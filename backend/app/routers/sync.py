"""``POST /sync`` and ``POST /attachments`` (PRD §19). Owner: ``feature/offline-sync``."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse

from ..deps import AnyUser, Db, FieldUser
from ..models.enums import AttachmentKind
from ..schemas.sync import AttachmentOut, SyncIn, SyncOut
from ..services import attachments as attachment_service
from ..services import sync as sync_service

router = APIRouter(tags=["sync"])


@router.post("/sync", operation_id="sync", response_model=SyncOut)
def sync(body: SyncIn, db: Db, user: FieldUser) -> SyncOut:
    """One or many outbox records. Idempotent by ``clientId``: a replay returns ``duplicate``.

    Rules live in ``waypoint_rules.reconcile`` (PRD §19 reconciliation rule).
    """
    out = sync_service.sync(db, user, body)
    db.commit()
    return out


@router.post("/attachments", operation_id="uploadAttachment", response_model=AttachmentOut, status_code=201)
def upload_attachment(
    db: Db,
    user: FieldUser,
    client_id: Annotated[uuid.UUID, Form(alias="clientId")],
    file: Annotated[UploadFile, File()],
    kind: Annotated[AttachmentKind, Form()] = AttachmentKind.PHOTO,
) -> AttachmentOut:
    """A photo or signature (multipart). Idempotent by the blob's ``clientId``."""
    out = attachment_service.upload(db, client_id, kind, file.content_type, file.file)
    db.commit()
    return out


@router.get("/attachments/{attachment_id}", operation_id="getAttachment", response_class=FileResponse)
def get_attachment(db: Db, user: AnyUser, attachment_id: uuid.UUID) -> FileResponse:
    """One POD photo or signature, for the people its stop belongs to (``services.attachments._may_read``).

    Any signed-in role, because a delivery photo is evidence the store, the driver and the dispatcher all have a
    reason to see; which of them sees *this* one is decided by scope, not by role. The media type served is the one
    sniffed from the bytes at upload, so a blob cannot be served back as something a browser would execute.
    """
    path, row = attachment_service.fetch(db, user, attachment_id)
    return FileResponse(
        path,
        media_type=row.mime,
        headers={
            # Evidence should not be rendered inline by a browser that guesses a different type, and must not be
            # cached by a shared proxy: it is scoped per account.
            "Content-Disposition": f'inline; filename="{row.id}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=300",
        },
    )
