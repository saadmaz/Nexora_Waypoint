"""The driver's route package, notices and history, built from plain rows (PRD v3 §15, §19 DriverApi).

Pure: ``driver_repo`` reads the database, this shapes what the phone gets. The wording a screen shows (a parking note, a
notice kind) is decided here so the phone never re-derives it.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime, time, timedelta
from typing import Any

from ..config import COLOMBO
from ..schemas import driver as s
from ..schemas.common import Window
from .driver_rows import NoticeRow, ResolutionRow, RunFacts, StopRow, TripChoice, VehicleRow

#: Supplied parking constraints in the screen's words. ``normal`` has no note.
_PARKING = {"van_only": "Vans only", "mall_dock": "Mall dock"}


def pick_trip(trips: Sequence[TripChoice], requested: int | None) -> int | None:
    """The trip the phone asked for, else the earliest not finished, else the day's last. None when there are none.

    A requested trip that does not exist is None, so the caller can answer 404.
    """
    numbers = sorted(trips, key=lambda t: t.trip_no)
    if requested is not None:
        return requested if any(t.trip_no == requested for t in numbers) else None
    for trip in numbers:
        if not trip.finished:
            return trip.trip_no
    return numbers[-1].trip_no if numbers else None


def no_run_reason(*, is_operating: bool | None, is_holiday: bool, released: bool, has_trip: bool) -> s.NoRunReason | None:
    """Why the driver has no run that day, or None when they have one. A day missing from the calendar counts as operating."""
    if is_operating is False:
        return "holiday" if is_holiday else "sunday"
    if not released:
        return "not_released"
    if not has_trip:
        return "no_trip"
    return None


def parking_note(constraint: str | None) -> str | None:
    if not constraint or constraint == "normal":
        return None
    return _PARKING.get(constraint, constraint.replace("_", " ").capitalize())


def unload_minutes(row: StopRow) -> int | None:
    return row.handling_minutes if row.handling_minutes is not None else row.allowance_minutes


def vehicle_tags(v: VehicleRow) -> list[str]:
    if v.replaced:
        return ["Replaced"]
    if v.held:
        return ["Held"]
    return ["In workshop"] if v.in_workshop else ["Available"]


def notice_kind(tag: str, refs: dict[str, Any]) -> str | None:
    """The driver app's notice kind for a stored notice, or None for one the phone has no screen for.

    ``Plan`` is a release. ``Change`` is a later version that changed this run (a deferred stop, a swapped trip), which
    the phone shows as a plan released. ``Review`` with a conflict is Dispatch's decision on it. A notice marked
    ``refs.kind == "contact"`` is Dispatch asking the driver to call back (``services/contact.py``).
    """
    if refs.get("kind") == "contact":
        return "call_request"
    if tag == "Review" and refs.get("conflictId") is not None:
        return "resolved"
    if tag in ("Plan", "Change"):
        return "plan_released"
    return None


def local(value: datetime | None) -> datetime | None:
    """Times go out in Asia/Colombo with their offset, as the clock does, so "04:50" reads as 04:50."""
    return value.astimezone(COLOMBO) if value is not None else None


def _hm(value: time) -> str:
    return value.strftime("%H:%M")


def _departure_shift(facts: RunFacts) -> timedelta:
    """How late the run left. The planned arrivals move by the same amount once it has (A27).

    An early departure keeps the plan's times: the windows are what the stores were promised, and the driver
    waits for them anyway.
    """
    if facts.departed_at is None:
        return timedelta(0)
    return max(timedelta(0), facts.departed_at - facts.depart_at)


def _stop(row: StopRow, shift: timedelta = timedelta(0)) -> s.RunStopOut:
    return s.RunStopOut(
        order_id=row.order_id,
        outlet_id=row.outlet_id,
        outlet_name=row.outlet_name,
        seq=row.seq,
        temp=row.temp,
        units=row.units,
        window=Window(start=_hm(row.window_open), end=_hm(row.window_close)),
        planned_arrival=local(row.planned_arrival + shift if row.planned_arrival else None),
        status=row.status,
        tags=list(row.tags),
        brand=row.brand,
        district=row.district,
        dock=row.dock,
        parking_note=parking_note(row.parking_constraint),
        unload_minutes=unload_minutes(row),
        weight_kg=row.weight_kg,
        volume_m3=row.volume_m3,
    )


def run_view(facts: RunFacts, *, monsoon: bool | None, now: datetime) -> s.RunOut:
    v = facts.vehicle
    c = facts.confirmation
    return s.RunOut(
        date=facts.day,
        calendar=s.CalendarOut(monsoon=True) if monsoon else None,
        vehicle_id=facts.vehicle_id,
        trip_no=facts.trip_no,
        trips=list(facts.trips),
        plan_version=facts.version,
        plan_released_at=local(facts.released_at),
        plan_note=facts.note,
        driver=facts.driver,
        vehicle=(
            s.RunVehicleOut(
                kind=v.kind, temperature=v.temperature, weight_cap_kg=v.weight_cap_kg, volume_cap_m3=v.volume_cap_m3,
                km_per_l=v.km_per_l, tags=vehicle_tags(v),
            )
            if v
            else None
        ),
        depart_at=local(facts.depart_at),
        planned_km=facts.planned_km,
        stops=[_stop(row, _departure_shift(facts)) for row in sorted(facts.stops, key=lambda r: (r.seq, r.order_id))],
        acknowledged=facts.acknowledged,
        loader_confirmation=(
            s.LoaderConfirmationOut(
                by=c.by, at=c.at.astimezone(COLOMBO), shortfalls=[s.ShortfallOut(order_id=o, short_by=n) for o, n in c.shortfalls]
            )
            if c
            else None
        ),
        server_time=now,
    )


def no_run_view(
    day: date, reason: s.NoRunReason, *, next_plan_at: datetime | None, monsoon: bool | None, trips: Sequence[int], now: datetime
) -> s.RunOut:
    return s.RunOut(
        date=day,
        state="no_run",
        no_run=s.NoRunOut(reason=reason, next_plan_at=next_plan_at),
        calendar=s.CalendarOut(monsoon=True) if monsoon else None,
        trips=list(trips),
        server_time=now,
    )


def notice_view(row: NoticeRow, kind: str, resolution: ResolutionRow | None) -> s.NoticeOut:
    link: dict[str, Any] | None = None
    if resolution is not None:
        link = {"outletId": resolution.outlet_id, "decision": resolution.decision, "by": resolution.by}
        if resolution.units is not None:
            link["units"] = resolution.units
    return s.NoticeOut(id=row.id, tag=kind, title=row.title, body=row.body, created_at=row.created_at.astimezone(COLOMBO), read=row.read, link=link)
