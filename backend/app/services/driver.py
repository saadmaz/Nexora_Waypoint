"""The driver's reads (PRD v3 §19 DriverApi): the route package, notices and history. Writes come in through ``/sync``."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy.orm import Session

from waypoint_rules import next_plan_at

from .. import clock
from ..config import COLOMBO
from ..deps import CurrentUser
from ..errors import forbidden, not_found
from ..models.reference import CalendarDay
from ..schemas import driver as s
from . import driver_repo as repo
from . import driver_views as views
from .driver_rows import RunFacts
from .planning_repo import operating_days


def _vehicle_of(user: CurrentUser) -> str:
    """The vehicle this driver account drives; every read is scoped to it. Raises ApiError 403 when the account has none."""
    if not user.vehicle_id:
        raise forbidden("No vehicle is linked to your account. Ask Dispatch to link one.")
    return user.vehicle_id


def run(db: Session, user: CurrentUser, day: date, trip: int | None) -> s.RunOut:
    """The route package for one day, or why there is none. Raises ApiError 404 for a trip number the vehicle does not have."""
    vehicle_id = _vehicle_of(user)
    now = clock.now(db)
    cal = repo.calendar_day(db, day)
    version = repo.latest_released(db, day)
    trips = repo.trips(db, version, vehicle_id) if version else {}
    reason = views.no_run_reason(
        is_operating=cal.is_operating if cal else None, is_holiday=bool(cal and cal.is_holiday), released=version is not None,
        has_trip=bool(trips),
    )
    if version is None or reason is not None:
        return _no_run(db, day, reason or "not_released", cal, sorted(trips), now)

    chosen = views.pick_trip(repo.trip_choices(db, day, vehicle_id, sorted(trips)), trip)
    if chosen is None:
        raise not_found(f"Trip {trip}")
    t = trips[chosen]
    facts = RunFacts(
        day=day, version=version.number, released_at=version.released_at, note=version.note, vehicle_id=vehicle_id, trip_no=chosen,
        trips=tuple(sorted(trips)), driver=repo.driver_name(db, vehicle_id), vehicle=repo.vehicle(db, day, vehicle_id),
        depart_at=t.depart_at, planned_km=t.planned_km, stops=tuple(repo.stops(db, day, version, t)),
        acknowledged=repo.acknowledged(db, version, vehicle_id), confirmation=repo.confirmation(db, day, vehicle_id, chosen),
    )
    return views.run_view(facts, monsoon=cal.monsoon if cal else None, now=now)


def _no_run(db: Session, day: date, reason: s.NoRunReason, cal: CalendarDay | None, trips: list[int], now: datetime) -> s.RunOut:
    """A closed day says when the next plan comes; a day still waiting for its plan or with no trip does not know yet."""
    expected = next_plan_at(day, operating_days(db)) if reason in ("sunday", "holiday") else None
    return views.no_run_view(
        day, reason, next_plan_at=expected.replace(tzinfo=COLOMBO) if expected else None, monsoon=cal.monsoon if cal else None,
        trips=trips, now=now,
    )


def notices(db: Session, user: CurrentUser, since: datetime | None) -> list[s.NoticeOut]:
    """R8: this vehicle's notices newest first, in the phone's kinds. Notices the phone has no screen for are left out."""
    vehicle_id = _vehicle_of(user)
    out: list[s.NoticeOut] = []
    for row in repo.notices(db, vehicle_id, user.id, since):
        kind = views.notice_kind(row.tag, row.refs)
        if kind is None:
            continue
        resolution = repo.resolution(db, int(row.refs["conflictId"])) if kind == "resolved" else None
        out.append(views.notice_view(row, kind, resolution))
    return out


def history(db: Session, user: CurrentUser) -> list[s.DriverHistoryRowOut]:
    """R7: this vehicle's finished runs, newest first."""
    vehicle_id = _vehicle_of(user)
    rows: list[s.DriverHistoryRowOut] = []
    for run_row, trip, day in repo.finished_runs(db, vehicle_id):
        # A few queries per run is fine here: one vehicle's finished runs, a handful a week.
        stops, delivered = repo.trip_order_counts(db, day, vehicle_id, trip.trip_no)
        rows.append(
            s.DriverHistoryRowOut(
                date=day, vehicle_id=vehicle_id, trip_no=trip.trip_no, stops=stops, delivered=delivered, km=run_row.gps_km,
                fuel_l=run_row.fuel_l_est, departed_at=views.local(run_row.departed_at), finished_at=views.local(run_row.finished_at),
            )
        )
    return rows
