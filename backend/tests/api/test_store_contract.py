"""The parts of ``StoreApi`` the hero walkthrough does not pin down: the wire contract and the rules behind the screens.

``test_store_field.py`` plays the hero day end to end. This file covers what that run passes through once or not at
all: the shape of a timestamp, the A50 shortfall rule, the A51 review gate, the journey when the plan has moved on,
and the read routes (history, issues, the feed, the delivery range) at their edges. These need the test database.
"""

from __future__ import annotations

import re

from .test_dispatcher_live import advance, defer_hero
from .test_store_field import DAY, LOADER, STORE, day, get, on_the_road, place, post, released
from .test_sync import hero_batch, results, sync

#: Naive local ISO, no offset and no sub-second part: "2026-09-28T15:40:00" (PRD §19 Time).
NAIVE_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$")


# ---- §19: times on the wire -------------------------------------------------------------------------------------


def test_order_timestamps_are_naive_local_with_no_offset(client, auth, reseed):
    """The store renders these with ``clockTime()``, which reads ``getHours()``. An offset would make the same
    reply say 15:40 in Colombo and 11:10 in London, so §19 fixes them as the scenario's own wall clock."""
    orders = place(client, auth)
    assert NAIVE_ISO.match(orders[0]["receivedAt"]), orders[0]["receivedAt"]
    assert orders[0]["receivedAt"] == "2026-09-28T15:40:00"
    assert all(o["updatedAt"] is None for o in orders)

    edited = client.patch(f"{STORE}/orders/ORD2001", headers=auth("store"), json={"units": 14, "estimatedKg": 82, "estimatedM3": 0.8})
    assert edited.status_code == 200, edited.text
    assert NAIVE_ISO.match(edited.json()["updatedAt"]), edited.json()["updatedAt"]

    # Every order the form hands back carries the same shape.
    for order in get(client, auth, "store", f"{STORE}/order-form")["orders"]:
        assert NAIVE_ISO.match(order["receivedAt"]), order["receivedAt"]
        assert "+" not in order["receivedAt"] and not order["receivedAt"].endswith("Z")


# ---- A50: a short receipt has to say why ------------------------------------------------------------------------


def delivered_day(client, auth) -> None:
    """The hero day as far as a delivery the store can confirm: deferred, delivered anyway, then kept (H11 to H16)."""
    cid = under_review(client, auth)
    advance(client, auth, "2026-09-29T06:44:00+05:30")
    res = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_delivery"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    advance(client, auth, "2026-09-29T07:30:00+05:30")


def test_a_short_receipt_is_refused_without_a_reason_the_sheet_offers(client, auth, reseed):
    """A50. The rule is ``waypoint_rules.receipts``, so the API refuses what the sheet would not let a store send."""
    delivered_day(client, auth)
    short = [{"orderId": "ORD2001", "received": 10}, {"orderId": "ORD2002", "received": 8}]

    missing = client.post(f"{STORE}/receipts", headers=auth("store"), json={"date": DAY, "lines": short})
    assert missing.status_code == 422 and missing.json()["code"] == "reason_required"
    assert set(missing.json()) == {"code", "message", "details"}
    assert missing.json()["details"] == {"rule": "A50", "reasons": ["Missing", "Damaged", "Wrong item", "Other"]}

    for bad in ("", "   ", "One carton was crushed", "missing"):
        res = client.post(f"{STORE}/receipts", headers=auth("store"), json={"date": DAY, "lines": short, "reason": bad})
        assert res.status_code == 422, f"{bad!r} was accepted"
        assert res.json()["code"] in {"reason_required", "unknown_reason"}

    # Nothing was written while it was being refused.
    assert day(client, auth)["receiptConfirmedAt"] is None

    ok = post(client, auth, "store", f"{STORE}/receipts", {"date": DAY, "lines": short, "reason": "Missing"}, status=201)
    assert ok["status"] == "partial" and ok["shortfallReason"] == "Missing"
    assert [(o["id"], o["received"]) for o in ok["orders"]] == [("ORD2001", 10), ("ORD2002", None)]


def test_a_full_receipt_needs_no_reason_and_keeps_none(client, auth, reseed):
    delivered_day(client, auth)
    full = post(
        client, auth, "store", f"{STORE}/receipts",
        {"date": DAY, "lines": [{"orderId": "ORD2001", "received": 12}, {"orderId": "ORD2002", "received": 8}]}, status=201,
    )
    assert full["status"] == "delivered" and full["shortfallReason"] is None
    assert "Receipt confirmed" in full["tags"] and all(o["received"] is None for o in full["orders"])


# ---- A51: the question waits for Dispatch -----------------------------------------------------------------------


