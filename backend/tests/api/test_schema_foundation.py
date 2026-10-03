"""The latest v3 model and real PostgreSQL integrity, independent of table count."""

from __future__ import annotations

import re
import uuid
from datetime import date, datetime
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import CheckConstraint, ForeignKeyConstraint, UniqueConstraint, inspect, text
from sqlalchemy.exc import IntegrityError

from app.db import Base, SessionLocal, engine
from app.models import PlanVersion, Trip, TripOrder
from app.models.enums import PlanState
from waypoint_rules.vocab import Brand

MODEL = Path(__file__).resolve().parents[3] / "docs/data-model.md"


def expected_schema():
    diagram = MODEL.read_text().split("```mermaid")[1].split("```")[0]
    tables = {}
    for name, body in re.findall(r"^    (\w+) \{\n(.*?)^    \}", diagram, re.M | re.S):
        tables[name] = {name: (kind, detail) for kind, name, detail in re.findall(r"^        (\w+) (\w+)(.*)$", body, re.M)}
    return tables, diagram


def test_metadata_matches_every_v3_table_column_type_and_key():
    expected, diagram = expected_schema()
    assert set(Base.metadata.tables) == set(expected)
    assert len(expected) == 37
    types = {"text": "TEXT", "integer": "INTEGER", "bigint": "BIGINTEGER", "float": "FLOAT", "date": "DATE",
             "time": "TIME", "boolean": "BOOLEAN", "uuid": "UUID", "jsonb": "JSONB", "text_array": "ARRAY"}
    for name, columns in expected.items():
        table = Base.metadata.tables[name]
        assert set(table.columns.keys()) == set(columns), name
        assert set(table.primary_key.columns.keys()) == {c for c, (_, detail) in columns.items() if "PK" in detail}, name
        for column, (kind, _) in columns.items():
            actual = table.c[column]
            if kind == "enum":
                assert actual.type.native_enum is False and actual.type.create_constraint is True
            elif kind == "timestamptz":
                assert actual.type.timezone is True
            else:
                assert actual.type.__class__.__name__.upper() == types[kind], (name, column)
    # Every solid relationship in the supplied diagram must have an actual FK.
    for parent, child, column in re.findall(r'^    (\w+) [|o{}-]+ (\w+) : "([^"]+)"', diagram, re.M):
        assert any(f.column.table.name == parent for f in Base.metadata.tables[child].c[column].foreign_keys), (parent, child, column)


def test_v3_nullability_uniques_checks_and_composite_links():
    tables = Base.metadata.tables
    required = {"trip_orders": ["plan_version_id", "outcome"], "traffic_speed": ["district", "hour", "monsoon", "speed_factor"],
                "notices": ["audience_kind"], "pin_people": ["depot_id"]}
    optional = {"trip_orders": ["actual_arrival", "actual_handling_end", "units_delivered", "outcome_record_id", "pod_attachment_id"],
                "exceptions": ["raised_by_user_id", "raised_by_pin_id", "decided_by_user_id"],
                "audit_events": ["actor_user_id", "actor_pin_id", "order_id"]}
    for name, columns in required.items():
        assert all(not tables[name].c[c].nullable for c in columns)
    for name, columns in optional.items():
        assert all(tables[name].c[c].nullable for c in columns)
    for name, columns in [("plan_versions", {"service_date", "number"}), ("trips", {"plan_version_id", "vehicle_id", "trip_no"}),
                          ("trip_orders", {"plan_version_id", "order_id"}), ("drivers", {"user_id"}), ("runs", {"trip_id"}),
                          ("districts", {"name", "depot_id"}), ("load_checks", {"client_id"})]:
        assert any(set(c.columns.keys()) == columns for c in tables[name].constraints if isinstance(c, UniqueConstraint)), name
    for name, cols, target in [("outlets", ["district", "depot_id"], "districts"),
                               ("trip_orders", ["trip_id", "plan_version_id"], "trips")]:
        assert any(list(c.columns.keys()) == cols and c.referred_table.name == target
                   for c in tables[name].constraints if isinstance(c, ForeignKeyConstraint))
    assert any(str(c.sqltext) == "trip_no IN (1, 2)" for c in tables["trips"].constraints if isinstance(c, CheckConstraint))
    assert tables["trip_orders"].c.outcome.type.enums == ["pending", "delivered", "partial", "failed"]
    assert tables["exceptions"].c.kind.type.enums == ["loader_shortfall", "driver_problem", "store_issue"]


