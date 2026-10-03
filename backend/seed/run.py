"""The seed (PRD §14). Idempotent: running it twice leaves the same data.

    python -m seed.run             # seeds only when SEED_ON_START=true and the database is still empty
    python -m seed.run --force     # seeds now, whatever the settings (upserts by primary key)
    python -m seed.run --strict    # fail instead of falling back when data/*.csv is absent

Order: reference tables (CSV, or the §4c fallback) → checks (CSV only) → accounts → the clock →
pinned orders → vehicle day and fuel ledger → scenario events. Outlet history and the generated orders
(A41, ``ORD3001`` upward) come later and need ``deliveries_train.csv``.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.config import COLOMBO, get_settings
from app.db import SessionLocal
from app.models.comms import Clock, ScenarioEvent
from app.models.enums import Availability, HistoryOutcome, ServerStatus
from app.models.orders import Order, OutletServiceHistory
from app.models.people import User
from app.models.plans import FuelLedger, VehicleDayStatus
from app.models.reference import Outlet, Vehicle
from waypoint_rules.vocab import Temp

from . import accounts, checks, fallback, load_reference

FIXTURES = Path(__file__).parent / "fixtures"
SCENARIO_EVENTS = Path(__file__).parent / "scenario_events.yaml"

#: Everything the seed or a demo run writes that is not reference data or accounts.
OPERATIONAL_TABLES = [
    "audit_events", "notices", "scenario_events", "clock", "receipts", "conflicts", "exceptions", "attachments",
    "device_records", "runs", "load_gates", "load_checks", "acknowledgements", "trip_orders", "trips",
    "deferrals", "plan_versions", "fuel_ledger", "vehicle_day_status", "outlet_service_history", "orders",
]


def _yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def _hhmm(value: str) -> time:
    h, m = value.split(":")
    return time(int(h), int(m))


def _at(day: date, value: str) -> datetime:
    return datetime.combine(day, _hhmm(value), tzinfo=COLOMBO)


def is_seeded(db: Session) -> bool:
    # Not the clock row: a first GET /clock creates that one lazily on an empty database.
    return (db.scalar(select(func.count()).select_from(User)) or 0) > 0


def seed_clock(db: Session) -> None:
    start = get_settings().scenario_start
    row = db.get(Clock, 1)
    if row is None:
        db.add(Clock(id=1, scenario_now=start, checkpoint=start, updated_at=start))
    else:
        row.scenario_now = row.checkpoint = row.updated_at = start
    db.flush()


def seed_pinned_orders(db: Session) -> dict[str, int]:
    data = _yaml(FIXTURES / "pinned_orders.yaml")
    service_date: date = data["service_date"]
    received_date: date = data["received_date"]
    default_received: str = data["default_received"]
    clock_now = get_settings().scenario_start

    missing = sorted({o["outlet"] for o in data["orders"]} - set(db.scalars(select(Outlet.id))))
    if missing:
        raise load_reference.SeedConfigError(
            "pinned_orders.yaml uses outlets that are not loaded: " + ", ".join(missing)
            + ". If outlets.csv is loaded, it must contain them (the CSV wins; fix the fixture)."
        )

    protected_outlets: list[str] = []
    for o in data["orders"]:
        received = _at(received_date, o["received"] or default_received)
        tags = ["Protected"] if o["deferred_yesterday"] else []
        if o["deferred_yesterday"]:
            protected_outlets.append(o["outlet"])
        db.merge(
            Order(
                id=o["id"],
                outlet_id=o["outlet"],
                service_date=service_date,
                temp=Temp(o["temp"]),
                units=o["units"],
                weight_kg=float(o["kg"]),
                volume_m3=float(o["m3"]),
                # Rows that arrive after the scenario clock are still Ordered; everything else is Confirmed.
                status=ServerStatus.ORDERED if received > clock_now else ServerStatus.CONFIRMED,
                tags=tags,
                received_at=received,
                placed_by="seed",
                after_cutoff=False,
                row_version=1,
            )
        )
    # Deferred yesterday (continuity guard input) is kept as outlet history until the full history seed lands.
    for outlet in protected_outlets:
        db.merge(OutletServiceHistory(outlet_id=outlet, service_date=received_date, outcome=HistoryOutcome.DEFERRED))
    # Days since served (impact on the store, priority): the outlet was last served that many days before the run.
    for o in data["orders"]:
        served = service_date - timedelta(days=int(o["days_since_served"]))
        db.merge(OutletServiceHistory(outlet_id=o["outlet"], service_date=served, outcome=HistoryOutcome.SERVED))
    db.flush()
    return {"orders": len(data["orders"]), "unspecified": len(data.get("unspecified", []))}


def seed_vehicle_day(db: Session) -> dict[str, int]:
    data = _yaml(FIXTURES / "vehicle_day.yaml")
    service_date: date = data["service_date"]
    iso = service_date.isocalendar()
    known = set(db.scalars(select(Vehicle.id)))

    ledger = 0
    for vid, litres in data["fuel_used_before_l"].items():
        if vid in known:
            db.merge(FuelLedger(vehicle_id=vid, iso_year=iso.year, iso_week=iso.week, used_before_l=float(litres)))
            ledger += 1
    status = 0
    for w in data["in_workshop"]:
        if w["vehicle"] in known:
            db.merge(
                VehicleDayStatus(
                    vehicle_id=w["vehicle"],
                    service_date=service_date,
                    availability=Availability.IN_WORKSHOP,
                    available_from=_at(service_date, w["available_from"]),
                )
            )
            status += 1
    db.flush()
    return {"fuel_ledger": ledger, "vehicle_day_status": status}


def seed_scenario_events(db: Session) -> int:
    events = _yaml(SCENARIO_EVENTS).get("events") or []
    db.query(ScenarioEvent).filter(ScenarioEvent.applied_at.is_(None)).delete()
    for e in events:
        at = e["at"] if isinstance(e["at"], datetime) else datetime.fromisoformat(str(e["at"]))
        db.add(ScenarioEvent(at=at, kind=e["kind"], payload=e.get("payload") or {}))
    db.flush()
    return len(events)


def seed(
    db: Session, *, data_dir: Path | None = None, strict: bool = False, reuse_accounts: bool = False
) -> dict[str, Any]:
    """Run every step in one transaction. The caller commits.

    ``reuse_accounts`` keeps the users, PIN people and drivers as they are when they exist: a demo reset does not truncate
    them, and re-hashing five passwords and PINs with bcrypt costs about three seconds.
    """
    data_dir = data_dir or get_settings().data_dir
    report: dict[str, Any] = {}

    if load_reference.csvs_present(data_dir):
        report["reference"] = {"source": "csv", **load_reference.load(db, data_dir)}
        report["reference"]["calendar_generated"] = fallback.extend_calendar(db)
        checks.run(db)
        report["checks"] = "passed"
    elif strict:
        raise load_reference.SeedConfigError(f"--strict: no CSVs in {data_dir.resolve()}")
    else:
        report["reference"] = {"source": "fallback (PRD §4c), data/*.csv not found", **fallback.load(db)}
        report["checks"] = "skipped (fallback data)"

    report["accounts"] = {"reused": True} if reuse_accounts and is_seeded(db) else accounts.seed(db)
    seed_clock(db)
    report["pinned"] = seed_pinned_orders(db)
    report["vehicle_day"] = seed_vehicle_day(db)
    report["scenario_events"] = seed_scenario_events(db)
    return report


def reset(*, actor: str = "demo") -> dict[str, Any]:
    """Truncate the operational tables and run the seed again (``POST /demo/reset``, PRD §13)."""
    with SessionLocal() as db:
        # Fail loudly rather than hang if another session still holds a lock on these tables.
        db.execute(text("SET LOCAL lock_timeout = '10s'"))
        db.execute(text("TRUNCATE " + ", ".join(OPERATIONAL_TABLES) + " RESTART IDENTITY CASCADE"))
        report = seed(db, reuse_accounts=True)
        db.commit()
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m seed.run", description=__doc__.split("\n\n")[0])
    parser.add_argument("--force", action="store_true", help="seed now, ignoring SEED_ON_START and existing data")
    parser.add_argument("--strict", action="store_true", help="fail when data/*.csv is absent instead of falling back")
    args = parser.parse_args(argv)

    settings = get_settings()
    if not args.force and not settings.seed_on_start:
        print("seed: SEED_ON_START is not true, skipping (use --force to seed anyway)")
        return 0
    with SessionLocal() as db:
        if not args.force and is_seeded(db):
            print("seed: database already seeded, nothing to do (use --force to reseed)")
            return 0
        try:
            report = seed(db, strict=args.strict)
        except (load_reference.SeedConfigError, checks.SeedCheckError) as exc:
            db.rollback()
            print(f"seed: FAILED\n{exc}", file=sys.stderr)
            return 1
        db.commit()
    for step, info in report.items():
        print(f"seed: {step}: {info}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
