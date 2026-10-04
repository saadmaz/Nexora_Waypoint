"""Jobs the scenario clock runs (PRD §13).

``clock.advance`` calls :func:`run_due` in the same transaction, so the clock, the jobs' state changes and their
audit rows land together. The API process also calls it on a timer (``main.py``), so jobs run when the ticking clock
crosses their time. Each job is claimed in ``job_runs`` (a unique key), so a restart, a second worker or a replay
cannot run it twice, and several jobs that fall due together run in time order. Nothing here waits for a person: the
judge's own actions (release at 23:40, the swap at 03:00) are API calls, never jobs.

    16:00  cutoff       Ordered becomes Confirmed, and each store is told
    16:05  draft        the planner writes v1 from the closed queue
    scripted events     the ``scenario_events`` table, in time order: Kumari's 21:15 adjustments (v2), VEH036 back
                        from the workshop at 02:45. Kinds this module does not know yet are left for their owner.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from waypoint_rules import OrderEvent

from .models.comms import JobRun, Notice, ScenarioEvent
from .models.enums import AuditType, Availability, NoticeTag, PlanState, ServerStatus
from .models.orders import Order
from .models.plans import VehicleDayStatus
from .services import audit, planning
from .services import orders as order_service
from .services import planning_repo as repo

DRAFT_DELAY = timedelta(minutes=5)
SYSTEM = "system"


cutoff_at = repo.cutoff_at


def _claim(db: Session, key: str, at: datetime) -> bool:
    """Record that a job is running. False if it already ran: a unique key, so only one caller wins."""
    won = db.execute(
        pg_insert(JobRun)
        .values(key=key, ran_at=repo.aware(at))
        .on_conflict_do_nothing(index_elements=[JobRun.key])
        .returning(JobRun.key)
    ).first()
    return won is not None


def _close_queue(db: Session, service_date: date, now: datetime) -> int:
    """Ordered becomes Confirmed for one service date, and each order's store is told."""
    closed = 0
    rows = db.scalars(
        select(Order)
        .where(Order.service_date == service_date, Order.status == ServerStatus.ORDERED, Order.cancelled_at.is_(None))
        .order_by(Order.id)
    )
    for order in rows:
        order_service.apply(db, order, OrderEvent.CUTOFF, actor=SYSTEM, commit=False)
        db.add(
            Notice(
                audience_kind="store", outlet_id=order.outlet_id,
                tag=NoticeTag.ORDER,
                title="Your order is confirmed",
                body=f"{order.id} is in the closed queue for {service_date:%a} {service_date.day} {service_date:%b}.",
                link={"screen": "deliveries", "orderId": order.id},
                refs={"orderIds": [order.id]},
                created_at=repo.aware(now),
            )
        )
        closed += 1
    db.flush()
    return closed




# ---- scripted events --------------------------------------------------------

Handler = Callable[[Session, ScenarioEvent, datetime, list[date]], None]


def _save_scripted_draft(db: Session, event: ScenarioEvent, now: datetime, ops: list[date], note: str) -> None:
    """Save the scripted moves (possibly none) as the next draft. A plan that is already released is left alone."""
    service_date = repo.active_service_date(now, ops)
    latest = repo.latest_version(db, service_date)
    if latest is None or latest.state is PlanState.RELEASED:
        return
    moves: list[tuple[str, tuple[str, int] | None, str | None]] = []
    for m in (event.payload or {}).get("moves", []):
        to = m.get("to")
        moves.append((m["orderId"], None if to in (None, "deferred") else (to["vehicleId"], int(to["trip"])), m.get("reason")))
    planning.save_moves(db, service_date, moves, note=note, actor=SYSTEM, actor_name="Kumari", skip_refused=True)


def _evening_adjustments(db: Session, event: ScenarioEvent, now: datetime, ops: list[date]) -> None:
    """Kumari's adjustments after the capacity review, saved as the next draft (v2). A refused move is skipped and logged."""
    _save_scripted_draft(db, event, now, ops, "Kumari's adjustments after the capacity review")


