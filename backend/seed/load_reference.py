"""Reference tables from ``data/*.csv`` (PRD §14 step 1).

``COLUMNS`` maps each of our fields to the exact CSV header (the value on the right); this module does the
rest. If a header is missing from a file, loading fails loudly and names it, rather than guessing.

``data/README.md`` lists the files. Keys on the left are our field names; do not change them.
"""

from __future__ import annotations

import csv
from collections.abc import Callable, Iterable
from datetime import date, time
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.models.reference import (
    CalendarDay,
    Depot,
    District,
    Outlet,
    RoadCondition,
    ServiceAllowance,
    TrafficSpeed,
    Vehicle,
)
from waypoint_rules.vocab import Brand, DockType, VehicleTemp, VehicleType

TODO = "TODO"

#: file name -> {our field: the CSV header}. Fill the right-hand side; leave the keys alone.
COLUMNS: dict[str, dict[str, str]] = {
    "outlets.csv": {
        "id": "outlet_id",
        "name": TODO,  # optional: leave as TODO if the file has no name column
        "brand": "brand",
        "district": "district",
        "depot": "depot",
        "dock_type": "dock_type",
        "parking_constraint": "parking_constraint",
        "mall_window_open": "mall_window",
        "mall_window_close": "mall_window",
        "window_open": "window_open_time",
        "window_close": "window_close_time",
    },
    "vehicles.csv": {
        "id": "vehicle_id",
        "type": "type",
        "temp": "temp",
        "weight_cap_kg": "weight_cap_kg",
        "volume_cap_m3": "volume_cap_m3",
        "fuel_type": "fuel_type",
        "km_per_l": "km_per_l",
        "weekly_fuel_quota_l": "weekly_fuel_quota_l",
        "depot": "depot",
    },
    "calendar.csv": {
        "date": "date",
        "dow": "dow",
        "dow_name": "dow_name",
        "is_weekend": "is_weekend",
        "iso_year": "iso_year",
        "iso_week": "iso_week",
        "is_payday": "is_payday",
        "festival": "festival",
        "festival_ramp": "festival_ramp",
        "is_holiday": "is_holiday",
        "monsoon": "monsoon",
        "is_operating": "is_operating",
    },
    "district_travel.csv": {
        "name": "district",
        "depot": "depot",
        "road_class": "road_class",
        "free_flow_kmh": "free_flow_kmh",
        "depot_to_district_km": "depot_to_district_km",
        "depot_to_district_freeflow_min": "depot_to_district_freeflow_min",
        "inter_stop_km": "inter_stop_km",
        "inter_stop_freeflow_min": "inter_stop_freeflow_min",
    },
    "service_allowance.csv": {
        "brand": "brand",
        "dock_type": "dock_type",
        "minutes": "service_allowance_min",
    },
    "traffic_speed.csv": {
        "district": "district",
        "hour": "hour",
        "speed_index": "speed_index",  # booklet: 100 is free flow; stored as index / 100
    },
    "road_conditions.csv": {
        "service_date": "date",
        "district": "district",
        # The booklet documents disruption_index, but no disruption-kind header.
        # Configure the actual header before loading this optional file; never invent a kind.
        "kind": TODO,
        "disruption_index": "disruption_index",  # stored as 100 / index (travel-time multiplier)
        "note": TODO,
    },
}

#: Fields that may stay TODO: the column is optional in the CSV or in the table.
OPTIONAL: dict[str, set[str]] = {
    "outlets.csv": {"name", "parking_constraint", "mall_window_open", "mall_window_close"},
    "vehicles.csv": {"fuel_type"},
    "calendar.csv": {"festival", "festival_ramp"},
    "district_travel.csv": {"road_class", "free_flow_kmh"},
    "road_conditions.csv": {"note"},
}

CORE_FILES = ["outlets.csv", "vehicles.csv", "calendar.csv", "district_travel.csv", "service_allowance.csv"]


class SeedConfigError(RuntimeError):
    """The CSVs or the column mapping are not ready. The message says what to fix."""


# ---- value parsers ----------------------------------------------------------


def _blank(v: str | None) -> bool:
    return v is None or v.strip() == "" or v.strip().lower() in {"na", "n/a", "null", "none", "nan"}


def to_str(v: str | None) -> str | None:
    return None if _blank(v) else v.strip()  # type: ignore[union-attr]


def to_float(v: str | None) -> float | None:
    return None if _blank(v) else float(v.strip().replace(",", ""))  # type: ignore[union-attr]


def to_int(v: str | None) -> int | None:
    f = to_float(v)
    return None if f is None else int(f)


