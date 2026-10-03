"""The planning endpoints end to end: the clock runs the cutoff and the draft, the dispatcher edits and releases.

These need the test database (see ``conftest.py``) and change state, so each one puts the seed back afterwards.
The walkthrough they follow is PRD v3 §16 steps 2 to 6, on the pinned orders and the six story vehicles.
"""

from __future__ import annotations

from sqlalchemy import select

PLAN = "/api/v1/dispatcher/plan"
DEPOT = "?depot=peliyagoda"


def advance(client, auth, to: str) -> None:
    res = client.post("/api/v1/demo/advance", json={"to": to}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text


def get_plan(client, auth, query: str = DEPOT) -> dict:
    res = client.get(PLAN + query, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    return res.json()


def first_chilled_order_and_ambient_trip(plan: dict) -> tuple[str, dict]:
    """A chilled order on a reefer trip, and a trip on an ambient vehicle: the move the design refuses (D3.4)."""
    order = next(s["orderIds"][0] for lane in plan["lanes"] if lane["reefer"] for t in lane["trips"] for s in t["stops"])
    target = next(t for lane in plan["lanes"] if not lane["reefer"] for t in lane["trips"])
    return order, {"vehicleId": target["vehicleId"], "trip": target["trip"]}


# --------------------------------------------------------------------------- the clock drives the plan


def test_nothing_is_planned_before_the_cutoff(client, auth):
    plan = get_plan(client, auth)
    assert plan["version"]["number"] == 0 and plan["readyToRelease"] is False
    capacity = client.get("/api/v1/dispatcher/capacity" + DEPOT, headers=auth("dispatcher")).json()
    assert capacity["plan"] is None


def test_the_first_draft_appears_at_16_05(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:04:00+05:30")
    assert get_plan(client, auth)["version"]["number"] == 0  # cutoff passed, draft not due yet

    advance(client, auth, "2026-09-28T16:05:00+05:30")
    plan = get_plan(client, auth)
    assert plan["version"]["number"] == 1 and plan["version"]["state"] == "draft"
    assert plan["readOnly"] is False and plan["readyToRelease"] is True
    assert all(check["ok"] for check in plan["checks"])
    assert plan["version"]["note"] == "System draft from the closed queue"


def test_the_cutoff_confirms_orders_and_the_draft_plans_or_defers_them(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.orders import Order

    advance(client, auth, "2026-09-28T16:06:00+05:30")
    with SessionLocal() as db:
        statuses = {o.id: o.status.value for o in db.scalars(select(Order).where(Order.deferred_from_order_id.is_(None)))}
    assert set(statuses.values()) <= {"planned", "deferred"}
    assert statuses["ORD1020"] == "deferred"  # no legal vehicle
    assert statuses["ORD1001"] == "planned"  # OUT012 was deferred yesterday: the continuity guard keeps it on a trip


def test_a_deferral_has_a_next_run_copy_for_the_next_operating_day(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.orders import Order

    advance(client, auth, "2026-09-28T16:06:00+05:30")
    with SessionLocal() as db:
        copy = db.get(Order, "ORD1020-R")
    assert copy is not None and copy.deferred_from_order_id == "ORD1020"
    assert copy.service_date.isoformat() == "2026-09-30" and copy.status.value == "confirmed"


def test_the_draft_explains_the_capacity_deferral(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    view = client.get("/api/v1/dispatcher/deferrals" + DEPOT, headers=auth("dispatcher")).json()
    assert view["counts"]["capacity"] == 1
    card = view["capacity"][0]
    assert card["orderId"] == "ORD1020" and card["kind"] == "capacity"
    assert card["reason"]["detail"] == (
        "van_only and 1,250 kg; the largest Peliyagoda reefer van carries 1,040 kg; whole orders can't split."
    )
    assert view["banner"]["title"].startswith("Capacity forces ")


def test_the_draft_kumari_releases_is_v3_at_23_30(client, auth, reseed):
    advance(client, auth, "2026-09-28T23:29:00+05:30")
    assert [v["number"] for v in get_plan(client, auth)["versions"]] == [1, 2]
    advance(client, auth, "2026-09-28T23:31:00+05:30")
    plan = get_plan(client, auth)
    assert [(v["number"], v["state"]) for v in plan["versions"]] == [(1, "draft"), (2, "draft"), (3, "draft")]
    assert plan["version"]["number"] == 3 and plan["readyToRelease"] is True
    released = client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher")).json()
    assert released["version"]["number"] == 3 and released["version"]["state"] == "released"
    assert released["version"]["note"] == "Peliyagoda + Kandy"
    assert [v["number"] for v in released["versions"]] == [1, 2, 3]


def test_a_released_plan_is_not_overwritten_by_the_scripted_drafts(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:10:00+05:30")
    assert client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher")).status_code == 200
    advance(client, auth, "2026-09-28T23:40:00+05:30")  # the 21:15 and 23:30 jobs run, and leave it alone
    plan = get_plan(client, auth)
    assert [(v["number"], v["state"]) for v in plan["versions"]] == [(1, "released")]


def test_kumaris_evening_adjustments_are_saved_as_v2(client, auth, reseed):
    advance(client, auth, "2026-09-28T21:16:00+05:30")
    plan = get_plan(client, auth)
    assert [v["number"] for v in plan["versions"]] == [1, 2]
    assert plan["version"]["number"] == 2
    assert plan["version"]["note"] == "Kumari's adjustments after the capacity review"


# --------------------------------------------------------------------------- D3 moves


def test_a_refused_move_names_every_rule(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    order, target = first_chilled_order_and_ambient_trip(get_plan(client, auth))
    res = client.post("/api/v1/dispatcher/plan/validate-move", json={"orderId": order, "to": target}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is False
    assert {v["rule"] for v in body["violations"]} >= {"R-TEMP"}
    assert body["summary"].startswith(f"Can't move {order} to ")


def test_a_protected_order_cannot_be_deferred(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    res = client.post(
        "/api/v1/dispatcher/plan/validate-move", json={"orderId": "ORD1001", "to": {"deferred": True}}, headers=auth("dispatcher")
    )
    body = res.json()
    assert body["ok"] is False and body["protectedReason"]
    assert [v["rule"] for v in body["violations"]] == ["R-CONT"]


def test_a_move_to_a_trip_that_is_not_in_the_plan_is_a_409(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    res = client.post(
        "/api/v1/dispatcher/plan/validate-move", json={"orderId": "ORD1001", "to": {"vehicleId": "VEH999", "trip": 1}}, headers=auth("dispatcher")
    )
    assert res.status_code == 409 and res.json()["code"] == "no_such_trip"


def test_saving_a_refused_move_is_a_409_and_changes_nothing(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    res = client.post(
        "/api/v1/dispatcher/plan/moves", json={"moves": [{"orderId": "ORD1001", "to": {"deferred": True}}]}, headers=auth("dispatcher")
    )
    assert res.status_code == 409 and res.json()["code"] == "illegal_move"
    assert res.json()["details"][0]["rule"] == "R-CONT"
    assert get_plan(client, auth)["version"]["number"] == 1


def test_saving_an_accepted_move_writes_the_next_draft(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    before = get_plan(client, auth)
    placed = next(s["orderIds"][0] for lane in before["lanes"] for t in lane["trips"] for s in t["stops"] if not s["protected"])
    res = client.post(
        "/api/v1/dispatcher/plan/moves", json={"moves": [{"orderId": placed, "to": {"deferred": True}}], "note": "Absorb the shortfall"},
        headers=auth("dispatcher"),
    )
    assert res.status_code == 200, res.text
    after = res.json()
    assert after["version"]["number"] == 2 and after["version"]["note"] == "Absorb the shortfall"
    assert after["deferredTotal"] == before["deferredTotal"] + 1


# --------------------------------------------------------------------------- D5 release


def test_release_locks_the_plan_and_tells_the_docks_and_drivers(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.comms import AuditEvent, Notice
    from app.models.enums import AuditType

    advance(client, auth, "2026-09-28T23:40:00+05:30")
    before = get_plan(client, auth)
    res = client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    plan = res.json()
    assert plan["version"]["number"] == before["version"]["number"]  # "Release plan v3" releases v3, in place
    assert before["version"]["state"] == "draft" and before["version"]["note"] == "Peliyagoda + Kandy · ready to release"
    assert plan["version"]["state"] == "released" and plan["readOnly"] is True

    with SessionLocal() as db:
        audiences = {n.audience for n in db.scalars(select(Notice))}
        released = list(db.scalars(select(AuditEvent).where(AuditEvent.type == AuditType.PLAN_RELEASED)))
    assert "dock:peliyagoda" in audiences and "dock:kandy" in audiences
    assert any(a.startswith("driver:") for a in audiences) and any(a.startswith("store:") for a in audiences)
    assert len(released) == 1


def test_a_plan_cannot_be_released_twice_or_edited_afterwards(client, auth, reseed):
    advance(client, auth, "2026-09-28T23:40:00+05:30")
    client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher"))
    again = client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher"))
    assert again.status_code == 409 and again.json()["code"] == "already_released"
    edit = client.post(
        "/api/v1/dispatcher/plan/moves", json={"moves": [{"orderId": "ORD1012", "to": {"deferred": True}}]}, headers=auth("dispatcher")
    )
    assert edit.status_code == 409 and edit.json()["code"] == "read_only"
    assert client.post("/api/v1/dispatcher/plan/redraft", headers=auth("dispatcher")).status_code == 409


def test_release_before_the_first_draft_says_so(client, auth):
    res = client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher"))
    assert res.status_code == 409 and res.json()["code"] == "not_ready"


def test_notify_tells_each_store_once(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    first = client.post("/api/v1/dispatcher/deferrals/notify", json={"depot": "peliyagoda"}, headers=auth("dispatcher"))
    assert first.status_code == 200 and first.json()["sent"] >= 1
    second = client.post("/api/v1/dispatcher/deferrals/notify", json={"depot": "peliyagoda"}, headers=auth("dispatcher"))
    assert second.json()["sent"] == 0
    view = client.get("/api/v1/dispatcher/deferrals" + DEPOT, headers=auth("dispatcher")).json()
    assert view["notices"]["sent"] == view["counts"]["total"]


def test_acknowledgements_follow_the_docks_and_drivers(client, auth, reseed):
    from datetime import datetime

    from app.config import COLOMBO
    from app.db import SessionLocal
    from app.models.enums import ActorKind
    from app.models.plans import Acknowledgement, PlanVersion

    advance(client, auth, "2026-09-28T23:40:00+05:30")
    released = client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher")).json()
    number = released["version"]["number"]
    pending = client.get("/api/v1/dispatcher/acknowledgements", headers=auth("dispatcher")).json()
    assert pending["version"] == number and pending["acknowledged"] == 0 and pending["banner"]["tone"] == "warning"

    with SessionLocal() as db:
        version = db.scalar(select(PlanVersion).where(PlanVersion.number == number))
        db.add(
            Acknowledgement(
                plan_version_id=version.id, actor_kind=ActorKind.PIN_PERSON, actor_id="Priya", dock="peliyagoda", vehicle_id=None,
                acknowledged_at=datetime(2026, 9, 29, 0, 10, tzinfo=COLOMBO),
            )
        )
        db.commit()
    after = client.get("/api/v1/dispatcher/acknowledgements", headers=auth("dispatcher")).json()
    priya = next(r for r in after["rows"] if r["person"] == "Priya")
    assert priya["state"] == "acknowledged" and priya["at"] == "00:10"


# --------------------------------------------------------------------------- the workshop vehicle


def test_veh036_is_spare_from_02_45(client, auth, reseed):
    advance(client, auth, "2026-09-28T23:40:00+05:30")
    before = client.get("/api/v1/dispatcher/capacity" + DEPOT, headers=auth("dispatcher")).json()
    assert before["spare"] is None and before["reefers"]["note"] == "VEH036 in workshop until 02:45"

    advance(client, auth, "2026-09-29T02:46:00+05:30")
    after = client.get("/api/v1/dispatcher/capacity" + DEPOT, headers=auth("dispatcher")).json()
    assert after["spare"]["vehicleId"] == "VEH036" and after["spare"]["since"] == "02:45"
    assert after["reefers"]["note"] == "VEH036 is spare"


# --------------------------------------------------------------------------- who may call


def test_the_planning_endpoints_are_dispatcher_only(client, auth):
    for role in ("store", "loader", "driver"):
        for method, path in (("GET", PLAN + DEPOT), ("GET", "/api/v1/dispatcher/capacity" + DEPOT), ("GET", "/api/v1/dispatcher/acknowledgements")):
            res = client.request(method, path, headers=auth(role))
            assert res.status_code == 403, (role, path)
            assert res.json()["code"] == "forbidden"


def test_an_unknown_plan_version_is_a_404(client, auth):
    res = client.get(PLAN + DEPOT + "&version=99", headers=auth("dispatcher"))
    assert res.status_code == 404 and res.json()["code"] == "not_found"
