"""The store, loader and driver reads over HTTP: the hero day (PRD v3 §2, §16 steps 1 to 19) seen from the three field roles.

Nothing is inserted by hand. The store places its own orders; the dispatcher releases, defers and resolves; the loader and
the driver write through ``/sync``; and each role reads back through its own typed routes. These need the test database.
"""

from __future__ import annotations

from typing import Any

from .test_dispatcher_live import advance, defer_hero
from .test_sync import DAY, hero_batch, record, results, sync

STORE = "/api/v1/store"
LOADER = "/api/v1/loader"
DRIVER = "/api/v1/driver"


def get(client, auth, role: str, path: str, **params: Any) -> Any:
    res = client.get(path, headers=auth(role), params=params)
    assert res.status_code == 200, f"{path}: {res.status_code} {res.text}"
    return res.json()


def post(client, auth, role: str, path: str, body: dict | None = None, status: int = 200) -> Any:
    res = client.post(path, headers=auth(role), json=body)
    assert res.status_code == status, f"{path}: {res.status_code} {res.text}"
    return res.json() if res.content else None


def day(client, auth) -> dict:
    days = get(client, auth, "store", f"{STORE}/deliveries/{DAY}")
    assert len(days) == 1
    return days[0]


def place(client, auth) -> list[dict]:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    return post(
        client, auth, "store", f"{STORE}/orders",
        {"orders": [
            {"outletId": "OUT084", "deliveryDate": DAY, "line": {"kind": "chilled", "units": 12, "estimatedKg": 70, "estimatedM3": 0.7}},
            {"outletId": "OUT084", "deliveryDate": DAY, "line": {"kind": "ambient", "units": 8, "estimatedKg": 45, "estimatedM3": 0.6}},
        ]},
        status=201,
    )


def released(client, auth) -> int:
    advance(client, auth, "2026-09-28T23:40:00+05:30")
    res = client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    return client.get("/api/v1/dispatcher/plan?depot=kandy", headers=auth("dispatcher")).json()["version"]["number"]


def on_the_road(client, auth) -> int:
    version = released(client, auth)
    advance(client, auth, "2026-09-29T04:50:00+05:30")
    loaded = results(
        sync(client, auth, [record("loader.confirmLoaded", {"vehicleId": "VEH039", "trip": 1, "personId": "Ruwan", "personName": "Ruwan"}, "04:50", None, actor="Ruwan")], role="loader", device="tablet-kandy")
    )
    assert [r["result"] for r in loaded] == ["accepted"]
    advance(client, auth, "2026-09-29T05:17:00+05:30")
    started = results(
        sync(client, auth, [record("driver.ack", {"date": DAY, "version": version}, "04:55", version), record("driver.startRoute", {"date": DAY, "at": "05:10"}, "05:10", version)])
    )
    assert [r["result"] for r in started] == ["accepted", "accepted"]
    return version


# ---- orders (S1) --------------------------------------------------------------------------------------------------------


