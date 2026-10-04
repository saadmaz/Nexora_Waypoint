"""The service day as the calendar sees it (calendar.csv): what changes demand or travel, and where a deferral goes.

Demand itself is the actual orders, so nothing here changes the plan; it tells the dispatcher what kind of day it is.
Travel is already slower on a monsoon day through ``RefData.travel`` (``planning_repo.travel_factors``).
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from waypoint_rules.schedule import next_operating_day

from ..models import reference
from ..schemas import dispatcher as s
from . import planning_repo as repo
from .dispatcher_views import day_label


def service_day_info(db: Session, service_date: date) -> s.ServiceDayInfo:
    cal = db.get(reference.CalendarDay, service_date)
    flags: list[s.DayFlag] = []
    if cal is not None:
        if cal.is_payday:
            flags.append(s.DayFlag(kind="payday", label="Payday", detail="Expect larger orders"))
        if cal.festival:
            ramp = f", demand up {round(cal.festival_ramp * 100)} %" if cal.festival_ramp else ""
            flags.append(s.DayFlag(kind="festival", label=cal.festival, detail=f"Festival{ramp}"))
        elif cal.festival_ramp:
            flags.append(s.DayFlag(kind="festival", label="Festival ramp", detail=f"Demand up {round(cal.festival_ramp * 100)} %"))
        if cal.is_weekend:
            flags.append(s.DayFlag(kind="weekend", label=cal.dow_name or "Weekend", detail="Weekend demand"))
        if cal.monsoon:
            flags.append(s.DayFlag(kind="monsoon", label="Monsoon", detail="Roads are slower, arrivals planned later"))
        if cal.is_holiday:
            flags.append(s.DayFlag(kind="holiday", label="Holiday", detail="No deliveries" if not cal.is_operating else "Public holiday"))
    try:
        after: date | None = next_operating_day(service_date, repo.operating_days(db))
    except ValueError:  # the calendar ends before another operating day
        after = None
    return s.ServiceDayInfo(label=day_label(service_date), flags=flags, next_run=day_label(after) if after else None)
