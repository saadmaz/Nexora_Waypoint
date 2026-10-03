"""Plan versions: draft, edit, release (PRD v3 §12, §13).

Every action runs the rules in ``waypoint_rules`` and writes its state change with an ``audit_events`` row in the
same transaction. Order statuses move only through ``waypoint_rules.transition`` (via ``services.orders``).
Callers commit.

A *draft* is the planner's output or the dispatcher's saved moves; a *release* is a snapshot of the latest draft
under the next version number (v3 is released from the v2 draft), so the draft stays editable history.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules import (
    Impact,
    Move,
    Order,
    OrderEvent,
    Plan,
    RefData,
    Trip,
    check_plan,
    draft_plan,
    frees,
    impact_on_store,
    planned_clock,
    planned_fuel,
    trip_load,
    trip_minutes,
    validate_move,
)
from waypoint_rules.constraints import trip_brand
from waypoint_rules.schedule import next_operating_day
from waypoint_rules.vocab import Binding, DeferralType

from .. import clock
from ..errors import ApiError
from ..models import orders as order_models
from ..models import plans
from ..models.comms import Notice
from ..models.enums import AuditType, HistoryOutcome, NoticeTag, PlanState, ServerStatus
from . import audit
from . import orders as order_service
from . import planning_repo as repo
from .dispatch_model import DeferralRow, DispatchDay
from .plan_logic import after_move, gate, plan_of

SYSTEM_DRAFT = "System draft"
#: Orders in these statuses are still the planner's to place or defer.
PLANNABLE = ("confirmed", "planned", "deferred")


@dataclass(frozen=True, slots=True)
class DeferralSpec:
    """A deferral about to be written, from the planner, a dispatcher move, or a copy of an earlier version's."""

    order_id: str
    type: DeferralType
    binding: Binding | None
    reason_text: str
    impact: dict[str, object]
    frees: dict[str, object]
    next_run_date: date | None
    decided_by: str | None
    decided_at: datetime | None = None
    notice_sent_at: datetime | None = None
    notice_seen_at: datetime | None = None


# ---- rows <-> rules ---------------------------------------------------------


def spec_of(row: DeferralRow) -> DeferralSpec:
    return DeferralSpec(
        row.order_id, row.type, row.binding, row.reason_text, row.impact, row.frees, row.next_run_date,
        row.decided_by, row.decided_at, row.notice_sent_at, row.notice_seen_at,
    )


def _impact_dict(impact: Impact) -> dict[str, object]:
    return {
        "deferred_yesterday": impact.deferred_yesterday,
        "days_since_served": impact.days_since_served,
        "consequence": impact.consequence,
    }


def _next_run(db: Session, service_date: date) -> date:
    ops = repo.operating_days(db)
    if ops:
        return next_operating_day(service_date, ops)
    nxt = service_date + timedelta(days=1)
    return nxt + timedelta(days=1) if nxt.weekday() == 6 else nxt


def _decided_by(actor_name: str, now: datetime) -> str:
    return f"{actor_name} · {now:%H:%M}"


# ---- writing a version ------------------------------------------------------


def _write_version(
    db: Session, service_date: date, *, state: PlanState, note: str | None, actor: str, now: datetime
) -> plans.PlanVersion:
    version = plans.PlanVersion(
        service_date=service_date,
        number=repo.next_version_number(db, service_date),
        state=state,
        note=note,
        created_by=actor,
        created_at=repo.aware(now),
        released_at=repo.aware(now) if state is PlanState.RELEASED else None,
    )
    db.add(version)
    db.flush()
    return version