def under_review(client, auth) -> int:
    place(client, auth)
    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T05:21:00+05:30")
    assert defer_hero(client, auth).status_code == 200
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    answers = results(sync(client, auth, hero_batch(version)))
    assert answers[1]["result"] == "conflict"
    return int(answers[1]["conflictId"])


def test_the_review_explains_itself_but_does_not_ask_until_dispatch_does(client, auth, reseed):
    """A51. S2.7 shows "Why you're seeing this" from the moment the records disagree; the question
    "Did you receive this delivery?" belongs to D7.2 "Review with store first"."""
    cid = under_review(client, auth)

    d = day(client, auth)
    assert d["status"] == "conflict" and d["review"]["asked"] is False
    # The explanation quotes the store's own call to hold the delivery (05:21), not the sync at 06:40.
    assert d["review"]["askedAt"] == "05:21" and d["review"]["deliveredAt"] == "05:42"
    assert d["review"]["receivedBy"] == "S. Fernando" and d["review"]["conflictId"] == str(cid)
    assert d["receivedAnswered"] is False

    asked = client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher"))
    assert asked.status_code == 200, asked.text
    after = day(client, auth)["review"]
    assert after["asked"] is True
    assert (after["askedAt"], after["deliveredAt"]) == ("05:21", "05:42")  # asking does not rewrite the story

    # Asking twice changes nothing, and the answer closes the block for the store either way (S2.8).
    assert client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher")).status_code == 200
    post(client, auth, "store", f"{STORE}/reviews/{cid}/answer", {"answer": "received"}, status=204)
    settled = day(client, auth)
    assert settled["review"] is None and settled["receivedAnswered"] is True and settled["status"] == "delivered"


def test_a_store_can_answer_only_its_own_review_and_only_with_received(client, auth, reseed):
    cid = under_review(client, auth)
    assert client.post(f"{STORE}/reviews/{cid}/answer", headers=auth("store"), json={"answer": "no"}).status_code == 422
    assert client.post(f"{STORE}/reviews/99999/answer", headers=auth("store"), json={"answer": "received"}).status_code == 404
    assert client.post(f"{STORE}/reviews/{cid}/answer", headers=auth("dispatcher"), json={"answer": "received"}).status_code == 403


# ---- the journey and the proof when the plan has moved on -------------------------------------------------------


def test_a_deferral_does_not_undo_the_morning_that_already_happened(client, auth, reseed):
    """The stop is deferred at 05:21, after the dock loaded it at 04:50 and the truck left at 05:10. The deferral
    takes the order off the plan; it does not take those two records off the journey."""
    place(client, auth)
    on_the_road(client, auth)
    advance(client, auth, "2026-09-29T05:21:00+05:30")
    assert defer_hero(client, auth).status_code == 200

    d = day(client, auth)
    assert d["status"] == "deferred"
    steps = {s["step"]: s for s in d["journey"]}
    assert steps["Loaded"]["at"] == "04:50" and steps["Loaded"]["state"] == "done"
    assert steps["Departed"]["at"] == "05:10"
    assert steps["Delivered"]["at"] is None and steps["Delivered"]["state"] == "pending"


def test_departed_keeps_its_time_after_the_deferral_replans_the_trip(client, auth, reseed):
    """The deferral releases a new plan version, so the order's placement names a trip nobody drove. The journey
    still has to show the departure that happened, and the proof still has to name the driver who signed."""
    under_review(client, auth)

    d = day(client, auth)
    steps = {s["step"]: s for s in d["journey"]}
    assert steps["Loaded"]["at"] == "04:50" and steps["Loaded"]["state"] == "done"
    assert steps["Departed"]["at"] == "05:10", "the run that drove is found by the vehicle on the driver's record"
    assert steps["Departed"]["state"] == "current"
    # Under review nothing is settled yet, so Delivered waits, but it never sits behind a pending Departed.
    assert steps["Delivered"]["state"] == "pending"
    order = [s["step"] for s in d["journey"]]
    assert order.index("Departed") < order.index("Delivered")

    assert d["proof"]["driver"] == "Nimal" and d["proof"]["vehicle"] == "VEH039"
    assert d["proof"]["receivedBy"] == "S. Fernando" and d["proof"]["at"] == "05:42"


def test_the_journey_never_leaves_a_gap_behind_a_reached_step(client, auth, reseed):
    """Whatever the day did, a step that has a time is done or current, and no reached step follows a pending one."""
    delivered_day(client, auth)
    post(client, auth, "store", f"{STORE}/receipts", {"date": DAY, "lines": [{"orderId": "ORD2001", "received": 12}, {"orderId": "ORD2002", "received": 8}]}, status=201)

    journey = day(client, auth)["journey"]
    assert [s["step"] for s in journey] == ["Ordered", "Confirmed", "Planned", "Loaded", "Departed", "Delivered", "Receipt confirmed"]
    for step in journey:
        assert (step["at"] is not None) == (step["state"] in ("done", "current")), step
    reached = [i for i, s in enumerate(journey) if s["at"] is not None]
    assert reached == list(range(len(reached))), "a reached step never follows one that was skipped"
    assert all(s["actor"] for s in journey)


