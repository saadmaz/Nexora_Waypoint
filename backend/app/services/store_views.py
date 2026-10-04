"""The store manager's reads (PRD §19 StoreApi): the order form, delivery days, history, issues and the updates feed.

Everything is derived from the order record, the plan, the field records and the scenario clock, never held as separate
state (handoff 14). A delivery day is one outlet and one service date; its status, journey, arrival and proof come from the
rows ``load_facts`` gathers once for all the orders being shown. Callers do not commit: these are reads.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules import OrderStatus, is_offline
from waypoint_rules.vocab import DeferralType, Temp

from .. import clock
from ..config import COLOMBO
from ..deps import CurrentUser
from ..errors import forbidden, not_found
from ..models import field as f
from ..models import orders as om
from ..models import people, plans, reference
from ..models.comms import AuditEvent, Notice, NoticeRead
from ..models.enums import (
    AudienceKind,
    AuditType,
    ConflictStatus,
    DeviceRecordType,
    ExceptionKind,
    ExceptionStatus,
    HistoryOutcome,
    NoticeTag,
    PlanState,
)
from ..schemas import store as s
from ..schemas.common import Window
from . import planning_repo as repo
from .dispatcher_views import day_label

#: The seven steps of the journey and who acts at each (``frontend/src/domain/delivery.ts``).
JOURNEY_STEPS = ("Ordered", "Confirmed", "Planned", "Loaded", "Departed", "Delivered", "Receipt confirmed")
_ACTOR = {
    "Ordered": "You", "Confirmed": "Dispatch", "Planned": "Dispatch", "Loaded": "Loader",
    "Departed": "Driver", "Delivered": "Driver", "Receipt confirmed": "You",
}

_OS = OrderStatus
LOADED_OR_LATER = {_OS.LOADED, _OS.DEPARTED, _OS.DELIVERED, _OS.PARTIAL, _OS.ISSUE, _OS.CONFLICT}
DEPARTED_OR_LATER = {_OS.DEPARTED, _OS.DELIVERED, _OS.PARTIAL, _OS.ISSUE, _OS.CONFLICT}
DELIVERED_LIKE = {_OS.DELIVERED, _OS.PARTIAL, _OS.ISSUE}
_ADVANCE = [_OS.ORDERED, _OS.CONFIRMED, _OS.PLANNED, _OS.LOADED, _OS.DEPARTED, _OS.DELIVERED]


# ---- small helpers ----------------------------------------------------------


def now_local(db: Session) -> datetime:
    """Scenario time as naive Asia/Colombo, which is how the rules and the screens speak."""
    return clock.now(db).replace(tzinfo=None)


def hm(value: datetime | None) -> str | None:
    local = repo.naive(value)
    return f"{local:%H:%M}" if local is not None else None


def stamp(value: datetime) -> str:
    """An ISO time with the Colombo offset, as the order form shows ``receivedAt``."""
    return value.astimezone(COLOMBO).replace(microsecond=0).isoformat()


def dock_label(dock_type: Any) -> str:
    return str(dock_type.value).replace("_", " ").capitalize()


def outlet_name(outlet: reference.Outlet) -> str:
    return outlet.name or f"Waypoint {outlet.brand.value}"


def kind_order(order: om.Order) -> tuple[int, str]:
    """Chilled first, then dry, as every store screen lists them."""
    return (0 if order.temp is Temp.CHILLED else 1, order.id)


def outlet_of(db: Session, user: CurrentUser) -> reference.Outlet:
    if user.outlet_id is None:
        raise forbidden("This account is not linked to an outlet")
    outlet = db.get(reference.Outlet, user.outlet_id)
    if outlet is None:
        raise not_found(f"Outlet {user.outlet_id}")
    return outlet


def window_of(outlet: reference.Outlet) -> Window:
    return Window(start=f"{outlet.window_open:%H:%M}", end=f"{outlet.window_close:%H:%M}")


def status_of(order: om.Order) -> OrderStatus:
    return OrderStatus(order.status.value)


def day_status(statuses: list[OrderStatus]) -> OrderStatus:
    """The status a delivery day's orders share: the one that needs the store's attention first, else the least advanced."""
    present = set(statuses)
    for pick in (_OS.CONFLICT, _OS.ISSUE, _OS.PARTIAL, _OS.DEFERRED):
        if pick in present:
            return pick
    known = [x for x in _ADVANCE if x in present]
    return known[0] if known else statuses[0]


def next_label(next_run: date | None) -> str:
    return day_label(next_run) if next_run else "the next run"


# ---- the facts a set of orders needs -----------------------------------------


@dataclass(slots=True)
class Placement:
    """Where the latest released plan puts one order."""

    version: int
    service_date: date
    vehicle_id: str
    trip_no: int
    depart_at: datetime
    planned_arrival: datetime | None
    released_at: datetime | None


@dataclass(slots=True)
class Facts:
    outlet: reference.Outlet
    orders: list[om.Order]
    updated: dict[str, datetime] = field(default_factory=dict)
    placed: dict[str, Placement] = field(default_factory=dict)
    first_release: dict[date, datetime] = field(default_factory=dict)
    deferrals: dict[str, om.Deferral] = field(default_factory=dict)
    withdrawn: dict[str, om.Deferral] = field(default_factory=dict)
    receipts: dict[str, f.Receipt] = field(default_factory=dict)
    outcomes: dict[str, f.DeviceRecord] = field(default_factory=dict)
    conflicts: list[f.Conflict] = field(default_factory=list)
    runs: dict[tuple[date, str, int], f.Run] = field(default_factory=dict)
    gates: dict[tuple[date, str, int], plans.LoadGate] = field(default_factory=dict)
    issues: list[f.FieldException] = field(default_factory=list)
    issue_photo: dict[int, bool] = field(default_factory=dict)
    drivers: dict[str, str] = field(default_factory=dict)
    depots: dict[str, str] = field(default_factory=dict)
    by_id: dict[str, om.Order] = field(default_factory=dict)


def load_facts(db: Session, outlet: reference.Outlet, orders: list[om.Order]) -> Facts:
    facts = Facts(outlet=outlet, orders=orders, by_id={o.id: o for o in orders})
    ids = [o.id for o in orders]
    if not ids:
        return facts
    dates = {o.service_date for o in orders}

    for a in db.scalars(select(AuditEvent).where(AuditEvent.entity_type == "order", AuditEvent.entity_id.in_(ids), AuditEvent.type == AuditType.ORDER_EDITED)):
        if a.entity_id not in facts.updated or a.at > facts.updated[a.entity_id]:
            facts.updated[a.entity_id] = a.at

    released = db.execute(
        select(plans.TripOrder, plans.Trip, plans.PlanVersion)
        .join(plans.Trip, plans.Trip.id == plans.TripOrder.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(plans.TripOrder.order_id.in_(ids), plans.PlanVersion.state == PlanState.RELEASED)
    ).all()
    for to, trip, version in released:
        current = facts.placed.get(to.order_id)
        if current is None or version.number > current.version:
            facts.placed[to.order_id] = Placement(
                version.number, version.service_date, trip.vehicle_id, trip.trip_no, trip.depart_at,
                to.planned_arrival or to.planned_handling_start, version.released_at,
            )
    for version in db.scalars(select(plans.PlanVersion).where(plans.PlanVersion.service_date.in_(dates), plans.PlanVersion.state == PlanState.RELEASED)):
        if version.released_at is not None and (version.service_date not in facts.first_release or version.released_at < facts.first_release[version.service_date]):
            facts.first_release[version.service_date] = version.released_at

    for d in db.scalars(select(om.Deferral).where(om.Deferral.order_id.in_(ids)).order_by(om.Deferral.id)):
        (facts.withdrawn if d.withdrawn_at is not None else facts.deferrals)[d.order_id] = d
    for r in db.scalars(select(f.Receipt).where(f.Receipt.order_id.in_(ids))):
        facts.receipts[r.order_id] = r
    for rec in db.scalars(select(f.DeviceRecord).where(f.DeviceRecord.type == DeviceRecordType.DRIVER_OUTCOME, f.DeviceRecord.client_id.in_(select(f.DeviceRecordOrder.client_id).where(f.DeviceRecordOrder.order_id.in_(ids)))).order_by(f.DeviceRecord.received_at)):
        if str((rec.payload or {}).get("outcome") or "").lower() == "delivered":
            for oid in rec.order_ids:
                facts.outcomes[oid] = rec
    facts.conflicts = [c for c in db.scalars(select(f.Conflict).where(f.Conflict.id.in_(select(f.ConflictOrder.conflict_id).where(f.ConflictOrder.order_id.in_(ids)))).order_by(f.Conflict.id))]

    for run, trip, version in db.execute(
        select(f.Run, plans.Trip, plans.PlanVersion)
        .join(plans.Trip, plans.Trip.id == f.Run.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(plans.PlanVersion.service_date.in_(dates))
    ):
        facts.runs[(version.service_date, run.vehicle_id, trip.trip_no)] = run
    for gate, trip, version in db.execute(
        select(plans.LoadGate, plans.Trip, plans.PlanVersion)
        .join(plans.Trip, plans.Trip.id == plans.LoadGate.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(plans.PlanVersion.service_date.in_(dates))
    ):
        facts.gates[(version.service_date, trip.vehicle_id, trip.trip_no)] = gate

    facts.issues = list(
        db.scalars(select(f.FieldException).where(f.FieldException.kind == ExceptionKind.STORE_ISSUE, f.FieldException.id.in_(select(f.ExceptionOrder.exception_id).where(f.ExceptionOrder.order_id.in_(ids)))).order_by(f.FieldException.id))
    )
    if facts.issues:
        for a in db.scalars(select(AuditEvent).where(AuditEvent.entity_type == "exception", AuditEvent.type == AuditType.ISSUE_REPORTED, AuditEvent.entity_id.in_([str(e.id) for e in facts.issues]))):
            facts.issue_photo[int(a.entity_id)] = bool((a.payload or {}).get("photo"))

    # The vehicles carrying the orders, and the ones that delivered them: a stop deferred after the truck left is on no trip
    # in the latest plan, but its proof still names the driver (S3.1).
    vehicles = {p.vehicle_id for p in facts.placed.values()} | {r.vehicle_id for r in facts.outcomes.values() if r.vehicle_id}
    if vehicles:
        facts.drivers = {d.vehicle_id: d.name for d in db.scalars(select(people.Driver).where(people.Driver.vehicle_id.in_(vehicles)))}
        facts.depots = {v.id: v.depot_id for v in db.scalars(select(reference.Vehicle).where(reference.Vehicle.id.in_(vehicles)))}
    return facts


def orders_of(db: Session, outlet_id: str, *, from_: date | None = None, to: date | None = None, on: date | None = None) -> list[om.Order]:
    query = select(om.Order).where(om.Order.outlet_id == outlet_id, om.Order.cancelled_at.is_(None))
    if on is not None:
        query = query.where(om.Order.service_date == on)
    if from_ is not None:
        query = query.where(om.Order.service_date >= from_)
    if to is not None:
        query = query.where(om.Order.service_date <= to)
    return list(db.scalars(query.order_by(om.Order.service_date, om.Order.id)))


# ---- arrival and deferral wording ---------------------------------------------


def arrival_range(predicted: datetime | None, outlet: reference.Outlet) -> s.ArrivalRange:
    """What the store sees as arrival (PRD §4a): the later of predicted arrival and window opening, as a range."""
    opens = f"{outlet.window_open:%H:%M}"
    local = repo.naive(predicted)
    if local is None:
        return s.ArrivalRange(from_=opens)
    arrives = f"{local:%H:%M}"
    return s.ArrivalRange(from_=opens, may_arrive_at=arrives) if arrives < opens else s.ArrivalRange(from_=arrives)


def _deferral_notice(d: om.Deferral) -> s.DeferralNoticeOut:
    return s.DeferralNoticeOut(
        type=d.type, reason=d.reason_text, decided_by=(d.decided_by or "Dispatch").split(" · ")[0],
        next_run=day_label(d.next_run_date) if d.next_run_date else None,
    )


def _deferral_out(d: om.Deferral, outlet: reference.Outlet, kinds: str, acknowledged: bool) -> s.DeliveryDeferralOut:
    label = next_label(d.next_run_date)
    short = f"{d.next_run_date:%a}" if d.next_run_date else ""
    decided = repo.naive(d.decided_at)
    common: dict[str, Any] = {
        "id": d.id, "type": d.type, "reason": d.reason_text, "decided_by": (d.decided_by or "Dispatch").split(" · ")[0],
        "decided_at": f"{decided:%H:%M}" if decided else "", "next_run_short": short, "acknowledged": acknowledged,
    }
    if d.type is DeferralType.STORE_REQUEST:
        return s.DeliveryDeferralOut(
            headline="Deferred at your request", subline=f"Next run {label}.", next_run_label="New ETA",
            next_run=f"{label} · from {outlet.window_open:%H:%M}", **common,
        )
    consequence = (d.impact or {}).get("consequence")
    if d.type is DeferralType.POLICY:
        headline = f"Your {kinds} order moved to {d.next_run_date:%A}" if d.next_run_date else f"Your {kinds} order moved to the next run"
        explanation = "Dispatch could not fit every order on the vehicles available, and chose the order that protects the stores skipped most recently."
    else:
        headline = f"Your {kinds} order could not be carried on this run"
        explanation = "No vehicle that can legally carry this order had room left on the run."
    return s.DeliveryDeferralOut(
        headline=headline, explanation=f"{explanation} {consequence}." if consequence else explanation,
        next_run_label="Next run", next_run=label, **common,
    )


# ---- orders ---------------------------------------------------------------------


def order_out(order: om.Order, facts: Facts) -> s.OrderOut:
    outlet = facts.outlet
    placement = facts.placed.get(order.id)
    deferral = facts.deferrals.get(order.id) if status_of(order) is _OS.DEFERRED else None
    arrival = None
    if placement is not None and deferral is None:
        rng = arrival_range(placement.planned_arrival, outlet)
        arrival = Window(start=rng.from_, end=f"{outlet.window_close:%H:%M}")
    updated = facts.updated.get(order.id)
    return s.OrderOut(
        id=order.id, outlet_id=order.outlet_id, outlet_name=outlet_name(outlet), district=outlet.district,
        delivery_date=order.service_date, dock=outlet.dock_type.value, window=window_of(outlet),
        line=s.OrderLineOut(id=f"{order.id}-L1", kind=order.temp, units=order.units, estimated_kg=order.weight_kg, estimated_m3=order.volume_m3),
        status=status_of(order), received_at=stamp(order.received_at) if order.received_at else "",
        updated_at=stamp(updated) if updated else None, after_cutoff=bool(order.after_cutoff), arrival=arrival,
        deferral=_deferral_notice(deferral) if deferral else None,
    )


#: Used when an outlet has no earlier order of a kind to take the figures from (PRD v3 A14, A42).
_DEFAULT_FACTORS = {Temp.CHILLED: (70 / 12, 0.7 / 12), Temp.AMBIENT: (45 / 8, 0.6 / 8)}
_DEFAULT_UNITS = {Temp.CHILLED: 12, Temp.AMBIENT: 8}


def order_draft(db: Session, user: CurrentUser, day: date | None) -> s.OrderDraftOut:
    """S1: the form for one day. Figures per unit and starting quantities come from the outlet's own last order of each kind."""
    from waypoint_rules.schedule import service_day_for

    outlet = outlet_of(db, user)
    now = now_local(db)
    service = service_day_for(now, repo.operating_days(db))
    delivery_date = day or service.service_date
    history = list(db.scalars(select(om.Order).where(om.Order.outlet_id == outlet.id).order_by(om.Order.received_at.desc().nulls_last(), om.Order.id.desc())))
    factors: dict[Temp, s.UnitFactor] = {}
    defaults: dict[Temp, int] = {}
    for temp in Temp:
        last = next((o for o in history if o.temp is temp and o.units > 0 and not o.id.endswith("-F")), None)
        if last is not None:
            factors[temp] = s.UnitFactor(kg=last.weight_kg / last.units, m3=last.volume_m3 / last.units)
            defaults[temp] = last.units
        else:
            kg, m3 = (outlet.units_to_kg, outlet.units_to_m3) if outlet.units_to_kg and outlet.units_to_m3 else _DEFAULT_FACTORS[temp]
            factors[temp] = s.UnitFactor(kg=kg, m3=m3)
            defaults[temp] = _DEFAULT_UNITS[temp]
    placed = sorted(orders_of(db, outlet.id, on=delivery_date), key=kind_order)
    facts = load_facts(db, outlet, placed)
    return s.OrderDraftOut(
        outlet_id=outlet.id, delivery_date=delivery_date, after_cutoff=service.after_cutoff if delivery_date == service.service_date else False,
        window=window_of(outlet), dock=dock_label(outlet.dock_type), unit_factors=factors, default_units=defaults,
        orders=[order_out(o, facts) for o in placed],
    )


