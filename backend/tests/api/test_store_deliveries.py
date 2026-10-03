"""The store's delivery days over HTTP: S2.1 to S2.8 walked on the scenario clock (PRD v3 §2, §3 S2, §19).

Nothing here is inserted by hand. Anusha places her orders through the store's own endpoint, Kumari releases
the plan, Ruwan confirms the load and Nimal starts the route and syncs the delivery through ``/sync``, and the
dispatcher defers the stop and settles the review through its own routes. What the store then reads is the
subject of every assertion.

The clock starts Mon 28 Sep 2026 15:30 Asia/Colombo and the hero delivery day is Tue 29 Sep, so these tests
walk time forward in a deliberate order. Every test that moves the clock takes ``reseed``, which puts the seed
and the clock back afterwards, so the 16:00 cutoff job never leaks into the next test.
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi.testclient import TestClient

DELIVERIES = "/api/v1/store/deliveries"
HISTORY = "/api/v1/store/history"
DAY = "2026-09-29"
HERO = ("ORD2001", "ORD2002")

#: The hero order sizes for OUT084 (PRD §4c H1).
CHILLED = {"kind": "chilled", "units": 12, "estimatedKg": 70.0, "estimatedM3": 0.7}
AMBIENT = {"kind": "ambient", "units": 8, "estimatedKg": 45.0, "estimatedM3": 0.6}

#: "05:42": what the store's screens print as a clock time.
HHMM = re.compile(r"^\d{2}:\d{2}$")

JOURNEY_STEPS = ("Ordered", "Confirmed", "Planned", "Loaded", "Departed", "Delivered", "Receipt confirmed")


# --------------------------------------------------------------------------- driving the scenario


def advance(client: TestClient, auth: Any, to: str) -> None:
    """Move the scenario clock. Advancing is dispatcher only, so it borrows that token."""
    res = client.post("/api/v1/demo/advance", json={"to": to}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text


def place_hero(client: TestClient, auth: Any) -> list[dict[str, Any]]:
    """H1 at 15:40: Anusha places chilled 12 and dry 8 for Tue 29 Sep, through S1."""
    res = client.post(
        "/api/v1/store/orders",
        json={"orders": [{"outletId": "OUT084", "deliveryDate": DAY, "line": dict(line)} for line in (CHILLED, AMBIENT)]},
        headers=auth("store"),
    )
    assert res.status_code == 201, res.text
    body: list[dict[str, Any]] = res.json()
    return body


def day(client: TestClient, auth: Any, date: str = DAY) -> dict[str, Any]:
    """The one delivery day for ``date``. ``getDeliveryDay`` answers with a list of length 0 or 1."""
    res = client.get(f"{DELIVERIES}/{date}", headers=auth("store"))
    assert res.status_code == 200, res.text
    days: list[dict[str, Any]] = res.json()
    assert len(days) == 1, days
    return days[0]


def step(delivery: dict[str, Any], name: str) -> dict[str, Any]:
    found = next(s for s in delivery["journey"] if s["step"] == name)
    return dict(found)


def current_step(delivery: dict[str, Any]) -> str | None:
    return next((s["step"] for s in delivery["journey"] if s["state"] == "current"), None)


def record(type_: str, payload: dict[str, Any], hhmm: str, version: int | None, *, actor: str = "Nimal") -> dict[str, Any]:
    return {
        "clientId": str(uuid.uuid4()),
        "type": type_,
        "payload": payload,
        "deviceTime": f"2026-09-29T{hhmm}:00+05:30",
        "planVersionOnDevice": version,
        "actor": actor,
    }


def sync(client: TestClient, auth: Any, records: list[dict[str, Any]], role: str = "driver", device: str = "phone-veh039") -> list[str]:
    res = client.post("/api/v1/sync", json={"deviceId": device, "records": records}, headers=auth(role))
    assert res.status_code == 200, res.text
    return [r["result"] for r in res.json()["results"]]


def released_number(client: TestClient, auth: Any) -> int:
    number: int = client.get("/api/v1/dispatcher/plan?depot=kandy", headers=auth("dispatcher")).json()["version"]["number"]
    return number


def to_planned(client: TestClient, auth: Any) -> int:
    """H1 to H4: the orders are placed, the cutoff closes them and Kumari releases the plan at 23:40."""
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)
    advance(client, auth, "2026-09-28T23:40:00+05:30")
    res = client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    return released_number(client, auth)


def to_loaded(client: TestClient, auth: Any) -> int:
    """H6: Ruwan confirms VEH039 loaded at the Kandy gate."""
    version = to_planned(client, auth)
    advance(client, auth, "2026-09-29T04:50:00+05:30")
    loaded = sync(
        client,
        auth,
        [record("loader.confirmLoaded", {"vehicleId": "VEH039", "trip": 1, "personId": "Ruwan", "personName": "Ruwan"}, "04:50", None, actor="Ruwan")],
        role="loader",
        device="tablet-kandy",
    )
    assert loaded == ["accepted"]
    return version


def to_departed(client: TestClient, auth: Any) -> int:
    """H8 and H9: Nimal acknowledges, starts the route at 05:10, and the phone is last heard at 05:17."""
    version = to_loaded(client, auth)
    advance(client, auth, "2026-09-29T05:17:00+05:30")
    started = sync(
        client,
        auth,
        [
            record("driver.ack", {"date": DAY, "version": version}, "04:55", version),
            record("driver.startRoute", {"date": DAY, "at": "05:10"}, "05:10", version),
        ],
    )
    assert started == ["accepted", "accepted"]
    return version


def to_deferred(client: TestClient, auth: Any) -> int:
    """H11 at 05:21: Kumari defers OUT084's stop at the store's request, creating the next plan version."""
    version = to_departed(client, auth)
    advance(client, auth, "2026-09-29T05:21:00+05:30")
    res = client.post(
        "/api/v1/dispatcher/stops/defer",
        json={"orderIds": list(HERO), "kind": "store_request", "reason": "Receiving staff unavailable today"},
        headers=auth("dispatcher"),
    )
    assert res.status_code == 200, res.text
    return version


def hero_batch(version: int, units: dict[str, int] | None = None) -> list[dict[str, Any]]:
    """H12 to H14: what the phone recorded offline, on the plan it still held."""
    counts = units or {"ORD2001": 12, "ORD2002": 8}
    return [
        record("driver.arrival", {"date": DAY, "outletId": "OUT084", "at": "05:26"}, "05:26", version),
        *[
            record(
                "driver.outcome",
                {
                    "date": DAY,
                    "outletId": "OUT084",
                    "orderId": order_id,
                    "outcome": "Delivered",
                    "unitsDelivered": counts[order_id],
                    "receiverName": "S. Fernando",
                    **({"photoBlobId": str(uuid.uuid4())} if order_id == "ORD2001" else {}),
                    "at": "05:42",
                },
                "05:42",
                version,
            )
            for order_id in HERO
        ],
    ]


def to_review(client: TestClient, auth: Any, units: dict[str, int] | None = None) -> int:
    """H15 at 06:40: coverage returns, the delivery syncs and disagrees with the deferral."""
    version = to_deferred(client, auth)
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    results = sync(client, auth, hero_batch(version, units))
    assert results == ["accepted", "conflict", "conflict"], results
    return conflict_id()


def conflict_id() -> int:
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.field import Conflict

    with SessionLocal() as db:
        row = db.scalars(select(Conflict).order_by(Conflict.id.desc()).limit(1)).first()
        assert row is not None
        return int(row.id)


def to_delivered(client: TestClient, auth: Any) -> None:
    """H16 at 06:44: the dispatcher keeps the delivery and the deferral is withdrawn."""
    cid = to_review(client, auth)
    advance(client, auth, "2026-09-29T06:44:00+05:30")
    res = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_delivery"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text


# --------------------------------------------------------------------------- S2.1: ordered and confirmed


def test_an_ordered_day_has_no_arrival_and_waits_for_the_plan(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)
    delivery = day(client, auth)

    assert delivery["outletId"] == "OUT084"  # from the token, never asked for
    assert delivery["dock"] == "Rear dock"  # the human label, not "rear_dock"
    assert delivery["window"] == {"start": "05:30", "end": "08:00"}
    assert delivery["status"] == "ordered"
    assert delivery["planPending"] is True
    assert delivery["arrival"] is None
    assert delivery["receiversCue"] is False
    assert delivery["vehicle"] is None
    assert [o["id"] for o in delivery["orders"]] == list(HERO)  # chilled first
    assert [o["kind"] for o in delivery["orders"]] == ["chilled", "ambient"]
    assert step(delivery, "Ordered") == {"step": "Ordered", "actor": "You", "at": "15:40", "state": "done"}
    assert current_step(delivery) is None  # the amber marker starts at Planned (A45)


def test_the_cutoff_confirms_the_day_and_stamps_the_journey(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)
    advance(client, auth, "2026-09-28T16:01:00+05:30")
    delivery = day(client, auth)

    assert delivery["status"] == "confirmed"
    assert delivery["planPending"] is True
    assert step(delivery, "Confirmed") == {"step": "Confirmed", "actor": "Dispatch", "at": "16:00", "state": "done"}
    assert current_step(delivery) is None  # Ordered and Confirmed never carry the marker (A45)


def test_the_seven_journey_steps_are_always_listed_with_their_actors(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)
    delivery = day(client, auth)

    assert [s["step"] for s in delivery["journey"]] == list(JOURNEY_STEPS)
    assert [s["actor"] for s in delivery["journey"]] == ["You", "Dispatch", "Dispatch", "Loader", "Driver", "Driver", "You"]
    assert {s["state"] for s in delivery["journey"]} <= {"done", "current", "pending"}


# --------------------------------------------------------------------------- S2.2: the plan is out


def test_the_released_plan_gives_an_arrival_range_and_the_receivers_cue(client: TestClient, auth: Any, reseed: None) -> None:
    to_planned(client, auth)
    delivery = day(client, auth)

    assert delivery["status"] == "planned"
    assert delivery["planPending"] is False
    assert delivery["receiversCue"] is True
    assert delivery["vehicle"] == "VEH039"
    assert current_step(delivery) == "Planned"

    # The rule (PRD §4a): the later of predicted arrival and the window opening, and the earlier arrival is
    # named only when the truck would have to wait. The window opens 05:30, so that is what the store is told.
    arrival = delivery["arrival"]
    assert arrival["from"] == "05:30"
    assert HHMM.match(arrival["mayArriveAt"]) and arrival["mayArriveAt"] < "05:30"


def test_the_plan_step_keeps_the_time_the_first_plan_went_out(client: TestClient, auth: Any, reseed: None) -> None:
    # A later version re-releases the day (the 05:21 deferral does). The store was told at 23:40 and that stands.
    to_deferred(client, auth)
    assert step(day(client, auth), "Planned")["at"] == "23:40"


# --------------------------------------------------------------------------- S2.3 and S2.4: loaded, on the way


def test_a_confirmed_load_names_the_dock_and_the_time(client: TestClient, auth: Any, reseed: None) -> None:
    to_loaded(client, auth)
    delivery = day(client, auth)

    assert delivery["status"] == "loaded"
    assert delivery["loaded"] == {"place": "Kandy dock", "at": "04:50"}
    assert delivery["onTheWay"] is None
    assert delivery["receiversCue"] is True
    assert current_step(delivery) == "Loaded"
    assert step(delivery, "Loaded")["at"] == "04:50"


def test_a_departed_run_replaces_the_load_line_with_the_arrival(client: TestClient, auth: Any, reseed: None) -> None:
    to_departed(client, auth)
    delivery = day(client, auth)

    assert delivery["status"] == "departed"
    assert delivery["loaded"] is None  # the truck has left; S2.4 shows where it is instead
    assert delivery["onTheWay"]["unloadingFrom"] == "05:30"
    assert HHMM.match(delivery["onTheWay"]["arrivesAbout"])
    assert current_step(delivery) == "Departed"
    assert step(delivery, "Departed")["at"] == "05:10"


def test_a_driver_out_of_coverage_leaves_the_last_update_behind(client: TestClient, auth: Any, reseed: None) -> None:
    to_departed(client, auth)
    assert day(client, auth)["lastUpdate"] is None  # 05:17, still being heard from

    # The rule is waypoint_rules.schedule.is_offline: silent for more than three minutes on a run.
    advance(client, auth, "2026-09-29T05:21:00+05:30")
    assert day(client, auth)["lastUpdate"] == "05:17"


# --------------------------------------------------------------------------- S2.6: deferred at the store's request


def test_a_store_request_deferral_is_announced_with_its_next_run(client: TestClient, auth: Any, reseed: None) -> None:
    to_deferred(client, auth)
    delivery = day(client, auth)

    assert delivery["status"] == "deferred"
    assert delivery["arrival"] is None  # nothing is arriving today
    assert delivery["receiversCue"] is False
    deferral = delivery["deferral"]
    assert deferral["type"] == "store_request"
    assert deferral["headline"] == "Deferred at your request"
    assert deferral["subline"] == "Next run Wed 30 Sep."
    assert deferral["reason"] == "Receiving staff unavailable today"
    assert deferral["decidedBy"] == "Kumari"
    assert deferral["decidedAt"] == "05:21"
    assert deferral["nextRunLabel"] == "New ETA"  # the store's own ETA moved
    assert deferral["nextRun"] == "Wed 30 Sep · from 05:30"
    assert deferral["nextRunShort"] == "Wed"
    assert deferral["acknowledged"] is False
    assert isinstance(deferral["id"], int)  # the client acknowledges by this id


def test_a_deferral_does_not_undo_the_morning(client: TestClient, auth: Any, reseed: None) -> None:
    # The stop leaves the plan, but the truck was still loaded at 04:50 and still left at 05:10 (S2.6).
    to_deferred(client, auth)
    delivery = day(client, auth)

    assert step(delivery, "Loaded")["at"] == "04:50"
    assert step(delivery, "Departed")["at"] == "05:10"
    assert current_step(delivery) == "Departed"


def test_got_it_on_a_deferral_shows_as_seen_to_dispatch(client: TestClient, auth: Any, reseed: None) -> None:
    to_deferred(client, auth)
    deferral_id = day(client, auth)["deferral"]["id"]

    res = client.post(f"/api/v1/store/deferrals/{deferral_id}/seen", headers=auth("store"))
    assert res.status_code == 204, res.text
    assert res.content == b""
    assert day(client, auth)["deferral"]["acknowledged"] is True

    # The real cross-role effect: the dispatcher's D4 sent / seen column reads this stamp.
    view = client.get("/api/v1/dispatcher/deferrals?depot=kandy", headers=auth("dispatcher"))
    assert view.status_code == 200, view.text
    cards = view.json()["storeRequest"]
    told = [card["storeTold"] for card in cards if card["orderId"] in HERO]
    assert told, cards
    assert all(t["state"] == "seen" and t["at"] == "05:21" for t in told), told


def test_acknowledging_twice_changes_nothing(client: TestClient, auth: Any, reseed: None) -> None:
    to_deferred(client, auth)
    deferral_id = day(client, auth)["deferral"]["id"]
    for _ in range(2):
        assert client.post(f"/api/v1/store/deferrals/{deferral_id}/seen", headers=auth("store")).status_code == 204
    assert day(client, auth)["deferral"]["acknowledged"] is True


def test_acknowledging_an_unknown_deferral_is_a_404(client: TestClient, auth: Any) -> None:
    res = client.post("/api/v1/store/deferrals/999999/seen", headers=auth("store"))
    assert res.status_code == 404, res.text
    assert res.json()["code"] == "not_found"


# --------------------------------------------------------------------------- S2.7 and S2.8: under review, then kept


def test_a_synced_delivery_that_disagrees_reads_as_under_review(client: TestClient, auth: Any, reseed: None) -> None:
    to_review(client, auth)
    delivery = day(client, auth)

    # The wire keeps `conflict`; the store's own vocabulary prints "Under review" (PRD §4b).
    assert delivery["status"] == "conflict"
    assert [o["status"] for o in delivery["orders"]] == ["conflict", "conflict"]
    assert delivery["receivedAnswered"] is False
    # The goods are at the store, and the proof says so even while the two records are being settled.
    assert delivery["proof"] == {
        "receivedBy": "S. Fernando",
        "at": "05:42",
        "driver": "Nimal",
        "vehicle": "VEH039",
        "units": [12, 8],
    }
    assert step(delivery, "Delivered")["at"] == "05:42"
    assert current_step(delivery) == "Receipt confirmed"  # the step that waits on the store (A45)


def test_the_review_question_appears_only_once_dispatch_has_asked(client: TestClient, auth: Any, reseed: None) -> None:
    cid = to_review(client, auth)
    assert day(client, auth)["review"] is None  # A51: no ask, no question

    res = client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    review = day(client, auth)["review"]
    # conflictId is part of the contract: the answer route is keyed by the review.
    assert review["conflictId"] == str(cid)
    assert review["receivedBy"] == "S. Fernando"
    assert review["deliveredAt"] == "05:42"
    assert HHMM.match(review["askedAt"])


def test_answering_yes_settles_the_delivery_for_the_store_at_once(client: TestClient, auth: Any, reseed: None) -> None:
    cid = to_review(client, auth)
    client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher"))

    res = client.post(f"/api/v1/store/reviews/{cid}/answer", json={"answer": "received"}, headers=auth("store"))
    assert res.status_code == 204, res.text

    # A47: the store reads Delivered without waiting for 06:44; the review stays Dispatch's to close.
    delivery = day(client, auth)
    assert delivery["status"] == "delivered"
    assert [o["status"] for o in delivery["orders"]] == ["delivered", "delivered"]
    assert delivery["receivedAnswered"] is True
    assert delivery["review"] is None

    view = client.get(f"/api/v1/dispatcher/conflicts/{cid}", headers=auth("dispatcher"))
    assert view.status_code == 200, view.text
    assert view.json()["state"] != "resolved"  # still open for Kumari


def test_answering_keeps_the_recommendation_at_keep_delivery(client: TestClient, auth: Any, reseed: None) -> None:
    cid = to_review(client, auth)
    client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher"))
    before = client.get(f"/api/v1/dispatcher/conflicts/{cid}", headers=auth("dispatcher")).json()["recommendation"]

    client.post(f"/api/v1/store/reviews/{cid}/answer", json={"answer": "received"}, headers=auth("store"))
    after = client.get(f"/api/v1/dispatcher/conflicts/{cid}", headers=auth("dispatcher")).json()["recommendation"]
    # Everything was received, so the recommendation and its reasons stand. Only the "waiting for the store"
    # note clears, which is the one thing the answer is allowed to change.
    assert after["choice"] == before["choice"] == "keep_delivery"
    assert after["reasons"] == before["reasons"]
    assert before["pausedNote"] and after["pausedNote"] is None


def test_answering_a_review_nobody_asked_about_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    cid = to_review(client, auth)
    res = client.post(f"/api/v1/store/reviews/{cid}/answer", json={"answer": "received"}, headers=auth("store"))
    assert res.status_code == 409, res.text
    assert res.json()["code"] == "not_awaiting_store"


def test_answering_a_settled_review_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    cid = to_review(client, auth)
    client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher"))
    advance(client, auth, "2026-09-29T06:44:00+05:30")
    client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_delivery"}, headers=auth("dispatcher"))

    res = client.post(f"/api/v1/store/reviews/{cid}/answer", json={"answer": "received"}, headers=auth("store"))
    assert res.status_code == 409, res.text


def test_answering_an_unknown_review_is_a_404(client: TestClient, auth: Any) -> None:
    res = client.post("/api/v1/store/reviews/999999/answer", json={"answer": "received"}, headers=auth("store"))
    assert res.status_code == 404, res.text


def test_a_kept_delivery_withdraws_the_deferral_and_tags_the_day(client: TestClient, auth: Any, reseed: None) -> None:
    to_delivered(client, auth)
    delivery = day(client, auth)

    assert delivery["status"] == "delivered"
    assert delivery["deferral"] is None  # withdrawn: nothing is still deferred
    assert delivery["tags"] == ["Deferral withdrawn"]
    assert delivery["withdrawnNote"] == "Wed 30 Sep re-run removed."
    assert current_step(delivery) == "Receipt confirmed"


# --------------------------------------------------------------------------- listing and scope


def test_listing_answers_from_the_day_the_store_is_working_on(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)

    res = client.get(DELIVERIES, headers=auth("store"))
    assert res.status_code == 200, res.text
    assert [d["date"] for d in res.json()] == [DAY]


def test_listing_takes_a_range(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)

    assert [d["date"] for d in client.get(f"{DELIVERIES}?from=2026-09-29&to=2026-09-29", headers=auth("store")).json()] == [DAY]
    assert client.get(f"{DELIVERIES}?from=2026-09-30", headers=auth("store")).json() == []


def test_a_day_the_outlet_never_ordered_for_is_an_empty_list(client: TestClient, auth: Any) -> None:
    res = client.get(f"{DELIVERIES}/2026-10-15", headers=auth("store"))
    assert res.status_code == 200, res.text
    assert res.json() == []


def test_the_deliveries_routes_need_a_store_account(client: TestClient, auth: Any) -> None:
    for url in (DELIVERIES, f"{DELIVERIES}/{DAY}", HISTORY, "/api/v1/store/issues", "/api/v1/store/updates"):
        assert client.get(url).status_code == 401, url
        for role in ("dispatcher", "loader", "driver"):
            res = client.get(url, headers=auth(role))
            assert res.status_code == 403, (url, role)
            assert res.json()["code"] == "forbidden"


def test_another_outlets_day_is_never_answered(client: TestClient, auth: Any) -> None:
    # ORD1002 is OUT009's order for the same day; the token is bound to OUT084, so the day holds only its own.
    res = client.get(f"{DELIVERIES}/{DAY}", headers=auth("store"))
    assert res.status_code == 200, res.text
    for delivery in res.json():
        assert delivery["outletId"] == "OUT084"
        assert all(not o["id"].startswith("ORD1") for o in delivery["orders"]), delivery["orders"]


def test_another_outlets_deferral_cannot_be_acknowledged(client: TestClient, auth: Any, reseed: None) -> None:
    # The 03:00 vehicle swap defers ORD1002 for OUT009 (PRD §2b X3).
    advance(client, auth, "2026-09-28T23:40:00+05:30")
    client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher"))
    advance(client, auth, "2026-09-29T03:00:00+05:30")
    res = client.post(
        "/api/v1/dispatcher/stops/defer",
        json={"orderIds": ["ORD1002"], "kind": "policy", "reason": "Replacement van is smaller"},
        headers=auth("dispatcher"),
    )
    assert res.status_code == 200, res.text

    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.orders import Deferral

    with SessionLocal() as db:
        other = db.scalars(select(Deferral).where(Deferral.order_id == "ORD1002").order_by(Deferral.id.desc()).limit(1)).first()
        assert other is not None
        deferral_id = int(other.id)

    denied = client.post(f"/api/v1/store/deferrals/{deferral_id}/seen", headers=auth("store"))
    assert denied.status_code == 403, denied.text
    assert denied.json()["code"] == "forbidden"


# --------------------------------------------------------------------------- the history list (S2.10, S4.2)


def test_the_history_lists_the_current_day_once_it_is_finished(client: TestClient, auth: Any, reseed: None) -> None:
    to_delivered(client, auth)
    rows = client.get(f"{HISTORY}?limit=10", headers=auth("store")).json()

    today = next(r for r in rows if r["date"] == DAY)
    assert today["status"] == "delivered"
    assert today["orderCount"] == 2
    assert today["orderIds"] == list(HERO)
    assert today["deliveredAt"] == "05:42"
    assert today["deferralWithdrawn"] is True
    assert today["current"] is True  # only the current day opens a delivery (PRD §3 S4)


def test_a_day_still_in_flight_is_not_history_yet(client: TestClient, auth: Any, reseed: None) -> None:
    to_review(client, auth)
    assert [r["date"] for r in client.get(HISTORY, headers=auth("store")).json() if r["date"] == DAY] == []


def test_the_history_never_lists_a_sunday(client: TestClient, auth: Any, reseed: None) -> None:
    to_delivered(client, auth)
    import datetime as dt

    for row in client.get(f"{HISTORY}?limit=60", headers=auth("store")).json():
        assert dt.date.fromisoformat(row["date"]).weekday() != 6, row


def test_the_history_takes_a_limit_and_a_cursor(client: TestClient, auth: Any, reseed: None) -> None:
    to_delivered(client, auth)
    assert len(client.get(f"{HISTORY}?limit=1", headers=auth("store")).json()) <= 1
    assert [r["date"] for r in client.get(f"{HISTORY}?before={DAY}", headers=auth("store")).json() if r["date"] >= DAY] == []


# --------------------------------------------------------------------------- the wording, with no database


def _facts(**over: Any) -> Any:
    """A delivery day built by hand. ``store_views`` takes no ``Session``, so its wording tests need none."""
    from datetime import date, datetime

    from app.services.store_model import DeliveryDay, OrderFacts, OutletFacts
    from waypoint_rules.vocab import OrderStatus, Temp

    service_date = date(2026, 9, 29)
    outlet = OutletFacts(
        id="OUT009",
        name="Waypoint Fresh Peradeniya",
        district="Kandy",
        dock="Rear dock",
        window_open=datetime(2026, 9, 29, 4, 0),
        window_close=datetime(2026, 9, 29, 7, 45),
    )
    day = DeliveryDay(
        outlet=outlet,
        service_date=service_date,
        now=datetime(2026, 9, 29, 3, 1),
        orders=[OrderFacts(id="ORD1002", temp=Temp.CHILLED, units=35, status=OrderStatus.DEFERRED, received_at=datetime(2026, 9, 28, 14, 2))],
        next_run=date(2026, 9, 30),
        cutoff_at=datetime(2026, 9, 28, 16, 0),
    )
    for key, value in over.items():
        setattr(day, key, value)
    return day


def _deferral(kind: str, **over: Any) -> Any:
    from datetime import date, datetime

    from app.services.store_model import DeferralFacts
    from waypoint_rules.vocab import DeferralType

    base = {
        "id": 7,
        "type": DeferralType(kind),
        "reason": "Vehicle unavailable: replacement van is smaller",
        "decided_by": "Kumari",
        "decided_at": datetime(2026, 9, 29, 3, 0),
        "next_run_date": date(2026, 9, 30),
        "seen_at": None,
        "withdrawn_at": None,
        "withdrawn_reason": None,
    }
    return DeferralFacts(**{**base, **over})


def test_a_policy_deferral_says_which_day_the_order_moved_to() -> None:
    from app.services import store_views

    out = store_views.deferral_out(_facts(deferral=_deferral("policy")))
    assert out is not None
    assert out.headline == "Your chilled order moved to Wed 30 Sep"
    assert out.subline is None
    assert out.explanation is not None and out.explanation.startswith("Vehicle unavailable")
    assert "Wed 30 Sep" in out.explanation
    assert out.next_run_label == "Next run"  # the store did not ask, so this is not its own ETA
    assert out.next_run == "Wed 30 Sep"
    assert out.next_run_short == "Wed"
    assert out.decided_by == "Kumari"
    assert out.decided_at == "03:00"


def test_a_capacity_deferral_explains_that_no_vehicle_can_carry_it() -> None:
    from app.services import store_views

    out = store_views.deferral_out(_facts(deferral=_deferral("capacity")))
    assert out is not None
    assert out.next_run_label == "Next run"
    assert out.explanation is not None
    assert "no vehicle" in out.explanation.lower()


def test_a_withdrawn_deferral_is_no_longer_announced() -> None:
    from datetime import datetime

    from app.services import store_views

    day = _facts(deferral=_deferral("store_request", withdrawn_at=datetime(2026, 9, 29, 6, 44)))
    assert store_views.deferral_out(day) is None


def test_the_deferral_wording_never_uses_an_em_dash_or_a_placeholder() -> None:
    from app.services import store_views

    for kind in ("capacity", "policy", "store_request"):
        out = store_views.deferral_out(_facts(deferral=_deferral(kind)))
        assert out is not None
        text = " ".join(part for part in (out.headline, out.subline, out.explanation, out.next_run) if part)
        assert "—" not in text, text
        assert "[" not in text and "Mock" not in text, text
        assert "Conflict" not in text, text


def test_the_arrival_is_the_window_when_the_truck_would_have_to_wait() -> None:
    from datetime import datetime

    from app.services import store_views

    # The window opens 04:00; a truck expected 03:40 waits, so the store hears 04:00 with 03:40 behind it.
    early = store_views.arrival(_facts(released=True, deferral=None, predicted_arrival=datetime(2026, 9, 29, 3, 40)))
    assert early is not None
    assert (early.from_, early.may_arrive_at) == ("04:00", "03:40")

    late = store_views.arrival(_facts(released=True, deferral=None, predicted_arrival=datetime(2026, 9, 29, 6, 6)))
    assert late is not None
    assert (late.from_, late.may_arrive_at) == ("06:06", None)


def test_a_day_with_no_plan_has_no_arrival() -> None:
    from app.services import store_views

    assert store_views.arrival(_facts(released=False, deferral=None)) is None


def test_a_mixed_day_reads_as_the_earliest_stage_still_in_flight() -> None:
    from datetime import datetime

    from app.services import store_views
    from app.services.store_model import OrderFacts
    from waypoint_rules.vocab import OrderStatus, Temp

    received = datetime(2026, 9, 28, 15, 40)
    day = _facts(
        orders=[
            OrderFacts(id="A", temp=Temp.CHILLED, units=12, status=OrderStatus.DEFERRED, received_at=received),
            OrderFacts(id="B", temp=Temp.AMBIENT, units=8, status=OrderStatus.PLANNED, received_at=received),
        ]
    )
    assert store_views.day_status(day) is OrderStatus.PLANNED

    # Finished orders are the other way round: the worst one speaks.
    for mix, expected in (
        ((OrderStatus.DELIVERED, OrderStatus.PARTIAL), OrderStatus.PARTIAL),
        ((OrderStatus.PARTIAL, OrderStatus.ISSUE), OrderStatus.ISSUE),
        ((OrderStatus.DELIVERED, OrderStatus.DELIVERED), OrderStatus.DELIVERED),
        ((OrderStatus.DEFERRED, OrderStatus.DEFERRED), OrderStatus.DEFERRED),
    ):
        day = _facts(
            orders=[
                OrderFacts(id="A", temp=Temp.CHILLED, units=12, status=mix[0], received_at=received),
                OrderFacts(id="B", temp=Temp.AMBIENT, units=8, status=mix[1], received_at=received),
            ]
        )
        assert store_views.day_status(day) is expected, mix