def test_migrated_database_matches_metadata(client):
    with engine.connect() as conn:
        assert conn.scalar(text("SHOW server_version_num")) == "180006"
        assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "0002"
        assert set(inspect(conn).get_table_names()) - {"alembic_version"} == set(Base.metadata.tables)
        assert compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True, "compare_server_default": True}), Base.metadata) == []
        # Alembic autogenerate omits CHECK diffs; compare those explicitly.
        inspector = inspect(conn)
        for name, table in Base.metadata.tables.items():
            actual = {c["name"] for c in inspector.get_check_constraints(name)}
            expected = {c.name for c in table.constraints if isinstance(c, CheckConstraint)}
            assert actual == expected, name


@pytest.fixture
def foundation_db(client):
    from seed import run as seed_run
    seed_run.reset()


@pytest.fixture
def plan_rows(foundation_db):
    with SessionLocal() as db:
        version = PlanVersion(service_date=date(2026, 9, 29), number=10000, state=PlanState.DRAFT, created_at=datetime(2026, 9, 28))
        db.add(version)
        db.flush()
        def trip(number):
            row = Trip(plan_version_id=version.id, vehicle_id="VEH039", trip_no=number, brand=Brand.FRESH, district="Kandy",
                       depart_at=datetime(2026, 9, 29), minutes=0, kg=0, m3=0, planned_km=0, planned_fuel_l=0)
            db.add(row)
            db.flush()
            return row
        first, second = trip(1), trip(2)
        yield db, version, first, second
        db.rollback()


def rejected(db, row, constraint):
    with pytest.raises(IntegrityError) as exc, db.begin_nested():
        db.add(row)
        db.flush()
    assert exc.value.orig.diag.constraint_name == constraint


def test_plan_and_trip_integrity(plan_rows):
    db, version, first, _ = plan_rows
    rejected(db, PlanVersion(service_date=version.service_date, number=version.number, state=PlanState.DRAFT, created_at=version.created_at),
             "uq_plan_versions_service_date")
    values = {c.name: getattr(first, c.name) for c in Trip.__table__.columns if c.name != "id"}
    rejected(db, Trip(**{**values, "trip_no": 3}), "ck_trips_trip_no")
    rejected(db, Trip(**values), "uq_trips_plan_version_id")


def test_one_order_per_plan_and_matching_trip_version(plan_rows):
    db, version, first, second = plan_rows
    db.add(TripOrder(trip_id=first.id, order_id="ORD2003", plan_version_id=version.id, seq=1))
    db.flush()
    rejected(db, TripOrder(trip_id=second.id, order_id="ORD2003", plan_version_id=version.id, seq=1), "uq_trip_orders_plan_version_id")
    other = PlanVersion(service_date=version.service_date, number=10001, state=PlanState.DRAFT, created_at=version.created_at)
    db.add(other)
    db.flush()
    rejected(db, TripOrder(trip_id=second.id, order_id="ORD1002", plan_version_id=other.id, seq=1), "fk_trip_orders_trip_plan_version_trips")


@pytest.mark.parametrize("table,parent,value", [("conflict_orders", "conflict_id", 999999),
                                               ("exception_orders", "exception_id", 999999),
                                               ("device_record_orders", "client_id", uuid.UUID(int=1))])
