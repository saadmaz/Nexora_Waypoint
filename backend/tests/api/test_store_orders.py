"""Store ordering over HTTP: the S1 form, placing, editing and cancelling (PRD v3 §16 step 1, §19).

The outlet always comes from the token, never from the path or the body. The scenario clock starts Mon 28 Sep 2026
15:30 Asia/Colombo and the hero delivery day is Tue 29 Sep, so these tests walk time forward across the 16:00 cutoff
in a deliberate order. Every test that moves the clock or writes an order takes ``reseed``, which puts the seed and
the clock back afterwards.
"""

from __future__ import annotations

import re
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

FORM = "/api/v1/store/order-form"
ORDERS = "/api/v1/store/orders"

#: The hero order sizes for OUT084 (PRD §4c H1): chilled 12 units, dry 8 units.
CHILLED = {"kind": "chilled", "units": 12, "estimatedKg": 70.0, "estimatedM3": 0.7}
AMBIENT = {"kind": "ambient", "units": 8, "estimatedKg": 45.0, "estimatedM3": 0.6}

#: A local time with no offset and no "Z": "2026-09-28T15:40:00".
NAIVE_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$")


def advance(client: TestClient, auth: Any, to: str) -> None:
    """Move the scenario clock. Advancing is dispatcher only, so it borrows that token."""
    res = client.post("/api/v1/demo/advance", json={"to": to}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text


def form(client: TestClient, auth: Any, date: str | None = None) -> dict[str, Any]:
    url = FORM if date is None else f"{FORM}?date={date}"
    res = client.get(url, headers=auth("store"))
    assert res.status_code == 200, res.text
    body: dict[str, Any] = res.json()
    return body


def new_order(line: dict[str, Any], delivery_date: str = "2026-09-29", outlet: str = "OUT084") -> dict[str, Any]:
    return {"outletId": outlet, "deliveryDate": delivery_date, "line": dict(line)}


def place(client: TestClient, auth: Any, orders: list[dict[str, Any]]) -> Any:
    return client.post(ORDERS, json={"orders": orders}, headers=auth("store"))


def place_hero(client: TestClient, auth: Any, delivery_date: str = "2026-09-29") -> list[dict[str, Any]]:
    """Step 1 at 15:40: Anusha places chilled 12 and dry 8 for OUT084."""
    res = place(client, auth, [new_order(CHILLED, delivery_date), new_order(AMBIENT, delivery_date)])
    assert res.status_code == 201, res.text
    body: list[dict[str, Any]] = res.json()
    return body


def error_shape(body: dict[str, Any]) -> None:
    assert set(body) == {"code", "message", "details"}, body
    assert isinstance(body["code"], str) and body["code"]
    assert isinstance(body["message"], str) and body["message"]


# --------------------------------------------------------------------------- the S1 form


def test_the_form_opens_on_the_next_operating_day_before_the_cutoff(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    draft = form(client, auth)
    assert draft["outletId"] == "OUT084"  # from the token, never asked for
    assert draft["deliveryDate"] == "2026-09-29"
    assert draft["afterCutoff"] is False
    assert draft["dock"] == "Rear dock"  # the human label, not "rear_dock"
    assert draft["window"] == {"start": "05:30", "end": "08:00"}
    assert draft["orders"] == []


def test_the_form_carries_both_kinds_of_unit_factor_and_default(client: TestClient, auth: Any, reseed: None) -> None:
    # The frontend mapper (storeMappers.mapOrderDraft) throws unless both keys are present.
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    draft = form(client, auth)
    assert set(draft["unitFactors"]) == {"chilled", "ambient"}
    for factor in draft["unitFactors"].values():
        assert set(factor) == {"kg", "m3"}
        assert factor["kg"] > 0 and factor["m3"] > 0
    assert draft["defaultUnits"] == {"chilled": 12, "ambient": 8}


def test_the_form_after_the_cutoff_moves_to_the_following_run(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T16:07:00+05:30")
    draft = form(client, auth)
    assert draft["deliveryDate"] == "2026-09-30"
    assert draft["afterCutoff"] is True


def test_the_form_needs_a_store_account(client: TestClient, auth: Any) -> None:
    assert client.get(FORM).status_code == 401
    for role in ("dispatcher", "loader", "driver"):
        res = client.get(FORM, headers=auth(role))
        assert res.status_code == 403, role
        assert res.json()["code"] == "forbidden"


# --------------------------------------------------------------------------- placing (step 1)


def test_placing_takes_the_reserved_hero_ids_and_a_naive_received_at(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    placed = place_hero(client, auth)

    assert [o["id"] for o in placed] == ["ORD2001", "ORD2002"]
    assert [o["line"]["kind"] for o in placed] == ["chilled", "ambient"]
    assert [o["line"]["units"] for o in placed] == [12, 8]
    for order in placed:
        assert order["outletId"] == "OUT084"
        assert order["deliveryDate"] == "2026-09-29"
        assert order["status"] == "ordered"
        assert order["afterCutoff"] is False
        assert order["window"] == {"start": "05:30", "end": "08:00"}
        # Naive local ISO: no offset, no "Z". The store screens read it as wall clock time.
        assert order["receivedAt"] == "2026-09-28T15:40:00", order["receivedAt"]
        assert NAIVE_ISO.match(order["receivedAt"])
        assert order.get("updatedAt") is None


def test_the_placed_orders_come_back_on_the_form(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)
    draft = form(client, auth)
    assert [o["id"] for o in draft["orders"]] == ["ORD2001", "ORD2002"]


def test_placing_after_the_cutoff_is_flagged_and_counts_for_wednesday(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T16:07:00+05:30")
    placed = place_hero(client, auth, "2026-09-30")
    for order in placed:
        assert order["deliveryDate"] == "2026-09-30"
        assert order["afterCutoff"] is True
        assert order["receivedAt"] == "2026-09-28T16:07:00"


def test_a_delivery_date_that_is_not_the_service_day_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    res = place(client, auth, [new_order(CHILLED, "2026-09-30")])
    assert res.status_code == 409, res.text
    error_shape(res.json())


def test_one_bad_line_stores_none_of_them(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    res = place(client, auth, [new_order(CHILLED), new_order(AMBIENT, "2026-09-30")])
    assert res.status_code == 409, res.text
    assert form(client, auth)["orders"] == []


def test_placing_for_another_outlet_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    res = place(client, auth, [new_order(CHILLED, outlet="OUT009")])
    assert res.status_code == 403, res.text
    assert res.json()["code"] == "forbidden"
    assert form(client, auth)["orders"] == []


def test_placing_is_store_only(client: TestClient, auth: Any) -> None:
    body = {"orders": [new_order(CHILLED)]}
    assert client.post(ORDERS, json=body).status_code == 401
    for role in ("dispatcher", "loader", "driver"):
        assert client.post(ORDERS, json=body, headers=auth(role)).status_code == 403, role


def test_placing_writes_one_notice_and_an_audit_row_for_each_order(client: TestClient, auth: Any, reseed: None) -> None:
    from app.db import SessionLocal
    from app.models.comms import AuditEvent, Notice
    from app.models.enums import AudienceKind, AuditType

    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)

    with SessionLocal() as db:
        notices = list(
            db.scalars(select(Notice).where(Notice.audience_kind == AudienceKind.STORE, Notice.outlet_id == "OUT084"))
        )
        placed = list(db.scalars(select(AuditEvent).where(AuditEvent.type == AuditType.ORDER_PLACED)))

    assert len(notices) == 1, [(n.tag.value, n.title) for n in notices]
    assert notices[0].tag.value == "Order"
    assert sorted(row.entity_id for row in placed) == ["ORD2001", "ORD2002"]
    assert {row.entity_type for row in placed} == {"order"}
    assert {row.actor for row in placed} == {"store@waypoint.demo"}


# --------------------------------------------------------------------------- editing before the cutoff


def test_editing_before_the_cutoff_returns_the_new_size_and_an_updated_at(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)
    advance(client, auth, "2026-09-28T15:59:00+05:30")

    res = client.patch(
        f"{ORDERS}/ORD2001",
        json={"units": 14, "estimatedKg": 81.7, "estimatedM3": 0.82},
        headers=auth("store"),
    )
    assert res.status_code == 200, res.text
    order = res.json()
    assert order["id"] == "ORD2001"
    assert order["line"]["units"] == 14
    assert order["line"]["estimatedKg"] == 81.7
    assert order["line"]["estimatedM3"] == 0.82
    assert order["status"] == "ordered"
    assert order["receivedAt"] == "2026-09-28T15:40:00"  # placing time is not touched
    assert order["updatedAt"] == "2026-09-28T15:59:00"
    assert NAIVE_ISO.match(order["updatedAt"])

    assert next(o for o in form(client, auth)["orders"] if o["id"] == "ORD2001")["line"]["units"] == 14


def test_editing_an_unknown_order_is_a_404(client: TestClient, auth: Any) -> None:
    res = client.patch(f"{ORDERS}/ORD0000", json={"units": 3, "estimatedKg": 1.0, "estimatedM3": 0.1}, headers=auth("store"))
    assert res.status_code == 404, res.text
    assert res.json()["code"] == "not_found"


def test_editing_another_outlets_order_is_a_403(client: TestClient, auth: Any) -> None:
    # ORD1002 belongs to OUT009; the token is bound to OUT084.
    res = client.patch(f"{ORDERS}/ORD1002", json={"units": 3, "estimatedKg": 1.0, "estimatedM3": 0.1}, headers=auth("store"))
    assert res.status_code == 403, res.text
    assert res.json()["code"] == "forbidden"


# --------------------------------------------------------------------------- cancelling before the cutoff


def test_cancelling_before_the_cutoff_removes_the_order_from_the_form(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)

    res = client.post(f"{ORDERS}/ORD2002/cancel", headers=auth("store"))
    assert res.status_code == 204, res.text
    assert res.content == b""
    assert [o["id"] for o in form(client, auth)["orders"]] == ["ORD2001"]


def test_cancelling_an_unknown_order_is_a_404(client: TestClient, auth: Any) -> None:
    res = client.post(f"{ORDERS}/ORD0000/cancel", headers=auth("store"))
    assert res.status_code == 404, res.text
    assert res.json()["code"] == "not_found"


def test_cancelling_another_outlets_order_is_a_403(client: TestClient, auth: Any) -> None:
    res = client.post(f"{ORDERS}/ORD1002/cancel", headers=auth("store"))
    assert res.status_code == 403, res.text
    assert res.json()["code"] == "forbidden"


# --------------------------------------------------------------------------- the 16:00 cutoff closes both


def test_after_the_cutoff_editing_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)
    advance(client, auth, "2026-09-28T16:01:00+05:30")

    res = client.patch(f"{ORDERS}/ORD2001", json={"units": 14, "estimatedKg": 81.7, "estimatedM3": 0.82}, headers=auth("store"))
    assert res.status_code == 409, res.text
    error_shape(res.json())
    assert next(o for o in form(client, auth, "2026-09-29")["orders"] if o["id"] == "ORD2001")["line"]["units"] == 12


def test_after_the_cutoff_cancelling_is_refused(client: TestClient, auth: Any, reseed: None) -> None:
    advance(client, auth, "2026-09-28T15:40:00+05:30")
    place_hero(client, auth)
    advance(client, auth, "2026-09-28T16:01:00+05:30")

    res = client.post(f"{ORDERS}/ORD2002/cancel", headers=auth("store"))
    assert res.status_code == 409, res.text
    error_shape(res.json())
    assert [o["id"] for o in form(client, auth, "2026-09-29")["orders"]] == ["ORD2001", "ORD2002"]
