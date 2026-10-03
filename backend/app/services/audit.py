"""Append-only audit log. Every state change writes a row in the same transaction (PRD §9 principle 3)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import clock
from ..models.comms import AuditEvent
from ..models.enums import AuditType
from ..models.people import PinPerson, User


def user_id_for(db: Session, actor: str | None) -> int | None:
    """Resolve an existing account only; system actions deliberately have no account FK."""
    if not actor:
        return None
    ids = list(db.scalars(select(User.id).where(or_(User.email == actor, User.display_name == actor))))
    return ids[0] if len(ids) == 1 else None


def record(
    db: Session,
    *,
    actor: str,
    entity_type: str,
    entity_id: str,
    type: AuditType,
    payload: dict[str, Any] | None = None,
    at: datetime | None = None,
    actor_user_id: int | None = None,
    actor_pin_id: int | None = None,
) -> AuditEvent:
    """Add an audit row to the caller's session. The caller commits, so the state change and its row land together."""
    row = AuditEvent(
        at=at if at is not None else clock.now(db),
        actor=actor,
        actor_user_id=actor_user_id if actor_user_id is not None else user_id_for(db, actor),
        actor_pin_id=actor_pin_id if actor_pin_id is not None else db.scalar(select(PinPerson.id).where(PinPerson.name == actor)),
        order_id=entity_id if entity_type == "order" else None,
        entity_type=entity_type,
        entity_id=entity_id,
        type=type,
        payload=payload or {},
    )
    db.add(row)
    return row