def test_the_store_places_edits_and_cancels_its_orders(client, auth, reseed):
    form = get(client, auth, "store", f"{STORE}/order-form")
    assert form["outletId"] == "OUT084" and form["deliveryDate"] == "2026-09-29" and form["afterCutoff"] is False
    assert form["window"] == {"start": "05:30", "end": "08:00"} and form["dock"] == "Rear dock" and form["orders"] == []
    assert set(form["unitFactors"]) == {"chilled", "ambient"} and set(form["defaultUnits"]) == {"chilled", "ambient"}

    orders = place(client, auth)
    assert [(o["id"], o["line"]["kind"], o["line"]["units"], o["status"]) for o in orders] == [
        ("ORD2001", "chilled", 12, "ordered"), ("ORD2002", "ambient", 8, "ordered"),
    ]
    assert orders[0]["receivedAt"].startswith("2026-09-28T15:40") and orders[0]["afterCutoff"] is False and orders[0]["dock"] == "rear_dock"
    # The form now lists them, and the units they were placed with become the form's starting quantities.
    again = get(client, auth, "store", f"{STORE}/order-form")
    assert [o["id"] for o in again["orders"]] == ["ORD2001", "ORD2002"] and again["defaultUnits"] == {"chilled": 12, "ambient": 8}
    assert round(again["unitFactors"]["chilled"]["kg"], 2) == round(70 / 12, 2)

    # One order per kind per day.
    dup = client.post(f"{STORE}/orders", headers=auth("store"), json={"orders": [
        {"outletId": "OUT084", "deliveryDate": DAY, "line": {"kind": "chilled", "units": 5, "estimatedKg": 30, "estimatedM3": 0.3}}]})
    assert dup.status_code == 409 and dup.json()["code"] == "already_ordered"
    # Another outlet's orders are not the store's to place.
    other = client.post(f"{STORE}/orders", headers=auth("store"), json={"orders": [
        {"outletId": "OUT009", "deliveryDate": DAY, "line": {"kind": "chilled", "units": 5, "estimatedKg": 30, "estimatedM3": 0.3}}]})
    assert other.status_code == 403

    edited = client.patch(f"{STORE}/orders/ORD2001", headers=auth("store"), json={"units": 14, "estimatedKg": 82, "estimatedM3": 0.8})
    assert edited.status_code == 200 and edited.json()["line"]["units"] == 14 and edited.json()["updatedAt"] is not None
    assert client.patch(f"{STORE}/orders/ORD9999", headers=auth("store"), json={"units": 1, "estimatedKg": 1, "estimatedM3": 1}).status_code == 404

    assert post(client, auth, "store", f"{STORE}/orders/ORD2002/cancel", status=204) is None
    assert [o["id"] for o in get(client, auth, "store", f"{STORE}/order-form")["orders"]] == ["ORD2001"]

    feed = get(client, auth, "store", f"{STORE}/updates")
    assert feed["updates"][0]["title"] == "Order received" and feed["updates"][0]["tag"] == "Order" and feed["unread"] >= 1
    assert feed["updates"][0]["target"] == {"screen": "orders"}


def test_orders_close_at_the_cutoff_and_after_it_roll_to_the_next_run(client, auth, reseed):
    place(client, auth)
    advance(client, auth, "2026-09-28T16:01:00+05:30")
    for res in (
        client.patch(f"{STORE}/orders/ORD2001", headers=auth("store"), json={"units": 9, "estimatedKg": 50, "estimatedM3": 0.5}),
        client.post(f"{STORE}/orders/ORD2001/cancel", headers=auth("store")),
    ):
        assert res.status_code == 409, res.text
        assert set(res.json()) == {"code", "message", "details"}
    d = day(client, auth)
    assert d["status"] == "confirmed" and d["planPending"] is True and d["arrival"] is None
    assert [s["state"] for s in d["journey"][:3]] == ["done", "done", "pending"] and d["journey"][1]["at"] == "16:00"

    form = get(client, auth, "store", f"{STORE}/order-form")
    assert form["deliveryDate"] == "2026-09-30" and form["afterCutoff"] is True  # a store ordering at 16:01 counts for Wednesday
    late = post(
        client, auth, "store", f"{STORE}/orders",
        {"orders": [{"outletId": "OUT084", "deliveryDate": "2026-09-29", "line": {"kind": "chilled", "units": 3, "estimatedKg": 18, "estimatedM3": 0.2}}]}, status=201,
    )
    assert late[0]["deliveryDate"] == "2026-09-30" and late[0]["afterCutoff"] is True  # the server decides the day, not the form


# ---- the plan, the dock and the driver ------------------------------------------------------------------------------------


