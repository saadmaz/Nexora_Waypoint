"""D9, the capacity outlook: a baseline, not a model (PRD v3 §12 "D9 baseline", A15).

For each of the next four ISO weeks: the reefer minutes a normal day asks for, scaled by the calendar (a payday adds a little,
a festival ramp adds its own factor), against what the depot's reefers can give (usable reefers × 270 minutes × operating days).
A week at or over 100% is Short, 90% up to that is Tight and anything under is OK. All four weeks are returned so the screen
can show where the pressure is as well as where it is not. The Datathon Task 2A model is not wired in, and the screen says so in its label.

The PRD builds demand from eight weeks of delivered orders in ``deliveries_train.csv``. Those rows are not in the repository, so a
normal day's demand here is today's own queue: the minutes its chilled Fresh orders need (handling plus one hop each).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules import frees
from waypoint_rules.vocab import FRESH_BUDGET_MIN, Brand, VehicleTemp

from ..models.reference import CalendarDay
from ..schemas import dispatcher as s
from . import planning_repo as repo
from .dispatcher_views import day_label

LABEL = "Baseline forecast: Datathon Task 2A model not wired in"
WEEKS = 4
SHORT_AT = 100
TIGHT_AT = 90
#: What a payday adds to a day's demand (A15). A festival ramp carries its own factor in the calendar.
PAYDAY_UPLIFT = 0.06
DAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


@dataclass(frozen=True, slots=True)
class CalendarFacts:
    day: date
    operating: bool
    payday: bool
    ramp: float


def next_mondays(today: date, count: int = WEEKS) -> list[date]:
    """The Mondays of the next ``count`` ISO weeks: the first one strictly after ``today``."""
    first = today + timedelta(days=(7 - today.weekday()) % 7 or 7)
    return [first + timedelta(weeks=i) for i in range(count)]


def forecast_view(
    depot: s.DepotId, now: datetime, calendar: dict[date, CalendarFacts], *, demand_per_day: float, usable_reefers: int
) -> s.ForecastView:
    weeks: list[s.ForecastWeek] = []
    for monday in next_mondays(now.date()):
        days = [calendar[monday + timedelta(days=i)] for i in range(7) if (monday + timedelta(days=i)) in calendar]
        operating = [d for d in days if d.operating]
        capacity = usable_reefers * FRESH_BUDGET_MIN * len(operating)
        if not operating or capacity <= 0:
            continue
        demand = sum(demand_per_day * (1 + (PAYDAY_UPLIFT if d.payday else 0) + d.ramp) for d in operating)
        percent = round(100 * demand / capacity)
        flags = (["Payday"] if any(d.payday for d in days) else []) + (["Festival ramp"] if any(d.ramp > 0 for d in days) else [])
        short = percent >= SHORT_AT
        status: Literal["Short", "Tight", "OK"] = "Short" if short else "Tight" if percent >= TIGHT_AT else "OK"
        week = s.ForecastWeek(
            monday=day_label(monday),
            percent=percent,
            status=status,
            flags=flags,
            lever={"Short": "Move workshop slots · pre-warn stores", "Tight": "Watch", "OK": "Enough capacity"}[status],
        )
        if short:
            gap = demand - capacity
            slots = max(1, math.ceil(gap / FRESH_BUDGET_MIN))
            week.gap = s.ForecastGap(minutes=round(gap))
            week.days = [
                s.ForecastDay(day=DAYS[d.day.weekday()], flag="ramp" if d.ramp > 0 else "payday" if d.payday else None)
                for d in sorted(days, key=lambda d: d.day)
            ]
            week.levers = [f"Move {slots} workshop slot{'s' if slots != 1 else ''} out of this week", "Pre-warn Fresh stores of likely deferrals"]
        weeks.append(week)
    return s.ForecastView(as_of=day_label(now.date()), depot=depot, label=LABEL, weeks=weeks)


def load_forecast(db: Session, depot: s.DepotId, now: datetime) -> s.ForecastView:
    """Read the calendar, the run's chilled Fresh orders and the depot's reefers, and build the outlook."""
    service_date = repo.active_service_date(now, repo.operating_days(db))
    ref = repo.load_ref(db)
    days, _ = repo.vehicle_days(db, service_date)
    orders = repo.day_orders(db, service_date, repo.operating_days(db))
    minutes = sum(
        frees(o, ref).minutes
        for o in orders.values()
        if o.temp.needs_reefer and ref.outlets[o.outlet_id].brand is Brand.FRESH and ref.outlets[o.outlet_id].depot == depot
    )
    reefers = [
        v for v in ref.vehicles.values()
        if v.depot == depot and v.temp is VehicleTemp.REEFER and not days[v.id].held and days[v.id].available_from is None
    ]
    calendar = {
        c.date: CalendarFacts(c.date, c.is_operating, c.is_payday, c.festival_ramp or 0.0)
        for c in db.scalars(select(CalendarDay).where(CalendarDay.date >= now.date()))
    }
    return forecast_view(depot, now, calendar, demand_per_day=float(minutes), usable_reefers=len(reefers))