def _write_trips(db: Session, version: plans.PlanVersion, trips: list[Trip], orders: dict[str, Order], ref: RefData) -> None:
    for trip in sorted(trips, key=lambda t: (t.vehicle_id, t.trip_no)):
        if not trip.order_ids:
            continue
        vehicle = ref.vehicles[trip.vehicle_id]
        kg, m3 = trip_load(trip, orders)
        fuel = planned_fuel(trip, vehicle, orders, ref)
        first = ref.outlets[orders[trip.order_ids[0]].outlet_id]
        row = plans.Trip(
            plan_version_id=version.id,
            vehicle_id=trip.vehicle_id,
            trip_no=trip.trip_no,
            brand=trip_brand(trip, orders, ref) or first.brand,
            district=first.district,
            depart_at=repo.aware(trip.depart_at),
            minutes=trip_minutes(trip, orders, ref),
            kg=kg,
            m3=round(m3, 3),
            planned_km=fuel.km,
            planned_fuel_l=round(fuel.litres, 3),
        )
        db.add(row)
        db.flush()
        timing = planned_clock(trip, orders, ref)
        for i, oid in enumerate(trip.order_ids):
            stop = timing.stop_for_order(oid)
            db.add(
                plans.TripOrder(
                    trip_id=row.id,
                    order_id=oid,
                    seq=i + 1,
                    plan_version_id=version.id,
                    planned_arrival=repo.aware(stop.arrival) if stop else None,
                    planned_handling_start=repo.aware(stop.handling_start) if stop else None,
                    planned_handling_end=repo.aware(stop.handling_end) if stop else None,
                )
            )
    db.flush()


def _write_deferrals(db: Session, version: plans.PlanVersion, specs: list[DeferralSpec], now: datetime) -> None:
    for s in sorted(specs, key=lambda x: x.order_id):
        db.add(
            order_models.Deferral(
                order_id=s.order_id,
                plan_version_id=version.id,
                type=s.type,
                binding=s.binding,
                reason_text=s.reason_text,
                impact=s.impact,
                frees=s.frees,
                next_run_date=s.next_run_date,
                decided_by=s.decided_by,
                decided_by_user_id=audit.user_id_for(db, (s.decided_by or "").split(" · ")[0]),
                decided_at=repo.aware(s.decided_at) if s.decided_at else repo.aware(now),
                notice_sent_at=repo.aware(s.notice_sent_at) if s.notice_sent_at else None,
                notice_seen_at=repo.aware(s.notice_seen_at) if s.notice_seen_at else None,
            )
        )
    db.flush()


def _order_rows(db: Session, ids: set[str]) -> dict[str, order_models.Order]:
    if not ids:
        return {}
    return {o.id: o for o in db.scalars(select(order_models.Order).where(order_models.Order.id.in_(ids)))}


def _set_statuses(db: Session, placed: set[str], deferred: set[str], *, actor: str, version: int) -> None:
    """Order statuses follow the plan: on a trip is Planned, in the deferred pool is Deferred (R: state machine)."""
    rows = _order_rows(db, placed | deferred)
    for oid in sorted(placed):
        row = rows.get(oid)
        if row is None or row.status.value not in PLANNABLE:
            continue
        if row.status is ServerStatus.PLANNED:
            continue
        order_service.apply(db, row, OrderEvent.PLAN, actor=actor, commit=False, payload={"plan": version})
    for oid in sorted(deferred):
        row = rows.get(oid)
        # A stop can be deferred up to the moment it is delivered: Loaded and Departed may defer too (the lifecycle allows it).
        if row is None or row.status.value not in (*PLANNABLE, "loaded", "departed") or row.status is ServerStatus.DEFERRED:
            continue
        order_service.apply(db, row, OrderEvent.DEFER, actor=actor, commit=False, payload={"plan": version})


