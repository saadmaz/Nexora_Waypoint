"""The queue and the order history over HTTP (PRD v3 §16 step 1 and step 2, D1 and D1.5).

These need the test database (see ``conftest.py``). The store's ``placeOrders`` is not built yet, so the orders the judge
places in step 1 are inserted straight into the table, exactly as that endpoint will write them.
"""

from __future__ import annotations

from datetime import datetime

from app.config import COLOMBO

QUEUE = "/api/v1/dispatcher/queue"


def advance(client, auth, to: str) -> None:
    res = client.post("/api/v1/demo/advance", json={"to": to}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text


def queue(client, auth, depot: str = "peliyagoda", extra: str = "") -> dict:
    res = client.get(f"{QUEUE}?depot={depot}{extra}", headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    return res.json()


def place_hero_orders() -> None:
    """Step 1: Anusha orders for OUT084 at 15:40 on Mon 28 Sep, before the cutoff: Ordered, for Tue 29 Sep."""
    from app.db import SessionLocal
    from app.models.enums import ServerStatus
    from app.models.orders import Order
    from waypoint_rules.vocab import Temp

    received = datetime(2026, 9, 28, 15, 40, tzinfo=COLOMBO)
    with SessionLocal() as db:
        for oid, temp, units, kg, m3 in (("ORD2001", Temp.CHILLED, 12, 70.0, 0.7), ("ORD2002", Temp.AMBIENT, 8, 45.0, 0.6)):
            db.add(
                Order(
                    id=oid, outlet_id="OUT084", service_date=received.date().replace(day=29), temp=temp, units=units,
                    weight_kg=kg, volume_m3=m3, status=ServerStatus.ORDERED, tags=[], received_at=received, placed_by="store@waypoint.demo",
                    after_cutoff=False, row_version=1,
                )
            )
        db.commit()


# --------------------------------------------------------------------------- step 1: the hero order reaches the queue


def test_the_hero_orders_appear_under_out084_in_the_kandy_queue(client, auth, reseed):
    advance(client, auth, "2026-09-28T15:41:00+05:30")
    place_hero_orders()
    view = queue(client, auth, "kandy")
    group = next(g for g in view["groups"] if g["key"] == "OUT084")
    assert [o["id"] for o in group["orders"]] == ["ORD2001", "ORD2002"]
    assert {o["status"] for o in group["orders"]} == {"ordered"}
    assert group["outlet"]["note"] == "2 orders · tracked separately"
    assert group["title"].startswith("OUT084")
    assert view["lastReceived"] == "15:40" and view["cutoff"]["closed"] is False
    assert view["counts"]["kandy"] >= 3


# --------------------------------------------------------------------------- the queue itself


def test_the_queue_before_the_cutoff_is_open_with_a_countdown(client, auth):
    view = queue(client, auth)
    assert view["depot"] == "peliyagoda" and view["serviceDate"] == "2026-09-29"
    assert view["cutoff"] == {"closed": False, "at": "16:00", "minutesLeft": 30}
    assert view["total"] == view["counts"]["peliyagoda"] and view["shown"] == view["total"]


def test_carry_overs_come_first_and_the_van_order_is_flagged(client, auth):
    view = queue(client, auth)
    assert [g["key"] for g in view["groups"]] == ["carry", "other"]
    assert view["groups"][0]["title"] == "Carry-overs · 2"
    assert {o["outletId"] for o in view["groups"][0]["orders"]} == {"OUT012", "OUT029"}
    flagged = next(o for g in view["groups"] for o in g["orders"] if o["id"] == "ORD1020")
    assert "No legal vehicle" in flagged["tags"] and view["atRisk"] == 1


def test_after_the_cutoff_orders_are_confirmed_and_planned(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    view = queue(client, auth)
    assert view["cutoff"]["closed"] is True and view["cutoff"]["minutesLeft"] == 0
    statuses = {o["id"]: o["status"] for g in view["groups"] for o in g["orders"]}
    assert statuses["ORD1020"] == "deferred" and statuses["ORD1001"] == "planned"


def test_an_order_placed_after_the_cutoff_waits_for_the_following_run(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.enums import ServerStatus
    from app.models.orders import Order
    from waypoint_rules.vocab import Temp

    advance(client, auth, "2026-09-28T16:08:00+05:30")
    with SessionLocal() as db:
        db.add(
            Order(
                id="ORD9001", outlet_id="OUT001", service_date=datetime(2026, 9, 30).date(), temp=Temp.CHILLED, units=5, weight_kg=30.0,
                volume_m3=0.3, status=ServerStatus.ORDERED, tags=[], received_at=datetime(2026, 9, 28, 16, 7, tzinfo=COLOMBO),
                placed_by="store@waypoint.demo", after_cutoff=True, row_version=1,
            )
        )
        db.commit()
    order = next(o for g in queue(client, auth)["groups"] for o in g["orders"] if o["id"] == "ORD9001")
    assert "After cutoff" in order["tags"] and order["status"] == "ordered"
    assert order["note"] == "Moves to the following run (Wed 30 Sep)"


# --------------------------------------------------------------------------- filters and search


def _all_orders(view: dict) -> list[dict]:
    return [o for g in view["groups"] for o in g["orders"]]


def test_filters_use_repeated_query_parameters(client, auth):
    everything = queue(client, auth)
    styles = [o["id"] for o in _all_orders(everything) if o["brand"] == "Style"]
    both = queue(client, auth, extra="&brand=Fresh&brand=Style")
    only_style = queue(client, auth, extra="&brand=Style")
    assert both["shown"] == everything["shown"] > only_style["shown"] == len(styles) >= 1
    assert sorted(o["id"] for o in _all_orders(only_style)) == sorted(styles)
    assert only_style["matching"] == len(styles)
    assert everything["matching"] is None


def test_filters_combine_and_search_matches_orders_and_outlets(client, auth):
    chilled_carry = queue(client, auth, extra="&temp=chilled&tags=Carry-over")
    assert {o["outletId"] for g in chilled_carry["groups"] for o in g["orders"]} == {"OUT012", "OUT029"}
    found = queue(client, auth, extra="&search=out012")
    assert [o["id"] for g in found["groups"] for o in g["orders"]] == ["ORD1001"]
    assert queue(client, auth, extra="&brand=Style")["hiddenCarryOvers"] == queue(client, auth)["carryOvers"] == 2


def test_status_and_window_filters_take_the_systems_own_values(client, auth):
    confirmed = queue(client, auth, extra="&status=confirmed")
    assert confirmed["shown"] == confirmed["total"]
    assert queue(client, auth, extra="&status=delivered")["shown"] == 0
    late = [o["id"] for o in _all_orders(queue(client, auth)) if o["window"]["start"] >= "06:00"]
    assert "ORD1007" in late  # the 09:00 mall slot
    assert sorted(o["id"] for o in _all_orders(queue(client, auth, extra="&window=late"))) == sorted(late)
    assert client.get(f"{QUEUE}?depot=peliyagoda&status=nonsense", headers=auth("dispatcher")).status_code == 422


def test_the_queue_needs_a_depot_and_a_dispatcher(client, auth):
    assert client.get(QUEUE, headers=auth("dispatcher")).status_code == 422
    for role in ("store", "loader", "driver"):
        assert client.get(f"{QUEUE}?depot=kandy", headers=auth(role)).status_code == 403


# --------------------------------------------------------------------------- step 2: the history drawer


def test_the_history_drawer_explains_a_protected_order(client, auth):
    res = client.get("/api/v1/dispatcher/orders/ORD1001/history", headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["order"]["id"] == "ORD1001" and body["outletName"]
    assert body["summary"] == "Fresh · Colombo · chilled · rear dock"
    assert body["continuity"] == {
        "protected": True,
        "text": "Deferred yesterday · 2 days since last served · Protected by continuity guard",
    }
    assert body["lastRuns"][-1] == {"date": "Tue 29 Sep", "outcome": "pending", "label": "Today pending"}
    assert any(r["outcome"] == "deferred" and r["date"] == "Mon 28 Sep" for r in body["lastRuns"])
    assert [s["step"] for s in body["journey"]][:3] == ["Ordered", "Confirmed", "Planned"]


def test_the_journey_advances_with_the_plan(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    body = client.get("/api/v1/dispatcher/orders/ORD1020/history", headers=auth("dispatcher")).json()
    current = next(s for s in body["journey"] if s["state"] == "current")
    assert current["step"] == "Planned"  # a deferred order stays on the planned step
    assert body["notes"][0].startswith("Deferred (capacity): van_only and 1,250 kg")
    assert body["notes"][1] == "Next run Wed 30 Sep"
    planned = next(s for s in client.get("/api/v1/dispatcher/orders/ORD1002/history", headers=auth("dispatcher")).json()["journey"] if s["step"] == "Planned")
    assert planned["by"] == "System · 16:06" and planned["state"] == "current"


def test_the_history_of_an_unknown_order_is_a_404(client, auth):
    res = client.get("/api/v1/dispatcher/orders/ORD0000/history", headers=auth("dispatcher"))
    assert res.status_code == 404 and res.json()["code"] == "not_found"
