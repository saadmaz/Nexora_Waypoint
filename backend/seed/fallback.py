"""A small reference set from PRD §4c, used only when ``data/*.csv`` is absent (CI, a fresh clone).

Keeps the API and the tests working without the competition data. It is not the real reference data:
the six story vehicles, the three districts, the nine allowances, the pinned outlets and a generated
calendar (Monday to Saturday operate; no holidays known). ``checks.py`` does not run on it.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.reference import CalendarDay, Depot, District, Outlet, ServiceAllowance, Vehicle
from waypoint_rules.vocab import Brand

from . import reference_4c as ref

CALENDAR_FROM = date(2026, 9, 14)
CALENDAR_DAYS = 45


def load(db: Session) -> dict[str, int]:
    for depot_id, name in ref.DEPOTS.items():
        db.merge(Depot(id=depot_id, name=name))
    db.flush()

    for name, (depot, out_min, out_km, step_min, step_km) in ref.DISTRICTS.items():
        db.merge(
            District(
                name=name,
                depot_id=depot,
                depot_to_district_km=out_km,
                depot_to_district_freeflow_min=out_min,
                inter_stop_km=step_km,
                inter_stop_freeflow_min=step_min,
            )
        )
    for (brand, dock), minutes in ref.ALLOWANCES.items():
        db.merge(ServiceAllowance(brand=brand, dock_type=dock, minutes=minutes))
    db.flush()

    for oid, (brand, district, dock, w_open, w_close, van_only, mall) in ref.OUTLETS.items():
        db.merge(
            Outlet(
                id=oid,
                brand=Brand(brand),
                district=district,
                depot_id=ref.DISTRICTS[district][0],
                dock_type=dock,
                parking_constraint="van_only" if van_only else ("mall_dock" if mall else "normal"),
                mall_window_open=mall[0] if mall else None,
                mall_window_close=mall[1] if mall else None,
                window_open=w_open,
                window_close=w_close,
            )
        )
    for vid, (depot, vtype, temp, kg, m3, km_per_l, quota, _used) in ref.VEHICLES.items():
        db.merge(
            Vehicle(
                id=vid, type=vtype, temp=temp, weight_cap_kg=kg, volume_cap_m3=m3, km_per_l=km_per_l,
                weekly_fuel_quota_l=quota, depot_id=depot,
            )
        )
    db.flush()

    calendar = extend_calendar(db)
    return {"depots": len(ref.DEPOTS), "districts": len(ref.DISTRICTS), "outlets": len(ref.OUTLETS),
            "vehicles": len(ref.VEHICLES), "calendar": calendar}


def extend_calendar(db: Session, *, through: date | None = None) -> int:
    """Add the scenario weeks the calendar lacks and return how many days were added. Loaded rows win.

    ``calendar.csv`` ends on Sun 28 Jun 2026, before the scenario week, so the CSV seed needs this too. ``through`` is the
    last day to cover (the scenario service date plus a fortnight); at least ``CALENDAR_DAYS`` days are always added.
    """
    added = 0
    days = max(CALENDAR_DAYS, ((through - CALENDAR_FROM).days + 1) if through else 0)
    for i in range(days):
        d = CALENDAR_FROM + timedelta(days=i)
        if db.get(CalendarDay, d) is not None:
            continue
        # The same weekday 52 weeks earlier carries the season (monsoon starts in October in the CSV).
        last_year = db.get(CalendarDay, d - timedelta(weeks=52))
        iso = d.isocalendar()
        db.add(
            CalendarDay(
                date=d, dow=d.weekday(), dow_name=d.strftime("%a"), is_weekend=d.weekday() >= 5,
                iso_year=iso.year, iso_week=iso.week, is_payday=False, festival=None, festival_ramp=0.0,
                is_holiday=False, monsoon=bool(last_year and last_year.monsoon), is_operating=d.weekday() != 6,
            )
        )
        added += 1
    db.flush()
    return added
