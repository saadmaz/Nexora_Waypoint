"""D8: review a loading exception and decide it (PRD v3 §12, walkthrough step 11 to 12).

Deciding a vehicle swap creates and releases the next plan version in one transaction: the failed vehicle's trips move
to the replacement, the orders that do not fit are deferred by policy (with their next-run copies), the dock, the new
driver, the old driver and each deferred store are told, and the vehicle is marked Replaced. Callers commit.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules import frees, impact_on_store
from waypoint_rules.schedule import next_operating_day
from waypoint_rules.vocab import DeferralType

from .. import clock
from ..errors import ApiError, not_found
from ..models import field, plans
from ..models import orders as order_models
from ..models.comms import Notice
from ..models.enums import AuditType, Availability, ExceptionStatus, NoticeTag
from ..schemas import dispatcher as s
from . import audit, planning
from . import planning_repo as repo
from .dispatch_model import DispatchDay
from .exception_logic import (
    ExceptionRow,
    Swap,
    build_swap,
    choose_replacement,
    deferral_binding,
    deferral_reason,
    exception_view,
    holds_the_vehicle,
    trip_of_order,
)
from .planning import DeferralSpec, spec_of


def row_of(e: field.FieldException) -> ExceptionRow:
    """A stored exception as plain data."""
    return ExceptionRow(
        e.id, e.kind.value, e.type, e.vehicle_id, e.trip_id, tuple(e.order_ids or ()), e.detail, e.raised_by,
        repo.naive(e.raised_at) or e.raised_at, e.status, dict(e.decision) if e.decision else None, e.decided_by, repo.naive(e.decided_at),
        repo.naive(e.device_time),
    )


def _load(db: Session, exception_id: int) -> tuple[field.FieldException, ExceptionRow]:
    e = db.get(field.FieldException, exception_id)
    if e is None:
        raise not_found(f"Exception {exception_id}")
    return e, row_of(e)


def _service_date(db: Session, e: field.FieldException, now: datetime) -> date:
    """The run the exception is about: its trip's plan date, else the run the dispatcher is working on."""
    if e.trip_id is not None:
        trip = db.get(plans.Trip, e.trip_id)
        version = db.get(plans.PlanVersion, trip.plan_version_id) if trip is not None else None
        if version is not None:
            return version.service_date
    return repo.active_service_date(now, repo.operating_days(db))


def _next_run(db: Session, service_date: date) -> date | None:
    ops = repo.operating_days(db)
    return next_operating_day(service_date, ops) if ops else None


def review(db: Session, exception_id: int) -> s.ExceptionView:
    """D8: the exception, the recommended swap and what it costs. Once decided, the figures are those of the decision."""
    e, row = _load(db, exception_id)
    if not holds_the_vehicle(row):
        raise ApiError(409, "not_a_vehicle_flag", "This exception does not hold a vehicle, so there is no swap to review.")
    now = clock.now(db).replace(tzinfo=None)
    service_date = _service_date(db, e, now)
    version = int(row.decision["fromPlan"]) if row.decision and row.decision.get("fromPlan") else None  # type: ignore[call-overload]
    day = repo.load_day(db, service_date, now, version=version)
    return exception_view(day, row, next_run=_next_run(db, service_date), decided_plan=row.decision)


def _notify(db: Session, day: DispatchDay, swap: Swap, old: int, new: int, defer_specs: list[DeferralSpec], now: datetime) -> None:
    depot = day.ref.vehicles[swap.failed].depot
    stamp = repo.aware(now)
    db.add(
        Notice(
            audience_kind="dock", depot_id=depot, tag=NoticeTag.CHANGE, title=f"Plan changed v{old} → v{new}, review",
            body=f"{swap.failed} is replaced by {swap.replacement.id}.", link={"screen": "plan"},
            refs={"planVersion": new, "vehicle": swap.replacement.id}, created_at=stamp,
        )
    )
    moved = sum(len(t.order_ids) for t in swap.plan.trips.values() if t.vehicle_id == swap.replacement.id)
    db.add(
        Notice(
            audience_kind="driver", vehicle_id=swap.replacement.id, tag=NoticeTag.CHANGE, title=f"Plan v{new}: a new trip for you",
            body=f"{swap.replacement.id} takes over {swap.failed}'s trips: {moved} orders.", link={"screen": "run"},
            refs={"planVersion": new}, created_at=stamp,
        )
    )
    db.add(
        Notice(
            audience_kind="driver", vehicle_id=swap.failed, tag=NoticeTag.CHANGE, title=f"Plan v{new}: your trip moved",
            body=f"{swap.failed} did not pass its check. {swap.replacement.id} takes the trips.", link={"screen": "run"},
            refs={"planVersion": new}, created_at=stamp,
        )
    )
    for spec in defer_specs:
        planning.store_deferral_notice(
            db, order_id=spec.order_id, outlet_id=day.orders[spec.order_id].outlet_id, reason=spec.reason_text,
            next_run=spec.next_run_date, version=new, now=now,
        )


