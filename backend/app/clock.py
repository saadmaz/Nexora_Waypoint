"""The scenario clock (PRD §13). Business code asks ``now(db)``; nothing else calls ``datetime.now()``.

One row in ``clock``. ``advance`` only moves forward; ``reset`` returns to the checkpoint.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from .config import COLOMBO, get_settings
from .errors import ApiError
from .models.comms import Clock


def _row(db: Session) -> Clock:
    row = db.get(Clock, 1)
    if row is None:
        # First use on an empty database: start at the scenario checkpoint (A38).
        start = get_settings().scenario_start
        row = Clock(id=1, scenario_now=start, checkpoint=start, updated_at=start)
        db.add(row)
        db.flush()
    return row


def now(db: Session) -> datetime:
    """Scenario time, timezone-aware, in Asia/Colombo."""
    return _row(db).scenario_now.astimezone(COLOMBO)


def checkpoint(db: Session) -> datetime:
    return _row(db).checkpoint.astimezone(COLOMBO)


def _aware(value: datetime) -> datetime:
    """A naive time from a client means Asia/Colombo, never the server's zone."""
    return value.replace(tzinfo=COLOMBO) if value.tzinfo is None else value


def advance(db: Session, to: datetime, *, actor: str = "system") -> datetime:
    """Move the clock forward to ``to``. Refuses to go backwards; staying put is allowed."""
    from .models.enums import AuditType
    from .services import audit

    row = _row(db)
    target = _aware(to).astimezone(UTC)
    current = row.scenario_now
    if target < current:
        raise ApiError(
            409,
            "clock_backwards",
            "The clock only moves forward. Use Reset demo to start again.",
            {"now": current.astimezone(COLOMBO).isoformat(), "requested": target.astimezone(COLOMBO).isoformat()},
        )
    row.scenario_now = target
    row.updated_at = target
    audit.record(
        db,
        actor=actor,
        entity_type="clock",
        entity_id="1",
        type=AuditType.CLOCK_ADVANCED,
        payload={"from": current.astimezone(COLOMBO).isoformat(), "to": target.astimezone(COLOMBO).isoformat()},
        at=target,
    )
    db.flush()
    return target.astimezone(COLOMBO)


def set_to_checkpoint(db: Session) -> datetime:
    """Used by the demo reset (and the seed): back to the scenario checkpoint."""
    row = _row(db)
    row.scenario_now = row.checkpoint
    row.updated_at = row.checkpoint
    db.flush()
    return row.scenario_now.astimezone(COLOMBO)
