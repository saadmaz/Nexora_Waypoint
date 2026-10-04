"""The P0 findings of the architecture audit, each as a test that fails on the code before the fix.

One file rather than additions spread through the suite: these are security properties, and a reviewer asking "is the
delivery IDOR closed" should not have to find the answer in four places. They need the test database (``conftest.py``).
"""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from .test_dispatcher_live import advance
from .test_sync import DAY, on_the_road, record, results, sync

ORDERS = "/api/v1/store/orders"


# ---- 1. a driver may only report on orders their own vehicle carries -------------------------------


def _order_on_another_vehicle(not_vehicle: str = "VEH039") -> str:
    """An order of the run day that some other vehicle carries, taken from the released plan."""
    from app.db import SessionLocal
    from app.models import plans
    from app.models.orders import Order

    with SessionLocal() as db:
        row = db.execute(
            select(plans.TripOrder.order_id)
            .join(plans.Trip, plans.Trip.id == plans.TripOrder.trip_id)
            .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
            .join(Order, Order.id == plans.TripOrder.order_id)
            .where(plans.Trip.vehicle_id != not_vehicle, Order.service_date == plans.PlanVersion.service_date)
            .limit(1)
        ).first()
    assert row is not None, "the released plan has no trip for another vehicle"
    return row[0]


def test_a_driver_cannot_deliver_an_order_their_vehicle_does_not_carry(client, auth, reseed):
    """The audit's finding 1: the vehicle on the record was checked against the account, the order never was."""
    from app.db import SessionLocal
    from app.models.orders import Order

    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    stranger = _order_on_another_vehicle()

    with SessionLocal() as db:
        before = db.get(Order, stranger).status

    answer = results(
        sync(
            client, auth,
            [record("driver.outcome", {"date": DAY, "orderId": stranger, "outcome": "Delivered", "unitsDelivered": 5,
                                       "receiverName": "Nobody", "at": "06:00"}, "06:00", version)],
        )
    )[0]

    assert answer["result"] == "error", answer
    assert "not on a trip" in (answer.get("reason") or "").lower(), answer
    with SessionLocal() as db:
        assert db.get(Order, stranger).status == before, "another vehicle's order was moved"


def test_a_driver_cannot_hang_a_problem_on_another_vehicles_order(client, auth, reseed):
    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    stranger = _order_on_another_vehicle()
    answer = results(
        sync(
            client, auth,
            [record("driver.problem", {"date": DAY, "type": "Other", "note": "x", "orderIds": [stranger]}, "06:00", version)],
        )
    )[0]
    assert answer["result"] == "error", answer


def test_the_hero_driver_still_delivers_their_own_orders(client, auth, reseed):
    """The guard must not cost the walkthrough: ORD2001 is on VEH039's trip and still goes through."""
    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    answer = results(
        sync(
            client, auth,
            [record("driver.outcome", {"date": DAY, "outletId": "OUT084", "orderId": "ORD2001", "outcome": "Delivered",
                                       "unitsDelivered": 12, "receiverName": "S. Fernando", "at": "05:42"}, "05:42", version)],
        )
    )[0]
    assert answer["result"] in {"accepted", "conflict"}, answer


# ---- 2. POD photos can be read back, by the right people only -------------------------------------


#: The smallest valid PNG: the magic bytes are what the server checks.
PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _upload(client, auth, role: str = "driver", blob: bytes = PNG, mime: str = "image/png", device: str = "phone-veh039"):
    blob_id = str(uuid.uuid4())
    res = client.post(
        "/api/v1/attachments",
        data={"clientId": blob_id, "kind": "photo"},
        files={"file": ("pod.png", blob, mime)},
        headers=auth(role),
    )
    return blob_id, res