# ---- delivery days ------------------------------------------------------------------


def _open_conflict(facts: Facts, ids: set[str]) -> f.Conflict | None:
    for c in reversed(facts.conflicts):
        if c.status is not ConflictStatus.RESOLVED and ids & set(c.order_ids or ()):
            return c
    return None


def _answered(c: f.Conflict | None) -> bool:
    return c is not None and isinstance((c.server_snapshot or {}).get("storeReport"), dict)


def _journey(times: dict[str, str]) -> list[s.JourneyStepOut]:
    reached = [step for step in JOURNEY_STEPS if step in times]
    last = reached[-1] if reached else None
    # Ordered and Confirmed stay done: the current marker starts once the plan is out; after delivery it waits on the store.
    current = "Receipt confirmed" if last == "Delivered" else None if last in ("Receipt confirmed", "Ordered", "Confirmed") else last
    return [
        s.JourneyStepOut(step=step, actor=_ACTOR[step], at=times.get(step), state="current" if step == current else "done" if step in times else "pending")
        for step in JOURNEY_STEPS
    ]


def issue_out(e: f.FieldException, facts: Facts) -> s.IssueOut:
    orders = [facts.by_id[o] for o in e.order_ids if o in facts.by_id]
    first = orders[0] if orders else None
    return s.IssueOut(
        id=f"ISS{e.id}", outlet_id=facts.outlet.id, date=first.service_date if first else repo.naive(e.raised_at).date(),  # type: ignore[union-attr]
        type=e.type,
        lines=[
            s.IssueLineOut(order_id=o.id, kind=o.temp, units=int((e.units_short or {}).get(o.id, o.units)), order_units=o.units)
            for o in orders
        ],
        note=e.detail, photo=facts.issue_photo.get(e.id, False), reported_at=hm(e.raised_at) or "", resolved=e.status is ExceptionStatus.DECIDED,
    )


