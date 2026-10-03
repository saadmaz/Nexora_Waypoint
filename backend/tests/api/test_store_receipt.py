"""Confirming receipt and reporting a problem, over HTTP (PRD v3 §3 S3, §16 step 19, handoff 10).

The hero walk that gets the goods to the counter lives in ``test_store_deliveries.py``; these tests pick it up
at 07:30, where Anusha checks the proof of delivery and either confirms what arrived or says what went wrong.
Both are real cross-role writes: the receipt reaches the dispatcher's live board, and a reported problem lands
in its inbox as a store issue.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from .test_store_deliveries import (
    DAY,
    HERO,
    advance,
    conflict_id,
    day,
    place_hero,
    step,
    to_delivered,
    to_departed,
    to_review,
)

RECEIPTS = "/api/v1/store/receipts"
ISSUES = "/api/v1/store/issues"


def full_lines() -> list[dict[str, Any]]:
    return [{"orderId": "ORD2001", "received": 12}, {"orderId": "ORD2002", "received": 8}]


def confirm(client: TestClient, auth: Any, **body: Any) -> Any:
    payload: dict[str, Any] = {"date": DAY, "lines": full_lines(), **body}
    return client.post(RECEIPTS, json=payload, headers=auth("store"))


def at_the_counter(client: TestClient, auth: Any) -> None:
    """H17: the delivery is settled and it is 07:30 at the counter."""
    to_delivered(client, auth)
    advance(client, auth, "2026-09-29T07:30:00+05:30")


def report(client: TestClient, auth: Any, **body: Any) -> Any:
    payload: dict[str, Any] = {"date": DAY, "type": "Missing", "lines": [{"orderId": "ORD2001", "units": 2}], **body}
    return client.post(ISSUES, json=payload, headers=auth("store"))


def audit_types(entity_id: str) -> list[str]:
    from app.db import SessionLocal
    from app.models.comms import AuditEvent

    with SessionLocal() as db:
        return [row.type.value for row in db.scalars(select(AuditEvent).where(AuditEvent.entity_id == entity_id))]


def dispatch_notices() -> list[tuple[str, str]]:
    from app.db import SessionLocal
    from app.models.comms import Notice
    from app.models.enums import AudienceKind

    with SessionLocal() as db:
        rows = db.scalars(
            select(Notice).where(Notice.audience_kind == AudienceKind.DISPATCHER).order_by(Notice.id)
        )
        return [(n.title, n.body) for n in rows]


# --------------------------------------------------------------------------- S3.2: a clean receipt


def test_confirming_what_arrived_tags_the_day_and_closes_the_journey(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = confirm(client, auth)
    assert res.status_code == 201, res.text

    delivery = res.json()
    assert delivery["status"] == "delivered"  # a full count leaves the order Delivered (PRD §4b, H17)
    assert delivery["receiptConfirmedAt"] == "07:30"
    assert delivery["receiptBy"] == "Anusha"
    assert delivery["shortfallReason"] is None
    assert "Receipt confirmed" in delivery["tags"]
    assert step(delivery, "Receipt confirmed") == {"step": "Receipt confirmed", "actor": "You", "at": "07:30", "state": "done"}
    assert all(s["state"] != "current" for s in delivery["journey"])  # nothing is waiting any more

    # The reply is the day itself, so the screen needs no second request.
    assert day(client, auth) == delivery


def test_a_receipt_writes_a_row_and_an_audit_row_for_each_order(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    assert confirm(client, auth).status_code == 201

    from app.db import SessionLocal
    from app.models.field import Receipt

    with SessionLocal() as db:
        rows = {r.order_id: r for r in db.scalars(select(Receipt))}
    assert sorted(rows) == list(HERO)
    assert rows["ORD2001"].units_received == 12
    assert rows["ORD2001"].confirmed_by == "Anusha"
    for order_id in HERO:
        assert "RECEIPT_CONFIRMED" in audit_types(order_id), order_id


def test_the_receipt_reaches_the_dispatchers_live_board(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    assert confirm(client, auth).status_code == 201

    titles = [title for title, _ in dispatch_notices()]
    assert "OUT084: receipt confirmed" in titles, titles

    board = client.get("/api/v1/dispatcher/live?depot=kandy", headers=auth("dispatcher"))
    assert board.status_code == 200, board.text
    assert "07:30" in board.text  # D6.6: receipt confirmed 07:30


def test_confirming_twice_keeps_one_receipt_per_order(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    assert confirm(client, auth).status_code == 201
    assert confirm(client, auth).status_code == 201

    from app.db import SessionLocal
    from app.models.field import Receipt

    with SessionLocal() as db:
        assert len(list(db.scalars(select(Receipt)))) == 2


# --------------------------------------------------------------------------- S3.1 B: a shortfall


def test_a_lower_count_makes_the_order_partial_and_keeps_the_reason(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = confirm(
        client,
        auth,
        lines=[{"orderId": "ORD2001", "received": 10}, {"orderId": "ORD2002", "received": 8}],
        reason="Missing",
    )
    assert res.status_code == 201, res.text

    delivery = res.json()
    assert delivery["status"] == "partial"
    assert delivery["shortfallReason"] == "Missing"
    short = next(o for o in delivery["orders"] if o["id"] == "ORD2001")
    assert short["status"] == "partial"
    assert short["received"] == 10  # "ORD2001 - 10 of 12 units received" (A50)
    complete = next(o for o in delivery["orders"] if o["id"] == "ORD2002")
    assert complete["status"] == "delivered"
    # A line counted in full carries no count: S3 would print "8 of 8 units received" and the shortfall reason under it.
    assert complete["received"] is None
    assert "Receipt confirmed" in delivery["tags"]


def test_a_shortfall_without_a_reason_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = confirm(client, auth, lines=[{"orderId": "ORD2001", "received": 10}])
    assert res.status_code == 400, res.text
    assert res.json()["code"] == "reason_required"
    assert day(client, auth)["receiptConfirmedAt"] is None  # nothing was written


def test_a_blank_reason_is_no_reason(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = confirm(client, auth, lines=[{"orderId": "ORD2001", "received": 10}], reason="   ")
    assert res.status_code == 400, res.text
    assert res.json()["code"] == "reason_required"


def test_more_units_than_were_ordered_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = confirm(client, auth, lines=[{"orderId": "ORD2001", "received": 13}])
    assert res.status_code == 400, res.text
    assert res.json()["code"] == "more_than_ordered"


def test_a_shortfall_reported_during_a_review_becomes_the_stores_report(client: TestClient, auth: Any, reseed: None) -> None:
    # S3.6 and handoff 10: the receipt is recorded, the review stays open, and D7 now recommends Partial.
    cid = to_review(client, auth)
    client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher"))
    advance(client, auth, "2026-09-29T07:30:00+05:30")

    res = confirm(client, auth, lines=[{"orderId": "ORD2001", "received": 10}], reason="Missing")
    assert res.status_code == 201, res.text

    view = client.get(f"/api/v1/dispatcher/conflicts/{cid}", headers=auth("dispatcher"))
    assert view.status_code == 200, view.text
    assert view.json()["state"] != "resolved"
    assert view.json()["recommendation"]["choice"] == "keep_partial"

    # The order is still under review, so its status is D7.4 B's to set, not the receipt's. A shortage
    # report is an answer, so the question is not asked again, but it settles nothing for the store.
    delivery = day(client, auth)
    assert next(o for o in delivery["orders"] if o["id"] == "ORD2001")["status"] == "conflict"
    assert delivery["status"] == "conflict"
    assert delivery["receivedAnswered"] is True
    assert delivery["review"] is None


# --------------------------------------------------------------------------- when a receipt is possible


def test_a_receipt_before_anything_is_delivered_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)
    res = confirm(client, auth)
    assert res.status_code == 409, res.text
    assert res.json()["code"] == "not_delivered"


def test_a_receipt_while_the_truck_is_still_out_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    to_departed(client, auth)
    res = confirm(client, auth)
    assert res.status_code == 409, res.text
    assert res.json()["code"] == "not_delivered"


def test_a_receipt_may_be_confirmed_while_the_delivery_is_under_review(client: TestClient, auth: Any, reseed: None) -> None:
    to_review(client, auth)
    advance(client, auth, "2026-09-29T07:30:00+05:30")
    res = confirm(client, auth)
    assert res.status_code == 201, res.text
    assert res.json()["receiptConfirmedAt"] == "07:30"


def test_a_receipt_for_a_day_the_outlet_never_ordered_for_is_a_404(client: TestClient, auth: Any) -> None:
    res = client.post(RECEIPTS, json={"date": "2026-10-15", "lines": full_lines()}, headers=auth("store"))
    assert res.status_code == 404, res.text


def test_a_receipt_naming_another_outlets_order_is_a_404(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    # ORD1002 is OUT009's. It is not on this outlet's day, so the day cannot confirm it.
    res = client.post(RECEIPTS, json={"date": DAY, "lines": [{"orderId": "ORD1002", "received": 35}]}, headers=auth("store"))
    assert res.status_code == 404, res.text
    assert res.json()["code"] == "not_found"


def test_confirming_a_receipt_is_store_only(client: TestClient, auth: Any) -> None:
    body = {"date": DAY, "lines": full_lines()}
    assert client.post(RECEIPTS, json=body).status_code == 401
    for role in ("dispatcher", "loader", "driver"):
        assert client.post(RECEIPTS, json=body, headers=auth(role)).status_code == 403, role


# --------------------------------------------------------------------------- a receipt saved offline (A52)


def test_a_receipt_saved_offline_keeps_the_time_on_the_phone(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    advance(client, auth, "2026-09-29T08:10:00+05:30")  # the phone reconnects later
    res = confirm(client, auth, deviceTime="07:30")
    assert res.status_code == 201, res.text
    assert res.json()["receiptConfirmedAt"] == "07:30"


def test_a_phone_time_the_scenario_has_not_reached_falls_back_to_the_clock(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = confirm(client, auth, deviceTime="23:59")
    assert res.status_code == 201, res.text
    assert res.json()["receiptConfirmedAt"] == "07:30"


def test_a_phone_time_that_is_not_a_time_falls_back_to_the_clock(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = confirm(client, auth, deviceTime="later")
    assert res.status_code == 201, res.text
    assert res.json()["receiptConfirmedAt"] == "07:30"


# --------------------------------------------------------------------------- S3.3 and S3.4: reporting a problem


def test_reporting_a_problem_moves_the_order_to_issue_and_tags_it(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = report(client, auth, note="Two crates not on the truck", photo=True)
    assert res.status_code == 201, res.text

    issue = res.json()
    assert issue["type"] == "Missing"
    assert issue["outletId"] == "OUT084"
    assert issue["date"] == DAY
    assert issue["lines"] == [{"orderId": "ORD2001", "kind": "chilled", "units": 2, "orderUnits": 12}]
    assert issue["note"] == "Two crates not on the truck"
    assert issue["photo"] is True
    assert issue["reportedAt"] == "07:30"
    assert issue["resolved"] is False

    delivery = day(client, auth)
    assert delivery["status"] == "issue"
    flagged = next(o for o in delivery["orders"] if o["id"] == "ORD2001")
    assert flagged["status"] == "issue"
    assert flagged["issue"] == "Short"  # Missing on part of an order reads Short (A49)
    assert next(o for o in delivery["orders"] if o["id"] == "ORD2002")["status"] == "delivered"
    assert [i["id"] for i in delivery["issues"]] == [issue["id"]]


def test_a_problem_covering_a_whole_order_keeps_its_own_tag(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = report(client, auth, lines=[{"orderId": "ORD2001", "units": 12}])
    assert res.status_code == 201, res.text
    assert next(o for o in day(client, auth)["orders"] if o["id"] == "ORD2001")["issue"] == "Missing"


def test_reporting_a_problem_reaches_dispatch_with_its_exception_row(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = report(client, auth, note="Two crates not on the truck", photo=True)
    issue_id = res.json()["id"]

    from app.db import SessionLocal
    from app.models.enums import ExceptionKind, ExceptionStatus
    from app.models.field import FieldException

    with SessionLocal() as db:
        row = db.get(FieldException, int(issue_id))
        assert row is not None
        assert row.kind is ExceptionKind.STORE_ISSUE
        assert row.status is ExceptionStatus.OPEN
        assert row.order_ids == ["ORD2001"]
        assert row.units_short == {"ORD2001": 2}
        assert row.raised_by == "Anusha"

    assert "ISSUE_REPORTED" in audit_types(issue_id)
    assert any("store" in title for title, _ in dispatch_notices()), dispatch_notices()


def test_an_unknown_problem_type_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = report(client, auth, type="Refused")  # a driver outcome, never a store report
    assert res.status_code == 400, res.text
    assert res.json()["code"] == "unknown_issue_type"


def test_short_is_never_chosen_on_the_sheet(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    assert report(client, auth, type="Short").status_code == 400


def test_more_affected_units_than_the_order_has_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = report(client, auth, lines=[{"orderId": "ORD2001", "units": 13}])
    assert res.status_code == 400, res.text
    assert res.json()["code"] == "more_than_ordered"


def test_a_problem_on_another_outlets_order_is_a_404(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    res = report(client, auth, lines=[{"orderId": "ORD1002", "units": 2}])
    assert res.status_code == 404, res.text


def test_reporting_a_problem_is_store_only(client: TestClient, auth: Any) -> None:
    body = {"date": DAY, "type": "Missing", "lines": [{"orderId": "ORD2001", "units": 2}]}
    assert client.post(ISSUES, json=body).status_code == 401
    for role in ("dispatcher", "loader", "driver"):
        assert client.post(ISSUES, json=body, headers=auth(role)).status_code == 403, role


# --------------------------------------------------------------------------- S3.7: the Issues tab


def test_the_issues_tab_is_empty_until_something_is_reported(client: TestClient, auth: Any) -> None:
    res = client.get(ISSUES, headers=auth("store"))
    assert res.status_code == 200, res.text
    assert res.json() == []


def test_the_issues_tab_lists_open_problems_newest_first(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    first = report(client, auth, lines=[{"orderId": "ORD2001", "units": 2}]).json()
    second = report(client, auth, type="Damaged", lines=[{"orderId": "ORD2002", "units": 1}]).json()

    rows = client.get(ISSUES, headers=auth("store")).json()
    assert [r["id"] for r in rows] == [second["id"], first["id"]]
    assert [r["type"] for r in rows] == ["Damaged", "Missing"]


def test_a_problem_a_dispatcher_has_decided_sorts_below_the_open_ones(client: TestClient, auth: Any, reseed: None) -> None:
    at_the_counter(client, auth)
    decided = report(client, auth, lines=[{"orderId": "ORD2001", "units": 2}]).json()
    still_open = report(client, auth, type="Damaged", lines=[{"orderId": "ORD2002", "units": 1}]).json()

    from app.db import SessionLocal
    from app.models.enums import ExceptionStatus
    from app.models.field import FieldException

    with SessionLocal() as db:
        row = db.get(FieldException, int(decided["id"]))
        assert row is not None
        row.status = ExceptionStatus.DECIDED
        db.commit()

    rows = client.get(ISSUES, headers=auth("store")).json()
    assert [r["id"] for r in rows] == [still_open["id"], decided["id"]]
    assert [r["resolved"] for r in rows] == [False, True]


def test_the_review_is_untouched_when_the_store_reports_a_problem_instead_of_answering(
    client: TestClient, auth: Any, reseed: None
) -> None:
    # S3.5: "Report issue" escalates to S3.3 and back to D7.3. It never settles the review.
    cid = to_review(client, auth)
    client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher"))
    advance(client, auth, "2026-09-29T07:31:00+05:30")

    assert report(client, auth, lines=[{"orderId": "ORD2001", "units": 2}]).status_code == 201
    view = client.get(f"/api/v1/dispatcher/conflicts/{conflict_id()}", headers=auth("dispatcher")).json()
    assert view["state"] != "resolved"
    assert view["recommendation"]["choice"] == "keep_partial"  # the shortage now decides it (D7.3)