def test_normalized_links_reject_missing_parent_and_order(foundation_db, table, parent, value):
    with engine.connect() as conn, conn.begin():
        with pytest.raises(IntegrityError) as exc, conn.begin_nested():
            conn.execute(Base.metadata.tables[table].insert().values(**{parent: value, "order_id": "ORD2003"}))
        assert exc.value.orig.diag.constraint_name == f"fk_{table}_{parent}_{ {'conflict_orders': 'conflicts', 'exception_orders': 'exceptions', 'device_record_orders': 'device_records'}[table]}"
        # An existing parent's row still cannot link to an unknown order.
        if table == "conflict_orders":
            key = conn.scalar(text("INSERT INTO conflicts (server_snapshot, device_snapshot, recommendation, reasons, status) VALUES ('{}', '{}', 'keep_delivery', '{}', 'open') RETURNING id"))
        elif table == "exception_orders":
            key = conn.scalar(text("INSERT INTO exceptions (kind, type, raised_at, status) VALUES ('store_issue', 'Other', CURRENT_TIMESTAMP, 'open') RETURNING id"))
        else:
            key = uuid.uuid4()
            conn.execute(text("INSERT INTO device_records (client_id, device_id, type, payload, received_at, result) VALUES (:key, 'test', 'driver.outcome', '{}', CURRENT_TIMESTAMP, 'error')"), {"key": key})
        with pytest.raises(IntegrityError) as exc, conn.begin_nested():
            conn.execute(Base.metadata.tables[table].insert().values(**{parent: key, "order_id": "UNKNOWN"}))
        assert exc.value.orig.diag.constraint_name == f"fk_{table}_order_id_orders"
        conn.rollback()


def test_outlet_depot_calendar_and_notice_reader_integrity(foundation_db):
    with engine.connect() as conn, conn.begin():
        with pytest.raises(IntegrityError) as exc, conn.begin_nested():
            conn.execute(text("UPDATE outlets SET depot_id = 'peliyagoda' WHERE id = 'OUT084'"))
        assert exc.value.orig.diag.constraint_name == "fk_outlets_district_depot_id_districts"
        with pytest.raises(IntegrityError) as exc, conn.begin_nested():
            conn.execute(text("UPDATE orders SET service_date = '2099-01-01' WHERE id = 'ORD2003'"))
        assert exc.value.orig.diag.constraint_name == "fk_orders_service_date_calendar_days"
        notice = conn.scalar(text("INSERT INTO notices (audience_kind, depot_id, tag, title, body, refs, created_at) VALUES ('dock', 'kandy', 'Plan', 'Test', 'Test', '{}', CURRENT_TIMESTAMP) RETURNING id"))
        readers = conn.execute(text("SELECT id FROM users ORDER BY id LIMIT 2")).scalars().all()
        for reader in readers:
            conn.execute(text("INSERT INTO notice_reads (notice_id, user_id, read_at) VALUES (:notice, :reader, CURRENT_TIMESTAMP)"), {"notice": notice, "reader": reader})
        with pytest.raises(IntegrityError) as exc, conn.begin_nested():
            conn.execute(text("INSERT INTO notice_reads (notice_id, user_id, read_at) VALUES (:notice, :reader, CURRENT_TIMESTAMP)"), {"notice": notice, "reader": readers[0]})
        assert exc.value.orig.diag.constraint_name == "pk_notice_reads"
        conn.rollback()


def test_normalized_reference_csv_seed_is_idempotent(foundation_db, tmp_path, monkeypatch):
    from app.models import RoadCondition, TrafficSpeed
    from seed import load_reference

    # Synthetic schema examples only; never read the competition datasets in tests.
    (tmp_path / "traffic_speed.csv").write_text("district,hour,monsoon,speed_index\nKandy,5,False,80\n")
    (tmp_path / "road_conditions.csv").write_text("date,district,kind,disruption_index\n2026-09-29,Kandy,roadworks,50\n")
    monkeypatch.setitem(load_reference.COLUMNS["road_conditions.csv"], "kind", "kind")
    with SessionLocal() as db:
        for _ in range(2):
            assert load_reference._load_traffic(db, tmp_path) == 1
            assert load_reference._load_roads(db, tmp_path) == 1
        assert db.get(TrafficSpeed, ("Kandy", 5, False)).speed_factor == 0.8
        roads = db.query(RoadCondition).all()
        assert len(roads) == 1 and roads[0].delay_factor == 2
        db.rollback()


