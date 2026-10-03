"""The rest of the day, generated (PRD v3 §14 step 6, A41), for a clone that has no ``data/*.csv``.

The fallback reference set is only the six story vehicles and the outlets the pinned orders use, which cannot carry a day of
212 Peliyagoda and 64 Kandy orders. This module fills it out deterministically, the same on every run:

* **The fleet** is completed to the §4c depot totals (Peliyagoda 38: 7 reefer trucks, 27 dry-box trucks, 2 reefer vans, 2 ambient
  vans; Kandy 22: 5, 13, 2, 2), as copies of the story vehicles' specifications. The vehicle IDs run VEH001 to VEH060, Peliyagoda
  up to VEH038 and Kandy from VEH039, so the six named vehicles keep their depots.
* **The outlets** the generated orders go to are added around the pinned ones (OUT035 to OUT083 for Peliyagoda, OUT085 onwards for
  Kandy), mostly Fresh, a few Style and Tech mall outlets.
* **The orders** are ORD3001 upward, received Mon 09:00 to 15:55, sized like the pinned ones. Peliyagoda reaches 212 for Tue 29 Sep
  and Kandy 62 (the judge places ORD2001 and ORD2002 at 15:40, which makes 64).

Everything here is a stand-in. When the CSVs are present they supply the reference data, and the order sizes should be sampled from
``deliveries_train.csv`` instead: that sampler is not written, because the column names are not in the repository (ask the data owner).
The planner's own result on this day is what the demo shows, and the README records how it compares with §4c (DP-01).
"""

from __future__ import annotations

import random
from datetime import date, datetime, time

from sqlalchemy.orm import Session

from app.config import COLOMBO
from app.models.enums import ServerStatus
from app.models.orders import Order
from app.models.plans import FuelLedger
from app.models.reference import Outlet, Vehicle
from waypoint_rules.vocab import Brand, DockType, Temp, VehicleTemp, VehicleType

from . import reference_4c as ref

P, K = ref.P, ref.K
RANDOM_SEED = 2026

#: Peliyagoda outlets get OUT035 to OUT083, Kandy OUT085 and up (skipping the pinned OUT087).
PELIYAGODA_OUTLETS = [f"OUT{n:03d}" for n in range(35, 84)]
KANDY_OUTLETS = ["OUT085", "OUT086", "OUT088", "OUT089", "OUT090", "OUT091", "OUT092", "OUT093", "OUT094", "OUT095"]

#: Style and Tech mall outlets among the Peliyagoda ones (their orders are ambient and go to the 09:00 mall slot).
MALL_OUTLETS = {"OUT038": Brand.STYLE, "OUT048": Brand.STYLE, "OUT058": Brand.STYLE, "OUT068": Brand.STYLE, "OUT078": Brand.TECH, "OUT043": Brand.TECH}

#: Fresh delivery windows seen in §4c, as (open, close).
WINDOWS = [(time(3, 0), time(8, 0)), (time(4, 0), time(7, 45)), (time(5, 0), time(7, 30)), (time(5, 30), time(8, 0)), (time(4, 30), time(8, 0))]

#: Extra vehicles by archetype: id -> (depot, type, temp). Archetype specs are copied from the story vehicle of that kind.
_REEFER_TRUCKS_P = ["VEH004", "VEH008", "VEH013", "VEH018", "VEH023", "VEH028"]
_AMBIENT_VANS_P = ["VEH033"]
_REEFER_TRUCKS_K = ["VEH040", "VEH046", "VEH052", "VEH058"]
_REEFER_VANS_K = ["VEH044", "VEH056"]
_AMBIENT_VANS_K = ["VEH050", "VEH060"]

_SPEC = {
    "reefer_truck_p": (5510, 26.4, 4.7, 480),
    "dry_truck": (7200, 38.0, 4.9, 600),
    "ambient_van": (1100, 8.0, 11.5, 340),
    "reefer_truck_k": (6180, 29.9, 5.0, 370),
    "reefer_van": (1040, 7.0, 10.3, 480),
}

#: Peliyagoda orders and Kandy orders the generator adds on top of the pinned ones (see the module docstring).
PELIYAGODA_TARGET = 212
KANDY_TARGET = 62
FIRST_ORDER = 3001

#: How many Fresh orders are chilled (the rest are ambient and can ride a dry-box truck). Tuned, with nothing placed by hand, so the planner
#: defers about as many orders at Peliyagoda as §4c does (19: 1 for capacity, 18 for policy) and the reefers are what binds. 0.262 gives
#: 17 (1 and 16): the count moves in steps of two to four as one more chilled order appears, so 19 itself is not reachable (DP-01).
CHILLED_SHARE = 0.262


def _vehicle_kind(vid: str) -> tuple[str, VehicleType, VehicleTemp, str]:
    """(depot, type, temp, spec key) for a generated vehicle."""
    n = int(vid[3:])
    depot = P if n <= 38 else K
    if vid in _REEFER_TRUCKS_P:
        return P, VehicleType.TRUCK, VehicleTemp.REEFER, "reefer_truck_p"
    if vid in _AMBIENT_VANS_P:
        return P, VehicleType.VAN, VehicleTemp.AMBIENT, "ambient_van"
    if vid in _REEFER_TRUCKS_K:
        return K, VehicleType.TRUCK, VehicleTemp.REEFER, "reefer_truck_k"
    if vid in _REEFER_VANS_K:
        return K, VehicleType.VAN, VehicleTemp.REEFER, "reefer_van"
    if vid in _AMBIENT_VANS_K:
        return K, VehicleType.VAN, VehicleTemp.AMBIENT, "ambient_van"
    return depot, VehicleType.TRUCK, VehicleTemp.AMBIENT, "dry_truck"