def test_a_released_plan_reaches_the_store_the_dock_and_the_driver(client, auth, reseed):
    place(client, auth)
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    empty = get(client, auth, "loader", f"{LOADER}/docks/kandy")  # nothing is released yet: an empty board, not an error
    assert empty["planVersion"] == 0 and empty["vehicles"] == []
    before = client.get(f"{DRIVER}/runs/{DAY}", headers=auth("driver"))  # no plan yet: a state of the screen, not an error
    assert before.status_code == 200 and before.json()["state"] == "no_run" and before.json()["noRun"]["reason"] == "not_released"
    version = released(client, auth)

    d = day(client, auth)
    assert d["status"] == "planned" and d["vehicle"] == "VEH039" and d["planPending"] is False and d["receiversCue"] is True
    assert d["arrival"]["from"] == "05:30" and d["journey"][2]["at"] == "23:40" and d["journey"][2]["state"] == "current"
    assert [(o["id"], o["status"]) for o in d["orders"]] == [("ORD2001", "planned"), ("ORD2002", "planned")]

    dock = get(client, auth, "loader", f"{LOADER}/docks/kandy")
    assert dock["dock"] == "kandy" and dock["planVersion"] == version and dock["acknowledged"] is False
    assert {p["name"] for p in dock["people"]} == {"Ruwan"}
    veh039 = next(v for v in dock["vehicles"] if v["vehicleId"] == "VEH039")
    assert veh039["tripNo"] == 1 and veh039["orders"] == 3 and veh039["planVersion"] == version

    person = dock["people"][0]["id"]
    assert post(client, auth, "loader", f"{LOADER}/pins/verify", {"personId": person, "pin": "5678"})["ok"] is True
    assert post(client, auth, "loader", f"{LOADER}/pins/verify", {"personId": person, "pin": "0000"}) == {"ok": False, "person": None}
    assert post(client, auth, "loader", f"{LOADER}/pins/verify", {"personId": 9999, "pin": "5678"})["ok"] is False

    plan = get(client, auth, "loader", f"{LOADER}/vehicles/VEH039/trips/1")
    assert plan["planVersion"] == version and plan["confirmedAt"] is None
    assert [line["loadNo"] for line in plan["lines"]] == [1, 2, 3]
    assert {line["orderId"] for line in plan["lines"]} == {"ORD2001", "ORD2002", "ORD2003"} and all(line["unitsLoaded"] is None for line in plan["lines"])
    assert get(client, auth, "loader", f"{LOADER}/docks/kandy/diff", **{"from": version, "to": version})["lines"] == []
    assert client.get(f"{LOADER}/vehicles/VEH039/trips/2", headers=auth("loader")).status_code == 404
    assert client.get(f"{LOADER}/docks/nowhere", headers=auth("loader")).status_code == 404

    run = get(client, auth, "driver", f"{DRIVER}/runs/{DAY}")
    assert (run["vehicleId"], run["tripNo"], run["planVersion"], run["driver"], run["acknowledged"]) == ("VEH039", 1, version, "Nimal", False)
    assert sorted(s["orderId"] for s in run["stops"]) == ["ORD2001", "ORD2002", "ORD2003"]
    first = next(s for s in run["stops"] if s["orderId"] == "ORD2001")
    assert first["outletId"] == "OUT084" and first["window"] == {"start": "05:30", "end": "08:00"} and first["status"] == "planned"
    assert "Chilled" in first["tags"]
    assert get(client, auth, "driver", f"{DRIVER}/history") == []
    notices = get(client, auth, "driver", f"{DRIVER}/notices")
    assert notices and notices[0]["tag"] == "plan_released" and notices[0]["read"] is False


def test_loading_and_leaving_show_on_the_store_the_dock_and_the_driver(client, auth, reseed):
    place(client, auth)
    version = on_the_road(client, auth)

    d = day(client, auth)
    assert d["status"] == "departed" and d["onTheWay"] == {"arrivesAbout": d["onTheWay"]["arrivesAbout"], "unloadingFrom": "05:30"}
    assert d["journey"][3]["at"] == "04:50" and d["journey"][4]["at"] == "05:10" and d["journey"][4]["state"] == "current"
    assert d["lastUpdate"] is None  # heard at 05:17, scenario time 05:17: not yet out of coverage

    advance(client, auth, "2026-09-29T05:21:00+05:30")
    assert day(client, auth)["lastUpdate"] == "05:17"  # now it is: the store sees the last status, not an alert

    plan = get(client, auth, "loader", f"{LOADER}/vehicles/VEH039/trips/1")
    assert plan["confirmedAt"] is not None
    dock = get(client, auth, "loader", f"{LOADER}/docks/kandy")
    assert dock["planVersion"] == version
    run = get(client, auth, "driver", f"{DRIVER}/runs/{DAY}")
    assert run["acknowledged"] is True and {s["status"] for s in run["stops"]} == {"departed"}


