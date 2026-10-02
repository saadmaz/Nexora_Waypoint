"""Reference day from PRD v3 §4c: the six story vehicles, three districts, the pinned orders
and the released plan v3. The golden tests check that the rules reproduce the designed numbers.

These figures were copied from the competition CSVs via app.html. If the CSVs disagree, the
CSVs win and ``seed/checks.py`` fails until the PRD is corrected.
"""

from __future__ import annotations

from datetime import date, datetime, time

import pytest

from waypoint_rules import (
    Brand,
    District,
    DockType,
    Order,
    Outlet,
    Plan,
    RefData,
    Temp,
    Trip,
    Vehicle,
    VehicleDay,
    VehicleTemp,
    VehicleType,
)

SERVICE = date(2026, 9, 29)
P, K = "peliyagoda", "kandy"


def at(hhmm: str, day: date = SERVICE) -> datetime:
    h, m = map(int, hhmm.split(":"))
    return datetime.combine(day, time(h, m))


def t(hhmm: str) -> time:
    h, m = map(int, hhmm.split(":"))
    return time(h, m)


DISTRICTS = {
    "Colombo": District("Colombo", P, 24, 12, 8, 4),
    "Gampaha": District("Gampaha", P, 37, 28, 9, 7),
    "Kandy": District("Kandy", K, 16, 8, 6, 3),
}

ALLOWANCES = {
    (Brand.FRESH, DockType.REAR_DOCK): 15,
    (Brand.FRESH, DockType.STREET): 16,
    (Brand.FRESH, DockType.MALL_BAY): 18,
    (Brand.STYLE, DockType.REAR_DOCK): 38,
    (Brand.STYLE, DockType.STREET): 46,
    (Brand.STYLE, DockType.MALL_BAY): 59,
    (Brand.TECH, DockType.REAR_DOCK): 43,
    (Brand.TECH, DockType.STREET): 55,
    (Brand.TECH, DockType.MALL_BAY): 55,
}

VEHICLES = {
    "VEH003": Vehicle("VEH003", P, VehicleType.TRUCK, VehicleTemp.REEFER, 5510, 26.4, 4.7, 480),
    "VEH011": Vehicle("VEH011", P, VehicleType.TRUCK, VehicleTemp.AMBIENT, 7200, 38.0, 4.9, 600),
    "VEH035": Vehicle("VEH035", P, VehicleType.VAN, VehicleTemp.REEFER, 1040, 7.0, 10.3, 480),
    "VEH036": Vehicle("VEH036", P, VehicleType.VAN, VehicleTemp.REEFER, 1040, 7.0, 10.3, 480),
    "VEH037": Vehicle("VEH037", P, VehicleType.VAN, VehicleTemp.AMBIENT, 1100, 8.0, 11.5, 340),
    "VEH039": Vehicle("VEH039", K, VehicleType.TRUCK, VehicleTemp.REEFER, 6180, 29.9, 5.0, 370),
}

VEHICLE_DAYS = {
    "VEH003": VehicleDay("VEH003", fuel_used_before_l=58),
    "VEH011": VehicleDay("VEH011", fuel_used_before_l=64),
    "VEH035": VehicleDay("VEH035", fuel_used_before_l=40),
    "VEH036": VehicleDay("VEH036", available_from=at("02:45"), fuel_used_before_l=22),
    "VEH037": VehicleDay("VEH037", fuel_used_before_l=30),
    "VEH039": VehicleDay("VEH039", fuel_used_before_l=71),
}

F, S = Brand.FRESH, Brand.STYLE
RD, ST, MB = DockType.REAR_DOCK, DockType.STREET, DockType.MALL_BAY
C, A = Temp.CHILLED, Temp.AMBIENT

