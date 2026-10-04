"""Database reads for the driver's endpoints. Plain rows out; ``driver_views`` shapes them."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules.vocab import OrderStatus

from ..models import field as f
from ..models import plans
from ..models.comms import Notice
from ..models.enums import ActorKind, AudienceKind, Availability, ConflictRecommendation, DeviceRecordType, PlanState
from ..models.orders import Order
from ..models.people import Driver, PinPerson
from ..models.reference import CalendarDay, Outlet, ServiceAllowance, Vehicle
from .conflict_views import short_units
from .driver_rows import ConfirmationRow, NoticeRow, ResolutionRow, StopRow, TripChoice, VehicleRow
from .live_repo import conflict_row


def latest_released(db: Session, day: date) -> plans.PlanVersion | None:
    """The newest released plan version for the day, or None before the first release."""
    return db.scalars(
        select(plans.PlanVersion)
        .where(plans.PlanVersion.service_date == day, plans.PlanVersion.state == PlanState.RELEASED)
        .order_by(plans.PlanVersion.number.desc())
        .limit(1)
    ).first()


def calendar_day(db: Session, day: date) -> CalendarDay | None:
    """The calendar row for the day, or None when the calendar does not cover it."""
    return db.get(CalendarDay, day)


def _runs(db: Session, day: date, vehicle_id: str) -> dict[int, f.Run]:
    """The vehicle's runs that day by trip number, whichever version's trip row each was started on."""
    rows = db.execute(
        select(plans.Trip.trip_no, f.Run)
        .join(plans.Trip, plans.Trip.id == f.Run.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(plans.Trip.vehicle_id == vehicle_id, plans.PlanVersion.service_date == day)
        .order_by(f.Run.id)
    ).all()
    return {trip_no: run for trip_no, run in rows}


def departed_at(db: Session, day: date, vehicle_id: str, trip_no: int) -> datetime | None:
    """When this trip's run actually left, if it has."""
    run = _runs(db, day, vehicle_id).get(trip_no)
    return run.departed_at if run is not None else None


def trips(db: Session, version: plans.PlanVersion, vehicle_id: str) -> dict[int, plans.Trip]:
    """The vehicle's trips in one plan version, by trip number."""
    rows = db.scalars(select(plans.Trip).where(plans.Trip.plan_version_id == version.id, plans.Trip.vehicle_id == vehicle_id))
    return {t.trip_no: t for t in rows}


def trip_choices(db: Session, day: date, vehicle_id: str, trip_nos: list[int]) -> list[TripChoice]:
    """Each trip number with whether its run is finished, for choosing the current trip."""
    runs = _runs(db, day, vehicle_id)
    return [TripChoice(n, runs[n].finished_at is not None if n in runs else False) for n in trip_nos]


def _trips_across_versions(db: Session, day: date, vehicle_id: str, trip_no: int) -> list[int]:
    """Trip ids of this vehicle trip in every released version of the day, oldest first."""
    return list(
        db.scalars(
            select(plans.Trip.id)
            .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
            .where(
                plans.PlanVersion.service_date == day,
                plans.PlanVersion.state == PlanState.RELEASED,
                plans.Trip.vehicle_id == vehicle_id,
                plans.Trip.trip_no == trip_no,
            )
            .order_by(plans.PlanVersion.number)
        )
    )


def stops(db: Session, day: date, version: plans.PlanVersion, trip: plans.Trip) -> list[StopRow]:
    """The trip's orders, each with its outlet, ready to shape into stops."""
    on_trip = _trip_orders(db, day, version, trip)
    if not on_trip:
        return []
    rows = db.execute(select(Order, Outlet).join(Outlet, Outlet.id == Order.outlet_id).where(Order.id.in_(list(on_trip)))).all()
    allowances = {(a.brand, a.dock_type): a.minutes for a in db.scalars(select(ServiceAllowance))}
    return [
        StopRow(
            order_id=order.id, outlet_id=outlet.id, outlet_name=outlet.name, seq=on_trip[order.id].seq, temp=order.temp,
            units=order.units, status=OrderStatus(order.status.value), tags=_stop_tags(order), window_open=outlet.window_open,
            window_close=outlet.window_close, planned_arrival=on_trip[order.id].planned_arrival, brand=outlet.brand,
            district=outlet.district, dock=outlet.dock_type, parking_constraint=outlet.parking_constraint,
            handling_minutes=_handling_minutes(on_trip[order.id]), allowance_minutes=allowances.get((outlet.brand, outlet.dock_type)),
            weight_kg=order.weight_kg, volume_m3=order.volume_m3,
        )
        for order, outlet in rows
    ]