def test_a_photo_can_be_read_back_by_the_dispatcher(client, auth):
    blob_id, res = _upload(client, auth)
    assert res.status_code == 201, res.text
    got = client.get(f"/api/v1/attachments/{blob_id}", headers=auth("dispatcher"))
    assert got.status_code == 200, got.text
    assert got.content == PNG
    # Served as the type the bytes are, and never sniffed into something executable.
    assert got.headers["content-type"].startswith("image/png")
    assert got.headers["x-content-type-options"] == "nosniff"


def test_a_photo_no_record_claims_is_not_readable_by_another_role(client, auth):
    """A blob with no device record has nothing to scope it by, so only the dispatcher may open it."""
    blob_id, res = _upload(client, auth)
    assert res.status_code == 201, res.text
    assert client.get(f"/api/v1/attachments/{blob_id}", headers=auth("store")).status_code == 403


def test_a_delivery_photo_is_readable_by_its_own_store_and_driver_and_nobody_else(client, auth, reseed):
    """The scope rule on a photo that a real delivery record claims (the hero stop, OUT084 on VEH039)."""
    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    blob_id, res = _upload(client, auth)
    assert res.status_code == 201, res.text

    # The outcome record names the blob, which is what ties the photo to the stop.
    answer = results(
        sync(
            client, auth,
            [{**record("driver.outcome", {"date": DAY, "outletId": "OUT084", "orderId": "ORD2001", "outcome": "Delivered",
                                          "unitsDelivered": 12, "receiverName": "S. Fernando", "photoBlobId": blob_id,
                                          "at": "05:42"}, "05:42", version),
              "blobIds": [blob_id]}],
        )
    )[0]
    assert answer["result"] in {"accepted", "conflict"}, answer

    # The store it was taken at, and the driver whose vehicle took it, can both open it.
    assert client.get(f"/api/v1/attachments/{blob_id}", headers=auth("store")).status_code == 200
    assert client.get(f"/api/v1/attachments/{blob_id}", headers=auth("driver")).status_code == 200
    assert client.get(f"/api/v1/attachments/{blob_id}", headers=auth("dispatcher")).status_code == 200
    # The shared dock tablet did not record it, so it does not reach it.
    assert client.get(f"/api/v1/attachments/{blob_id}", headers=auth("loader")).status_code == 403


def test_a_missing_photo_is_404_not_500(client, auth):
    assert client.get(f"/api/v1/attachments/{uuid.uuid4()}", headers=auth("dispatcher")).status_code == 404


def test_reading_a_photo_needs_a_token(client, auth):
    blob_id, _ = _upload(client, auth)
    assert client.get(f"/api/v1/attachments/{blob_id}").status_code == 401


def test_a_file_that_is_not_an_image_is_refused(client, auth):
    """The multipart content type is whatever the client typed, so the bytes decide."""
    _, res = _upload(client, auth, blob=b"<?php system($_GET['c']); ?>", mime="image/jpeg")
    assert res.status_code == 415, res.text


# ---- 4. the presenter controls are not mounted outside a demo -------------------------------------


def test_the_demo_routes_exist_in_the_test_environment(client, auth):
    """They are the judge walkthrough's own controls, so they must stay reachable where DEMO_MODE is on."""
    assert "/api/v1/demo/reset" in set(client.app.openapi()["paths"])  # type: ignore[attr-defined]


def test_the_demo_routes_are_absent_when_demo_mode_is_off():
    """The real protection: with DEMO_MODE off the destructive route does not exist, so no role can reach it."""
    from app.config import Settings
    from app.main import create_app

    built = create_app(Settings(demo_mode=False, job_loop=False, request_log=False))
    # Read from the schema, not ``app.routes``: an included router is one lazy node there, not its routes.
    paths = set(built.openapi()["paths"])
    assert "/api/v1/demo/reset" not in paths
    assert "/api/v1/demo/advance" not in paths
    # Everything else is still there.
    assert "/api/v1/clock" in paths


# ---- 5. placing an order: no 500 under a race, and a retry is safe --------------------------------


