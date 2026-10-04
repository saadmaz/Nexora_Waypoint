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

from app import clock
from app.config import COLOMBO, get_settings
from app.db import SessionLocal
from app.models.comms import Clock, ScenarioEvent
from app.models.enums import Availability, HistoryOutcome, ServerStatus
from app.models.orders import Order, OutletServiceHistory
from app.models.people import User
from app.models.plans import FuelLedger, VehicleDayStatus
from app.models.reference import CalendarDay, Outlet, Vehicle
from app.services.planning_repo import active_service_date
from waypoint_rules.vocab import Temp

from . import accounts, checks, fallback, generated, load_reference

FIXTURES = Path(__file__).parent / "fixtures"
SCENARIO_EVENTS = Path(__file__).parent / "scenario_events.yaml"

#: Everything the seed or a demo run writes that is not reference data or accounts.
OPERATIONAL_TABLES = [
    "notice_reads", "conflict_orders", "exception_orders", "device_record_orders", "demand_forecasts",
    "audit_events", "notices", "scenario_events", "job_runs", "clock", "receipts", "conflicts", "exceptions", "attachments",
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


def scenario_days(db: Session) -> tuple[date, date]:
    """(planning day, service date). The service date comes from SCENARIO_SERVICE_DATE and must be an operating day;
    the planning day is the operating day before it, when the clock starts (15:30) and the stores place their orders."""
    service = get_settings().scenario_service_date
    operating = sorted(db.scalars(select(CalendarDay.date).where(CalendarDay.is_operating)))
    if service not in operating:
        raise load_reference.SeedConfigError(
            f"SCENARIO_SERVICE_DATE {service.isoformat()} is not an operating day in the calendar "
            f"({operating[0].isoformat() if operating else 'empty'} to {operating[-1].isoformat() if operating else 'empty'}; "
            "Sundays and holidays do not operate). Pick another date."
        )
    earlier = [d for d in operating if d < service]
    if not earlier:
        raise load_reference.SeedConfigError(f"SCENARIO_SERVICE_DATE {service.isoformat()} has no operating day before it")
    return earlier[-1], service


def _orders_by_depot(db: Session, service_date: date) -> dict[str, int]:
    rows = db.execute(
        select(Outlet.depot_id, func.count()).join(Order, Order.outlet_id == Outlet.id).where(Order.service_date == service_date).group_by(Outlet.depot_id)
    )
    return {depot: n for depot, n in rows}


def seed_clock(db: Session, planning_day: date) -> None:
    settings = get_settings()
    start = _at(planning_day, "15:30")
    wall = clock.wall_now()
    row = db.get(Clock, 1)
    if row is None:
        db.add(Clock(id=1, anchor_scenario=start, anchor_wall=wall, rate=settings.clock_rate, checkpoint=start, updated_at=start))
    else:
        row.anchor_scenario = row.checkpoint = row.updated_at = start
        row.anchor_wall = wall
        row.rate = settings.clock_rate
    db.flush()


def seed_pinned_orders(db: Session, service_date: date, received_date: date) -> dict[str, int]:
    data = _yaml(FIXTURES / "pinned_orders.yaml")
    default_received: str = data["default_received"]

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
                # Every order is Ordered at 15:30: the 16:00 cutoff job confirms them (PRD §4b, D1.1 shows Ordered before it).
                status=ServerStatus.ORDERED,
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


def seed_vehicle_day(db: Session, service_date: date) -> dict[str, int]:
    data = _yaml(FIXTURES / "vehicle_day.yaml")
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


def seed_scenario_events(db: Session, planning_day: date, service_date: date) -> int:
    """Events are written as an offset from the scenario: ``{day: -1, time: "21:15"}`` is the planning day, ``day: 0`` the service date."""
    events = _yaml(SCENARIO_EVENTS).get("events") or []
    days = {-1: planning_day, 0: service_date}
    db.query(ScenarioEvent).filter(ScenarioEvent.applied_at.is_(None)).delete()
    for e in events:
        when = e["at"]
        if when["day"] not in days:
            raise load_reference.SeedConfigError(f"scenario_events.yaml: day must be -1 or 0, got {when['day']!r}")
        at = _at(days[when["day"]], when["time"])
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
    fallback_day = False

    if load_reference.csvs_present(data_dir):
        report["reference"] = {"source": "csv", **load_reference.load(db, data_dir)}
        report["reference"]["calendar_generated"] = fallback.extend_calendar(
            db, through=get_settings().scenario_service_date + timedelta(days=14)
        )
        checks.run(db)
        report["checks"] = "passed"
    elif strict:
        raise load_reference.SeedConfigError(f"--strict: no CSVs in {data_dir.resolve()}")
    else:
        report["reference"] = {"source": "fallback (PRD §4c), data/*.csv not found", **fallback.load(db)}
        fallback.extend_calendar(db, through=get_settings().scenario_service_date + timedelta(days=14))
        fallback_day = get_settings().seed_generated_orders
        if fallback_day:
            report["reference"]["generated"] = generated.extend_reference(db, service_date=get_settings().scenario_service_date)
        report["checks"] = "skipped (fallback data)"

    report["accounts"] = {"reused": True} if reuse_accounts and is_seeded(db) else accounts.seed(db)
    planning_day, service_date = scenario_days(db)
    seed_clock(db, planning_day)
    report["scenario"] = {"service_date": service_date.isoformat(), "planning_day": planning_day.isoformat()}
    report["pinned"] = seed_pinned_orders(db, service_date, planning_day)
    if fallback_day:
        # No CSVs: generate the rest of the day (A41) so the queue and the plan have a believable size.
        by_depot = _orders_by_depot(db, service_date)
        report["generated_orders"] = generated.seed_orders(
            db, service_date=service_date, received_date=planning_day,
            pinned_peliyagoda=by_depot.get("peliyagoda", 0), pinned_kandy=by_depot.get("kandy", 0),
        )
    report["vehicle_day"] = seed_vehicle_day(db, service_date)
    report["scenario_events"] = seed_scenario_events(db, planning_day, service_date)
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


def drifted_past_run(db: Session) -> bool:
    """Whether scenario time has run past the seeded delivery day, which empties every screen that shows "today's run".

    The dispatcher's queue, the plan and the loader's dock all follow the *active* run, which rolls to the next
    operating day at noon (``planning_repo.active_service_date``). Every seeded order is pinned to
    ``SCENARIO_SERVICE_DATE``, so once the clock passes that day's noon the seeded day is no longer anyone's run and
    the screens go empty against a database that is perfectly intact. At ``CLOCK_RATE=1`` a stack left up overnight
    reaches it in about 20 hours.
    """
    row = db.get(Clock, 1)
    if row is None:
        return False
    ops = sorted(db.scalars(select(CalendarDay.date).where(CalendarDay.is_operating)))
    now = clock.now(db).replace(tzinfo=None)
    return active_service_date(now, ops) > get_settings().scenario_service_date


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m seed.run", description=__doc__.split("\n\n")[0])
    parser.add_argument("--force", action="store_true", help="seed now, ignoring SEED_ON_START and existing data")
    parser.add_argument("--strict", action="store_true", help="fail when data/*.csv is absent instead of falling back")
    args = parser.parse_args(argv)

    settings = get_settings()
    if not args.force and not settings.seed_on_start:
        print("seed: SEED_ON_START is not true, skipping (use --force to seed anyway)")
        return 0
    drifted_at: datetime | None = None
    with SessionLocal() as db:
        if not args.force and is_seeded(db):
            # A restart is the one moment a drifted demo can be put right without a person. A clock rewind on its own
            # would leave a half-played day: the jobs that already ran are claimed in ``job_runs`` and would not run
            # again, and each drifted day has added another deferred ``-R`` order. So the repair is the demo reset,
            # taken below once this session is closed, because it truncates the tables this one has just read.
            drifted_at = clock.now(db) if drifted_past_run(db) else None
            if drifted_at is None:
                print("seed: database already seeded, nothing to do (use --force to reseed)")
                return 0
        else:
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

    print(
        f"seed: the scenario clock had run to {drifted_at:%a %d %b %H:%M}, past the seeded run "
        f"({settings.scenario_service_date}), so every screen showed an empty day. Starting the demo again."
    )
    try:
        for step, info in reset(actor="seed").items():
            print(f"seed: {step}: {info}")
    except (load_reference.SeedConfigError, checks.SeedCheckError) as exc:
        print(f"seed: FAILED\n{exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