def sync_rerun_copies(db: Session, service_date: date, deferred: dict[str, date | None], *, now: datetime) -> None:
    """Each deferred order has a next-run copy: Confirmed for the next operating day, linked by ``deferred_from_order_id``.

    Idempotent. A copy whose order is no longer deferred is removed ("Wed re-run removed") while it is still untouched.
    """
    existing = {
        c.deferred_from_order_id: c
        for c in db.scalars(select(order_models.Order).where(order_models.Order.deferred_from_order_id.is_not(None)))
        if c.deferred_from_order_id is not None
    }
    rows = _order_rows(db, set(deferred) | {k for k in existing})
    for oid, next_run in sorted(deferred.items()):
        source = rows.get(oid)
        if source is None or next_run is None or oid in existing:
            continue
        db.add(
            order_models.Order(
                id=f"{oid}-R",
                outlet_id=source.outlet_id,
                service_date=next_run,
                temp=source.temp,
                units=source.units,
                weight_kg=source.weight_kg,
                volume_m3=source.volume_m3,
                status=ServerStatus.CONFIRMED,
                tags=[],
                received_at=repo.aware(now),
                placed_by="system",
                after_cutoff=False,
                deferred_from_order_id=oid,
                row_version=1,
            )
        )
    for source_id, copy_row in existing.items():
        src = rows.get(source_id)
        still = src is not None and src.service_date == service_date
        if still and source_id not in deferred and copy_row.status is ServerStatus.CONFIRMED:
            db.delete(copy_row)
    db.flush()


def _save_draft(
    db: Session,
    day: DispatchDay,
    plan: Plan,
    specs: list[DeferralSpec],
    *,
    note: str,
    actor: str,
    audit_type: AuditType,
    now: datetime,
) -> plans.PlanVersion:
    _validate_for_write(day, plan, specs)
    version = _write_version(db, day.service_date, state=PlanState.DRAFT, note=note, actor=actor, now=now)
    trips = [t for t in plan.trips.values() if t.order_ids]
    _write_trips(db, version, trips, day.orders, day.ref)
    _write_deferrals(db, version, specs, now)
    placed = {o for t in trips for o in t.order_ids}
    deferred = {s.order_id for s in specs}
    _set_statuses(db, placed, deferred, actor=actor, version=version.number)
    sync_rerun_copies(db, day.service_date, {s.order_id: s.next_run_date for s in specs}, now=now)
    audit.record(
        db,
        actor=actor,
        entity_type="plan",
        entity_id=str(version.id),
        type=audit_type,
        payload={"number": version.number, "serviceDate": day.service_date.isoformat(), "trips": len(trips), "served": len(placed), "deferred": len(deferred)},
        at=repo.aware(now),
    )
    db.flush()
    return version


def _validate_for_write(day: DispatchDay, plan: Plan, specs: list[DeferralSpec]) -> None:
    """Fail before any version/trip/status/audit mutation; database constraints remain the final safety net."""
    expected = day.plannable | {oid for trip in plan.trips.values() for oid in trip.order_ids} | set(plan.deferred)
    pool = {oid: order for oid, order in day.orders.items() if oid in expected}
    reasons = {spec.order_id: (spec.type, spec.reason_text) for spec in specs}
    violations = check_plan(plan, pool, day.ref, day.vehicle_days, deferral_reasons=reasons)
    if plan.service_date != day.service_date:
        raise ApiError(409, "invalid_plan", "Plan service date does not match the input day")
    if len(reasons) != len(specs) or violations:
        raise ApiError(409, "invalid_plan", "Plan validation failed before persistence",
                       [v.message for v in violations] or ["Duplicate deferral records"])


# ---- the system draft -------------------------------------------------------


def draft(
    db: Session, service_date: date, *, actor: str = "system", actor_name: str = SYSTEM_DRAFT, note: str | None = None
) -> plans.PlanVersion:
    """Run the planner on the day's closed queue and save the result as the next draft (v1 at 16:05, or Redraft)."""
    now = clock.now(db).replace(tzinfo=None)
    latest = repo.latest_version(db, service_date)
    if latest is not None and latest.state is PlanState.RELEASED:
        raise ApiError(409, "already_released", f"Plan v{latest.number} is released. Changes now happen in Live and create a new version.")
    ops = repo.operating_days(db)
    pool = repo.day_orders(db, service_date, ops, statuses=PLANNABLE)
    if not pool:
        raise ApiError(409, "not_ready", "There are no confirmed orders to plan yet.")
    started = repo.day_orders(db, service_date, ops, statuses=("loaded", "departed", "delivered", "partial", "issue", "conflict"))
    if started:
        raise ApiError(409, "run_started", "Loading has started, so the plan can no longer be redrafted.")
    ref = repo.load_ref(db)
    vdays, _avail = repo.vehicle_days(db, service_date)
    result = draft_plan(pool, ref, vdays, service_date=service_date, operating_days=ops)

    day = repo.load_day(db, service_date, now)
    name = actor_name
    specs = [
        DeferralSpec(
            d.order_id, d.type, d.binding, d.reason_text, _impact_dict(d.impact),
            {"kg": d.frees.kg, "m3": d.frees.m3, "minutes": d.frees.minutes}, d.next_run_date, _decided_by(name, now), now,
        )
        for d in result.deferrals
    ]
    plan = result.as_plan()
    return _save_draft(
        db, day, plan, specs, note=note or "System draft from the closed queue", actor=name, audit_type=AuditType.PLAN_DRAFTED, now=now
    )


