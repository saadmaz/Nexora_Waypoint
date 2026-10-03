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

from ..config import get_settings
from ..errors import ApiError
from ..models import field as f
from ..models.enums import AttachmentKind
from ..schemas.sync import AttachmentOut

#: Photos are compressed on the phone to a 1600 px longest edge; anything near this is not a POD photo.
MAX_BYTES = 15 * 1024 * 1024
_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


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


def upload(db: Session, client_id: uuid.UUID, kind: AttachmentKind, mime: str | None, source: BinaryIO) -> AttachmentOut:
    existing = db.get(f.Attachment, client_id)
    if existing is not None:
        return _out(existing, duplicate=True)
    content_type = (mime or "application/octet-stream").split(";")[0].strip().lower()
    name = f"{client_id}{_EXT.get(content_type, '.bin')}"
    size = _write(get_settings().uploads_dir, name, source)
    if size == 0:
        (get_settings().uploads_dir / name).unlink(missing_ok=True)
        raise ApiError(422, "empty_file", "The attachment is empty")
    owner = db.scalars(select(f.DeviceRecord.client_id).where(f.DeviceRecord.payload.contains({"blobIds": [str(client_id)]})).limit(1)).first()
    row = f.Attachment(id=client_id, device_record_id=owner, kind=kind, path=name, mime=content_type, bytes=size)
    db.add(row)
    db.flush()
    return _out(row, duplicate=False)
