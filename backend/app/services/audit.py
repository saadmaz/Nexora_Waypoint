"""Append-only audit log. Every state change writes a row in the same transaction (PRD §9 principle 3)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from .. import clock
from ..models.comms import AuditEvent
from ..models.enums import AuditType


def record(
    db: Session,
    *,
    actor: str,
    entity_type: str,
    entity_id: str,
    type: AuditType,
    payload: dict[str, Any] | None = None,
    at: datetime | None = None,
) -> AuditEvent:
    """Add an audit row to the caller's session. The caller commits, so the state change and its row land together."""
    row = AuditEvent(
        at=at if at is not None else clock.now(db),
        actor=actor,
        entity_type=entity_type,
        entity_id=entity_id,
        type=type,
        payload=payload or {},
    )
    db.add(row)
    return row