def test_a_loader_flag_is_read_back_with_its_decision(client, auth, reseed):
    place(client, auth)
    released(client, auth)
    flagged = results(
        sync(
            client, auth,
            [record("loader.exception", {"vehicleId": "VEH039", "trip": 1, "type": "Missing item", "orderIds": ["ORD2003"], "unitsShort": 2, "note": "Two cartons short"}, "03:10", None, actor="Ruwan")],
            role="loader", device="tablet-kandy",
        )
    )
    assert flagged[0]["result"] == "accepted"
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.field import FieldException

    with SessionLocal() as db:
        exception_id = db.scalars(select(FieldException.id)).first()
    flag = get(client, auth, "loader", f"{LOADER}/exceptions/{exception_id}")
    assert flag["type"] == "Missing item" and flag["vehicleId"] == "VEH039" and flag["tripNo"] == 1 and flag["status"] == "open"
    assert flag["unitsShort"] == {"ORD2003": 2} and flag["detail"] == "Two cartons short" and flag["decision"] is None
    assert client.get(f"{LOADER}/exceptions/99999", headers=auth("loader")).status_code == 404


# ---- the degradation: deferral, offline delivery, review, receipt -------------------------------------------------------------------


def test_the_hero_degradation_as_the_store_sees_it(client, auth, reseed):
    place(client, auth)
    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T05:21:00+05:30")
    titles = [u["title"] for u in get(client, auth, "store", f"{STORE}/updates")["updates"]]
    assert titles[:3] == ["On the way", "Loaded", "Arrival time set"] and titles[-1] == "Order received"
    sent = {u["title"]: u for u in get(client, auth, "store", f"{STORE}/updates")["updates"]}
    assert sent["Arrival time set"]["time"] == "23:40" and sent["Arrival time set"]["tag"] == "Plan" and sent["Loaded"]["body"].endswith("at Kandy dock.")
    assert sent["On the way"]["body"].startswith("VEH039 left at 05:10") and sent["On the way"]["target"] == {"screen": "delivery", "date": DAY}
    assert defer_hero(client, auth).status_code == 200

    d = day(client, auth)
    assert d["status"] == "deferred" and d["arrival"] is None and d["planPending"] is False
    deferral = d["deferral"]
    assert deferral["type"] == "store_request" and deferral["headline"] == "Deferred at your request"
    assert deferral["decidedBy"] == "Kumari" and deferral["decidedAt"] == "05:21" and deferral["acknowledged"] is False
    assert deferral["nextRunLabel"] == "New ETA" and deferral["nextRun"] == "Wed 30 Sep · from 05:30" and deferral["nextRunShort"] == "Wed"
    feed = get(client, auth, "store", f"{STORE}/updates")
    assert feed["updates"][0]["tag"] == "Deferral" and feed["updates"][0]["unread"] is True
    assert feed["updates"][0]["target"] == {"screen": "delivery", "date": DAY}

    post(client, auth, "store", f"{STORE}/deferrals/{deferral['id']}/seen", status=204)
    assert day(client, auth)["deferral"]["acknowledged"] is True
    assert get(client, auth, "store", f"{STORE}/updates")["updates"][0]["unread"] is False
    assert client.post(f"{STORE}/deferrals/99999/seen", headers=auth("store")).status_code == 404

    # The driver's phone gets the change, and the dock gets a diff of v(n) → v(n+1).
    diff = get(client, auth, "loader", f"{LOADER}/docks/kandy/diff", **{"from": version, "to": version + 1})
    assert {(line["change"], line["orderId"]) for line in diff["lines"]} == {("removed", "ORD2001"), ("removed", "ORD2002")}
    kinds = {n["tag"] for n in get(client, auth, "driver", f"{DRIVER}/notices")}
    assert "plan_released" in kinds

    advance(client, auth, "2026-09-29T06:40:00+05:30")
    answers = results(sync(client, auth, hero_batch(version)))
    assert [a["result"] for a in answers] == ["accepted", "conflict", "conflict", "accepted", "accepted"]
    cid = answers[1]["conflictId"]

    d = day(client, auth)
    assert d["status"] == "conflict"  # the store screens print this as "Under review", never "Conflict"
    # askedAt is the store's own call to hold the delivery (05:21, H10 to H11), which is what the
    # "Why you're seeing this" notice quotes back; it is not the moment the outbox synced.
    assert d["review"] == {"askedAt": "05:21", "deliveredAt": "05:42", "receivedBy": "S. Fernando", "conflictId": str(cid), "asked": False}
    assert d["proof"]["receivedBy"] == "S. Fernando" and d["proof"]["at"] == "05:42" and d["proof"]["units"] == [12, 8]
    assert (d["proof"]["driver"], d["proof"]["vehicle"]) == ("Nimal", "VEH039") and d["receivedAnswered"] is False
    # Departed keeps its 05:10 time even though v5 moved the orders off the trip that drove: the run is
    # found by the vehicle on the driver's record. Delivered waits, because under review nothing is settled.
    assert d["journey"][4]["at"] == "05:10" and [s["state"] for s in d["journey"][4:6]] == ["current", "pending"]
    review = get(client, auth, "store", f"{STORE}/updates")["updates"][0]
    assert review["tag"] == "Review" and review["resolvedAt"] is None

    # D7.2 "Review with store first": now the store is asked, and only now does S3.5 draw the question.
    asked = client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher"))
    assert asked.status_code == 200, asked.text
    assert day(client, auth)["review"]["asked"] is True

    # "Yes, we received it": recorded for Dispatch, and it settles the delivery for the store at once (S2.8).
    post(client, auth, "store", f"{STORE}/reviews/{cid}/answer", {"answer": "received"}, status=204)
    d = day(client, auth)
    assert d["receivedAnswered"] is True and d["review"] is None and d["status"] == "delivered"
    assert client.post(f"{STORE}/reviews/{cid}/answer", headers=auth("store"), json={"answer": "nope"}).status_code == 422

    advance(client, auth, "2026-09-29T06:44:00+05:30")
    res = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_delivery"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    d = day(client, auth)
    assert d["status"] == "delivered" and "Deferral withdrawn" in d["tags"] and d["withdrawnNote"] == "Wed 30 Sep re-run removed."
    assert d["deferral"] is None and d["review"] is None and d["journey"][5]["at"] == "05:42" and d["journey"][6]["state"] == "current"
    assert get(client, auth, "store", f"{STORE}/updates")["updates"][0]["title"] == "Deliveries updated"

    # S3: confirm receipt with a shortfall, then report a problem. A50: a short count has to say why,
    # in one of the four words the sheet offers, and the API refuses it without one.
    no_reason = client.post(f"{STORE}/receipts", headers=auth("store"), json={
        "date": DAY, "lines": [{"orderId": "ORD2001", "received": 11}, {"orderId": "ORD2002", "received": 8}]})
    assert no_reason.status_code == 422 and no_reason.json()["code"] == "reason_required"
    assert no_reason.json()["details"]["reasons"] == ["Missing", "Damaged", "Wrong item", "Other"]
    prose = client.post(f"{STORE}/receipts", headers=auth("store"), json={
        "date": DAY, "lines": [{"orderId": "ORD2001", "received": 11}], "reason": "One carton was crushed"})
    assert prose.status_code == 422 and prose.json()["code"] == "unknown_reason"

    short = post(
        client, auth, "store", f"{STORE}/receipts",
        {"date": DAY, "lines": [{"orderId": "ORD2001", "received": 11}, {"orderId": "ORD2002", "received": 8}], "reason": "Damaged", "deviceTime": "07:30"},
        status=201,
    )
    assert short["status"] == "partial" and "Receipt confirmed" in short["tags"] and short["receiptConfirmedAt"] == "07:30"
    assert short["receiptBy"] == "Anusha" and short["shortfallReason"] == "Damaged"
    assert [(o["id"], o["status"], o["received"]) for o in short["orders"]] == [("ORD2001", "partial", 11), ("ORD2002", "delivered", None)]
    assert short["journey"][6]["at"] == "07:30" and short["journey"][6]["state"] == "done"
    # A full count needs no reason at all.
    full = post(client, auth, "store", f"{STORE}/receipts", {"date": DAY, "lines": [{"orderId": "ORD2002", "received": 8}]}, status=201)
    assert full["receiptConfirmedAt"] is not None
    too_many = client.post(f"{STORE}/receipts", headers=auth("store"), json={"date": DAY, "lines": [{"orderId": "ORD2002", "received": 9}]})
    assert too_many.status_code == 422

    issue = post(client, auth, "store", f"{STORE}/issues", {"date": DAY, "type": "Damaged", "lines": [{"orderId": "ORD2002", "units": 2}], "note": "Wet boxes", "photo": True}, status=201)
    assert issue["type"] == "Damaged" and issue["photo"] is True and issue["resolved"] is False and issue["date"] == DAY
    assert issue["lines"] == [{"orderId": "ORD2002", "kind": "ambient", "units": 2, "orderUnits": 8}]
    assert client.post(f"{STORE}/issues", headers=auth("store"), json={"date": DAY, "type": "Bored", "lines": [{"orderId": "ORD2002", "units": 1}]}).status_code == 422
    listed = get(client, auth, "store", f"{STORE}/issues")
    assert [i["id"] for i in listed] == [issue["id"]]
    d = day(client, auth)
    assert d["status"] == "issue" and d["issues"][0]["id"] == issue["id"]
    assert next(o for o in d["orders"] if o["id"] == "ORD2002")["issue"] == "Damaged" and next(o for o in d["orders"] if o["id"] == "ORD2002")["status"] == "issue"

    recent = get(client, auth, "store", f"{STORE}/history", limit=5)
    assert recent[0]["date"] == DAY and recent[0]["current"] is True and recent[0]["orderCount"] == 2 and recent[0]["deliveredAt"] == "05:42"
    assert recent[0]["orderIds"] == ["ORD2001", "ORD2002"] and recent[0]["receiptConfirmedAt"] == "07:30"

    # Nothing delivered yet means nothing to confirm.
    assert client.post(f"{STORE}/receipts", headers=auth("dispatcher"), json={"date": DAY, "lines": [{"orderId": "ORD2001", "received": 1}]}).status_code == 403
    # History lists finished runs; this one is still on the road, and the phone shows today's row from its own cache.
    assert get(client, auth, "driver", f"{DRIVER}/history") == []


def test_mark_all_read_clears_the_bell(client, auth, reseed):
    place(client, auth)
    advance(client, auth, "2026-09-28T16:01:00+05:30")
    assert get(client, auth, "store", f"{STORE}/updates")["unread"] >= 2
    post(client, auth, "store", f"{STORE}/updates/read-all", status=204)
    assert get(client, auth, "store", f"{STORE}/updates")["unread"] == 0


def test_a_store_sees_only_its_own_outlet(client, auth, reseed):
    place(client, auth)
    # The dispatcher account has no outlet, so the store's reads refuse it before anything is read.
    assert client.get(f"{STORE}/deliveries", headers=auth("dispatcher")).status_code == 403
    assert client.get(f"{STORE}/deliveries/2026-09-30", headers=auth("store")).json() == []
