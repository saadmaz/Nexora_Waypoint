"""The driver's and the loader's reads (PRD §19 DriverApi, LoaderApi).

Both roles write through ``POST /sync`` (``services/sync``); this module is the other half, what their screens read: the
route package, the notices, the run history, the dock's vehicles, the load list, a flag and a plan diff. The latest
*released* plan is the one they work from; a draft is never shown to the field. Callers do not commit: these are reads.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from waypoint_rules.vocab import OrderStatus

from .. import clock
from ..auth import verify_secret
from ..deps import CurrentUser, require_depot
from ..errors import ApiError, forbidden, not_found
from ..models import field as f
from ..models import orders as om
from ..models import people, plans, reference
from ..models.comms import Notice
from ..models.enums import ActorKind, ExceptionStatus, NoticeTag, PlanState
from ..schemas import driver as ds
from ..schemas import loader as ls
from ..schemas.common import Window
from . import planning_repo as repo

DELIVERED_LIKE = {OrderStatus.DELIVERED, OrderStatus.PARTIAL, OrderStatus.ISSUE}


def _released(db: Session, service_date: date) -> plans.PlanVersion | None:
    return db.scalars(
        select(plans.PlanVersion)
        .where(plans.PlanVersion.service_date == service_date, plans.PlanVersion.state == PlanState.RELEASED)
        .order_by(plans.PlanVersion.number.desc())
        .limit(1)
    ).first()


def _active_released(db: Session) -> plans.PlanVersion | None:
    """The released plan of the run in progress: the active service date's, else the newest one released."""
    now = clock.now(db).replace(tzinfo=None)
    version = _released(db, repo.active_service_date(now, repo.operating_days(db)))
    if version is not None:
        return version
    return db.scalars(
        select(plans.PlanVersion).where(plans.PlanVersion.state == PlanState.RELEASED).order_by(plans.PlanVersion.service_date.desc(), plans.PlanVersion.number.desc()).limit(1)
    ).first()


