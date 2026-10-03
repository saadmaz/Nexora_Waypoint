"""The driver's reads (PRD §19 DriverApi): the route package, the notices and the run history.

The driver writes through ``POST /sync`` (``services/sync``); this module is what the phone reads. The latest *released*
plan is the one it works from; a draft is never shown to the field. The loader's reads are ``services/loader``.
Callers do not commit: these are reads.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from waypoint_rules.vocab import OrderStatus

from .. import clock
from ..deps import CurrentUser
from ..errors import forbidden, not_found
from ..models import field as f
from ..models import orders as om
from ..models import people, plans, reference
from ..models.comms import Notice, NoticeRead
from ..models.enums import AudienceKind, NoticeTag, PlanState
from ..schemas import driver as ds
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


def _run_of(db: Session, service_date: date, vehicle_id: str, trip_no: int) -> f.Run | None:
    """The run of one vehicle trip, whichever plan version's trip row it was started on."""
    return db.scalars(
        select(f.Run)
        .join(plans.Trip, plans.Trip.id == f.Run.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(plans.Trip.vehicle_id == vehicle_id, plans.Trip.trip_no == trip_no, plans.PlanVersion.service_date == service_date)
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
        select(func.count()).select_from(plans.Acknowledgement).where(plans.Acknowledgement.plan_version_id == version.id, plans.Acknowledgement.driver_vehicle_id == vehicle)
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
    query = select(Notice).where(Notice.audience_kind == AudienceKind.DRIVER, Notice.vehicle_id == vehicle)
    if since is not None:
        query = query.where(Notice.created_at > since)
    rows = list(db.scalars(query.order_by(Notice.created_at.desc(), Notice.id.desc())))
    conflicts = {
        c.id: c for c in db.scalars(select(f.Conflict).where(f.Conflict.id.in_([(n.refs or {}).get("conflictId") for n in rows if (n.refs or {}).get("conflictId")] or [0])))
    }
    read = set(db.scalars(select(NoticeRead.notice_id).where(NoticeRead.user_id == user.id, NoticeRead.notice_id.in_([n.id for n in rows] or [0]))))
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
        out.append(ds.NoticeOut(id=n.id, tag=_notice_kind(n), title=n.title, body=n.body, created_at=n.created_at, read=n.id in read, link=link or None))
    return out


def history(db: Session, user: CurrentUser) -> list[ds.DriverHistoryRowOut]:
    """R7: this driver's past runs, newest first."""
    vehicle = _driver_vehicle(user)
    out: list[ds.DriverHistoryRowOut] = []
    rows = db.execute(
        select(f.Run, plans.Trip, plans.PlanVersion)
        .join(plans.Trip, plans.Trip.id == f.Run.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(plans.Trip.vehicle_id == vehicle)
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
