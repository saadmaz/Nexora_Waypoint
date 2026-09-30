"""The reference values printed in PRD v3 §4c.

They were copied from the competition CSVs via app.html. **If a CSV disagrees, the CSV wins**:
``checks.py`` compares the loaded CSV data with these numbers and fails until the PRD and this file are
corrected. They also stand in as a small reference set when ``data/*.csv`` is absent (CI, a fresh clone),
so the API still starts. ``load_reference`` replaces them by primary key when the CSVs are present.
"""

from __future__ import annotations

from datetime import date, time

from waypoint_rules.vocab import Brand, DockType, VehicleTemp, VehicleType

P, K = "peliyagoda", "kandy"

DEPOTS = {P: "Peliyagoda", K: "Kandy"}

#: name -> (depot, outbound min, outbound km, inter-stop min, inter-stop km)
DISTRICTS = {
    "Colombo": (P, 24, 12, 8, 4),
    "Gampaha": (P, 37, 28, 9, 7),
    "Kandy": (K, 16, 8, 6, 3),
}

#: (brand, dock_type) -> handling minutes
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

#: id -> (depot, type, temp, weight cap kg, volume cap m3, km/L, weekly quota L, used before tonight L)
VEHICLES = {
    "VEH003": (P, VehicleType.TRUCK, VehicleTemp.REEFER, 5510, 26.4, 4.7, 480, 58),
    "VEH011": (P, VehicleType.TRUCK, VehicleTemp.AMBIENT, 7200, 38.0, 4.9, 600, 64),
    "VEH035": (P, VehicleType.VAN, VehicleTemp.REEFER, 1040, 7.0, 10.3, 480, 40),
    "VEH036": (P, VehicleType.VAN, VehicleTemp.REEFER, 1040, 7.0, 10.3, 480, 22),
    "VEH037": (P, VehicleType.VAN, VehicleTemp.AMBIENT, 1100, 8.0, 11.5, 340, 30),
    "VEH039": (K, VehicleType.TRUCK, VehicleTemp.REEFER, 6180, 29.9, 5.0, 370, 71),
}

#: Fleet by depot: (reefer trucks, dry-box trucks, reefer vans, ambient vans)
FLEET = {P: (7, 27, 2, 2), K: (5, 13, 2, 2)}
NETWORK = {"vehicles": 60, "reefer_capable": 16, "vans": 8}

#: Outlets the pinned orders use: id -> (brand, district, dock, window open, window close, van_only, mall window)
#: The mall window of OUT023 is a guess (same slot as OUT015); the CSV replaces it.
OUTLETS = {
    "OUT084": (Brand.FRESH, "Kandy", DockType.REAR_DOCK, time(5, 30), time(8, 0), False, None),
    "OUT087": (Brand.FRESH, "Kandy", DockType.REAR_DOCK, time(3, 0), time(8, 0), False, None),
    "OUT011": (Brand.FRESH, "Colombo", DockType.REAR_DOCK, time(3, 0), time(8, 0), False, None),
    "OUT006": (Brand.FRESH, "Colombo", DockType.STREET, time(3, 0), time(8, 0), False, None),
    "OUT005": (Brand.FRESH, "Colombo", DockType.REAR_DOCK, time(4, 0), time(7, 45), False, None),
    "OUT009": (Brand.FRESH, "Colombo", DockType.REAR_DOCK, time(4, 0), time(7, 45), False, None),
    "OUT012": (Brand.FRESH, "Colombo", DockType.REAR_DOCK, time(5, 30), time(8, 0), False, None),
    "OUT008": (Brand.FRESH, "Colombo", DockType.REAR_DOCK, time(5, 0), time(7, 30), False, None),
    "OUT013": (Brand.FRESH, "Colombo", DockType.REAR_DOCK, time(5, 0), time(7, 30), False, None),
    "OUT010": (Brand.FRESH, "Colombo", DockType.REAR_DOCK, time(5, 0), time(7, 30), False, None),
    "OUT004": (Brand.FRESH, "Colombo", DockType.STREET, time(5, 30), time(8, 0), False, None),
    "OUT014": (Brand.FRESH, "Colombo", DockType.STREET, time(5, 30), time(8, 0), False, None),
    "OUT007": (Brand.FRESH, "Colombo", DockType.STREET, time(5, 30), time(8, 0), False, None),
    "OUT001": (Brand.FRESH, "Colombo", DockType.STREET, time(5, 0), time(7, 30), True, None),
    "OUT026": (Brand.FRESH, "Gampaha", DockType.REAR_DOCK, time(3, 0), time(8, 0), False, None),
    "OUT028": (Brand.FRESH, "Gampaha", DockType.STREET, time(3, 0), time(8, 0), False, None),
    "OUT032": (Brand.FRESH, "Gampaha", DockType.REAR_DOCK, time(4, 0), time(7, 45), False, None),
    "OUT034": (Brand.FRESH, "Gampaha", DockType.REAR_DOCK, time(5, 0), time(7, 30), False, None),
    "OUT027": (Brand.FRESH, "Gampaha", DockType.STREET, time(5, 0), time(7, 30), False, None),
    "OUT025": (Brand.FRESH, "Gampaha", DockType.REAR_DOCK, time(5, 30), time(8, 0), False, None),
    "OUT029": (Brand.FRESH, "Gampaha", DockType.REAR_DOCK, time(5, 30), time(8, 0), False, None),
    "OUT033": (Brand.FRESH, "Gampaha", DockType.REAR_DOCK, time(5, 30), time(8, 0), False, None),
    "OUT015": (Brand.STYLE, "Colombo", DockType.MALL_BAY, time(9, 0), time(11, 0), False, (time(9, 0), time(11, 0))),
    "OUT017": (Brand.FRESH, "Gampaha", DockType.REAR_DOCK, time(4, 30), time(8, 0), False, None),
    "OUT023": (Brand.STYLE, "Colombo", DockType.MALL_BAY, time(9, 0), time(11, 0), False, (time(9, 0), time(11, 0))),
}

#: Calendar checks (§14 step 2). Tue 29 Sep and Mon 28 Sep operate; Sun 27 Sep does not.
OPERATING = (date(2026, 9, 28), date(2026, 9, 29))
NOT_OPERATING = (date(2026, 9, 27),)
#: R10 dates (A26): the monsoon day, a Sunday and a public holiday.
R10_MONSOON = date(2026, 6, 27)
R10_SUNDAY = date(2026, 6, 28)
R10_HOLIDAY = date(2026, 4, 14)