# ---- dispatcher edits -------------------------------------------------------


def _require_open_draft(day: DispatchDay) -> None:
    latest = day.latest
    if latest is None:
        raise ApiError(409, "not_ready", "There is no plan yet. The first draft appears at 16:05.")
    if latest.state is PlanState.RELEASED:
        raise ApiError(409, "read_only", f"Plan v{latest.number} is released. Changes now happen in Live and create a new version.")


def save_moves(
    db: Session,
    service_date: date,
    moves: list[tuple[str, tuple[str, int] | None]],
    *,
    note: str | None,
    actor: str,
    actor_name: str,
    skip_refused: bool = False,
) -> plans.PlanVersion:
    """Validate each move in turn and save the accepted result as the next draft.

    A refused move stops the save with a 409 that names every rule it breaks. With ``skip_refused`` (the scripted
    evening adjustments) a refused move is logged and skipped instead, and the rest are saved.
    """
    now = clock.now(db).replace(tzinfo=None)
    day = repo.load_day(db, service_date, now)
    _require_open_draft(day)
    plan = plan_of(day)
    specs = {d.order_id: spec_of(d) for d in day.deferrals}
    ref = day.ref
    next_run = _next_run(db, service_date)

    for order_id, to in moves:
        if order_id not in day.orders:
            raise ApiError(404, "not_found", f"Order {order_id} was not found")
        move = Move(order_id, to)
        result = validate_move(plan, move, day.orders, ref, day.vehicle_days)
        if not result.ok:
            audit.record(
                db, actor=actor, entity_type="order", entity_id=order_id, type=AuditType.MOVE_REFUSED,
                payload={"to": list(to) if to else None, "violations": [v.message for v in result.violations]}, at=repo.aware(now),
            )
            if skip_refused:
                continue
            db.commit()
            raise ApiError(
                409,
                "illegal_move",
                " ".join(v.message for v in result.violations),
                [{"rule": v.rule.value, "message": v.message} for v in result.violations],
            )
        plan = after_move(plan, move, day.orders, result)
        audit.record(
            db, actor=actor, entity_type="order", entity_id=order_id, type=AuditType.MOVE_ACCEPTED,
            payload={"to": list(to) if to else None}, at=repo.aware(now),
        )
        if to is None:
            order = day.orders[order_id]
            specs[order_id] = DeferralSpec(
                order_id, DeferralType.POLICY, None, f"Deferred by {actor_name}", _impact_dict(impact_on_store(order, ref)),
                {"kg": frees(order, ref).kg, "m3": frees(order, ref).m3, "minutes": frees(order, ref).minutes},
                next_run, _decided_by(actor_name, now), now,
            )
        else:
            specs.pop(order_id, None)

    keep = [s for oid, s in specs.items() if oid in plan.deferred]
    return _save_draft(
        db, day, plan, keep, note=note or f"{actor_name}'s adjustments", actor=actor_name, audit_type=AuditType.PLAN_DRAFTED, now=now
    )


# ---- release ----------------------------------------------------------------


