"""Reads: database rows in, plain values out.

Everything the planner, the move validator and the dispatcher views need is loaded here and handed over as
``waypoint_rules`` types or :class:`DispatchDay`. Writes live in ``planning``. Times in the database are timestamptz;
the rules want naive Asia/Colombo times, so they are converted at this boundary and nowhere else.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from waypoint_rules import (
    District,
    Order,
    Outlet,
    OutletHistory,
    RefData,
    Vehicle,
    VehicleDay,
)
from waypoint_rules.schedule import next_operating_day
from waypoint_rules.vocab import Brand, DockType

from ..config import COLOMBO
from ..models import orders as orders_models
from ..models import people, plans, reference
from ..models.enums import Availability, HistoryOutcome, PlanState
from .dispatch_model import (
    AckRow,
    DeferralRow,
    DispatchDay,
    OutletRow,
    TripRow,
    VehicleAvailability,
    VersionRow,
)

#: A morning run is over by midday; after that the "current" run is the next operating day's.
RUN_ENDS = time(12, 0)


def naive(value: datetime | None) -> datetime | None:
    """A database time as naive Asia/Colombo, which is what the rules take."""
    return value.astimezone(COLOMBO).replace(tzinfo=None) if value is not None else None


def aware(value: datetime) -> datetime:
    """A naive Asia/Colombo time from the rules, ready for a timestamptz column."""
    return value.replace(tzinfo=COLOMBO) if value.tzinfo is None else value


# ---- reference data ---------------------------------------------------------


def load_ref(db: Session) -> RefData:
    districts = {
        d.name: District(
            d.name,
            d.depot_id,
            round(d.depot_to_district_freeflow_min),
            d.depot_to_district_km,
            round(d.inter_stop_freeflow_min),
            d.inter_stop_km,
        )
        for d in db.scalars(select(reference.District))
    }
    outlets = {
        o.id: Outlet(
            id=o.id,
            brand=o.brand,
            district=o.district,
            depot=o.depot_id,
            dock_type=o.dock_type,
            window_open=o.window_open,
            window_close=o.window_close,
            van_only=o.parking_constraint == "van_only",
            mall_dock=o.parking_constraint == "mall_dock",
            mall_open=o.mall_window_open,
            mall_close=o.mall_window_close,
        )
        for o in db.scalars(select(reference.Outlet))
    }
    vehicles = {
        v.id: Vehicle(v.id, v.depot_id, v.type, v.temp, v.weight_cap_kg, v.volume_cap_m3, v.km_per_l, v.weekly_fuel_quota_l)
        for v in db.scalars(select(reference.Vehicle))
    }
    allowances: dict[tuple[Brand, DockType], int] = {
        (a.brand, a.dock_type): a.minutes for a in db.scalars(select(reference.ServiceAllowance))
    }
    return RefData(outlets, districts, vehicles, allowances)


def operating_days(db: Session) -> list[date]:
    return sorted(db.scalars(select(reference.CalendarDay.date).where(reference.CalendarDay.is_operating)))


def active_service_date(now: datetime, ops: list[date]) -> date:
    """The run the dispatcher is working on: today's while it is still the morning, otherwise the next operating day's.

    Mon 15:30 and Mon 16:07 are both Tue's run (the queue, then the plan); Tue 03:00 is Tue's; Tue 14:00 is Wed's.
    """
    today = now.date()
    if not ops:
        return today
    if today in ops and now.time() < RUN_ENDS:
        return today
    return next_operating_day(today, ops)


def previous_operating_day(service_date: date, ops: Iterable[date]) -> date | None:
    earlier = [d for d in ops if d < service_date]
    return max(earlier) if earlier else None


CUTOFF = time(16, 0)


def cutoff_at(service_date: date, ops: list[date]) -> datetime:
    """16:00 on the last operating day before ``service_date`` (R-CUTOFF). Naive Asia/Colombo."""
    before = previous_operating_day(service_date, ops) or service_date - timedelta(days=1)
    return datetime.combine(before, CUTOFF)


def outlet_rows(db: Session) -> dict[str, OutletRow]:
    return {
        o.id: OutletRow(
            o.id, o.name or o.id, o.brand, o.district, o.depot_id, o.dock_type,
            o.parking_constraint == "van_only", o.parking_constraint == "mall_dock",
        )
        for o in db.scalars(select(reference.Outlet))
    }


# ---- orders -----------------------------------------------------------------


def outlet_history(db: Session, service_date: date, ops: list[date]) -> dict[str, OutletHistory]:
    """Continuity input per outlet: deferred on the previous run, and days since last served (PRD §4a R-CONT)."""
    yesterday = previous_operating_day(service_date, ops) or service_date
    rows = db.scalars(select(orders_models.OutletServiceHistory).where(orders_models.OutletServiceHistory.service_date < service_date))
    deferred: set[str] = set()
    last_served: dict[str, date] = {}
    for r in rows:
        if r.outcome is HistoryOutcome.DEFERRED and r.service_date == yesterday:
            deferred.add(r.outlet_id)
        if r.outcome in (HistoryOutcome.SERVED, HistoryOutcome.PARTIAL) and r.service_date > last_served.get(r.outlet_id, date.min):
            last_served[r.outlet_id] = r.service_date
    out: dict[str, OutletHistory] = {}
    for outlet_id in deferred | set(last_served):
        days = (service_date - last_served[outlet_id]).days if outlet_id in last_served else 1
        out[outlet_id] = OutletHistory(outlet_id in deferred, max(1, days))
    return out


def day_orders(db: Session, service_date: date, ops: list[date], *, statuses: Iterable[str] | None = None) -> dict[str, Order]:
    """The day's orders as rules ``Order`` values, continuity inputs applied. Cancelled orders are not part of the day."""
    wanted = set(statuses) if statuses is not None else None
    history = outlet_history(db, service_date, ops)
    rows = db.scalars(
        select(orders_models.Order)
        .where(orders_models.Order.service_date == service_date, orders_models.Order.cancelled_at.is_(None))
        .order_by(orders_models.Order.id)
    )
    out: dict[str, Order] = {}
    for o in rows:
        if wanted is not None and o.status.value not in wanted:
            continue
        past = history.get(o.outlet_id)
        out[o.id] = Order(
            o.id,
            o.outlet_id,
            o.temp,
            o.units,
            o.weight_kg,
            o.volume_m3,
            past.deferred_yesterday if past else False,
            past.days_since_served if past else 1,
        )
    return out