def _run_of(db: Session, service_date: date, vehicle_id: str, trip_no: int) -> f.Run | None:
    """The run of one vehicle trip, whichever plan version's trip row it was started on."""
    return db.scalars(
        select(f.Run)
        .join(plans.Trip, plans.Trip.id == f.Run.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(f.Run.vehicle_id == vehicle_id, plans.Trip.trip_no == trip_no, plans.PlanVersion.service_date == service_date)
        .order_by(f.Run.id.desc())
        .limit(1)
    ).first()


def _hhmm(value: datetime | None) -> str:
    local = repo.naive(value)
    return f"{local:%H:%M}" if local else ""


# ---- driver -----------------------------------------------------------------------------


def _driver_vehicle(user: CurrentUser) -> str:
    if user.vehicle_id is None:
        raise forbidden("This account is not linked to a vehicle")
    return user.vehicle_id


def run(db: Session, user: CurrentUser, day: date) -> ds.RunOut:
    """R1: the route package for one day. The trip is the first one not yet finished, else the last."""
    vehicle = _driver_vehicle(user)
    version = _released(db, day)
    if version is None:
        raise not_found(f"A released plan for {day:%a %d %b}")
    trips = list(db.scalars(select(plans.Trip).where(plans.Trip.plan_version_id == version.id, plans.Trip.vehicle_id == vehicle).order_by(plans.Trip.trip_no)))
    if not trips:
        raise not_found(f"A trip for {vehicle} on {day:%a %d %b}")
    trip = next((t for t in trips if (r := _run_of(db, day, vehicle, t.trip_no)) is None or r.finished_at is None), trips[-1])

    rows = db.execute(
        select(plans.TripOrder, om.Order, reference.Outlet)
        .join(om.Order, om.Order.id == plans.TripOrder.order_id)
        .join(reference.Outlet, reference.Outlet.id == om.Order.outlet_id)
        .where(plans.TripOrder.trip_id == trip.id)
        .order_by(plans.TripOrder.seq)
    ).all()
    stops = [
        ds.RunStopOut(
            order_id=order.id, outlet_id=outlet.id, outlet_name=outlet.name or f"Waypoint {outlet.brand.value}", seq=to.seq, temp=order.temp,
            units=order.units, window=Window(start=f"{outlet.window_open:%H:%M}", end=f"{outlet.window_close:%H:%M}"),
            planned_arrival=to.planned_arrival, status=OrderStatus(order.status.value),
            tags=[order.temp.value.capitalize(), *[t for t in (order.tags or []) if t != order.temp.value.capitalize()]],
        )
        for to, order, outlet in rows
    ]
    driver = db.get(people.Driver, vehicle)
    acknowledged = db.scalar(
        select(func.count()).select_from(plans.Acknowledgement).where(plans.Acknowledgement.plan_version_id == version.id, plans.Acknowledgement.vehicle_id == vehicle)
    )
    return ds.RunOut(
        date=day, vehicle_id=vehicle, trip_no=trip.trip_no, plan_version=version.number, driver=driver.name if driver else None,
        depart_at=trip.depart_at, planned_km=trip.planned_km, stops=stops, acknowledged=bool(acknowledged), server_time=clock.now(db),
    )


def _notice_kind(n: Notice) -> str:
    """The kind the phone has a screen for (``DriverNoticeKind``). Dispatch's answer to a review is "resolved"."""
    if n.tag is NoticeTag.REVIEW:
        return "resolved" if "resolved" in n.title.lower() else "sent_for_review"
    return "plan_released"


def notices(db: Session, user: CurrentUser, since: datetime | None) -> list[ds.NoticeOut]:
    """R8: notices for this driver's vehicle, newest first. A resolution names its stop so the phone can clear the conflict."""
    vehicle = _driver_vehicle(user)
    query = select(Notice).where(Notice.audience == f"driver:{vehicle}")
    if since is not None:
        query = query.where(Notice.created_at > since)
    rows = list(db.scalars(query.order_by(Notice.created_at.desc(), Notice.id.desc())))
    conflicts = {
        c.id: c for c in db.scalars(select(f.Conflict).where(f.Conflict.id.in_([(n.refs or {}).get("conflictId") for n in rows if (n.refs or {}).get("conflictId")] or [0])))
    }
    out: list[ds.NoticeOut] = []
    for n in rows:
        link: dict[str, Any] = dict(n.link or {})
        conflict = conflicts.get((n.refs or {}).get("conflictId"))
        if conflict is not None and conflict.order_ids:
            first = db.get(om.Order, conflict.order_ids[0])
            if first is not None:
                link["outletId"] = first.outlet_id
            if _notice_kind(n) == "resolved":
                link.update(decision=conflict.resolution, by=conflict.resolved_by or "Dispatch")
                units = ((conflict.server_snapshot or {}).get("storeReport") or {}).get("unitsReceived")
                if isinstance(units, int) and conflict.resolution == "keep_partial":
                    link["units"] = units
        out.append(ds.NoticeOut(id=n.id, tag=_notice_kind(n), title=n.title, body=n.body, created_at=n.created_at, read=n.read_at is not None, link=link or None))
    return out


def history(db: Session, user: CurrentUser) -> list[ds.DriverHistoryRowOut]:
    """R7: this driver's past runs, newest first."""
    vehicle = _driver_vehicle(user)
    out: list[ds.DriverHistoryRowOut] = []
    rows = db.execute(
        select(f.Run, plans.Trip, plans.PlanVersion)
        .join(plans.Trip, plans.Trip.id == f.Run.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(f.Run.vehicle_id == vehicle)
        .order_by(plans.PlanVersion.service_date.desc(), plans.Trip.trip_no.desc())
    ).all()
    for run_row, trip, version in rows:
        statuses = [
            OrderStatus(st.value)
            for (st,) in db.execute(
                select(om.Order.status).join(plans.TripOrder, plans.TripOrder.order_id == om.Order.id).where(plans.TripOrder.trip_id == trip.id)
            )
        ]
        out.append(
            ds.DriverHistoryRowOut(
                date=version.service_date, vehicle_id=vehicle, trip_no=trip.trip_no, stops=len(statuses),
                delivered=sum(1 for st in statuses if st in DELIVERED_LIKE), km=run_row.gps_km, fuel_l=run_row.fuel_l_est,
                departed_at=run_row.departed_at, finished_at=run_row.finished_at,
            )
        )
    return out


# ---- loader -----------------------------------------------------------------------------


def _depot(db: Session, dock: str) -> reference.Depot:
    depot = db.get(reference.Depot, dock)
    if depot is None:
        raise not_found(f"Dock {dock}")
    return depot


def _person(p: people.PinPerson) -> ls.PinPersonOut:
    return ls.PinPersonOut(id=p.id, name=p.name, dock=p.dock)


def dock(db: Session, user: CurrentUser, dock_id: str) -> ls.DockOut:
    """L1: the dock's vehicles for the current plan, with the PIN people who work it."""
    depot = _depot(db, dock_id)
    require_depot(user, depot.id)
    version = _active_released(db)
    if version is None:
        raise ApiError(409, "not_released", "No plan has been released yet. The dock opens when Dispatch releases it.")
    service_date = version.service_date
    trips = list(
        db.scalars(
            select(plans.Trip)
            .join(reference.Vehicle, reference.Vehicle.id == plans.Trip.vehicle_id)
            .where(plans.Trip.plan_version_id == version.id, reference.Vehicle.depot_id == depot.id)
            .order_by(plans.Trip.depart_at, plans.Trip.vehicle_id, plans.Trip.trip_no)
        )
    )
    counts = {tid: (n, kg) for tid, n, kg in db.execute(
        select(plans.TripOrder.trip_id, func.count(), func.coalesce(func.sum(om.Order.weight_kg), 0.0))
        .join(om.Order, om.Order.id == plans.TripOrder.order_id)
        .where(plans.TripOrder.trip_id.in_([t.id for t in trips] or [0]))
        .group_by(plans.TripOrder.trip_id)
    )}
    day_status = {s.vehicle_id: s for s in db.scalars(select(plans.VehicleDayStatus).where(plans.VehicleDayStatus.service_date == service_date))}
    vehicles: list[ls.DockVehicleOut] = []
    for t in trips:
        status = day_status.get(t.vehicle_id)
        tags = [tag for tag, on in (("Held", bool(status and status.held_at and not status.replaced_by)), ("Replaced", bool(status and status.replaced_by))) if on]
        n, kg = counts.get(t.id, (0, 0.0))
        vehicles.append(ls.DockVehicleOut(vehicle_id=t.vehicle_id, trip_no=t.trip_no, depart_at=t.depart_at, plan_version=version.number, tags=tags, orders=n, kg=float(kg)))
    acknowledged = db.scalar(
        select(func.count()).select_from(plans.Acknowledgement).where(
            plans.Acknowledgement.plan_version_id == version.id, plans.Acknowledgement.actor_kind == ActorKind.PIN_PERSON, plans.Acknowledgement.dock == depot.id
        )
    )
    return ls.DockOut(
        dock=depot.id, plan_version=version.number, acknowledged=bool(acknowledged),
        people=[_person(p) for p in db.scalars(select(people.PinPerson).where(people.PinPerson.dock == depot.id).order_by(people.PinPerson.id))],
        vehicles=vehicles,
    )


def verify_pin(db: Session, user: CurrentUser, body: ls.VerifyPinIn) -> ls.VerifyPinOut:
    """The PIN sheet. A wrong PIN is an answer (``ok: false``), not an error."""
    person = db.get(people.PinPerson, body.person_id)
    if person is None:
        return ls.VerifyPinOut(ok=False)
    require_depot(user, person.dock)
    if not verify_secret(body.pin, person.pin_hash):
        return ls.VerifyPinOut(ok=False)
    return ls.VerifyPinOut(ok=True, person=_person(person))


def load_plan(db: Session, user: CurrentUser, vehicle_id: str, trip_no: int) -> ls.LoadPlanOut:
    """L2: the load list for one trip, in reverse stop order, with what the dock has counted so far."""
    vehicle = db.get(reference.Vehicle, vehicle_id)
    if vehicle is None:
        raise not_found(f"Vehicle {vehicle_id}")
    require_depot(user, vehicle.depot_id)
    version = _active_released(db)
    trip = (
        db.scalars(select(plans.Trip).where(plans.Trip.plan_version_id == version.id, plans.Trip.vehicle_id == vehicle_id, plans.Trip.trip_no == trip_no)).first()
        if version
        else None
    )
    if version is None or trip is None:
        raise not_found(f"Trip {trip_no} of {vehicle_id}")
    counted: dict[str, int] = {}
    for check in db.scalars(
        select(plans.LoadCheck)
        .join(plans.Trip, plans.Trip.id == plans.LoadCheck.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(plans.Trip.vehicle_id == vehicle_id, plans.Trip.trip_no == trip_no, plans.PlanVersion.service_date == version.service_date)
        .order_by(plans.LoadCheck.checked_at, plans.LoadCheck.id)
    ):
        counted[check.order_id] = check.units_loaded  # the latest count wins
    gate = db.scalars(
        select(plans.LoadGate)
        .join(plans.Trip, plans.Trip.id == plans.LoadGate.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(plans.Trip.vehicle_id == vehicle_id, plans.Trip.trip_no == trip_no, plans.PlanVersion.service_date == version.service_date)
        .limit(1)
    ).first()
    rows = db.execute(
        select(plans.TripOrder, om.Order, reference.Outlet)
        .join(om.Order, om.Order.id == plans.TripOrder.order_id)
        .join(reference.Outlet, reference.Outlet.id == om.Order.outlet_id)
        .where(plans.TripOrder.trip_id == trip.id)
        .order_by(plans.TripOrder.load_no)
    ).all()
    lines = [
        ls.LoadLineOut(
            order_id=order.id, outlet_id=outlet.id, outlet_name=outlet.name or f"Waypoint {outlet.brand.value}", load_no=to.load_no,
            units_expected=order.units, units_loaded=counted.get(order.id),
            window=Window(start=f"{outlet.window_open:%H:%M}", end=f"{outlet.window_close:%H:%M}"),
        )
        for to, order, outlet in rows
    ]
    return ls.LoadPlanOut(
        vehicle_id=vehicle_id, trip_no=trip_no, plan_version=version.number, depart_at=trip.depart_at, lines=lines,
        confirmed_at=gate.confirmed_at if gate else None,
    )


def exception(db: Session, user: CurrentUser, exception_id: int) -> ls.LoaderExceptionOut:
    """L3: a flag the loader raised and what Dispatch decided. The decision carries the plan it produced, who and when."""
    e = db.get(f.FieldException, exception_id)
    if e is None:
        raise not_found(f"Flag {exception_id}")
    trip = db.get(plans.Trip, e.trip_id) if e.trip_id else None
    decision = None
    if e.status is ExceptionStatus.DECIDED and e.decision:
        decision = {**e.decision, "version": e.decision.get("plan"), "by": e.decided_by, "at": e.decided_at.isoformat() if e.decided_at else None}
    return ls.LoaderExceptionOut(
        id=e.id, type=e.type, vehicle_id=e.vehicle_id, trip_no=trip.trip_no if trip else None, order_ids=list(e.order_ids or []),
        units_short=dict(e.units_short or {}), detail=e.detail, raised_at=e.raised_at, status=e.status.value, decision=decision,
    )


def plan_diff(db: Session, user: CurrentUser, dock_id: str, from_version: int, to_version: int) -> ls.PlanDiffOut:
    """L1.5: what changed at this dock between two plan versions of the run."""
    depot = _depot(db, dock_id)
    require_depot(user, depot.id)
    latest = _active_released(db)
    service_date = latest.service_date if latest else repo.active_service_date(clock.now(db).replace(tzinfo=None), repo.operating_days(db))

    def trips_in(number: int) -> dict[tuple[str, int], tuple[plans.Trip, list[str]]]:
        version = db.scalars(select(plans.PlanVersion).where(plans.PlanVersion.service_date == service_date, plans.PlanVersion.number == number)).first()
        if version is None:
            raise not_found(f"Plan v{number}")
        out: dict[tuple[str, int], tuple[plans.Trip, list[str]]] = {}
        for t in db.scalars(
            select(plans.Trip).join(reference.Vehicle, reference.Vehicle.id == plans.Trip.vehicle_id).where(plans.Trip.plan_version_id == version.id, reference.Vehicle.depot_id == depot.id)
        ):
            ids = [o for (o,) in db.execute(select(plans.TripOrder.order_id).where(plans.TripOrder.trip_id == t.id).order_by(plans.TripOrder.seq))]
            out[(t.vehicle_id, t.trip_no)] = (t, ids)
        return out

    before, after = trips_in(from_version), trips_in(to_version)
    where_before = {oid: key for key, (_, ids) in before.items() for oid in ids}
    where_after = {oid: key for key, (_, ids) in after.items() for oid in ids}
    lines: list[ls.PlanDiffLineOut] = []
    swapped: set[tuple[str, int, str, int]] = set()
    for oid in sorted(set(where_before) | set(where_after)):
        was, now = where_before.get(oid), where_after.get(oid)
        if was == now:
            continue
        if now is None and was is not None:
            lines.append(ls.PlanDiffLineOut(vehicle_id=was[0], trip_no=was[1], change="removed", order_id=oid, before=f"{was[0]} trip {was[1]}"))
        elif was is None and now is not None:
            lines.append(ls.PlanDiffLineOut(vehicle_id=now[0], trip_no=now[1], change="added", order_id=oid, after=f"{now[0]} trip {now[1]}"))
        elif was is not None and now is not None and was[0] != now[0]:
            key = (was[0], was[1], now[0], now[1])
            if key not in swapped:
                swapped.add(key)
                lines.append(ls.PlanDiffLineOut(vehicle_id=now[0], trip_no=now[1], change="vehicle", before=was[0], after=now[0]))
        elif was is not None and now is not None:
            lines.append(ls.PlanDiffLineOut(vehicle_id=now[0], trip_no=now[1], change="moved", order_id=oid, before=f"trip {was[1]}", after=f"trip {now[1]}"))
    for key in sorted(set(before) & set(after)):
        t0, t1 = before[key][0], after[key][0]
        if t0.depart_at != t1.depart_at:
            lines.append(ls.PlanDiffLineOut(vehicle_id=key[0], trip_no=key[1], change="time", before=_hhmm(t0.depart_at), after=_hhmm(t1.depart_at)))
    return ls.PlanDiffOut(dock=depot.id, from_version=from_version, to_version=to_version, lines=lines)