# order, outlet, brand, district, temp, dock, window, units, kg, m3, deferred_yesterday, days_since, van_only, mall
PINNED = [
    ("ORD2001", "OUT084", F, "Kandy", C, RD, "05:30-08:00", 12, 70, 0.7, False, 1, False, False),
    ("ORD2002", "OUT084", F, "Kandy", A, RD, "05:30-08:00", 8, 45, 0.6, False, 1, False, False),
    ("ORD2003", "OUT087", F, "Kandy", A, RD, "03:00-08:00", 9, 55, 0.6, False, 1, False, False),
    ("ORD1014", "OUT011", F, "Colombo", C, RD, "03:00-08:00", 40, 240, 1.6, False, 1, False, False),
    ("ORD1016", "OUT006", F, "Colombo", C, ST, "03:00-08:00", 38, 230, 1.5, False, 1, False, False),
    ("ORD1011", "OUT005", F, "Colombo", C, RD, "04:00-07:45", 43, 260, 1.7, False, 1, False, False),
    ("ORD1002", "OUT009", F, "Colombo", C, RD, "04:00-07:45", 35, 210, 1.4, False, 1, False, False),
    ("ORD1001", "OUT012", F, "Colombo", C, RD, "05:30-08:00", 37, 220, 1.5, True, 2, False, False),
    ("ORD1013", "OUT008", F, "Colombo", C, RD, "05:00-07:30", 12, 70, 0.7, False, 1, False, False),
    ("ORD1015", "OUT013", F, "Colombo", C, RD, "05:00-07:30", 12, 75, 0.7, False, 1, False, False),
    ("ORD1018", "OUT010", F, "Colombo", C, RD, "05:00-07:30", 17, 100, 1.0, False, 1, False, False),
    ("ORD1012", "OUT004", F, "Colombo", C, ST, "05:30-08:00", 16, 95, 0.9, False, 1, False, False),
    ("ORD1009", "OUT014", F, "Colombo", C, ST, "05:30-08:00", 16, 95, 0.9, False, 1, False, False),
    ("ORD1017", "OUT007", F, "Colombo", C, ST, "05:30-08:00", 11, 65, 0.6, False, 1, False, False),
    ("ORD1020", "OUT001", F, "Colombo", C, ST, "05:00-07:30", 208, 1250, 8.6, False, 3, True, False),
    ("ORD1023", "OUT026", F, "Gampaha", C, RD, "03:00-08:00", 11, 65, 0.6, False, 1, False, False),
    ("ORD1024", "OUT028", F, "Gampaha", C, ST, "03:00-08:00", 17, 100, 0.9, False, 1, False, False),
    ("ORD1022", "OUT032", F, "Gampaha", C, RD, "04:00-07:45", 15, 90, 0.8, False, 1, False, False),
    ("ORD1021", "OUT034", F, "Gampaha", C, RD, "05:00-07:30", 12, 75, 0.7, False, 1, False, False),
    ("ORD1004", "OUT027", F, "Gampaha", C, ST, "05:00-07:30", 15, 90, 0.8, False, 1, False, False),
    ("ORD1003", "OUT025", F, "Gampaha", C, RD, "05:30-08:00", 20, 120, 1.0, False, 1, False, False),
    ("ORD1005", "OUT029", F, "Gampaha", C, RD, "05:30-08:00", 13, 80, 0.7, True, 2, False, False),
    ("ORD1006", "OUT033", F, "Gampaha", C, RD, "05:30-08:00", 22, 130, 1.1, False, 1, False, False),
    ("ORD1007", "OUT015", S, "Colombo", A, MB, "09:00-11:00", 30, 450, 6.5, False, 7, False, True),
]


def _build():
    outlets: dict[str, Outlet] = {}
    orders: dict[str, Order] = {}
    for oid, out, brand, district, temp, dock, window, units, kg, m3, dy, days, van, mall in PINNED:
        wo, wc = (t(x) for x in window.split("-"))
        outlets[out] = Outlet(
            id=out, brand=brand, district=district, depot=DISTRICTS[district].depot, dock_type=dock,
            window_open=wo, window_close=wc, van_only=van, mall_dock=mall,
            mall_open=wo if mall else None, mall_close=wc if mall else None,
        )
        orders[oid] = Order(oid, out, temp, units, kg, m3, dy, days)
    return RefData(outlets, DISTRICTS, VEHICLES, ALLOWANCES), orders


REF, ORDERS = _build()


def plan_v3() -> Plan:
    trips = [
        Trip("VEH003", 1, at("03:30"), ["ORD1014", "ORD1016", "ORD1011", "ORD1002", "ORD1001"]),
        Trip("VEH003", 2, at("06:09"), ["ORD1013", "ORD1015", "ORD1018", "ORD1012"]),
        Trip("VEH035", 1, at("03:30"), ["ORD1023", "ORD1024", "ORD1022", "ORD1021"]),
        Trip("VEH035", 2, at("06:12"), ["ORD1004", "ORD1003", "ORD1005"]),
        Trip("VEH011", 1, at("08:36"), ["ORD1007"]),
        Trip("VEH039", 1, at("05:10"), ["ORD2001", "ORD2002", "ORD2003"]),
    ]
    return Plan(SERVICE, {tr.key: tr for tr in trips}, deferred=["ORD1020", "ORD1009", "ORD1017", "ORD1006"])


@pytest.fixture
def ref() -> RefData:
    return REF


@pytest.fixture
def orders() -> dict[str, Order]:
    return ORDERS


@pytest.fixture
def vdays() -> dict[str, VehicleDay]:
    return VEHICLE_DAYS


@pytest.fixture
def v3() -> Plan:
    return plan_v3()