# ---- vehicles ---------------------------------------------------------------


def vehicle_days(db: Session, service_date: date) -> tuple[dict[str, VehicleDay], dict[str, VehicleAvailability]]:
    """Per vehicle: the rules' day state (held, back from the workshop at, fuel used this week) and the screen's."""
    iso = service_date.isocalendar()
    fuel = {
        f.vehicle_id: f.used_before_l
        for f in db.scalars(
            select(plans.FuelLedger).where(plans.FuelLedger.iso_year == iso.year, plans.FuelLedger.iso_week == iso.week)
        )
    }
    status = {s.vehicle_id: s for s in db.scalars(select(plans.VehicleDayStatus).where(plans.VehicleDayStatus.service_date == service_date))}
    days: dict[str, VehicleDay] = {}
    avail: dict[str, VehicleAvailability] = {}
    for vid in db.scalars(select(reference.Vehicle.id).order_by(reference.Vehicle.id)):
        s = status.get(vid)
        workshop = s is not None and s.availability is Availability.IN_WORKSHOP
        back = naive(s.available_from) if s is not None else None
        days[vid] = VehicleDay(
            vid,
            available_from=back if workshop else None,
            held=s is not None and s.held_at is not None,
            fuel_used_before_l=fuel.get(vid, 0.0),
        )
        avail[vid] = VehicleAvailability(workshop, back, s.replaced_by if s is not None else None)
    return days, avail


# ---- plans ------------------------------------------------------------------


def _version_row(v: plans.PlanVersion) -> VersionRow:
    return VersionRow(v.id, v.number, v.state, v.note, v.created_by, naive(v.created_at) or v.created_at, naive(v.released_at))


def versions_of(db: Session, service_date: date) -> list[plans.PlanVersion]:
    return list(db.scalars(select(plans.PlanVersion).where(plans.PlanVersion.service_date == service_date).order_by(plans.PlanVersion.number)))


