"""LoaderApi reads: the dock board (L1), the PIN sheet, a trip's load list (L2), a flag (L3) and a plan diff (L4).

The loader's writes are outbox records applied by ``services.sync``; nothing here changes state, so nothing here writes
an audit row. Two facts shape every query:

- **The dock is a device setting**, not an account (PRD §9 Auth). One shared tablet account reaches both docks, so a dock
  is a path value checked against ``depots.id``, and a vehicle belongs to a dock through ``vehicles.depot_id``.
- **A new plan version means new ``trips`` rows.** Anything the dock already recorded against a trip (``load_checks``,
  ``load_gates``) is therefore matched by ``(service_date, vehicle_id, trip_no)`` and not by ``trip_id``, the same way
  ``sync._run`` does. A reload after a vehicle swap starts from zero, because the vehicle id is part of that key.

The loader only ever sees released plan versions.
"""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import clock
from ..auth import verify_secret
from ..config import COLOMBO
from ..deps import CurrentUser, require_depot, require_vehicle
from ..errors import ApiError, not_found
from ..models import field, plans, reference
from ..models import orders as order_models
from ..models.enums import ActorKind, ExceptionKind, ExceptionStatus, PlanState
from ..models.people import PinPerson
from ..schemas.common import Window
from ..schemas.loader import (
    DockOut,
    DockVehicleOut,
    LoaderExceptionOut,
    LoadLineOut,
    LoadPlanOut,
    PinPersonOut,
    PlanDiffLineOut,
    PlanDiffOut,
    VerifyPinOut,
)
from . import planning_repo as repo

#: A loader's flag is this kind of exception. The other kinds are the driver's and the store's, which a dock must not read.
LOADER_KIND = ExceptionKind.LOADER_SHORTFALL


# ---- shared lookups ---------------------------------------------------------


def _context(db: Session) -> tuple[date, plans.PlanVersion | None]:
    """The run the dock is working on and its latest released version (``None`` before the first release)."""
    now = clock.now(db)
    service_date = repo.active_service_date(now.replace(tzinfo=None), repo.operating_days(db))
    latest = db.scalars(
        select(plans.PlanVersion)
        .where(plans.PlanVersion.service_date == service_date, plans.PlanVersion.state == PlanState.RELEASED)
        .order_by(plans.PlanVersion.number.desc())
        .limit(1)
    ).first()
    return service_date, latest


def _dock(db: Session, dock: str, user: CurrentUser) -> str:
    """The dock as a depot id. The shared tablet is bound to neither depot, so the scope check is a no-op for it."""
    if db.get(reference.Depot, dock) is None:
        raise not_found(f"Dock {dock}")
    require_depot(user, dock)
    return dock


def _hm(value: datetime | None) -> str:
    return value.astimezone(COLOMBO).strftime("%H:%M") if value is not None else ""


def _people(db: Session, dock: str) -> list[PinPersonOut]:
    """The PIN people who work this dock. ``pin_hash`` never leaves this module."""
    rows = db.scalars(select(PinPerson).where(PinPerson.depot_id == dock).order_by(PinPerson.name))
    return [PinPersonOut(id=p.id, name=p.name, dock=p.depot_id) for p in rows]


def _order_counts(db: Session, trip_ids: list[int]) -> dict[int, int]:
    if not trip_ids:
        return {}
    rows = db.execute(
        select(plans.TripOrder.trip_id, func.count())
        .where(plans.TripOrder.trip_id.in_(trip_ids))
        .group_by(plans.TripOrder.trip_id)
    )
    return {trip_id: count for trip_id, count in rows}


# ---- L1: the dock board -----------------------------------------------------


