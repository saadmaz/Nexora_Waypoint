"""The scenario clock (PRD §13, DP-26). Business code asks ``now(db)``; nothing else calls ``datetime.now()``.

One row in ``clock`` holds an anchor (a scenario time and the wall time it was set) and a rate. Scenario time is
``anchor_scenario + (wall now - anchor_wall) * rate``: rate 1 is real time, 0 is paused. ``advance`` re-anchors forward
and keeps the rate; ``reset`` re-anchors at the checkpoint. :func:`wall_now` is the only read of the wall clock here.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from .config import COLOMBO, get_settings
from .errors import ApiError
from .models.comms import Clock


def wall_now() -> datetime:
    """The one place the backend reads real time. Tests patch this to move the wall clock."""
    return datetime.now(UTC)


def _row(db: Session) -> Clock:
    row = db.get(Clock, 1)
    if row is None:
        # First use on an empty database: start at the scenario checkpoint (A38).
        settings = get_settings()
        start = settings.scenario_start
        row = Clock(
            id=1, anchor_scenario=start, anchor_wall=wall_now(), rate=settings.clock_rate, checkpoint=start, updated_at=start
        )
        db.add(row)
        db.flush()
    return row


def _scenario_at(row: Clock, wall: datetime) -> datetime:
    return row.anchor_scenario + (wall - row.anchor_wall) * row.rate


def now(db: Session) -> datetime:
    """Scenario time, timezone-aware, in Asia/Colombo."""
    return _scenario_at(_row(db), wall_now()).astimezone(COLOMBO)


def rate(db: Session) -> float:
    return _row(db).rate


def checkpoint(db: Session) -> datetime:
    return _row(db).checkpoint.astimezone(COLOMBO)


def _aware(value: datetime) -> datetime:
    """A naive time from a client means Asia/Colombo, never the server's zone."""
    return value.replace(tzinfo=COLOMBO) if value.tzinfo is None else value


def _audit(db: Session, actor: str, payload: dict, at: datetime) -> None:
    from .models.enums import AuditType
    from .services import audit

    audit.record(db, actor=actor, entity_type="clock", entity_id="1", type=AuditType.CLOCK_ADVANCED, payload=payload, at=at)


def _reanchor(row: Clock, scenario: datetime, wall: datetime, new_rate: float | None = None) -> None:
    row.anchor_scenario = scenario
    row.anchor_wall = wall
    if new_rate is not None:
        row.rate = new_rate
    row.updated_at = scenario


def advance(db: Session, to: datetime, *, actor: str = "system") -> datetime:
    """Move the clock forward to ``to`` and keep its rate. Refuses to go backwards; staying put is allowed."""
    row = _row(db)
    wall = wall_now()
    target = _aware(to).astimezone(UTC)
    current = _scenario_at(row, wall)
    if target < current:
        raise ApiError(
            409,
            "clock_backwards",
            "The clock only moves forward. Use Reset demo to start again.",
            {"now": current.astimezone(COLOMBO).isoformat(), "requested": target.astimezone(COLOMBO).isoformat()},
        )
    _reanchor(row, target, wall)
    _audit(
        db, actor, {"from": current.astimezone(COLOMBO).isoformat(), "to": target.astimezone(COLOMBO).isoformat()}, target
    )
    db.flush()
    # The jobs the clock owes between the old time and the new one (cutoff, draft, scripted events), in the same transaction.
    from . import jobs

    jobs.run_due(db, current.astimezone(COLOMBO).replace(tzinfo=None), target.astimezone(COLOMBO).replace(tzinfo=None))
    return target.astimezone(COLOMBO)


def pause(db: Session, *, actor: str = "system") -> datetime:
    """Freeze scenario time where it is now. Jobs stop being due until it is resumed or advanced."""
    row = _row(db)
    wall = wall_now()
    current = _scenario_at(row, wall)
    if row.rate != 0:
        _reanchor(row, current, wall, 0.0)
        _audit(db, actor, {"event": "paused", "at": current.astimezone(COLOMBO).isoformat()}, current)
        db.flush()
    return current.astimezone(COLOMBO)


def resume(db: Session, *, actor: str = "system") -> datetime:
    """Let scenario time run again at the configured rate (real time if that is 0)."""
    row = _row(db)
    wall = wall_now()
    current = _scenario_at(row, wall)
    if row.rate == 0:
        configured = get_settings().clock_rate
        _reanchor(row, current, wall, configured if configured > 0 else 1.0)
        _audit(db, actor, {"event": "resumed", "rate": row.rate}, current)
        db.flush()
    return current.astimezone(COLOMBO)


def set_to_checkpoint(db: Session) -> datetime:
    """Used by the demo reset (and the seed): back to the scenario checkpoint, at the configured rate."""
    row = _row(db)
    _reanchor(row, row.checkpoint, wall_now(), get_settings().clock_rate)
    db.flush()
    return row.checkpoint.astimezone(COLOMBO)

