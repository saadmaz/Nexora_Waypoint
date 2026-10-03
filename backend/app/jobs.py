"""Jobs the scenario clock runs (PRD §13).

``clock.advance`` calls :func:`run_due` in the same transaction, so the clock, the jobs' state changes and their
audit rows land together. Each job is idempotent: the cutoff and the draft look at the state they would create, and
the scripted events carry an ``applied_at`` marker. Nothing here waits for a person: the judge's own actions (release at
23:40, the swap at 03:00) are API calls, never jobs.

    16:00  cutoff       Ordered becomes Confirmed, and each store is told
    16:05  draft        the planner writes v1 from the closed queue
    scripted events     the ``scenario_events`` table, in time order: Kumari's 21:15 adjustments (v2), VEH036 back
                        from the workshop at 02:45. Kinds this module does not know yet are left for their owner.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules import OrderEvent

from .models.comms import Notice, ScenarioEvent
from .models.enums import AuditType, Availability, NoticeTag, PlanState, ServerStatus
from .models.orders import Order
from .models.plans import VehicleDayStatus
from .services import audit, planning
from .services import orders as order_service
from .services import planning_repo as repo

DRAFT_DELAY = timedelta(minutes=5)
SYSTEM = "system"


cutoff_at = repo.cutoff_at


def _close_queues(db: Session, now: datetime, ops: list[date]) -> int:
    """Ordered becomes Confirmed for every service date whose cutoff has passed, and each order's store is told."""
    dates = set(db.scalars(select(Order.service_date).where(Order.status == ServerStatus.ORDERED, Order.cancelled_at.is_(None))))
    closed = 0
    for service_date in sorted(dates):
        if cutoff_at(service_date, ops) > now:
            continue
        rows = db.scalars(
            select(Order)
            .where(Order.service_date == service_date, Order.status == ServerStatus.ORDERED, Order.cancelled_at.is_(None))
            .order_by(Order.id)
        )
        for order in rows:
            order_service.apply(db, order, OrderEvent.CUTOFF, actor=SYSTEM, commit=False)
            db.add(
                Notice(
                    audience=f"store:{order.outlet_id}",
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


def _draft_due(db: Session, now: datetime, ops: list[date]) -> list[date]:
    """Service dates with a closed queue and no plan yet, five minutes after their cutoff."""
    dates = set(db.scalars(select(Order.service_date).where(Order.status == ServerStatus.CONFIRMED, Order.cancelled_at.is_(None))))
    due: list[date] = []
    for service_date in sorted(dates):
        if cutoff_at(service_date, ops) + DRAFT_DELAY > now:
            continue
        if repo.latest_version(db, service_date) is None:
            due.append(service_date)
    return due


# ---- scripted events --------------------------------------------------------

Handler = Callable[[Session, ScenarioEvent, datetime, list[date]], None]


def _save_scripted_draft(db: Session, event: ScenarioEvent, now: datetime, ops: list[date], note: str) -> None:
    """Save the scripted moves (possibly none) as the next draft. A plan that is already released is left alone."""
    service_date = repo.active_service_date(now, ops)
    latest = repo.latest_version(db, service_date)
    if latest is None or latest.state is PlanState.RELEASED:
        return
    moves: list[tuple[str, tuple[str, int] | None]] = []
    for m in (event.payload or {}).get("moves", []):
        to = m.get("to")
        moves.append((m["orderId"], None if to in (None, "deferred") else (to["vehicleId"], int(to["trip"]))))
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


def _scripted(db: Session, now: datetime, ops: list[date]) -> list[str]:
    ran: list[str] = []
    due = db.scalars(
        select(ScenarioEvent).where(ScenarioEvent.applied_at.is_(None), ScenarioEvent.at <= repo.aware(now)).order_by(ScenarioEvent.at, ScenarioEvent.id)
    )
    for event in due:
        handler = HANDLERS.get(event.kind)
        if handler is None:
            continue  # another owner's event kind: leave it unapplied until its handler exists
        handler(db, event, now, ops)
        event.applied_at = repo.aware(now)
        ran.append(event.kind)
    db.flush()
    return ran


def run_due(db: Session, start: datetime, end: datetime) -> list[str]:
    """Everything the clock owes between ``start`` and ``end`` (naive Asia/Colombo), in order. Returns what ran."""
    ran: list[str] = []
    if end <= start:
        return ran
    ops = repo.operating_days(db)
    if _close_queues(db, end, ops):
        ran.append("cutoff")
    for service_date in _draft_due(db, end, ops):
        planning.draft(db, service_date, actor=SYSTEM)
        ran.append(f"draft {service_date.isoformat()}")
    ran.extend(_scripted(db, end, ops))
    return ran