def store_deferral_notice(
    db: Session, *, order_id: str, outlet_id: str, reason: str, next_run: date | None, version: int, now: datetime
) -> None:
    """Tell a store its order is deferred: the reason and the next run (S4 "Deferral")."""
    label = f"{next_run:%a} {next_run.day} {next_run:%b}" if next_run else "the next run"
    db.add(
        Notice(
            audience_kind="store", outlet_id=outlet_id,
            tag=NoticeTag.DEFERRAL,
            title=f"Order {order_id} is deferred",
            body=f"{reason} Next run {label}.",
            link={"screen": "deliveries", "orderId": order_id},
            refs={"orderIds": [order_id], "planVersion": version},
            created_at=repo.aware(now),
        )
    )


def _store_notice(db: Session, d: DeferralRow, day: DispatchDay, version: int, now: datetime) -> None:
    store_deferral_notice(
        db, order_id=d.order_id, outlet_id=day.orders[d.order_id].outlet_id, reason=d.reason_text,
        next_run=d.next_run_date, version=version, now=now,
    )


def release_change(
    db: Session,
    day: DispatchDay,
    plan: Plan,
    specs: list[DeferralSpec],
    *,
    note: str,
    actor: str,
    actor_name: str,
    now: datetime,
) -> plans.PlanVersion:
    """Save ``plan`` as the next version and release it at once (a swap at the dock, a store request on the road).

    Unlike ``release``, which snapshots a draft the dispatcher has reviewed, this writes the change and locks it in one
    step: the dispatcher's decision is the review. Order statuses, next-run copies, the continuity history and the audit
    row follow, exactly as they do for a release. Notices are the caller's, because each change tells different people.
    """
    _validate_for_write(day, plan, specs)
    version = _write_version(db, day.service_date, state=PlanState.RELEASED, note=note, actor=actor_name, now=now)
    trips = [t for t in plan.trips.values() if t.order_ids]
    _write_trips(db, version, trips, day.orders, day.ref)
    _write_deferrals(db, version, specs, now)
    placed = {o for t in trips for o in t.order_ids}
    deferred = {s.order_id for s in specs}
    _set_statuses(db, placed, deferred, actor=actor_name, version=version.number)
    sync_rerun_copies(db, day.service_date, {s.order_id: s.next_run_date for s in specs}, now=now)
    # Once per outlet: two orders at one stop share one history row.
    for outlet_id in sorted({day.orders[spec.order_id].outlet_id for spec in specs}):
        db.merge(order_models.OutletServiceHistory(outlet_id=outlet_id, service_date=day.service_date, outcome=HistoryOutcome.DEFERRED))
    audit.record(
        db, actor=actor, entity_type="plan", entity_id=str(version.id), type=AuditType.PLAN_RELEASED,
        payload={"number": version.number, "serviceDate": day.service_date.isoformat(), "trips": len(trips), "deferred": len(deferred), "note": note},
        at=repo.aware(now),
    )
    db.flush()
    return version