def _trip_orders(db: Session, day: date, version: plans.PlanVersion, trip: plans.Trip) -> dict[str, plans.TripOrder]:
    """The trip's orders in the latest version, plus orders a later version took off it without moving them elsewhere.

    The 05:21 deferral takes ORD2001 + ORD2002 off VEH039 in v5. The phone still has them, may already have delivered
    them, and has to see the server's answer (Deferred, then Conflict) on the same stop.
    """
    on_trip = {to.order_id: to for to in db.scalars(select(plans.TripOrder).where(plans.TripOrder.trip_id == trip.id))}
    planned_now = set(
        db.scalars(
            select(plans.TripOrder.order_id).join(plans.Trip, plans.Trip.id == plans.TripOrder.trip_id).where(plans.Trip.plan_version_id == version.id)
        )
    )
    for trip_id in reversed(_trips_across_versions(db, day, trip.vehicle_id, trip.trip_no)):
        for to in db.scalars(select(plans.TripOrder).where(plans.TripOrder.trip_id == trip_id)):
            if to.order_id not in on_trip and to.order_id not in planned_now:
                on_trip[to.order_id] = to
    return on_trip


def _stop_tags(order: Order) -> tuple[str, ...]:
    """The temperature first ("Chilled", "Ambient"), then the order's own tags: the phone shows the first as a chip."""
    temp = order.temp.value.capitalize()
    return (temp, *[t for t in (order.tags or []) if t != temp])


def _handling_minutes(to: plans.TripOrder) -> int | None:
    if to.planned_handling_start is None or to.planned_handling_end is None:
        return None
    return round((to.planned_handling_end - to.planned_handling_start).total_seconds() / 60)


def vehicle(db: Session, day: date, vehicle_id: str) -> VehicleRow | None:
    """The vehicle and its availability that day."""
    v = db.get(Vehicle, vehicle_id)
    if v is None:
        return None
    status = db.get(plans.VehicleDayStatus, (vehicle_id, day))
    return VehicleRow(
        kind=v.type, temperature=v.temp, weight_cap_kg=v.weight_cap_kg, volume_cap_m3=v.volume_cap_m3, km_per_l=v.km_per_l,
        in_workshop=status is not None and status.availability is Availability.IN_WORKSHOP,
        held=status is not None and status.held_at is not None,
        replaced=status is not None and status.replaced_by is not None,
    )


def driver_name(db: Session, vehicle_id: str) -> str | None:
    """The name of the driver assigned to the vehicle."""
    d = db.get(Driver, vehicle_id)
    return d.name if d else None


def acknowledged(db: Session, version: plans.PlanVersion, vehicle_id: str) -> bool:
    """Whether this driver acknowledged the version the run is on (an older version's acknowledgement does not count)."""
    return (
        db.scalar(
            select(plans.Acknowledgement.id)
            .where(
                plans.Acknowledgement.plan_version_id == version.id,
                plans.Acknowledgement.actor_kind == ActorKind.DRIVER,
                plans.Acknowledgement.driver_vehicle_id == vehicle_id,
            )
            .limit(1)
        )
        is not None
    )


def confirmation(db: Session, day: date, vehicle_id: str, trip_no: int) -> ConfirmationRow | None:
    """The loader's gate for this vehicle trip, in whichever version it was confirmed, with any short loads."""
    trip_ids = _trips_across_versions(db, day, vehicle_id, trip_no)
    if not trip_ids:
        return None
    gate = db.scalars(
        select(plans.LoadGate).where(plans.LoadGate.trip_id.in_(trip_ids)).order_by(plans.LoadGate.confirmed_at.desc()).limit(1)
    ).first()
    if gate is None:
        return None
    short: dict[str, int] = {}
    for check in db.scalars(select(plans.LoadCheck).where(plans.LoadCheck.trip_id.in_(trip_ids)).order_by(plans.LoadCheck.checked_at)):
        short[check.order_id] = max(check.units_expected - check.units_loaded, 0)  # the latest check of an order wins
    return ConfirmationRow(
        by=_confirmed_by(db, gate, vehicle_id, trip_no), at=gate.confirmed_at,
        shortfalls=tuple((o, n) for o, n in sorted(short.items()) if n > 0),
    )


