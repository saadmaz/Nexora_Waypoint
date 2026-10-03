"""D6.3: defer a stop after release (PRD v3 §16 step 8, handoff 5).

A store asks not to receive, or the dispatcher pulls a stop: the orders leave their trips, are deferred with the reason,
and the change is released as the next plan version at once. The driver, the dock and each store are told. A phone that is
out of coverage gets the change on its next sync, which is how the delivery it never heard about reaches D7 later.
Callers commit.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules import Violation, frees, impact_on_store, is_offline, validate_policy_action
from waypoint_rules.schedule import next_operating_day
from waypoint_rules.vocab import DeferralType, OrderStatus

from .. import clock
from ..errors import ApiError, not_found
from ..models import field, plans
from ..models import orders as order_models
from ..models.comms import Notice
from ..models.enums import NoticeTag, PlanState
from . import planning
from . import planning_repo as repo
from .dispatch_model import DispatchDay
from .plan_logic import plan_of
from .planning import DeferralSpec

#: Statuses a stop can still be deferred from: it has not been delivered, failed or settled.
DEFERRABLE = (OrderStatus.PLANNED, OrderStatus.LOADED, OrderStatus.DEPARTED)


def _statuses(db: Session, ids: list[str]) -> dict[str, OrderStatus]:
    rows = db.scalars(select(order_models.Order).where(order_models.Order.id.in_(ids)))
    return {o.id: OrderStatus(o.status.value) for o in rows}


def _offline_since(db: Session, day: DispatchDay, vehicles: set[str]) -> str | None:
    """"driver offline since 05:17" for the first vehicle of the stop that has gone quiet."""
    for vid in sorted(vehicles):
        run = db.scalars(
            select(field.Run).join(plans.Trip, plans.Trip.id == field.Run.trip_id).where(plans.Trip.vehicle_id == vid, field.Run.departed_at.is_not(None), field.Run.finished_at.is_(None)).order_by(field.Run.id.desc())
        ).first()
        heard = repo.naive(run.last_heard_at) if run else None
        if is_offline(heard, day.now, in_progress=run is not None):
            return f"{vid} driver offline since {heard:%H:%M}" if heard else None
    return None


def defer_stop(
    db: Session, order_ids: list[str], kind: DeferralType, reason: str, *, actor: str, actor_name: str
) -> tuple[int, list[str]]:
    """Defer ``order_ids`` and release the change. Returns the new plan number and the orders deferred."""
    now = clock.now(db).replace(tzinfo=None)
    service_date = repo.active_service_date(now, repo.operating_days(db))
    day = repo.load_day(db, service_date, now)
    if day.latest is None or day.latest.state is not PlanState.RELEASED:
        raise ApiError(409, "not_released", "Stops can be deferred once a plan is released.")
    if kind is DeferralType.CAPACITY:
        raise ApiError(409, "not_capacity", "A deferral for capacity is the planner's. Choose store request or policy.")

    plan = plan_of(day)
    already = {d.order_id for d in day.deferrals}
    statuses = _statuses(db, order_ids)
    violations: list[Violation] = []
    for oid in order_ids:
        if oid not in day.orders:
            raise not_found(f"Order {oid}")
        if oid in already:
            raise ApiError(409, "already_deferred", f"{oid} is already deferred in plan v{day.latest.number}.")
        if plan.trip_of_order(oid) is None:
            raise ApiError(409, "not_on_a_trip", f"{oid} is not on a trip in plan v{day.latest.number}.")
        if statuses.get(oid) not in DEFERRABLE:
            raise ApiError(409, "already_done", f"{oid} is {statuses.get(oid, OrderStatus.PLANNED).value}, so it can't be deferred now.")
        order = day.orders[oid]
        violations.extend(validate_policy_action(order, kind, day.ref, reason=reason.strip() or "Deferred by the dispatcher"))
    if violations:
        raise ApiError(409, "illegal_move", " ".join(v.message for v in violations), [{"rule": v.rule.value, "message": v.message} for v in violations])

    vehicles = {t.vehicle_id for t in plan.trips.values() if any(o in t.order_ids for o in order_ids)}
    for t in list(plan.trips.values()):
        t.order_ids = [o for o in t.order_ids if o not in order_ids]
        if not t.order_ids:
            del plan.trips[t.key]
    plan.deferred.extend(order_ids)

    ops = repo.operating_days(db)
    next_run = next_operating_day(service_date, ops) if ops else None
    by = f"{actor_name} · {now:%H:%M}"
    specs = [planning.spec_of(d) for d in day.deferrals]
    new_specs: list[DeferralSpec] = []
    for oid in order_ids:
        order = day.orders[oid]
        impact, freed = impact_on_store(order, day.ref), frees(order, day.ref)
        new_specs.append(
            DeferralSpec(
                oid, kind, None, reason.strip() or "Deferred by the dispatcher",
                {"deferred_yesterday": impact.deferred_yesterday, "days_since_served": impact.days_since_served, "consequence": impact.consequence},
                {"kg": freed.kg, "m3": freed.m3, "minutes": freed.minutes}, next_run, by, now, repo.aware(now),
            )
        )
    label = kind.value.replace("_", " ")
    offline = _offline_since(db, day, vehicles)
    note = f"{' + '.join(order_ids)} deferred ({label})" + (f"; {offline}" if offline else "")
    version = planning.release_change(db, day, plan, specs + new_specs, note=note, actor=actor, actor_name=actor_name, now=now)

    stamp = repo.aware(now)
    old = day.latest.number
    for vid in sorted(vehicles):
        db.add(
            Notice(
                audience_kind="driver", vehicle_id=vid, tag=NoticeTag.CHANGE, title=f"Plan v{version.number}: a stop was deferred",
                body=f"{' + '.join(order_ids)} deferred ({label}). Do not deliver; the stop leaves your route.",
                link={"screen": "run"}, refs={"planVersion": version.number, "orderIds": order_ids}, created_at=stamp,
            )
        )
        db.add(
            Notice(
                audience_kind="dock", depot_id=day.ref.vehicles[vid].depot, tag=NoticeTag.CHANGE, title=f"Plan changed v{old} → v{version.number}, review",
                body=f"{' + '.join(order_ids)} deferred ({label}).", link={"screen": "plan"}, refs={"planVersion": version.number}, created_at=stamp,
            )
        )
    for spec in new_specs:
        planning.store_deferral_notice(
            db, order_id=spec.order_id, outlet_id=day.orders[spec.order_id].outlet_id,
            reason=(f"Store request: {spec.reason_text.rstrip('.')}." if kind is DeferralType.STORE_REQUEST else spec.reason_text),
            next_run=spec.next_run_date, version=version.number, now=now,
        )
    db.flush()
    return version.number, list(order_ids)
