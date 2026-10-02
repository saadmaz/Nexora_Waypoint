"""Seed checks (PRD §14 step 2). Fail loudly: if a CSV disagrees with PRD §4c, **the CSV wins** and this
raises until §4c and ``reference_4c.py`` are corrected.

Run on CSV-loaded data only. The fallback set is the §4c numbers themselves, so there is nothing to check.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.reference import CalendarDay, District, ServiceAllowance, Vehicle
from waypoint_rules.vocab import VehicleTemp, VehicleType

from . import reference_4c as ref


class SeedCheckError(RuntimeError):
    def __init__(self, failures: list[str]):
        super().__init__(
            f"{len(failures)} seed check(s) failed. The CSV wins: correct PRD §4c and seed/reference_4c.py.\n  - "
            + "\n  - ".join(failures)
        )
        self.failures = failures


def _close(a: float | None, b: float, tol: float = 0.5) -> bool:
    return a is not None and abs(a - b) <= tol


def collect(db: Session) -> list[str]:
    """Every disagreement, not just the first."""
    bad: list[str] = []

    # Vehicles used on screens.
    for vid, (depot, vtype, temp, kg, m3, km_per_l, quota, _used) in ref.VEHICLES.items():
        v = db.get(Vehicle, vid)
        if v is None:
            bad.append(f"{vid}: not in vehicles.csv")
            continue
        for label, got, want in (
            ("depot", v.depot_id, depot),
            ("type", v.type, vtype),
            ("temp", v.temp, temp),
            ("weight cap kg", v.weight_cap_kg, kg),
            ("volume cap m3", v.volume_cap_m3, m3),
            ("km per litre", v.km_per_l, km_per_l),
            ("weekly fuel quota L", v.weekly_fuel_quota_l, quota),
        ):
            same = _close(got, want, 1e-6) if isinstance(want, (int, float)) else got == want
            if not same:
                bad.append(f"{vid} {label}: CSV has {got}, §4c says {want}")

    # District travel.
    for name, (depot, out_min, out_km, step_min, step_km) in ref.DISTRICTS.items():
        d = db.get(District, name)
        if d is None:
            bad.append(f"{name}: not in district_travel.csv")
            continue
        if d.depot_id != depot:
            bad.append(f"{name} depot: CSV has {d.depot_id}, §4c says {depot}")
        for label, got, want in (
            ("outbound min", d.depot_to_district_freeflow_min, out_min),
            ("outbound km", d.depot_to_district_km, out_km),
            ("inter-stop min", d.inter_stop_freeflow_min, step_min),
            ("inter-stop km", d.inter_stop_km, step_km),
        ):
            if not _close(got, want):
                bad.append(f"{name} {label}: CSV has {got}, §4c says {want}")

    # Handling allowances.
    for (brand, dock), minutes in ref.ALLOWANCES.items():
        row = db.get(ServiceAllowance, (brand, dock))
        if row is None or row.minutes != minutes:
            bad.append(f"allowance {brand.value}/{dock.value}: CSV has {row.minutes if row else 'nothing'}, §4c says {minutes}")

    # Fleet counts per depot and across the network.
    for depot, (reefer_trucks, dry_trucks, reefer_vans, ambient_vans) in ref.FLEET.items():
        got = {
            ("truck", "reefer"): 0, ("truck", "ambient"): 0, ("van", "reefer"): 0, ("van", "ambient"): 0,
        }
        for v in db.scalars(select(Vehicle).where(Vehicle.depot_id == depot)):
            got[(v.type.value, v.temp.value)] += 1
        want = {
            ("truck", "reefer"): reefer_trucks, ("truck", "ambient"): dry_trucks,
            ("van", "reefer"): reefer_vans, ("van", "ambient"): ambient_vans,
        }
        if got != want:
            bad.append(f"fleet at {depot}: CSV has {got}, §4c says {want}")
    total = db.scalar(select(func.count()).select_from(Vehicle)) or 0
    reefers = db.scalar(select(func.count()).select_from(Vehicle).where(Vehicle.temp == VehicleTemp.REEFER)) or 0
    vans = db.scalar(select(func.count()).select_from(Vehicle).where(Vehicle.type == VehicleType.VAN)) or 0
    for label, got_n, want_n in (
        ("vehicles", total, ref.NETWORK["vehicles"]),
        ("reefer-capable", reefers, ref.NETWORK["reefer_capable"]),
        ("vans", vans, ref.NETWORK["vans"]),
    ):
        if got_n != want_n:
            bad.append(f"network {label}: CSV has {got_n}, §4c says {want_n}")

    # Calendar.
    for d in ref.OPERATING:
        row = db.get(CalendarDay, d)
        if row is None or not row.is_operating:
            bad.append(f"{d:%a %d %b %Y} must be an operating day")
    for d in ref.NOT_OPERATING:
        row = db.get(CalendarDay, d)
        if row is None or row.is_operating:
            bad.append(f"{d:%a %d %b %Y} must exist and not be an operating day")

    # R10 dates and their flags (A26).
    monsoon = db.get(CalendarDay, ref.R10_MONSOON)
    if monsoon is None or not monsoon.monsoon:
        bad.append(f"{ref.R10_MONSOON:%a %d %b %Y} must exist with monsoon = true (R10.1)")
    sunday = db.get(CalendarDay, ref.R10_SUNDAY)
    if sunday is None or sunday.is_operating:
        bad.append(f"{ref.R10_SUNDAY:%a %d %b %Y} must exist and not be an operating day (R10.2)")
    holiday = db.get(CalendarDay, ref.R10_HOLIDAY)
    if holiday is None or not holiday.is_holiday:
        bad.append(f"{ref.R10_HOLIDAY:%a %d %b %Y} must exist with is_holiday = true (R10.3)")
    return bad


def run(db: Session) -> None:
    failures = collect(db)
    if failures:
        raise SeedCheckError(failures)