def _delivery(db: Session, facts: Facts, day: date, orders: list[om.Order], now: datetime) -> s.DeliveryOut:
    outlet = facts.outlet
    orders = sorted(orders, key=kind_order)
    ids = {o.id for o in orders}
    conflict = _open_conflict(facts, ids)
    answered = _answered(conflict)

    shown = {o.id: (_OS.DELIVERED if status_of(o) is _OS.CONFLICT and answered else status_of(o)) for o in orders}
    status = day_status(list(shown.values()))
    placements = [facts.placed[o.id] for o in orders if o.id in facts.placed]
    placement = placements[0] if placements else None
    deferral = next((facts.deferrals[o.id] for o in orders if o.id in facts.deferrals and shown[o.id] is _OS.DEFERRED), None)
    kinds = " and ".join(sorted({"chilled" if o.temp is Temp.CHILLED else "dry" for o in orders}))
    issues = [i for i in facts.issues if ids & set(i.order_ids or ())]
    issue_by_order: dict[str, s.IssueOut] = {}
    issue_outs = sorted((issue_out(i, facts) for i in issues), key=lambda i: i.reported_at, reverse=True)
    for issue in issue_outs:
        for line in issue.lines:
            issue_by_order.setdefault(line.order_id, issue)

    delivery_orders: list[s.DeliveryOrderOut] = []
    for o in orders:
        receipt = facts.receipts.get(o.id)
        tag = None
        if o.id in issue_by_order:
            line = next(x for x in issue_by_order[o.id].lines if x.order_id == o.id)
            kind = issue_by_order[o.id].type
            tag = "Short" if kind == "Missing" and line.units < line.order_units else kind
        delivery_orders.append(
            s.DeliveryOrderOut(
                id=o.id, kind=o.temp, units=o.units, status=shown[o.id], issue=tag,
                received=receipt.units_received if receipt is not None and receipt.units_received < o.units else None,
            )
        )

    # The journey: each step's time is the moment its record was made.
    times: dict[str, str] = {}
    earliest = min((o.received_at for o in orders if o.received_at), default=None)
    if earliest:
        times["Ordered"] = hm(earliest) or ""
    if status is not _OS.ORDERED:
        times["Confirmed"] = f"{repo.cutoff_at(day, repo.operating_days(db)):%H:%M}"  # the queue closes at the cutoff
    release = facts.first_release.get(day)
    if release and (placements or deferral or any(shown[o.id] not in (_OS.ORDERED, _OS.CONFIRMED) for o in orders)):
        times["Planned"] = hm(release) or ""
    if placement and any(shown[o.id] in LOADED_OR_LATER for o in orders):
        gate = facts.gates.get((placement.service_date, placement.vehicle_id, placement.trip_no))
        if gate:
            times["Loaded"] = hm(gate.confirmed_at) or ""
    run = facts.runs.get((placement.service_date, placement.vehicle_id, placement.trip_no)) if placement else None
    if run and run.departed_at and any(shown[o.id] in DEPARTED_OR_LATER for o in orders):
        times["Departed"] = hm(run.departed_at) or ""
    outcome = next((facts.outcomes[o.id] for o in orders if o.id in facts.outcomes), None)
    if outcome and any(shown[o.id] in DELIVERED_LIKE for o in orders):
        times["Delivered"] = hm(outcome.device_time or outcome.received_at) or ""
    receipts = [facts.receipts[o.id] for o in orders if o.id in facts.receipts]
    if receipts:
        times["Receipt confirmed"] = hm(max(r.confirmed_at for r in receipts)) or ""

    # arrival, on the way, loaded
    released = bool(placements)
    arrival = arrival_range(placement.planned_arrival, outlet) if released and deferral is None and placement else None
    predicted = hm(placement.planned_arrival) if placement and placement.planned_arrival else f"{outlet.window_open:%H:%M}"
    loaded = on_the_way = last_update = None
    if status is _OS.LOADED and "Loaded" in times and placement:
        depot = facts.depots.get(placement.vehicle_id)
        place = f"{db.get(reference.Depot, depot).name} dock" if depot and db.get(reference.Depot, depot) else "the dock"
        loaded = {"place": place, "at": times["Loaded"]}
    if status is _OS.DEPARTED:
        on_the_way = {"arrivesAbout": predicted or "", "unloadingFrom": f"{outlet.window_open:%H:%M}"}
        heard = repo.naive(run.last_heard_at) if run else None
        if is_offline(heard, now, in_progress=run is not None):
            last_update = f"{heard:%H:%M}" if heard else None

    review = None
    if conflict is not None and not answered:
        snap, dev = conflict.server_snapshot or {}, conflict.device_snapshot or {}

        def _t(value: Any) -> str:
            if isinstance(value, str):
                try:
                    return f"{datetime.fromisoformat(value).astimezone(COLOMBO):%H:%M}"
                except ValueError:
                    return ""
            return ""

        review = {
            "askedAt": _t(snap.get("askedAt")) or _t(dev.get("syncedAt")), "deliveredAt": _t(dev.get("deviceTime")),
            "receivedBy": str(dev.get("receivedBy") or ""), "conflictId": str(conflict.id),
        }

    proof = None
    if outcome is not None and (conflict is not None or any(shown[o.id] in DELIVERED_LIKE for o in orders)):
        payload = outcome.payload or {}
        units: list[int] = []
        for o in orders:
            rec = facts.outcomes.get(o.id)
            value = (rec.payload or {}).get("unitsDelivered") if rec else None
            units.append(value if isinstance(value, int) else o.units)
        proof = s.ProofOfDeliveryOut(
            received_by=str(payload.get("receiverName") or ""), at=hm(outcome.device_time or outcome.received_at) or "",
            driver=facts.drivers.get(outcome.vehicle_id or "", ""), vehicle=outcome.vehicle_id or "", units=units,
        )

    withdrawn = next((facts.withdrawn[o.id] for o in orders if o.id in facts.withdrawn), None)
    kept = withdrawn is not None and status in DELIVERED_LIKE
    tags = (["Deferral withdrawn"] if kept else []) + (["Receipt confirmed"] if receipts else [])
    receipt_rows = sorted(receipts, key=lambda r: r.confirmed_at)
    reasons = [r.shortfall_reason for r in receipt_rows if r.shortfall_reason]
    started = any(shown[o.id] not in (_OS.ORDERED, _OS.CONFIRMED) for o in orders)

    return s.DeliveryOut(
        date=day, outlet_id=outlet.id, outlet_name=outlet_name(outlet), district=outlet.district, window=window_of(outlet),
        dock=dock_label(outlet.dock_type), vehicle=placement.vehicle_id if placement else None, orders=delivery_orders, status=status,
        journey=_journey(times), arrival=arrival, plan_pending=not started and not released, loaded=loaded, on_the_way=on_the_way,
        last_update=last_update, receivers_cue=released and status in (_OS.PLANNED, _OS.LOADED, _OS.DEPARTED),
        deferral=_deferral_out(deferral, outlet, kinds, deferral.notice_seen_at is not None) if deferral else None,
        review=review, proof=proof, tags=tags,
        withdrawn_note=f"{next_label(withdrawn.next_run_date)} re-run removed." if kept and withdrawn else None,
        receipt_confirmed_at=times.get("Receipt confirmed"), receipt_by=receipt_rows[-1].confirmed_by if receipt_rows else None,
        shortfall_reason=reasons[0] if reasons else None, issues=issue_outs, received_answered=answered,
    )