def _place_body(units: int = 4) -> dict:
    return {
        "orders": [
            {
                "outletId": "OUT084",
                "deliveryDate": "2026-09-30",
                "line": {"id": "L1", "kind": "chilled", "units": units, "estimatedKg": 1.0, "estimatedM3": 1.0},
            }
        ]
    }


def test_two_orders_placed_at_once_give_one_409_not_a_500(client, auth, reseed):
    """The audit's finding 5. Both requests read "no order yet"; the database settles it, and the loser gets a 409."""
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(lambda _: client.post(ORDERS, json=_place_body(), headers=auth("store")), range(4)))

    codes = sorted(r.status_code for r in responses)
    assert 500 not in codes, [r.text for r in responses if r.status_code == 500]
    assert codes.count(201) == 1, codes
    assert set(codes) <= {201, 409}, codes


def test_a_retry_with_the_same_idempotency_key_returns_the_first_orders(client, auth, reseed):
    key = str(uuid.uuid4())
    headers = {**auth("store"), "Idempotency-Key": key}
    first = client.post(ORDERS, json=_place_body(), headers=headers)
    assert first.status_code == 201, first.text
    second = client.post(ORDERS, json=_place_body(), headers=headers)
    assert second.status_code == 201, second.text
    assert [o["id"] for o in second.json()] == [o["id"] for o in first.json()]


def test_without_the_key_a_second_order_is_refused(client, auth, reseed):
    """The rule itself is unchanged: one chilled order per outlet per day."""
    assert client.post(ORDERS, json=_place_body(), headers=auth("store")).status_code == 201
    again = client.post(ORDERS, json=_place_body(), headers=auth("store"))
    assert again.status_code == 409
    assert again.json()["code"] == "already_ordered"


def test_order_ids_come_from_the_sequence_not_from_the_maximum(client, auth, reseed):
    """Two placements for different days take different ids without either seeing the other's row."""
    first = client.post(ORDERS, json=_place_body(), headers=auth("store"))
    assert first.status_code == 201, first.text
    body = _place_body()
    body["orders"][0]["deliveryDate"] = "2026-10-01"
    second = client.post(ORDERS, json=body, headers=auth("store"))
    assert second.status_code == 201, second.text
    assert first.json()[0]["id"] != second.json()[0]["id"]


# ---- 6. nothing escapes as a raw traceback -------------------------------------------------------


def test_an_unhandled_error_becomes_the_standard_error_shape(client, auth):
    """A bug in a service must still answer ``{code, message, details}``, with an id that is in the log."""
    from fastapi.routing import APIRoute

    from app.main import app

    async def boom() -> None:
        raise RuntimeError("deliberate")

    app.router.routes.append(APIRoute("/api/v1/_test_boom", boom, methods=["GET"]))
    # The handler, not the test client, must shape the body, so this client lets the 500 through.
    raw = TestClient(app, raise_server_exceptions=False)
    try:
        res = raw.get("/api/v1/_test_boom")
    finally:
        app.router.routes[:] = [r for r in app.router.routes if getattr(r, "path", "") != "/api/v1/_test_boom"]

    assert res.status_code == 500
    body = res.json()
    assert body["code"] == "internal_error"
    assert "deliberate" not in res.text, "the cause belongs in the log, not the response"
    assert body["details"]["requestId"]
    assert res.headers["x-request-id"] == body["details"]["requestId"]


# ---- 7. liveness and readiness are separate ------------------------------------------------------


def test_liveness_answers_without_touching_the_database(client):
    res = client.get("/api/v1/health/live")
    assert res.status_code == 200 and res.json()["status"] == "ok"


def test_readiness_reports_the_job_loop(client):
    """The loop is off in tests (JOB_LOOP=false), so readiness does not hold it against this process."""
    res = client.get("/api/v1/health/ready")
    assert res.status_code == 200, res.text
    assert res.json()["failing"] == []


@pytest.mark.parametrize("path", ["/api/v1/health", "/api/v1/health/live", "/api/v1/health/ready"])
def test_the_probes_need_no_token(client, path):
    assert client.get(path).status_code == 200