def _held_vehicles(db: Session, service_date: date) -> set[str]:
    """Vehicles with a loader flag still waiting for Dispatch (D8).

    ``vehicle_day_status.held_at`` is only written when Dispatch decides, so until then the open flag is what says Held.
    """
    rows = db.scalars(
        select(field.FieldException.vehicle_id)
        .join(plans.Trip, plans.Trip.id == field.FieldException.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(
            field.FieldException.kind == LOADER_KIND,
            field.FieldException.status == ExceptionStatus.OPEN,
            field.FieldException.vehicle_id.is_not(None),
            plans.PlanVersion.service_date == service_date,
        )
    )
    return {vid for vid in rows if vid is not None}


def _acknowledged(db: Session, version_id: int, dock: str) -> bool:
    """Has this dock acknowledged this version?

    ``sync._loader_ack`` stores the dock the device named in ``depot_id``, which a device may leave out; the PIN person
    who acknowledged always belongs to one dock, so that answers it too.
    """
    row = db.scalars(
        select(plans.Acknowledgement.id)
        .outerjoin(PinPerson, PinPerson.id == plans.Acknowledgement.pin_person_id)
        .where(
            plans.Acknowledgement.plan_version_id == version_id,
            plans.Acknowledgement.actor_kind == ActorKind.PIN_PERSON,
            (plans.Acknowledgement.depot_id == dock) | (PinPerson.depot_id == dock),
        )
        .limit(1)
    ).first()
    return row is not None


def dock_view(db: Session, user: CurrentUser, dock: str) -> DockOut:
    """L1: this dock's vehicles for the latest released plan, with the people who may acknowledge it.

    Before the first release there is no plan to show, which is a state of the screen and not an error: the version is 0
    and the vehicle list empty, and L1 says the plan is not released yet.
    """
    dock = _dock(db, dock, user)
    people = _people(db, dock)
    service_date, latest = _context(db)
    if latest is None:
        return DockOut(dock=dock, plan_version=0, acknowledged=False, people=people, vehicles=[])

    trips = list(
        db.scalars(
            select(plans.Trip)
            .join(reference.Vehicle, reference.Vehicle.id == plans.Trip.vehicle_id)
            .where(plans.Trip.plan_version_id == latest.id, reference.Vehicle.depot_id == dock)
            .order_by(plans.Trip.depart_at, plans.Trip.vehicle_id, plans.Trip.trip_no)
        )
    )
    counts = _order_counts(db, [t.id for t in trips])
    held = _held_vehicles(db, service_date)
    status = {
        s.vehicle_id: s
        for s in db.scalars(select(plans.VehicleDayStatus).where(plans.VehicleDayStatus.service_date == service_date))
    }

    stands_in_for = {s.replaced_by: s.vehicle_id for s in status.values() if s.replaced_by}
    vehicles: list[DockVehicleOut] = []
    for t in trips:
        day = status.get(t.vehicle_id)
        tags: list[str] = []
        if t.vehicle_id in held or (day is not None and day.held_at is not None and day.replaced_by is None):
            tags.append("Held")
        if day is not None and day.replaced_by is not None:
            tags.append("Replaced")
        vehicles.append(
            DockVehicleOut(
                vehicle_id=t.vehicle_id,
                trip_no=t.trip_no,
                depart_at=repo.aware(t.depart_at),
                plan_version=latest.number,
                tags=tags,
                orders=counts.get(t.id, 0),
                kg=t.kg,
                replaces=stands_in_for.get(t.vehicle_id),
                replaced_by=day.replaced_by if day is not None else None,
            )
        )
    return DockOut(
        dock=dock,
        plan_version=latest.number,
        acknowledged=_acknowledged(db, latest.id, dock),
        people=people,
        vehicles=vehicles,
    )


# ---- the PIN sheet ----------------------------------------------------------

#: Wrong PINs per person, as monotonic timestamps. In-process: one API container is what the demo runs
#: (``docs/auth-audit.md`` finding 12).
_WRONG: dict[int, list[float]] = defaultdict(list)
#: Five wrong PINs inside this window locks the person out of the sheet.
PIN_WINDOW_S = 300.0
PIN_TRIES = 5


def reset_attempts() -> None:
    """Forget every wrong PIN. The demo reset should call this, so a mistyped PIN cannot outlive the scenario."""
    _WRONG.clear()


def _too_many(person_id: int) -> bool:
    """Rate limiting is security, not story: it measures real elapsed seconds, so it is the one read that may not use
    ``clock.now`` (a demo reset or a clock jump must not hand out free attempts)."""
    cutoff = time.monotonic() - PIN_WINDOW_S
    recent = [t for t in _WRONG[person_id] if t > cutoff]
    _WRONG[person_id] = recent
    return len(recent) >= PIN_TRIES


def verify_pin(db: Session, person_id: int, pin: str) -> VerifyPinOut:
    """The PIN sheet, used before every acknowledgement and every load-gate confirm.

    An unknown person and a wrong PIN answer the same way: the sheet says the PIN is wrong, never which part was.
    """
    if _too_many(person_id):
        raise ApiError(429, "too_many_attempts", "Too many wrong PINs. Wait a few minutes or ask a lead.")
    person = db.get(PinPerson, person_id)
    if person is None or not verify_secret(pin, person.pin_hash):
        _WRONG[person_id].append(time.monotonic())
        return VerifyPinOut(ok=False)
    _WRONG.pop(person_id, None)
    return VerifyPinOut(ok=True, person=PinPersonOut(id=person.id, name=person.name, dock=person.depot_id))


# ---- L2: the load list ------------------------------------------------------


def _trip_of(db: Session, version_id: int, vehicle_id: str, trip_no: int) -> plans.Trip | None:
    return db.scalars(
        select(plans.Trip).where(
            plans.Trip.plan_version_id == version_id,
            plans.Trip.vehicle_id == vehicle_id,
            plans.Trip.trip_no == trip_no,
        )
    ).first()


def _same_trip_across_versions(service_date: date, vehicle_id: str, trip_no: int):  # noqa: ANN202 - a reusable WHERE
    """Every version's row for one vehicle trip of one day: the key the dock's own records are matched on."""
    return (
        plans.Trip.vehicle_id == vehicle_id,
        plans.Trip.trip_no == trip_no,
        plans.PlanVersion.service_date == service_date,
    )


def _checked_units(db: Session, service_date: date, vehicle_id: str, trip_no: int) -> dict[str, int]:
    """The units counted per order. ``load_checks`` is append-only, so the latest row for an order is the count."""
    rows = db.scalars(
        select(plans.LoadCheck)
        .join(plans.Trip, plans.Trip.id == plans.LoadCheck.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(*_same_trip_across_versions(service_date, vehicle_id, trip_no))
        .order_by(plans.LoadCheck.checked_at, plans.LoadCheck.id)
    )
    return {c.order_id: c.units_loaded for c in rows}


def _confirmed_at(db: Session, service_date: date, vehicle_id: str, trip_no: int) -> datetime | None:
    """When the dock confirmed this trip clear to depart, whichever version's trip row it confirmed."""
    gate = db.scalars(
        select(plans.LoadGate)
        .join(plans.Trip, plans.Trip.id == plans.LoadGate.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(*_same_trip_across_versions(service_date, vehicle_id, trip_no))
        .order_by(plans.LoadGate.confirmed_at.desc())
        .limit(1)
    ).first()
    return repo.aware(gate.confirmed_at) if gate is not None else None


def load_plan(db: Session, user: CurrentUser, vehicle_id: str, trip_no: int) -> LoadPlanOut:
    """L2: one trip's load list, in reverse stop order.

    ``trip_orders.seq`` is the route order, so the last stop is loaded first: ``load_no = n + 1 - seq``. For the hero
    trip (ORD2001, ORD2002, ORD2003 in route order) that is ORD2003 first and ORD2001, the chilled one, last.
    """
    if trip_no not in (1, 2):
        raise ApiError(422, "validation_error", "A trip is 1 or 2", {"trip": trip_no})
    require_vehicle(user, vehicle_id)
    service_date, latest = _context(db)
    trip = _trip_of(db, latest.id, vehicle_id, trip_no) if latest is not None else None
    if trip is None:
        raise not_found(f"Trip {trip_no} of {vehicle_id}")

    rows = list(
        db.execute(
            select(plans.TripOrder, order_models.Order, reference.Outlet)
            .join(order_models.Order, order_models.Order.id == plans.TripOrder.order_id)
            .join(reference.Outlet, reference.Outlet.id == order_models.Order.outlet_id)
            .where(plans.TripOrder.trip_id == trip.id)
            .order_by(plans.TripOrder.seq)
        )
    )
    counted = _checked_units(db, service_date, vehicle_id, trip_no)
    total = len(rows)
    lines = [
        LoadLineOut(
            order_id=order.id,
            outlet_id=order.outlet_id,
            # As elsewhere (``planning_repo.outlet_rows``): an outlet with no name in the reference data shows as its id.
            outlet_name=outlet.name or outlet.id,
            load_no=total + 1 - stop.seq,
            units_expected=order.units,
            units_loaded=counted.get(order.id),
            window=Window(start=outlet.window_open.strftime("%H:%M"), end=outlet.window_close.strftime("%H:%M")),
        )
        for stop, order, outlet in rows
    ]
    lines.sort(key=lambda line: line.load_no)
    day_rows = list(db.scalars(select(plans.VehicleDayStatus).where(plans.VehicleDayStatus.service_date == service_date)))
    return LoadPlanOut(
        vehicle_id=vehicle_id,
        trip_no=trip_no,
        plan_version=latest.number if latest is not None else 0,
        depart_at=repo.aware(trip.depart_at),
        lines=lines,
        confirmed_at=_confirmed_at(db, service_date, vehicle_id, trip_no),
        replaces=next((d.vehicle_id for d in day_rows if d.replaced_by == vehicle_id), None),
        replaced_by=next((d.replaced_by for d in day_rows if d.vehicle_id == vehicle_id), None),
    )


# ---- L3: a flag and what Dispatch decided -----------------------------------


def exception_view(db: Session, exception_id: int) -> LoaderExceptionOut:
    """L3.3: the flag the dock raised, and the decision once D8 has made one.

    Dispatch stores the decision under its own keys (``plan``, with who and when in their own columns). The three the
    dock's sheet reads, ``version``, ``by`` and ``at``, are added to that dict; nothing stored is replaced.
    """
    e = db.get(field.FieldException, exception_id)
    if e is None or e.kind is not LOADER_KIND:
        raise not_found(f"Flag {exception_id}")
    trip = db.get(plans.Trip, e.trip_id) if e.trip_id is not None else None
    decision: dict | None = None
    if e.decision is not None:
        decision = dict(e.decision)
        decision.setdefault("version", decision.get("plan"))
        decision.setdefault("by", e.decided_by)
        decision.setdefault("at", _hm(e.decided_at))
    return LoaderExceptionOut(
        id=e.id,
        type=e.type,
        vehicle_id=e.vehicle_id,
        trip_no=trip.trip_no if trip is not None else None,
        order_ids=list(e.order_ids or []),
        units_short=e.units_short,
        detail=e.detail,
        # When the dock actually flagged it (02:55 for the reefer), not when the record reached the server.
        raised_at=repo.aware(e.device_time or e.raised_at),
        status=e.status.value,
        decision=decision,
    )


# ---- L4: what changed between two released versions -------------------------


@dataclass(frozen=True, slots=True)
class TripShape:
    """One trip as the diff sees it: who drives it, when it leaves and the orders on it in route order."""

    vehicle_id: str
    trip_no: int
    depart_at: datetime | None
    order_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class _Where:
    vehicle_id: str
    trip_no: int
    seq: int

    def label(self) -> str:
        return f"{self.vehicle_id} · trip {self.trip_no} · stop {self.seq}"


def _places(trips: list[TripShape]) -> dict[str, _Where]:
    return {
        order_id: _Where(t.vehicle_id, t.trip_no, i + 1)
        for t in trips
        for i, order_id in enumerate(t.order_ids)
    }


def _swaps(before: list[TripShape], after: list[TripShape]) -> dict[str, str]:
    """Vehicle replacements, as old id to new id.

    A swap looks like this: a vehicle that had trips and now has none, whose orders have mostly moved to a vehicle that
    had none and now has trips. That is the reefer swap (VEH003 to VEH036) and it is one change, not one per order. A
    replacement that was already driving in ``before`` is not detected, and its orders then read as ordinary moves.
    """
    old = {t.vehicle_id for t in before}
    new = {t.vehicle_id for t in after}
    gone, arrived = old - new, new - old
    if not gone or not arrived:
        return {}
    places = _places(after)
    pairs: dict[str, str] = {}
    for vehicle in sorted(gone):
        moved_to: defaultdict[str, int] = defaultdict(int)
        for t in before:
            if t.vehicle_id != vehicle:
                continue
            for order_id in t.order_ids:
                place = places.get(order_id)
                if place is not None and place.vehicle_id in arrived:
                    moved_to[place.vehicle_id] += 1
        if moved_to:
            pairs[vehicle] = max(sorted(moved_to), key=lambda v: moved_to[v])
    return pairs


def diff_lines(before: list[TripShape], after: list[TripShape]) -> list[PlanDiffLineOut]:
    """What changed from one released version to the next, loudest first (L4): removed, vehicle, moved, added, time.

    Pure: no database. Each group is sorted so the same two plans always give the same list.
    """
    was, now = _places(before), _places(after)
    pairs = _swaps(before, after)
    replaced = set(pairs)

    removed = [
        PlanDiffLineOut(
            vehicle_id=place.vehicle_id, trip_no=place.trip_no, change="removed", order_id=order_id,
            before=f"{place.vehicle_id} · trip {place.trip_no}",
        )
        for order_id, place in sorted(was.items())
        if order_id not in now
    ]

    # One line per trip of the vehicle taking over. The dock marks every vehicle absent from the diff as unchanged, so
    # the new vehicle has to be the one named here.
    vehicle_lines = [
        PlanDiffLineOut(vehicle_id=new, trip_no=t.trip_no, change="vehicle", before=old, after=new)
        for old, new in sorted(pairs.items())
        for t in sorted((t for t in after if t.vehicle_id == new), key=lambda t: t.trip_no)
    ]

    moved = []
    for order_id, place in sorted(now.items()):
        gone = was.get(order_id)
        if gone is None or gone == place:
            continue
        if gone.vehicle_id in replaced and pairs[gone.vehicle_id] == place.vehicle_id:
            continue  # the swap above already says this
        moved.append(
            PlanDiffLineOut(
                vehicle_id=place.vehicle_id, trip_no=place.trip_no, change="moved", order_id=order_id,
                before=gone.label(), after=place.label(),
            )
        )

    added = [
        PlanDiffLineOut(
            vehicle_id=place.vehicle_id, trip_no=place.trip_no, change="added", order_id=order_id,
            after=f"{place.vehicle_id} · trip {place.trip_no}",
        )
        for order_id, place in sorted(now.items())
        if order_id not in was
    ]

    departures = {(t.vehicle_id, t.trip_no): t.depart_at for t in before}
    time_lines = [
        PlanDiffLineOut(
            vehicle_id=t.vehicle_id, trip_no=t.trip_no, change="time",
            before=_hm(departures[(t.vehicle_id, t.trip_no)]), after=_hm(t.depart_at),
        )
        for t in sorted(after, key=lambda t: (t.vehicle_id, t.trip_no))
        if (t.vehicle_id, t.trip_no) in departures
        and _hm(departures[(t.vehicle_id, t.trip_no)]) != _hm(t.depart_at)
    ]

    return removed + vehicle_lines + moved + added + time_lines


def _released(db: Session, service_date: date, number: int) -> plans.PlanVersion:
    version = db.scalars(
        select(plans.PlanVersion).where(
            plans.PlanVersion.service_date == service_date,
            plans.PlanVersion.number == number,
            plans.PlanVersion.state == PlanState.RELEASED,
        )
    ).first()
    if version is None:
        raise not_found(f"Released plan v{number}")
    return version


def _shapes(db: Session, version_id: int, dock: str) -> list[TripShape]:
    """This dock's trips in one version, each with its orders in route order."""
    trips = list(
        db.scalars(
            select(plans.Trip)
            .join(reference.Vehicle, reference.Vehicle.id == plans.Trip.vehicle_id)
            .where(plans.Trip.plan_version_id == version_id, reference.Vehicle.depot_id == dock)
            .order_by(plans.Trip.vehicle_id, plans.Trip.trip_no)
        )
    )
    if not trips:
        return []
    stops: defaultdict[int, list[tuple[int, str]]] = defaultdict(list)
    for stop in db.scalars(select(plans.TripOrder).where(plans.TripOrder.trip_id.in_([t.id for t in trips]))):
        stops[stop.trip_id].append((stop.seq, stop.order_id))
    return [
        TripShape(t.vehicle_id, t.trip_no, repo.aware(t.depart_at), tuple(oid for _, oid in sorted(stops[t.id])))
        for t in trips
    ]


def plan_diff(db: Session, user: CurrentUser, dock: str, from_version: int, to_version: int) -> PlanDiffOut:
    """L4: what changed at this dock between two released versions of the run it is working on."""
    dock = _dock(db, dock, user)
    if from_version > to_version:
        raise ApiError(
            422, "validation_error", "A plan diff reads forwards: from an earlier version to a later one",
            {"from": from_version, "to": to_version},
        )
    service_date, _ = _context(db)
    first = _released(db, service_date, from_version)
    second = first if to_version == from_version else _released(db, service_date, to_version)
    lines = [] if from_version == to_version else diff_lines(_shapes(db, first.id, dock), _shapes(db, second.id, dock))
    return PlanDiffOut(dock=dock, from_version=from_version, to_version=to_version, lines=lines)