def deliveries(db: Session, user: CurrentUser, *, from_: date | None, to: date | None, on: date | None = None) -> list[s.DeliveryOut]:
    """The outlet's delivery days, earliest first. Without a range: every day from today on."""
    outlet = outlet_of(db, user)
    now = now_local(db)
    orders = orders_of(db, outlet.id, on=on, from_=None if on else (from_ or now.date()), to=None if on else to)
    facts = load_facts(db, outlet, orders)
    by_day: dict[date, list[om.Order]] = {}
    for o in orders:
        by_day.setdefault(o.service_date, []).append(o)
    return [_delivery(db, facts, day, rows, now) for day, rows in sorted(by_day.items())]


# ---- history ------------------------------------------------------------------------


def recent(db: Session, user: CurrentUser, limit: int, before: date | None) -> list[s.RecentOrderDayOut]:
    """Past delivery days, newest first, Sundays skipped. The current day joins once it has been delivered (S4.2)."""
    outlet = outlet_of(db, user)
    now = now_local(db)
    active = repo.active_service_date(now, repo.operating_days(db))
    orders = orders_of(db, outlet.id)
    facts = load_facts(db, outlet, orders)
    by_day: dict[date, list[om.Order]] = {}
    for o in orders:
        by_day.setdefault(o.service_date, []).append(o)

    days: dict[date, s.RecentOrderDayOut] = {}
    for day, rows in by_day.items():
        if day > active:
            continue
        d = _delivery(db, facts, day, rows, now)
        if day == active and d.status not in (_OS.DELIVERED, _OS.PARTIAL, _OS.ISSUE):
            continue
        short = sum(o.units - (o.received or o.units) for o in d.orders if o.received is not None)
        served_next = None
        if d.status is _OS.DEFERRED:
            ids = {o.id for o in rows}
            served_next = any(x.deferred_from_order_id in ids and status_of(x) in DELIVERED_LIKE for x in db.scalars(select(om.Order).where(om.Order.deferred_from_order_id.in_(ids))))
        deferral = facts.deferrals.get(rows[0].id) or next((facts.deferrals[o.id] for o in rows if o.id in facts.deferrals), None)
        days[day] = s.RecentOrderDayOut(
            date=day, order_count=len(rows), status=d.status,
            deferral={"type": deferral.type.value, "nextRunShort": f"{deferral.next_run_date:%a}" if deferral.next_run_date else ""} if deferral and d.status is _OS.DEFERRED else None,
            delivered_at=d.proof.at if d.proof else None, short_units=short or None, served_next_day=served_next,
            order_ids=[o.id for o in d.orders], deferral_withdrawn=True if "Deferral withdrawn" in d.tags else None,
            receipt_confirmed_at=d.receipt_confirmed_at, current=True if day == active else None,
        )
    # Earlier days the outlet was served have a history row but no order records; one order is the least a served day had.
    for h in db.scalars(select(om.OutletServiceHistory).where(om.OutletServiceHistory.outlet_id == outlet.id)):
        if h.service_date in days or h.service_date >= active or h.outcome is HistoryOutcome.NO_RUN:
            continue
        status = {HistoryOutcome.SERVED: _OS.DELIVERED, HistoryOutcome.PARTIAL: _OS.PARTIAL, HistoryOutcome.DEFERRED: _OS.DEFERRED}[h.outcome]
        days[h.service_date] = s.RecentOrderDayOut(
            date=h.service_date, order_count=1, status=status, delivered_at=f"{h.time:%H:%M}" if h.time is not None and status is _OS.DELIVERED else None,
            deferral={"type": DeferralType.POLICY.value} if status is _OS.DEFERRED else None,
        )
    rows = [d for _, d in sorted(days.items(), reverse=True) if d.date.weekday() != 6 and (before is None or d.date < before)]
    return rows[:limit]


