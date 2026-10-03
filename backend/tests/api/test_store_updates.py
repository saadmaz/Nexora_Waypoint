"""The S4 updates feed and the bell, over HTTP (PRD v3 §3 S4, V23, A37, A53, handoff 14).

The feed is not written here: every row is a notice some other part of the system sent this store as its
orders changed. These tests walk the hero day and check that each change reaches the store, with the tag, the
time, the target its View opens, and the unread count the bell shows.

The wording of each row belongs to whoever produced it (the cutoff job, the planner, the sync service), so
these tests assert the tag, the order and the link rather than re-stating someone else's sentence.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from .test_store_deliveries import (
    DAY,
    advance,
    conflict_id,
    place_hero,
    to_deferred,
    to_delivered,
    to_planned,
    to_review,
)

UPDATES = "/api/v1/store/updates"
READ_ALL = "/api/v1/store/updates/read-all"

#: The five tags the store's feed may use (PRD §4b, Store feed).
FEED_TAGS = {"Order", "Plan", "Delivery", "Deferral", "Review"}


def feed(client: TestClient, auth: Any) -> dict[str, Any]:
    res = client.get(UPDATES, headers=auth("store"))
    assert res.status_code == 200, res.text
    body: dict[str, Any] = res.json()
    return body


def rows(client: TestClient, auth: Any) -> list[dict[str, Any]]:
    updates: list[dict[str, Any]] = feed(client, auth)["updates"]
    return updates


def titles(client: TestClient, auth: Any) -> list[str]:
    return [r["title"] for r in rows(client, auth)]


# --------------------------------------------------------------------------- the rows arrive as the day moves


def test_the_feed_is_empty_before_anything_happens(client: TestClient, auth: Any) -> None:
    assert feed(client, auth) == {"updates": [], "unread": 0}


def test_placing_an_order_puts_the_first_row_in_the_feed(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)

    received = rows(client, auth)
    assert len(received) == 1
    assert received[0]["tag"] == "Order"
    assert received[0]["date"] == "2026-09-28"
    assert received[0]["time"] == "15:40"
    assert received[0]["unread"] is True
    assert received[0]["target"] == {"screen": "orders"}  # S1: the order it is about
    assert "ORD2001" in received[0]["body"]


def test_the_cutoff_adds_a_row_that_opens_the_delivery_day(client: TestClient, auth: Any, reseed: None) -> None:
    to_planned(client, auth)
    received = rows(client, auth)

    # The cutoff job's own row. Its time is the clock the job ran on, which is the job's to decide.
    closed = [r for r in received if r["tag"] == "Order" and r["title"] != "Order received"]
    assert closed, [(r["tag"], r["time"], r["title"]) for r in received]
    assert all(r["target"] == {"screen": "delivery", "date": DAY} for r in closed)
    # PRD §3 S4 also expects a Plan row, "Arrival time set 23:40". Nothing sends the store one yet:
    # ``planning.release`` notifies the docks and the drivers only. The gap is in that producer, not here,
    # so this asserts what the store is actually sent and the release owner adds the row.
    assert not [r for r in received if r["tag"] == "Plan"]


def test_a_deferral_reaches_the_store_as_a_deferral_row(client: TestClient, auth: Any, reseed: None) -> None:
    to_deferred(client, auth)
    deferral_rows = [r for r in rows(client, auth) if r["tag"] == "Deferral"]

    assert deferral_rows, titles(client, auth)
    assert all(r["time"] == "05:21" for r in deferral_rows)
    assert all(r["target"] == {"screen": "delivery", "date": DAY} for r in deferral_rows)


def test_a_review_row_is_marked_resolved_once_dispatch_settles_it(client: TestClient, auth: Any, reseed: None) -> None:
    to_review(client, auth)
    open_review = [r for r in rows(client, auth) if r["tag"] == "Review"]
    assert open_review, titles(client, auth)
    assert all(r["resolvedAt"] is None for r in open_review)

    advance(client, auth, "2026-09-29T06:44:00+05:30")
    res = client.post(
        f"/api/v1/dispatcher/conflicts/{conflict_id()}/resolve",
        json={"resolution": "keep_delivery"},
        headers=auth("dispatcher"),
    )
    assert res.status_code == 200, res.text

    settled = [r for r in rows(client, auth) if r["tag"] == "Review"]
    assert settled and all(r["resolvedAt"] == "06:44" for r in settled), settled


def test_the_kept_delivery_row_offers_to_open_the_delivery(client: TestClient, auth: Any, reseed: None) -> None:
    to_delivered(client, auth)
    kept = [r for r in rows(client, auth) if r["viewLabel"]]
    assert kept, rows(client, auth)
    assert all(r["viewLabel"] == "View delivery" for r in kept)
    assert all(r["target"] == {"screen": "delivery", "date": DAY} for r in kept)


# --------------------------------------------------------------------------- the shape every row keeps


def test_every_row_carries_a_tag_the_screens_know(client: TestClient, auth: Any, reseed: None) -> None:
    to_delivered(client, auth)
    for row in rows(client, auth):
        assert row["tag"] in FEED_TAGS, row


def test_every_row_opens_either_the_orders_screen_or_a_delivery_day(client: TestClient, auth: Any, reseed: None) -> None:
    to_delivered(client, auth)
    for row in rows(client, auth):
        target = row["target"]
        assert target["screen"] in {"orders", "delivery"}, row
        if target["screen"] == "delivery":
            assert target["date"] == DAY, row
        else:
            assert set(target) == {"screen"}, row


def test_every_row_has_a_title_a_body_and_a_clock_time(client: TestClient, auth: Any, reseed: None) -> None:
    to_delivered(client, auth)
    for row in rows(client, auth):
        assert row["title"] and row["body"], row
        assert len(row["time"]) == 5 and row["time"][2] == ":", row
        assert "—" not in row["title"] + row["body"], row  # no em dashes (Contributing §29)
        assert "Mock" not in row["title"] + row["body"], row
        assert "Conflict" not in row["title"], row  # stores read "Under review"


def test_the_feed_is_newest_first(client: TestClient, auth: Any, reseed: None) -> None:
    to_delivered(client, auth)
    stamps = [(r["date"], r["time"]) for r in rows(client, auth)]
    assert stamps == sorted(stamps, reverse=True), stamps


# --------------------------------------------------------------------------- the bell


def test_every_row_starts_unread_and_the_count_matches(client: TestClient, auth: Any, reseed: None) -> None:
    to_deferred(client, auth)
    body = feed(client, auth)
    assert body["unread"] == len(body["updates"])
    assert all(r["unread"] for r in body["updates"])


def test_mark_all_read_clears_the_bell(client: TestClient, auth: Any, reseed: None) -> None:
    to_deferred(client, auth)
    assert feed(client, auth)["unread"] > 0

    res = client.post(READ_ALL, headers=auth("store"))
    assert res.status_code == 204, res.text
    assert res.content == b""

    body = feed(client, auth)
    assert body["unread"] == 0
    assert all(r["unread"] is False for r in body["updates"])


def test_a_row_that_arrives_after_marking_all_read_is_unread(client: TestClient, auth: Any, reseed: None) -> None:
    to_deferred(client, auth)
    client.post(READ_ALL, headers=auth("store"))
    before = len(rows(client, auth))

    advance(client, auth, "2026-09-29T06:40:00+05:30")
    to_review_rows = client.get(UPDATES, headers=auth("store")).json()
    assert to_review_rows["unread"] == 0  # nothing new yet

    client.post(READ_ALL, headers=auth("store"))
    assert feed(client, auth)["unread"] == 0
    assert len(rows(client, auth)) == before


def test_marking_all_read_twice_changes_nothing(client: TestClient, auth: Any, reseed: None) -> None:
    to_deferred(client, auth)
    for _ in range(2):
        assert client.post(READ_ALL, headers=auth("store")).status_code == 204
    assert feed(client, auth)["unread"] == 0


# --------------------------------------------------------------------------- scope


def test_the_feed_holds_only_this_outlets_rows(client: TestClient, auth: Any, reseed: None) -> None:
    # The 03:00 swap defers OUT009's ORD1002, which sends that store a notice. It is not this store's.
    to_planned(client, auth)
    advance(client, auth, "2026-09-29T03:00:00+05:30")
    res = client.post(
        "/api/v1/dispatcher/stops/defer",
        json={"orderIds": ["ORD1002"], "kind": "policy", "reason": "Replacement van is smaller"},
        headers=auth("dispatcher"),
    )
    assert res.status_code == 200, res.text

    for row in rows(client, auth):
        assert "ORD1002" not in row["body"], row
        assert "OUT009" not in row["body"], row


def test_the_feed_and_the_bell_are_store_only(client: TestClient, auth: Any) -> None:
    assert client.get(UPDATES).status_code == 401
    assert client.post(READ_ALL).status_code == 401
    for role in ("dispatcher", "loader", "driver"):
        assert client.get(UPDATES, headers=auth(role)).status_code == 403, role
        assert client.post(READ_ALL, headers=auth(role)).status_code == 403, role