def to_bool(v: str | None) -> bool:
    return not _blank(v) and v.strip().lower() in {"1", "true", "t", "yes", "y"}  # type: ignore[union-attr]


def to_time(v: str | None) -> time | None:
    if _blank(v):
        return None
    parts = [int(p) for p in v.strip().split(":")]  # type: ignore[union-attr]
    return time(parts[0], parts[1], parts[2] if len(parts) > 2 else 0)


def range_end(v: str | None, index: int) -> time | None:
    """One end of an ``HH:MM-HH:MM`` range (0 open, -1 close). A single time is both ends."""
    if _blank(v):
        return None
    ends = v.strip().split("-")  # type: ignore[union-attr]
    return to_time(ends[index])


def to_date(v: str | None) -> date | None:
    return None if _blank(v) else date.fromisoformat(v.strip()[:10])  # type: ignore[union-attr]


def _key(v: str | None) -> str:
    return (v or "").strip().lower().replace(" ", "_").replace("-", "_")


def to_depot(v: str | None) -> str:
    return _key(v)


def to_brand(v: str | None) -> Brand:
    return Brand((v or "").strip().title())


def to_dock(v: str | None) -> DockType:
    return DockType(_key(v))


# ---- reading ---------------------------------------------------------------


def _missing(name: str) -> list[str]:
    optional = OPTIONAL.get(name, set())
    return [f for f, header in COLUMNS[name].items() if header == TODO and f not in optional]


def _rows(data_dir: Path, name: str) -> Iterable[dict[str, str]]:
    missing = _missing(name)
    if missing:
        raise SeedConfigError(
            f"{name} is present but COLUMNS['{name}'] in backend/seed/load_reference.py still has TODO for: "
            + ", ".join(missing)
            + ". Put the exact CSV header for each."
        )
    wanted = {h for h in COLUMNS[name].values() if h != TODO}
    with (data_dir / name).open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        absent = sorted(wanted - set(reader.fieldnames or []))
        if absent:
            raise SeedConfigError(
                f"{name} has no column named {', '.join(repr(a) for a in absent)}. Fix COLUMNS['{name}'] "
                f"(the mapping, not the CSV). Headers found: {', '.join(reader.fieldnames or [])}"
            )
        yield from reader


def _get(row: dict[str, str], name: str, field: str) -> str | None:
    header = COLUMNS[name][field]
    return None if header == TODO else row.get(header)


def csvs_present(data_dir: Path) -> list[str]:
    return [n for n in CORE_FILES if (data_dir / n).is_file()]


# ---- loading ---------------------------------------------------------------


def load(db: Session, data_dir: Path) -> dict[str, int]:
    """Upsert every reference table from the CSVs. Returns rows loaded per file.

    Raises ``SeedConfigError`` when a core CSV is missing or a mapping is unfilled. Caller commits.
    """
    present = csvs_present(data_dir)
    lacking = [n for n in CORE_FILES if n not in present]
    if lacking:
        raise SeedConfigError(f"{data_dir} is missing: {', '.join(lacking)}")

    counts: dict[str, int] = {}

    depots: set[str] = set()
    for name, fields in (("vehicles.csv", "depot"), ("outlets.csv", "depot"), ("district_travel.csv", "depot")):
        for row in _rows(data_dir, name):
            depots.add(to_depot(_get(row, name, fields)))
    for d in sorted(depots):
        db.merge(Depot(id=d, name=d.replace("_", " ").title()))
    db.flush()

    counts["district_travel.csv"] = _load(db, "district_travel.csv", data_dir, _district)
    counts["service_allowance.csv"] = _load(db, "service_allowance.csv", data_dir, _allowance)
    counts["outlets.csv"] = _load(db, "outlets.csv", data_dir, _outlet)
    counts["vehicles.csv"] = _load(db, "vehicles.csv", data_dir, _vehicle)
    counts["calendar.csv"] = _load(db, "calendar.csv", data_dir, _calendar)
    if (data_dir / "traffic_speed.csv").is_file():
        counts["traffic_speed.csv"] = _load_traffic(db, data_dir)
    if (data_dir / "road_conditions.csv").is_file():
        counts["road_conditions.csv"] = _load_roads(db, data_dir)
    return counts


def _load(db: Session, name: str, data_dir: Path, build: Callable[[dict[str, str], str], Any]) -> int:
    n = 0
    for row in _rows(data_dir, name):
        db.merge(build(row, name))
        n += 1
    db.flush()
    return n


def _g(row: dict[str, str], name: str) -> Callable[[str], str | None]:
    return lambda field: _get(row, name, field)