def release(db: Session, service_date: date, *, send_notices: bool, actor: str, actor_name: str) -> plans.PlanVersion:
    """Lock the latest draft as released, in place, and tell the docks, the drivers and (optionally) the stores.

    The version the dispatcher reviewed is the version that goes out, with the same number: "Release plan v3" releases
    v3. The scenario's 23:30 job writes that v3 draft ("ready to release"); releasing earlier simply releases the draft
    that exists. A released version is never edited again: later changes create the next number.
    """
    now = clock.now(db).replace(tzinfo=None)
    day = repo.load_day(db, service_date, now)
    if day.latest is None:
        raise ApiError(409, "not_ready", "There is no plan to release yet. The first draft appears at 16:05.")
    if day.latest.state is PlanState.RELEASED:
        raise ApiError(409, "already_released", "This plan is already released.")
    failed = [text for text, ok in gate(day) if not ok]
    if failed:
        raise ApiError(409, "gate_blocked", "The plan can't be released yet: " + "; ".join(failed), failed)

    _validate_for_write(day, plan_of(day), [spec_of(d) for d in day.deferrals])

    version = db.get(plans.PlanVersion, day.latest.id)
    assert version is not None
    trips = [t for t in plan_of(day).trips.values() if t.order_ids]
    version.state = PlanState.RELEASED
    version.released_at = repo.aware(now)
    version.note = _scope(day)
    version.created_by = actor_name

    if send_notices:
        sent = {d.id: d for d in day.deferrals if d.notice_sent_at is None}
        for row in db.scalars(select(order_models.Deferral).where(order_models.Deferral.plan_version_id == version.id, order_models.Deferral.withdrawn_at.is_(None))):
            if row.id in sent:
                row.notice_sent_at = repo.aware(now)
                _store_notice(db, sent[row.id], day, version.number, now)

    # The docks and the drivers always hear about a released plan.
    for depot in sorted({day.ref.vehicles[t.vehicle_id].depot for t in trips}):
        db.add(
            Notice(
                audience_kind="dock", depot_id=depot, tag=NoticeTag.PLAN, title=f"Plan v{version.number} released",
                body=f"{sum(1 for t in trips if day.ref.vehicles[t.vehicle_id].depot == depot)} trips for {service_date:%a %d %b}.",
                link={"screen": "plan"}, refs={"planVersion": version.number}, created_at=repo.aware(now),
            )
        )
    for trip in sorted(trips, key=lambda t: (t.vehicle_id, t.trip_no)):
        db.add(
            Notice(
                audience_kind="driver", vehicle_id=trip.vehicle_id, tag=NoticeTag.PLAN, title=f"Plan v{version.number} released",
                body=f"Trip {trip.trip_no} departs {trip.depart_at:%H:%M} with {len(trip.order_ids)} orders.",
                link={"screen": "run"}, refs={"planVersion": version.number, "trip": trip.trip_no}, created_at=repo.aware(now),
            )
        )

    # An outlet whose order is deferred was skipped today: the continuity guard protects it next run.
    for outlet_id in sorted({day.orders[d.order_id].outlet_id for d in day.deferrals}):
        db.merge(order_models.OutletServiceHistory(outlet_id=outlet_id, service_date=service_date, outcome=HistoryOutcome.DEFERRED))
    audit.record(
        db, actor=actor, entity_type="plan", entity_id=str(version.id), type=AuditType.PLAN_RELEASED,
        payload={"number": version.number, "serviceDate": service_date.isoformat(), "trips": len(trips), "deferred": len(day.deferrals), "noticesSent": send_notices},
        at=repo.aware(now),
    )
    db.flush()
    return version


def _scope(day: DispatchDay) -> str:
    """Which depots a version covers, Peliyagoda first: "Peliyagoda + Kandy"."""
    present = {day.ref.vehicles[t.vehicle_id].depot for t in day.trips}
    return " + ".join(d.title() for d in ("peliyagoda", "kandy") if d in present) or "No trips"


def notify_deferrals(db: Session, service_date: date, depot: str, *, actor: str) -> int:
    """Send the store notice for every deferral at ``depot`` that has not been sent yet. Returns how many went out."""
    now = clock.now(db).replace(tzinfo=None)
    day = repo.load_day(db, service_date, now)
    if day.latest is None:
        raise ApiError(409, "not_ready", "There is no plan yet, so there is nothing to tell the stores.")
    sent = 0
    rows = {d.id: d for d in db.scalars(select(order_models.Deferral).where(order_models.Deferral.plan_version_id == day.latest.id, order_models.Deferral.withdrawn_at.is_(None)))}
    for d in day.deferrals:
        if day.depot_of(d.order_id) != depot or d.notice_sent_at is not None:
            continue
        _store_notice(db, d, day, day.latest.number, now)
        rows[d.id].notice_sent_at = repo.aware(now)
        audit.record(db, actor=actor, entity_type="order", entity_id=d.order_id, type=AuditType.ORDER_DEFERRED, payload={"notice": "sent"}, at=repo.aware(now))
        sent += 1
    db.flush()
    return sent