def _confirmed_by(db: Session, gate: plans.LoadGate, vehicle_id: str, trip_no: int) -> str | None:
    """Who confirmed the load. The tablet may send a name instead of a PIN id, so fall back to the confirming record."""
    if gate.confirmed_by_pin is not None:
        person = db.get(PinPerson, gate.confirmed_by_pin)
        if person is not None:
            return person.name
    rec = db.scalars(
        select(f.DeviceRecord)
        .where(
            f.DeviceRecord.type == DeviceRecordType.LOADER_CONFIRM_LOADED,
            f.DeviceRecord.vehicle_id == vehicle_id,
            f.DeviceRecord.trip_id == gate.trip_id,
            f.DeviceRecord.device_time == gate.confirmed_at,
        )
        .limit(1)
    ).first()
    if rec is None:
        return None
    name = (rec.payload or {}).get("personName") or rec.actor
    return str(name) if name else None


def notices(db: Session, vehicle_id: str, since: datetime | None) -> list[NoticeRow]:
    """The vehicle's notices newer than ``since``, newest first."""
    query = select(Notice).where(Notice.audience_kind == AudienceKind.DRIVER, Notice.vehicle_id == vehicle_id)
    if since is not None:
        query = query.where(Notice.created_at > since)
    return [
        # The phone keeps its own read state, so the server reports every notice as unread.
        NoticeRow(id=n.id, tag=n.tag.value, title=n.title, body=n.body, created_at=n.created_at, read=False, refs=dict(n.refs or {}))
        for n in db.scalars(query.order_by(Notice.created_at.desc(), Notice.id.desc()))
    ]


def resolution(db: Session, conflict_id: int) -> ResolutionRow | None:
    """Dispatch's decision on a conflict, or None while it is still open."""
    c = db.get(f.Conflict, conflict_id)
    if c is None or c.resolution is None or not c.order_ids:
        return None
    first = db.get(Order, c.order_ids[0])
    if first is None:
        return None
    units = None
    if c.resolution == ConflictRecommendation.KEEP_PARTIAL.value:
        _, received, _ = short_units(conflict_row(c))
        units = received
    return ResolutionRow(outlet_id=first.outlet_id, decision=c.resolution, by=c.resolved_by, units=units)


def finished_runs(db: Session, vehicle_id: str) -> list[tuple[f.Run, plans.Trip, date]]:
    """The vehicle's finished runs with their trip and day, newest first."""
    return [
        (run, trip, day)
        for run, trip, day in db.execute(
            select(f.Run, plans.Trip, plans.PlanVersion.service_date)
            .join(plans.Trip, plans.Trip.id == f.Run.trip_id)
            .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
            .where(plans.Trip.vehicle_id == vehicle_id, f.Run.finished_at.is_not(None))
            .order_by(plans.PlanVersion.service_date.desc(), plans.Trip.trip_no.desc())
        ).all()
    ]


def trip_order_counts(db: Session, day: date, vehicle_id: str, trip_no: int) -> tuple[int, int]:
    """(stops, delivered) for a vehicle trip across the day's versions: distinct outlets, and orders delivered in full or part."""
    trip_ids = _trips_across_versions(db, day, vehicle_id, trip_no)
    if not trip_ids:
        return 0, 0
    orders = list(
        db.scalars(
            select(Order).join(plans.TripOrder, plans.TripOrder.order_id == Order.id).where(plans.TripOrder.trip_id.in_(trip_ids)).distinct()
        )
    )
    delivered = sum(1 for o in orders if o.status.value in (OrderStatus.DELIVERED.value, OrderStatus.PARTIAL.value))
    return len({o.outlet_id for o in orders}), delivered