def latest_version(db: Session, service_date: date) -> plans.PlanVersion | None:
    return db.scalars(
        select(plans.PlanVersion).where(plans.PlanVersion.service_date == service_date).order_by(plans.PlanVersion.number.desc()).limit(1)
    ).first()


def trips_of(db: Session, version_id: int) -> list[TripRow]:
    trips = list(db.scalars(select(plans.Trip).where(plans.Trip.plan_version_id == version_id).order_by(plans.Trip.vehicle_id, plans.Trip.trip_no)))
    if not trips:
        return []
    stops: dict[int, list[tuple[int, str]]] = {}
    for to in db.scalars(select(plans.TripOrder).where(plans.TripOrder.trip_id.in_([t.id for t in trips]))):
        stops.setdefault(to.trip_id, []).append((to.seq, to.order_id))
    return [
        TripRow(
            t.vehicle_id,
            t.trip_no,
            t.brand,
            t.district,
            naive(t.depart_at) or t.depart_at,
            tuple(oid for _, oid in sorted(stops.get(t.id, []))),
        )
        for t in trips
    ]


def deferrals_of(db: Session, version_id: int, *, include_withdrawn: bool = False) -> list[DeferralRow]:
    query = select(orders_models.Deferral).where(orders_models.Deferral.plan_version_id == version_id)
    if not include_withdrawn:
        query = query.where(orders_models.Deferral.withdrawn_at.is_(None))
    return [
        DeferralRow(
            d.id,
            d.order_id,
            d.type,
            d.binding,
            d.reason_text,
            dict(d.impact or {}),
            dict(d.frees or {}),
            d.next_run_date,
            d.decided_by,
            naive(d.decided_at),
            naive(d.notice_sent_at),
            naive(d.notice_seen_at),
        )
        for d in db.scalars(query.order_by(orders_models.Deferral.order_id))
    ]


def acks_of(db: Session, version_id: int) -> list[AckRow]:
    return [
        AckRow(a.actor_kind, a.depot_id, a.driver_vehicle_id, naive(a.acknowledged_at) or a.acknowledged_at)
        for a in db.scalars(select(plans.Acknowledgement).where(plans.Acknowledgement.plan_version_id == version_id))
    ]


def load_day(db: Session, service_date: date, now: datetime, *, version: int | None = None) -> DispatchDay:
    """The dispatcher's picture of one service date at plan ``version`` (the latest when omitted)."""
    ops = operating_days(db)
    ref = load_ref(db)
    days, avail = vehicle_days(db, service_date)
    outlets = outlet_rows(db)
    day = DispatchDay(
        service_date=service_date,
        now=now,
        ref=ref,
        orders=day_orders(db, service_date, ops),
        outlets=outlets,
        plannable=set(day_orders(db, service_date, ops, statuses=("confirmed", "planned", "deferred"))),
        vehicle_days=days,
        availability=avail,
        drivers={d.vehicle_id: d.name for d in db.scalars(select(people.Driver))},
        loaders={p.depot_id: p.name for p in db.scalars(select(people.PinPerson).order_by(people.PinPerson.id))},
    )
    versions = versions_of(db, service_date)
    day.versions = [_version_row(v) for v in versions]
    if not versions:
        return day
    chosen = next((v for v in versions if v.number == version), None) if version is not None else versions[-1]
    if chosen is None:
        return day
    day.chosen = _version_row(chosen)
    day.trips = trips_of(db, chosen.id)
    day.deferrals = deferrals_of(db, chosen.id)
    day.acks = acks_of(db, chosen.id)
    before = [v for v in versions if v.number < chosen.number]
    if before:
        day.earlier_deferred = {d.order_id for d in deferrals_of(db, before[-1].id)}
    released_before = [v for v in before if v.state is PlanState.RELEASED]
    if released_before:
        prev = released_before[-1]
        day.previous = _version_row(prev)
        day.previous_trips = trips_of(db, prev.id)
        day.previous_acks = acks_of(db, prev.id)
    return day


def next_version_number(db: Session, service_date: date) -> int:
    return (db.scalar(select(func.max(plans.PlanVersion.number)).where(plans.PlanVersion.service_date == service_date)) or 0) + 1