def _final_draft(db: Session, event: ScenarioEvent, now: datetime, ops: list[date]) -> None:
    """The draft Kumari releases (v3): both depots, ready to release at 23:30 (the release itself is hers, at 23:40)."""
    _save_scripted_draft(db, event, now, ops, "Peliyagoda + Kandy · ready to release")


def _vehicle_available(db: Session, event: ScenarioEvent, now: datetime, ops: list[date]) -> None:
    """A vehicle back from the workshop: it can be used from now on (VEH036 at 02:45)."""
    service_date = repo.active_service_date(now, ops)
    vehicle = str((event.payload or {}).get("vehicle"))
    row = db.get(VehicleDayStatus, (vehicle, service_date))
    if row is None:
        return
    row.availability = Availability.AVAILABLE
    audit.record(
        db, actor=SYSTEM, entity_type="vehicle", entity_id=vehicle, type=AuditType.CLOCK_ADVANCED,
        payload={"event": "vehicle_available", "serviceDate": service_date.isoformat()}, at=repo.aware(now),
    )


HANDLERS: dict[str, Handler] = {
    "evening_adjustments": _evening_adjustments,
    "final_draft": _final_draft,
    "vehicle_available": _vehicle_available,
}


def run_due(db: Session, start: datetime, end: datetime) -> list[str]:
    """Everything the clock owes up to ``end`` (naive Asia/Colombo), once each, in time order. Returns what ran.

    ``start`` only guards against an empty window: what ran before is decided by ``job_runs``, not by the window, so the
    timer can call this every few seconds and a jump over several job times runs them in the order they fell due.
    """
    ran: list[str] = []
    if end <= start:
        return ran
    ops = repo.operating_days(db)
    # (due time, order within a time, key, runner). The cutoff comes before the draft of the same minute.
    schedule: list[tuple[datetime, int, str, Callable[[], str | None]]] = []

    dates = set(
        db.scalars(
            select(Order.service_date).where(
                Order.status.in_([ServerStatus.ORDERED, ServerStatus.CONFIRMED]), Order.cancelled_at.is_(None)
            )
        )
    )
    for service_date in sorted(dates):
        cutoff = cutoff_at(service_date, ops)
        if cutoff <= end:
            schedule.append((cutoff, 0, f"cutoff:{service_date.isoformat()}", lambda d=service_date, t=cutoff: _run_cutoff(db, d, t)))
        if cutoff + DRAFT_DELAY <= end:
            schedule.append(
                (cutoff + DRAFT_DELAY, 1, f"draft:{service_date.isoformat()}", lambda d=service_date: _run_draft(db, d))
            )

    events = db.scalars(
        select(ScenarioEvent)
        .where(ScenarioEvent.applied_at.is_(None), ScenarioEvent.at <= repo.aware(end))
        .order_by(ScenarioEvent.at, ScenarioEvent.id)
    )
    for event in events:
        if event.kind not in HANDLERS:
            continue  # another owner's event kind: leave it unapplied until its handler exists
        at = repo.naive(event.at) or end
        schedule.append((at, 2, f"event:{event.id}", lambda e=event, t=at: _run_event(db, e, t, ops)))

    for due_at, _, key, runner in sorted(schedule, key=lambda item: (item[0], item[1], item[2])):
        if not _claim(db, key, due_at):
            continue
        label = runner()
        if label:
            ran.append(label)
    db.flush()
    return ran


def _run_cutoff(db: Session, service_date: date, at: datetime) -> str | None:
    return "cutoff" if _close_queue(db, service_date, at) else None


def _run_draft(db: Session, service_date: date) -> str | None:
    if repo.latest_version(db, service_date) is not None:
        return None
    if not db.scalar(
        select(Order.id).where(Order.service_date == service_date, Order.status == ServerStatus.CONFIRMED, Order.cancelled_at.is_(None)).limit(1)
    ):
        return None
    planning.draft(db, service_date, actor=SYSTEM)
    return f"draft {service_date.isoformat()}"


def _run_event(db: Session, event: ScenarioEvent, at: datetime, ops: list[date]) -> str | None:
    HANDLERS[event.kind](db, event, at, ops)
    event.applied_at = repo.aware(at)
    return event.kind