def test_audit_links_keep_display_history_and_real_actors(foundation_db):
    from app.models import PinPerson, User
    from app.models.enums import AuditType
    from app.services import audit

    with SessionLocal() as db:
        user = db.query(User).filter_by(email="dispatcher@waypoint.demo").one()
        person = db.query(PinPerson).filter_by(name="Ruwan").one()
        event = audit.record(db, actor=user.display_name, entity_type="order", entity_id="ORD2003", type=AuditType.ORDER_EDITED)
        pin_event = audit.record(db, actor=person.name, entity_type="order", entity_id="ORD2003", type=AuditType.LOAD_CHECKED)
        db.flush()
        assert (event.actor, event.actor_user_id, event.order_id) == ("Kumari", user.id, "ORD2003")
        assert (pin_event.actor, pin_event.actor_pin_id) == ("Ruwan", person.id)
        db.rollback()


def test_v3_forecast_and_road_check_values(foundation_db):
    with engine.connect() as conn, conn.begin():
        with pytest.raises(IntegrityError) as exc, conn.begin_nested():
            conn.execute(text("INSERT INTO demand_forecasts (depot_id, brand, iso_year, iso_week, total_volume_m3, chilled_volume_m3, model_version, generated_at) VALUES ('kandy', 'Style', 2026, 40, 10, 1, 'test', CURRENT_TIMESTAMP)"))
        assert exc.value.orig.diag.constraint_name == "ck_demand_forecasts_chilled_brand"
        with pytest.raises(IntegrityError) as exc, conn.begin_nested():
            conn.execute(text("INSERT INTO road_conditions (service_date, district, kind, delay_factor) VALUES ('2026-09-29', 'Kandy', 'unknown', 1)"))
        assert exc.value.orig.diag.constraint_name == "ck_road_conditions_road_kind"
        conn.rollback()


def test_traffic_speed_has_a_row_for_monsoon_and_for_not(foundation_db, tmp_path):
    """The reference file has two rows per district and hour, one for a monsoon day: both load, neither replaces the other."""
    from app.models import TrafficSpeed
    from seed import load_reference

    # Invented figures in the file's shape; never read the competition datasets in tests.
    (tmp_path / "traffic_speed.csv").write_text(
        "district,hour,monsoon,speed_index\nKandy,5,False,90\nKandy,5,True,60\nKandy,6,False,80\nKandy,6,True,50\n"
    )
    with SessionLocal() as db:
        assert load_reference._load_traffic(db, tmp_path) == 4
        assert db.get(TrafficSpeed, ("Kandy", 5, False)).speed_factor == 0.9
        assert db.get(TrafficSpeed, ("Kandy", 5, True)).speed_factor == 0.6
        assert db.query(TrafficSpeed).filter_by(district="Kandy").count() == 4
        db.rollback()


def test_traffic_speed_names_a_repeated_key_instead_of_a_database_error(foundation_db, tmp_path):
    from seed import load_reference

    (tmp_path / "traffic_speed.csv").write_text("district,hour,monsoon,speed_index\nKandy,5,False,90\nKandy,5,False,70\n")
    with SessionLocal() as db:
        with pytest.raises(load_reference.SeedConfigError, match=r"more than one row for district 'Kandy', hour 5, monsoon False"):
            load_reference._load_traffic(db, tmp_path)
        db.rollback()


def test_traffic_speed_without_the_monsoon_column_names_the_header(foundation_db, tmp_path):
    from seed import load_reference

    (tmp_path / "traffic_speed.csv").write_text("district,hour,speed_index\nKandy,5,90\n")
    with SessionLocal() as db:
        with pytest.raises(load_reference.SeedConfigError, match="monsoon"):
            load_reference._load_traffic(db, tmp_path)
        db.rollback()
