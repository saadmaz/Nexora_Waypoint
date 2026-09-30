"""``POST /sync`` and ``POST /attachments`` (PRD §19). Idempotent by ``clientId``: a replay returns ``duplicate``."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from ..models.enums import AttachmentKind, DeviceRecordType, SyncResultKind
from .base import ApiModel


class SyncRecordIn(ApiModel):
    client_id: uuid.UUID
    type: DeviceRecordType
    payload: dict = Field(default_factory=dict)
    device_time: datetime
    plan_version_on_device: int | None = None
    #: The driver or the PIN person.
    actor: str | None = None
    blob_ids: list[uuid.UUID] = Field(default_factory=list)


class SyncIn(ApiModel):
    device_id: str
    records: list[SyncRecordIn] = Field(min_length=1)


class SyncResultOut(ApiModel):
    client_id: uuid.UUID
    result: SyncResultKind
    reason: str | None = None
    conflict_id: int | None = None
    server_payload: dict | None = None


class SyncOut(ApiModel):
    results: list[SyncResultOut]


class AttachmentOut(ApiModel):
    id: uuid.UUID
    kind: AttachmentKind
    mime: str
    bytes: int
    #: True when this ``clientId`` was already stored.
    duplicate: bool = False
