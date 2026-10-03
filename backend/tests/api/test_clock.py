from __future__ import annotations

from datetime import datetime

from sqlalchemy import select

CHECKPOINT = datetime.fromisoformat("2026-09-28T15:30:00+05:30")


def _now(client, auth) -> datetime:
    res = client.get("/api/v1/clock", headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    return datetime.fromisoformat(res.json()["now"])


def test_clock_is_the_scenario_checkpoint_after_seed(client, auth):
    res = client.get("/api/v1/clock", headers=auth("store"))
    assert res.status_code == 200
    body = res.json()
    assert datetime.fromisoformat(body["now"]) == CHECKPOINT
    assert body["now"].endswith("+05:30")  # Asia/Colombo, never UTC
    assert datetime.fromisoformat(body["checkpoint"]) == CHECKPOINT
    # An order placed Mon 15:30 counts for Tue 29 Sep (before the 16:00 cutoff).
    assert body["serviceDate"] == "2026-09-29"


def test_clock_needs_a_sign_in(client):
    assert client.get("/api/v1/clock").status_code == 401


def test_advance_moves_forward_then_refuses_to_go_back(client, auth, reseed):
    res = client.post("/api/v1/demo/advance", json={"to": "2026-09-28T16:00:00+05:30"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    assert datetime.fromisoformat(res.json()["now"]) == datetime.fromisoformat("2026-09-28T16:00:00+05:30")

    # Backwards is refused with the one error shape, and the clock stays put.
    back = client.post("/api/v1/demo/advance", json={"to": "2026-09-28T15:45:00+05:30"}, headers=auth("dispatcher"))
    assert back.status_code == 409
    assert back.json()["code"] == "clock_backwards"
    assert set(back.json()) == {"code", "message", "details"}
    assert _now(client, auth) == datetime.fromisoformat("2026-09-28T16:00:00+05:30")

    # Staying put is allowed; a time with no offset means Asia/Colombo. Dispatcher, like every other
    # call here: advancing is dispatcher only (the auth audit, docs/auth-audit.md).
    same = client.post("/api/v1/demo/advance", json={"to": "2026-09-28T16:00:00"}, headers=auth("dispatcher"))
    assert same.status_code == 200


def test_advance_writes_an_audit_event_in_the_same_transaction(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.comms import AuditEvent
    from app.models.enums import AuditType

    client.post("/api/v1/demo/advance", json={"to": "2026-09-28T16:05:00+05:30"}, headers=auth("dispatcher"))
    with SessionLocal() as db:
        rows = list(db.scalars(select(AuditEvent).where(AuditEvent.type == AuditType.CLOCK_ADVANCED)))
    assert len(rows) == 1
    assert rows[0].actor == "dispatcher@waypoint.demo"
    assert rows[0].payload["to"].endswith("+05:30")


def test_reset_returns_to_the_checkpoint(client, auth, reseed):
    client.post("/api/v1/demo/advance", json={"to": "2026-09-29T02:45:00+05:30"}, headers=auth("dispatcher"))
    res = client.post("/api/v1/demo/reset", headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    assert res.json()["seeded"] is True
    assert _now(client, auth) == CHECKPOINT


def test_reset_is_dispatcher_only(client, auth):
    for role in ("store", "loader", "driver"):
        res = client.post("/api/v1/demo/reset", headers=auth(role))
        assert res.status_code == 403, role
        assert res.json()["code"] == "forbidden"
