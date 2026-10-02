"""``POST /sync`` and ``POST /attachments`` (PRD §19). Owner: ``feature/offline-sync``."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile

from ..deps import Db, FieldUser
from ..errors import not_implemented
from ..models.enums import AttachmentKind
from ..schemas.sync import AttachmentOut, SyncIn, SyncOut

router = APIRouter(tags=["sync"])


@router.post("/sync", operation_id="sync", response_model=SyncOut)
def sync(body: SyncIn, db: Db, user: FieldUser) -> SyncOut:
    """One or many outbox records. Idempotent by ``clientId``: a replay returns ``duplicate``.

    Rules live in ``waypoint_rules.reconcile`` (PRD §19 reconciliation rule).
    """
    raise not_implemented("sync")


@router.post("/attachments", operation_id="uploadAttachment", response_model=AttachmentOut, status_code=201)
def upload_attachment(
    db: Db,
    user: FieldUser,
    client_id: Annotated[uuid.UUID, Form(alias="clientId")],
    file: Annotated[UploadFile, File()],
    kind: Annotated[AttachmentKind, Form()] = AttachmentKind.PHOTO,
) -> AttachmentOut:
    """A photo or signature (multipart). Idempotent by the blob's ``clientId``."""
    raise not_implemented("uploadAttachment")