def _district(row: dict[str, str], name: str) -> District:
    g = _g(row, name)
    return District(
        name=to_str(g("name")) or "",
        depot_id=to_depot(g("depot")),
        road_class=to_str(g("road_class")),
        free_flow_kmh=to_float(g("free_flow_kmh")),
        depot_to_district_km=to_float(g("depot_to_district_km")) or 0.0,
        depot_to_district_freeflow_min=to_float(g("depot_to_district_freeflow_min")) or 0.0,
        inter_stop_km=to_float(g("inter_stop_km")) or 0.0,
        inter_stop_freeflow_min=to_float(g("inter_stop_freeflow_min")) or 0.0,
    )


def _allowance(row: dict[str, str], name: str) -> ServiceAllowance:
    g = _g(row, name)
    return ServiceAllowance(brand=to_brand(g("brand")), dock_type=to_dock(g("dock_type")), minutes=to_int(g("minutes")) or 0)


def _outlet(row: dict[str, str], name: str) -> Outlet:
    g = _g(row, name)
    return Outlet(
        id=to_str(g("id")) or "",
        name=to_str(g("name")),
        brand=to_brand(g("brand")),
        district=to_str(g("district")) or "",
        depot_id=to_depot(g("depot")),
        dock_type=to_dock(g("dock_type")),
        parking_constraint=_key(g("parking_constraint")) or "normal",
        # outlets.csv has one ``mall_window`` column ("10:30-12:30"); both fields map to it.
        mall_window_open=range_end(g("mall_window_open"), 0),
        mall_window_close=range_end(g("mall_window_close"), -1),
        window_open=to_time(g("window_open")) or time(0, 0),
        window_close=to_time(g("window_close")) or time(23, 59),
    )


def _vehicle(row: dict[str, str], name: str) -> Vehicle:
    g = _g(row, name)
    return Vehicle(
        id=to_str(g("id")) or "",
        type=VehicleType(_key(g("type"))),
        temp=VehicleTemp(_key(g("temp"))),
        weight_cap_kg=to_float(g("weight_cap_kg")) or 0.0,
        volume_cap_m3=to_float(g("volume_cap_m3")) or 0.0,
        fuel_type=to_str(g("fuel_type")),
        km_per_l=to_float(g("km_per_l")) or 0.0,
        weekly_fuel_quota_l=to_float(g("weekly_fuel_quota_l")) or 0.0,
        depot_id=to_depot(g("depot")),
    )


def _calendar(row: dict[str, str], name: str) -> CalendarDay:
    g = _g(row, name)
    return CalendarDay(
        date=to_date(g("date")),  # type: ignore[arg-type]
        dow=to_int(g("dow")) or 0,
        dow_name=to_str(g("dow_name")) or "",
        is_weekend=to_bool(g("is_weekend")),
        iso_year=to_int(g("iso_year")) or 0,
        iso_week=to_int(g("iso_week")) or 0,
        is_payday=to_bool(g("is_payday")),
        festival=to_str(g("festival")),
        festival_ramp=to_float(g("festival_ramp")) or 0.0,
        is_holiday=to_bool(g("is_holiday")),
        monsoon=to_bool(g("monsoon")),
        is_operating=to_bool(g("is_operating")),
    )


def _load_traffic(db: Session, data_dir: Path) -> int:
    name = "traffic_speed.csv"
    n = 0
    for row in _rows(data_dir, name):
        district = to_str(_get(row, name, "district"))
        hour = to_int(_get(row, name, "hour"))
        index = to_float(_get(row, name, "speed_index"))
        if district is None or hour is None or not 0 <= hour <= 23 or index is None or index <= 0:
            raise SeedConfigError("traffic_speed.csv requires a district, hour 0..23 and positive speed_index")
        db.merge(TrafficSpeed(district=district, hour=hour, speed_factor=index / 100))
        n += 1
    db.flush()
    return n


def _load_roads(db: Session, data_dir: Path) -> int:
    name = "road_conditions.csv"
    # No natural key in v3: replace this reference table when seeding again.
    db.query(RoadCondition).delete()
    n = 0
    for row in _rows(data_dir, name):
        g = _g(row, name)
        day, district, kind = to_date(g("service_date")), to_str(g("district")), to_str(g("kind"))
        index = to_float(g("disruption_index"))
        if day is None or district is None or kind is None or index is None or index <= 0:
            raise SeedConfigError("road_conditions.csv requires date, district, kind and positive disruption_index")
        db.add(RoadCondition(service_date=day, district=district, kind=kind, delay_factor=100 / index, note=to_str(g("note"))))
        n += 1
    db.flush()
    return n
