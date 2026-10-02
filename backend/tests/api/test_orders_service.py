"""services.orders.apply: one transition function, one audit row, one transaction."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app import errors
from waypoint_rules import IllegalTransition, OrderEvent, OrderStatus


@pytest.fixture
def db(client):
    from app.db import SessionLocal

    with SessionLocal() as session:
        yield session


def _audit_count(db, order_id: str) -> int:
    from app.models.comms import AuditEvent

    return db.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.entity_id == order_id)) or 0


def test_apply_changes_status_and_writes_the_audit_row_together(reseed, db):
    # ``reseed`` comes first so it is torn down after ``db`` has closed its session (TRUNCATE needs the locks).
    from app.models.enums import AuditType
    from app.models.orders import Order
    from app.services import orders as order_service

    order = db.get(Order, "ORD1014")
    assert OrderStatus(order.status.value) is OrderStatus.CONFIRMED
    before = _audit_count(db, "ORD1014")

    order_service.apply(db, order, OrderEvent.PLAN, actor="planner", payload={"trip": "VEH003-1"})

    db.expire_all()
    order = db.get(Order, "ORD1014")
    assert order.status.value == "planned"
    assert _audit_count(db, "ORD1014") == before + 1
    from app.models.comms import AuditEvent

    row = db.scalars(select(AuditEvent).where(AuditEvent.entity_id == "ORD1014").order_by(AuditEvent.id.desc())).first()
    assert row.type is AuditType.PLAN_DRAFTED
    assert row.payload == {"event": "plan", "from": "confirmed", "to": "planned", "trip": "VEH003-1"}
    assert row.at.utcoffset() is not None  # scenario time, timezone-aware


def test_illegal_transition_changes_nothing(db):
    from app.models.orders import Order
    from app.services import orders as order_service

    order = db.get(Order, "ORD1016")
    before = _audit_count(db, "ORD1016")
    with pytest.raises(IllegalTransition):
        order_service.apply(db, order, OrderEvent.DELIVER, actor="driver")  # a Confirmed order can't deliver
    db.rollback()
    db.expire_all()
    assert db.get(Order, "ORD1016").status.value == "confirmed"
    assert _audit_count(db, "ORD1016") == before


def test_illegal_transition_is_a_409_with_the_error_shape():
    app = FastAPI()
    errors.install(app)

    @app.get("/boom")
    def boom():
        raise IllegalTransition(OrderStatus.CONFIRMED, OrderEvent.DELIVER)

    res = TestClient(app).get("/boom")
    assert res.status_code == 409
    body = res.json()
    assert set(body) == {"code", "message", "details"}
    assert body["code"] == "illegal_transition"
    assert body["message"] == "An order that is confirmed can't deliver"
    assert body["details"] == {"status": "confirmed", "event": "deliver"}