def extend_reference(db: Session, *, service_date: date) -> dict[str, int]:
    """Complete the fleet to 60 vehicles and add the generated outlets. Idempotent: rows merge by primary key."""
    rng = random.Random(RANDOM_SEED)
    vehicles = 0
    iso = service_date.isocalendar()
    for n in range(1, 61):
        vid = f"VEH{n:03d}"
        if vid in ref.VEHICLES:
            continue
        depot, vtype, temp, spec = _vehicle_kind(vid)
        kg, m3, km_per_l, quota = _SPEC[spec]
        db.merge(Vehicle(id=vid, type=vtype, temp=temp, weight_cap_kg=kg, volume_cap_m3=m3, km_per_l=km_per_l, weekly_fuel_quota_l=quota, depot_id=depot))
        # Week-to-date fuel (A7): a fifth to two-thirds of the quota is already used.
        db.merge(FuelLedger(vehicle_id=vid, iso_year=iso.year, iso_week=iso.week, used_before_l=round(quota * rng.uniform(0.1, 0.35), 0)))
        vehicles += 1

    outlets = 0
    for i, oid in enumerate(PELIYAGODA_OUTLETS):
        brand = MALL_OUTLETS.get(oid, Brand.FRESH)
        district = "Colombo" if i % 2 == 0 else "Gampaha"
        db.merge(_outlet(oid, brand, district, P, rng))
        outlets += 1
    for oid in KANDY_OUTLETS:
        db.merge(_outlet(oid, Brand.FRESH, "Kandy", K, rng))
        outlets += 1
    db.flush()
    return {"vehicles": vehicles, "outlets": outlets}


def _outlet(oid: str, brand: Brand, district: str, depot: str, rng: random.Random) -> Outlet:
    if brand is not Brand.FRESH:
        # A mall dock: the mall's own window, as for OUT015 and OUT023.
        return Outlet(
            id=oid, brand=brand, district=district, depot_id=depot, dock_type=DockType.MALL_BAY, parking_constraint="mall_dock",
            mall_window_open=time(9, 0), mall_window_close=time(11, 0), window_open=time(9, 0), window_close=time(11, 0),
        )
    opens, closes = WINDOWS[rng.randrange(len(WINDOWS))]
    dock = DockType.REAR_DOCK if rng.random() < 0.65 else DockType.STREET
    return Outlet(
        id=oid, brand=brand, district=district, depot_id=depot, dock_type=dock, parking_constraint="normal",
        mall_window_open=None, mall_window_close=None, window_open=opens, window_close=closes,
    )


def _size(brand: Brand, rng: random.Random) -> tuple[int, float, float]:
    """(units, kg, m3) for one order, like the pinned ones: Fresh about 6 kg and 0.04 m³ a unit, mall brands far bulkier."""
    if brand is Brand.FRESH:
        units = rng.randint(8, 45)
        return units, float(round(units * rng.uniform(5.6, 6.4))), round(units * rng.uniform(0.036, 0.044), 1)
    units = rng.randint(10, 30)
    return units, float(round(units * rng.uniform(14.0, 16.0))), round(units * rng.uniform(0.2, 0.23), 1)


def seed_orders(db: Session, *, service_date: date, received_date: date, pinned_peliyagoda: int, pinned_kandy: int) -> dict[str, int]:
    """Generate ORD3001 upward so Peliyagoda has 212 orders for ``service_date`` and Kandy 62, all Ordered (before the cutoff)."""
    rng = random.Random(RANDOM_SEED + 1)
    made = {"peliyagoda": 0, "kandy": 0}
    number = FIRST_ORDER
    plan = (
        (P, PELIYAGODA_OUTLETS, PELIYAGODA_TARGET - pinned_peliyagoda),
        (K, KANDY_OUTLETS, KANDY_TARGET - pinned_kandy),
    )
    for depot, outlet_ids, count in plan:
        brands = {oid: MALL_OUTLETS.get(oid, Brand.FRESH) for oid in outlet_ids}
        for k in range(max(0, count)):
            oid = outlet_ids[k % len(outlet_ids)]
            brand = brands[oid]
            units, kg, m3 = _size(brand, rng)
            temp = Temp.AMBIENT if brand is not Brand.FRESH or rng.random() >= CHILLED_SHARE else Temp.CHILLED
            minutes = rng.randint(9 * 60, 15 * 60 + 55)
            received = datetime.combine(received_date, time(minutes // 60, minutes % 60), tzinfo=COLOMBO)
            db.add(
                Order(
                    id=f"ORD{number}", outlet_id=oid, service_date=service_date, temp=temp, units=units, weight_kg=kg, volume_m3=m3,
                    status=ServerStatus.ORDERED, tags=[], received_at=received, placed_by="seed", after_cutoff=False, row_version=1,
                )
            )
            number += 1
            made["peliyagoda" if depot == P else "kandy"] += 1
    db.flush()
    return made
