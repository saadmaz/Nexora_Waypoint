"""``POST /attachments``: photos and signatures, uploaded after their records (PRD §15 Offline, §19).

The blob's own id (``clientId``) is the idempotency key and the row's id: a second upload of the same blob answers
``duplicate: true`` and writes nothing. Files live under ``settings.uploads_dir``, the ``uploads`` Docker volume. A blob is
tied to the device record whose ``payload.blobIds`` lists it; one that arrives first is tied when its record is synced.
Callers commit.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import BinaryIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules.vocab import Role

from ..config import get_settings
from ..deps import CurrentUser
from ..errors import ApiError, forbidden, not_found
from ..models import field as f
from ..models import orders as order_models
from ..models.enums import AttachmentKind
from ..schemas.sync import AttachmentOut

#: Photos are compressed on the phone to a 1600 px longest edge; anything near this is not a POD photo.
MAX_BYTES = 15 * 1024 * 1024
_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

#: The leading bytes each accepted type must start with. The multipart ``Content-Type`` is whatever the client typed,
#: so the stored type is decided by the bytes instead: a script sent as ``image/jpeg`` is refused, and the ``GET``
#: below serves the type recorded here, never one the uploader chose.
_MAGIC: tuple[tuple[bytes, str], ...] = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
)
#: WebP is ``RIFF....WEBP``: the size sits between the two marks, so it is matched on its own.
_RIFF, _WEBP = b"RIFF", b"WEBP"
#: Enough bytes to recognise any of the above.
_SNIFF = 16


def sniff(head: bytes) -> str | None:
    """The media type ``head`` actually is, or ``None`` when it is not an accepted image."""
    for magic, mime in _MAGIC:
        if head.startswith(magic):
            return mime
    if head[:4] == _RIFF and head[8:12] == _WEBP:
        return "image/webp"
    return None


class _Rewound:
    """``source`` with the sniffed head put back in front of it, so ``_write`` still sees the whole file."""

    def __init__(self, head: bytes, rest: BinaryIO):
        self._head = head
        self._rest = rest

    def read(self, size: int = -1) -> bytes:
        if not self._head:
            return self._rest.read(size)
        head, self._head = self._head, b""
        if size is None or size < 0:
            return head + self._rest.read()
        if len(head) >= size:
            self._head = head[size:]
            return head[:size]
        return head + self._rest.read(size - len(head))


def _out(row: f.Attachment, *, duplicate: bool) -> AttachmentOut:
    return AttachmentOut(id=row.id, kind=row.kind, mime=row.mime, bytes=row.bytes, duplicate=duplicate)


def _write(directory: Path, name: str, source: BinaryIO) -> int:
    """Copy ``source`` to ``directory/name`` through a temporary file, so a half-written photo is never left behind."""
    directory.mkdir(parents=True, exist_ok=True)
    final = directory / name
    partial = directory / f".{name}.part"
    size = 0
    try:
        with partial.open("wb") as out:
            while chunk := source.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise ApiError(413, "too_large", f"An attachment can be at most {MAX_BYTES // (1024 * 1024)} MB")
                out.write(chunk)
        os.replace(partial, final)
    finally:
        partial.unlink(missing_ok=True)
    return size


def path_of(row: f.Attachment) -> Path:
    """Where the blob is on disk. Built from the row's id, never from a caller's string, so no path can be traversed."""
    return get_settings().uploads_dir / row.path


def upload(db: Session, client_id: uuid.UUID, kind: AttachmentKind, mime: str | None, source: BinaryIO) -> AttachmentOut:
    existing = db.get(f.Attachment, client_id)
    if existing is not None:
        return _out(existing, duplicate=True)
    head = source.read(_SNIFF)
    content_type = sniff(head)
    if content_type is None:
        raise ApiError(415, "unsupported_media", "An attachment must be a JPEG, PNG or WebP image")
    source = _Rewound(head, source)
    name = f"{client_id}{_EXT[content_type]}"
    # Nothing empty reaches here: an empty body has no magic number, so ``sniff`` already refused it 415.
    size = _write(get_settings().uploads_dir, name, source)
    owner = db.scalars(select(f.DeviceRecord.client_id).where(f.DeviceRecord.payload.contains({"blobIds": [str(client_id)]})).limit(1)).first()
    row = f.Attachment(id=client_id, device_record_id=owner, kind=kind, path=name, mime=content_type, bytes=size)
    db.add(row)
    db.flush()
    return _out(row, duplicate=False)


# ---- reading one back ------------------------------------------------------------------


def _record_of(db: Session, row: f.Attachment) -> f.DeviceRecord | None:
    """The device record this blob belongs to. Set at upload when the record arrived first, else resolved now."""
    if row.device_record_id is not None:
        return db.get(f.DeviceRecord, row.device_record_id)
    return db.scalars(
        select(f.DeviceRecord).where(f.DeviceRecord.payload.contains({"blobIds": [str(row.id)]})).limit(1)
    ).first()


def _may_read(db: Session, user: CurrentUser, row: f.Attachment) -> bool:
    """Whether ``user`` may see this blob.

    A POD photo is evidence about one stop, so it is readable by the people that stop belongs to:

    - the dispatcher, who is unbound and reconciles every conflict;
    - the driver whose vehicle recorded it;
    - the store manager of the outlet it was taken at, or of one of the record's orders.

    An account bound to neither a vehicle nor an outlet, which is the shared dock tablet, reaches only the records its
    own user signed. A blob no record claims yet is readable only by the dispatcher: there is nothing else to scope it
    by, so the narrower answer is the safe one.
    """
    if user.role is Role.DISPATCHER:
        return True
    record = _record_of(db, row)
    if record is None:
        return False
    if user.vehicle_id is not None:
        return record.vehicle_id == user.vehicle_id
    if user.outlet_id is not None:
        return record.outlet_id == user.outlet_id or _has_order_of(db, record, user.outlet_id)
    # Unbound field account (the shared dock tablet): its own records only.
    return record.user_id == user.id


def _has_order_of(db: Session, record: f.DeviceRecord, outlet_id: str) -> bool:
    """Whether any of the record's orders belongs to ``outlet_id``, for a record that names orders but no outlet.

    Asked as a membership question, not "which outlet is this record's": a record can name orders from more than one
    outlet, and taking the first one would both let the wrong store in and keep the right one out.
    """
    ids = list(record.order_ids or [])
    if not ids:
        return False
    return db.scalar(
        select(order_models.Order.id)
        .where(order_models.Order.id.in_(ids), order_models.Order.outlet_id == outlet_id)
        .limit(1)
    ) is not None


def fetch(db: Session, user: CurrentUser, attachment_id: uuid.UUID) -> tuple[Path, f.Attachment]:
    """The blob's file and row, or 404 when it does not exist and 403 when it is not this caller's to see."""
    row = db.get(f.Attachment, attachment_id)
    if row is None:
        raise not_found("That attachment")
    if not _may_read(db, user, row):
        raise forbidden("That attachment isn't yours to open")
    path = path_of(row)
    if not path.is_file():
        # The row is in the database but the file is gone: a lost volume, not a bad request.
        raise ApiError(410, "attachment_gone", "That attachment is no longer stored")
    return path, row