# ---- the read routes at their edges ------------------------------------------------------------------------------


def test_the_delivery_range_filters_by_day_and_an_unknown_day_is_empty_not_an_error(client, auth, reseed):
    place(client, auth)
    assert [d["date"] for d in get(client, auth, "store", f"{STORE}/deliveries", **{"from": DAY, "to": DAY})] == [DAY]
    assert get(client, auth, "store", f"{STORE}/deliveries", **{"from": "2026-10-05", "to": "2026-10-06"}) == []
    assert get(client, auth, "store", f"{STORE}/deliveries/2026-10-05") == []
    assert client.get(f"{STORE}/deliveries/not-a-date", headers=auth("store")).status_code == 422


def test_history_is_newest_first_skips_sundays_and_honours_its_limit(client, auth, reseed):
    delivered_day(client, auth)
    rows = get(client, auth, "store", f"{STORE}/history", limit=60)
    assert rows, "the outlet has been served before"
    assert [r["date"] for r in rows] == sorted((r["date"] for r in rows), reverse=True)
    assert all(r["date"][-2:] != "27" or r["date"] != "2026-09-27" for r in rows)  # Sun 27 Sep is not a delivery day
    assert len(get(client, auth, "store", f"{STORE}/history", limit=2)) <= 2
    assert client.get(f"{STORE}/history?limit=0", headers=auth("store")).status_code == 422
    assert client.get(f"{STORE}/history?limit=61", headers=auth("store")).status_code == 422
    # ``before`` is exclusive.
    assert all(r["date"] < DAY for r in get(client, auth, "store", f"{STORE}/history", limit=60, before=DAY))


def test_an_issue_is_refused_for_an_order_that_was_never_delivered(client, auth, reseed):
    place(client, auth)
    released(client, auth)
    not_yet = client.post(f"{STORE}/issues", headers=auth("store"), json={"date": DAY, "type": "Damaged", "lines": [{"orderId": "ORD2001", "units": 1}]})
    assert not_yet.status_code == 409 and not_yet.json()["code"] == "not_delivered"
    unknown = client.post(f"{STORE}/issues", headers=auth("store"), json={"date": DAY, "type": "Damaged", "lines": [{"orderId": "ORD9999", "units": 1}]})
    assert unknown.status_code == 404
    assert get(client, auth, "store", f"{STORE}/issues") == []


def test_the_feed_counts_what_is_unread_and_read_all_is_idempotent(client, auth, reseed):
    place(client, auth)
    advance(client, auth, "2026-09-28T16:01:00+05:30")
    feed = get(client, auth, "store", f"{STORE}/updates")
    assert feed["unread"] == sum(1 for u in feed["updates"] if u["unread"])
    assert [u["id"] for u in feed["updates"]] == [u["id"] for u in feed["updates"]][: len(feed["updates"])]
    assert all(u["target"] and u["tag"] and u["title"] for u in feed["updates"])

    post(client, auth, "store", f"{STORE}/updates/read-all", status=204)
    post(client, auth, "store", f"{STORE}/updates/read-all", status=204)  # again changes nothing
    after = get(client, auth, "store", f"{STORE}/updates")
    assert after["unread"] == 0 and all(u["unread"] is False for u in after["updates"])
    assert len(after["updates"]) == len(feed["updates"])


def test_every_store_route_refuses_an_account_with_no_outlet(client, auth, reseed):
    """The dispatcher has no outlet, so each route stops before it reads anything (PRD §19: role and scope)."""
    place(client, auth)
    for path in (f"{STORE}/order-form", f"{STORE}/deliveries", f"{STORE}/deliveries/{DAY}", f"{STORE}/history", f"{STORE}/issues", f"{STORE}/updates"):
        assert client.get(path, headers=auth("dispatcher")).status_code == 403, path
    assert client.post(f"{STORE}/updates/read-all", headers=auth("dispatcher")).status_code == 403
    assert client.post(f"{STORE}/issues", headers=auth("dispatcher"), json={"date": DAY, "type": "Damaged", "lines": [{"orderId": "ORD2001", "units": 1}]}).status_code == 403
    # And the loader's own board is not the store's to read either.
    assert client.get(f"{LOADER}/docks/kandy", headers=auth("store")).status_code == 403