# ---- issues -------------------------------------------------------------------------


def issues(db: Session, user: CurrentUser) -> list[s.IssueOut]:
    outlet = outlet_of(db, user)
    facts = load_facts(db, outlet, orders_of(db, outlet.id))
    out = [issue_out(e, facts) for e in facts.issues]
    out.sort(key=lambda i: i.reported_at, reverse=True)
    out.sort(key=lambda i: i.resolved)
    return out


# ---- the updates feed -------------------------------------------------------------


_TAGS = {NoticeTag.ORDER: "Order", NoticeTag.PLAN: "Plan", NoticeTag.DELIVERY: "Delivery", NoticeTag.DEFERRAL: "Deferral", NoticeTag.REVIEW: "Review", NoticeTag.CHANGE: "Plan"}


def updates(db: Session, user: CurrentUser) -> s.UpdatesFeedOut:
    """S4: every notice sent to the store, newest first, with its read state and the unread count for the bell."""
    outlet = outlet_of(db, user)
    rows = list(
        db.scalars(
            select(Notice).where(Notice.audience_kind == AudienceKind.STORE, Notice.outlet_id == outlet.id).order_by(Notice.created_at.desc(), Notice.id.desc())
        )
    )
    read = set(db.scalars(select(NoticeRead.notice_id).where(NoticeRead.user_id == user.id, NoticeRead.notice_id.in_([n.id for n in rows] or [0]))))
    order_ids = {oid for n in rows for oid in (n.refs or {}).get("orderIds", [])}
    service_dates = {o.id: o.service_date for o in db.scalars(select(om.Order).where(om.Order.id.in_(order_ids or {""})))}
    conflicts = {c.id: c for c in db.scalars(select(f.Conflict).where(f.Conflict.id.in_([(n.refs or {}).get("conflictId") for n in rows if (n.refs or {}).get("conflictId")] or [0])))}
    out: list[s.StoreUpdateOut] = []
    for n in rows:
        refs, link = n.refs or {}, n.link or {}
        conflict = conflicts.get(refs.get("conflictId"))
        when = repo.naive(n.created_at) or n.created_at.replace(tzinfo=None)
        day = link.get("date") or next((service_dates[o].isoformat() for o in refs.get("orderIds", []) if o in service_dates), None)
        if day is None and conflict is not None and conflict.order_ids:
            first = db.get(om.Order, conflict.order_ids[0])
            day = first.service_date.isoformat() if first else None
        target = {"screen": "orders"} if link.get("screen") == "orders" or day is None else {"screen": "delivery", "date": str(day)}
        resolved = conflict is not None and n.tag is NoticeTag.REVIEW and conflict.status is ConflictStatus.RESOLVED and conflict.resolved_at is not None
        out.append(
            s.StoreUpdateOut(
                id=str(n.id), tag=_TAGS[n.tag], date=when.date(), time=f"{when:%H:%M}", title=n.title, body=n.body,
                view_label="View delivery" if n.tag is NoticeTag.DELIVERY and target["screen"] == "delivery" else None,
                target=target, unread=n.id not in read, resolved_at=hm(conflict.resolved_at) if resolved and conflict else None,
            )
        )
    return s.UpdatesFeedOut(updates=out, unread=sum(1 for u in out if u.unread))