def decide(db: Session, exception_id: int, defer_order_ids: list[str], *, actor: str, actor_name: str) -> s.ExceptionView:
    """Swap the failed vehicle for the replacement, deferring ``defer_order_ids`` (the rules' recommendation when empty)."""
    e, row = _load(db, exception_id)
    if row.status is ExceptionStatus.DECIDED:
        raise ApiError(409, "already_decided", "This exception has already been decided.")
    if not holds_the_vehicle(row):
        raise ApiError(409, "not_a_vehicle_flag", "This exception does not hold a vehicle, so there is no swap to decide.")
    now = clock.now(db).replace(tzinfo=None)
    service_date = _service_date(db, e, now)
    day = repo.load_day(db, service_date, now)
    if day.latest is None:
        raise ApiError(409, "not_ready", "There is no plan yet.")

    failed = row.vehicle_id
    replacement = choose_replacement(day, failed)
    if replacement is None:
        raise ApiError(409, "no_replacement", f"No free vehicle can take {failed}'s trips.")
    swap = build_swap(day, failed, replacement, defer_order_ids or None)
    if not swap.trips:
        raise ApiError(409, "nothing_to_swap", f"{failed} has no trips in the plan.")
    if swap.violations:
        raise ApiError(
            409, "illegal_swap", " ".join(v.message for v in swap.violations),
            [{"rule": v.rule.value, "message": v.message} for v in swap.violations],
        )

    next_run = _next_run(db, service_date)
    by = f"{actor_name} · {now:%H:%M}"
    specs = [spec_of(d) for d in day.deferrals]
    new_specs: list[DeferralSpec] = []
    for oid in swap.defer:
        order = day.orders[oid]
        trip_no = trip_of_order(swap, oid)
        impact, freed = impact_on_store(order, day.ref), frees(order, day.ref)
        new_specs.append(
            DeferralSpec(
                oid, DeferralType.POLICY, deferral_binding(swap, trip_no), deferral_reason(swap, trip_no, actor_name),
                {"deferred_yesterday": impact.deferred_yesterday, "days_since_served": impact.days_since_served, "consequence": impact.consequence},
                {"kg": freed.kg, "m3": freed.m3, "minutes": freed.minutes}, next_run, by, now, repo.aware(now),
            )
        )
    specs = [sp for sp in specs if sp.order_id not in {n.order_id for n in new_specs}] + new_specs

    note = f"{failed} → {replacement.id}" + (f"; {', '.join(swap.defer)} deferred (policy)" if swap.defer else "")
    version = planning.release_change(db, day, swap.plan, specs, note=note, actor=actor, actor_name=actor_name, now=now)

    # The deferred stores were told in the same step, so their notice is already sent.
    told = db.scalars(
        select(order_models.Deferral).where(
            order_models.Deferral.plan_version_id == version.id, order_models.Deferral.order_id.in_(list(swap.defer) or [""])
        )
    )
    for d in told:
        d.notice_sent_at = repo.aware(now)
    _notify(db, day, swap, day.latest.number, version.number, new_specs, now)

    depot = day.ref.vehicles[failed].depot
    forced = [sp for sp in specs if sp.type is not DeferralType.STORE_REQUEST and day.ref.outlets[day.orders[sp.order_id].outlet_id].depot == depot]
    status = db.get(plans.VehicleDayStatus, (failed, service_date))
    if status is None:
        status = plans.VehicleDayStatus(vehicle_id=failed, service_date=service_date, availability=Availability.AVAILABLE)
        db.add(status)
    status.held_at = repo.aware(row.raised_at)
    status.held_reason = row.detail or row.type
    status.replaced_by = replacement.id

    e.status = ExceptionStatus.DECIDED
    e.decided_by = actor_name
    e.decided_by_user_id = audit.user_id_for(db, actor)
    e.decided_at = repo.aware(now)
    e.decision = {
        "decision": "swap_vehicle",
        "replacement": replacement.id,
        "deferred": list(swap.defer),
        "fromPlan": day.latest.number,
        "plan": version.number,
        "deferralsAfter": {
            "total": len(forced),
            "capacity": sum(1 for sp in forced if sp.type is DeferralType.CAPACITY),
            "policy": sum(1 for sp in forced if sp.type is DeferralType.POLICY),
        },
    }
    audit.record(
        db, actor=actor, entity_type="vehicle", entity_id=failed, type=AuditType.VEHICLE_SWAPPED,
        payload={"replacement": replacement.id, "deferred": list(swap.defer), "plan": version.number, "exception": exception_id},
        at=repo.aware(now),
    )
    db.flush()
    return review(db, exception_id)
