"""``POST /sync`` over HTTP: the hero replay H11 to H16 through the real endpoints (PRD v3 §2, §17 Sync and reconciliation).

The loader confirms VEH039 loaded and the driver starts the route through ``/sync``; the dispatcher defers OUT084 at the store's
request (Saad's ``/stops/defer``); the phone, still on the old plan, syncs five records at 06:40; the dispatcher keeps the
delivery (Saad's ``/conflicts/{id}/resolve``). Nothing here is inserted by hand. These need the test database (``conftest.py``).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import func, select

from app.config import COLOMBO

from .test_dispatcher_live import HERO, advance, board, defer_hero, release

SYNC = "/api/v1/sync"
DAY = "2026-09-29"


def at(hhmm: str) -> str:
    h, m = map(int, hhmm.split(":"))
    return datetime(2026, 9, 29, h, m, tzinfo=COLOMBO).isoformat()


def record(type_: str, payload: dict[str, Any], hhmm: str, version: int | None, *, actor: str = "Nimal", client_id: str | None = None) -> dict[str, Any]:
    return {
        "clientId": client_id or str(uuid.uuid4()),
        "type": type_,
        "payload": payload,
        "deviceTime": at(hhmm),
        "planVersionOnDevice": version,
        "actor": actor,
    }


def sync(client, auth, records: list[dict[str, Any]], role: str = "driver", device: str = "phone-veh039"):
    return client.post(SYNC, json={"deviceId": device, "records": records}, headers=auth(role))


def results(res) -> list[dict[str, Any]]:
    assert res.status_code == 200, res.text
    return res.json()["results"]


def released_number(client, auth) -> int:
    return client.get("/api/v1/dispatcher/plan?depot=kandy", headers=auth("dispatcher")).json()["version"]["number"]


def on_the_road(client, auth) -> int:
    """H4 to H9: v3 released, Ruwan confirms VEH039 loaded, Nimal acknowledges and starts, the phone is last heard at 05:17."""
    release(client, auth)
    version = released_number(client, auth)
    advance(client, auth, "2026-09-29T04:50:00+05:30")
    loaded = results(
        sync(
            client, auth,
            [record("loader.confirmLoaded", {"vehicleId": "VEH039", "trip": 1, "personId": "Ruwan", "personName": "Ruwan"}, "04:50", None, actor="Ruwan")],
            role="loader", device="tablet-kandy",
        )
    )
    assert [r["result"] for r in loaded] == ["accepted"]
    advance(client, auth, "2026-09-29T05:17:00+05:30")
    started = results(
        sync(
            client, auth,
            [
                record("driver.ack", {"date": DAY, "version": version}, "04:55", version),
                record("driver.startRoute", {"date": DAY, "at": "05:10"}, "05:10", version),
            ],
        )
    )
    assert [r["result"] for r in started] == ["accepted", "accepted"]
    return version


def hero_batch(version: int) -> list[dict[str, Any]]:
    """H12 to H14: what the phone recorded offline on the plan it held."""
    return [
        record("driver.arrival", {"date": DAY, "outletId": "OUT084", "at": "05:26"}, "05:26", version),
        record(
            "driver.outcome",
            {"date": DAY, "outletId": "OUT084", "orderId": "ORD2001", "outcome": "Delivered", "unitsDelivered": 12,
             "receiverName": "S. Fernando", "photoBlobId": str(uuid.uuid4()), "at": "05:42"},
            "05:42", version,
        ),
        record(
            "driver.outcome",
            {"date": DAY, "outletId": "OUT084", "orderId": "ORD2002", "outcome": "Delivered", "unitsDelivered": 8,
             "receiverName": "S. Fernando", "at": "05:42"},
            "05:42", version,
        ),
        record("driver.arrival", {"date": DAY, "outletId": "OUT087", "at": "05:48"}, "05:48", version),
        record(
            "driver.outcome",
            {"date": DAY, "outletId": "OUT087", "orderId": "ORD2003", "outcome": "Delivered", "unitsDelivered": 9,
             "receiverName": "M. Perera", "at": "05:58"},
            "05:58", version,
        ),
    ]


def to_the_sync(client, auth) -> tuple[int, list[dict[str, Any]], list[dict[str, Any]]]:
    """H11 to H15. Returns the version the phone holds, the batch it sent and the server's answers."""
    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T05:21:00+05:30")
    deferred = defer_hero(client, auth)
    assert deferred.status_code == 200, deferred.text
    assert deferred.json()["plan"] == version + 1
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    batch = hero_batch(version)
    return version, batch, results(sync(client, auth, batch))


def counts() -> dict[str, int]:
    from app.db import SessionLocal
    from app.models.comms import AuditEvent, Notice
    from app.models.field import Conflict, DeviceRecord

    with SessionLocal() as db:
        return {
            "device_records": db.scalar(select(func.count()).select_from(DeviceRecord)) or 0,
            "conflicts": db.scalar(select(func.count()).select_from(Conflict)) or 0,
            "notices": db.scalar(select(func.count()).select_from(Notice)) or 0,
            "order_audits": db.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.entity_type == "order")) or 0,
        }


def statuses(*ids: str) -> dict[str, str]:
    from app.db import SessionLocal
    from app.models.orders import Order

    with SessionLocal() as db:
        return {o.id: o.status.value for o in db.scalars(select(Order).where(Order.id.in_(ids)))}


# --------------------------------------------------------------------------- H15: the sync at 06:40


def test_the_hero_sync_is_three_accepted_and_one_conflict_for_two_orders(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.field import Conflict, DeviceRecord

    version, batch, answers = to_the_sync(client, auth)
    by_id = {r["clientId"]: r for r in answers}
    kinds = [by_id[r["clientId"]]["result"] for r in batch]
    assert kinds == ["accepted", "conflict", "conflict", "accepted", "accepted"]

    hero = [by_id[batch[1]["clientId"]], by_id[batch[2]["clientId"]]]
    cid = hero[0]["conflictId"]
    assert cid is not None and hero[1]["conflictId"] == cid  # one stop, one conflict: "1 conflict (2 orders)"
    assert hero[0]["reason"] == "The goods are at the store, with photo, receiver and units"
    payload = hero[0]["serverPayload"]
    assert payload["conflictId"] == cid and payload["serverVersion"] == version + 1
    assert (payload["changedAt"], payload["changedBy"]) == ("05:21", "Kumari")

    assert statuses(*HERO, "ORD2003") == {"ORD2001": "conflict", "ORD2002": "conflict", "ORD2003": "delivered"}
    with SessionLocal() as db:
        conflicts = list(db.scalars(select(Conflict)))
        rows = {r.order_ids[0]: r for r in db.scalars(select(DeviceRecord).where(DeviceRecord.type == "driver.outcome"))}
    assert len(conflicts) == 1 and conflicts[0].order_ids == list(HERO)
    assert conflicts[0].recommendation.value == "keep_delivery" and conflicts[0].device_snapshot["units"] == "12 + 8"
    # The trip comes from the plan the phone held: the deferral took ORD2001 + ORD2002 off VEH039 in the new version.
    for oid in HERO:
        assert (rows[oid].vehicle_id, rows[oid].trip_no, rows[oid].outlet_id) == ("VEH039", 1, "OUT084")
        assert rows[oid].result.value == "conflict" and rows[oid].conflict_id == cid
    assert (rows["ORD2003"].vehicle_id, rows["ORD2003"].trip_no, rows["ORD2003"].result.value) == ("VEH039", 1, "accepted")


def test_the_conflict_reads_back_on_the_board_the_inbox_and_d7(client, auth, reseed):
    version, batch, answers = to_the_sync(client, auth)
    cid = answers[1]["conflictId"]

    row = board(client, auth)["rows"][0]
    assert row["vehicleId"] == "VEH039" and row["lastHeard"]["time"] == "06:40"
    assert row["lastHeard"]["note"] == "3 synced · 1 conflict" and row["planOnDevice"] == version and row["changePending"] is True
    assert next(s for s in row["stopsDetail"] if s["outletId"] == "OUT084")["status"] == "Conflict"

    inbox = client.get("/api/v1/dispatcher/inbox", headers=auth("dispatcher")).json()["items"]
    assert [i["id"] for i in inbox if i["kind"] == "conflict"] == [f"c{cid}"]

    view = client.get(f"/api/v1/dispatcher/conflicts/{cid}", headers=auth("dispatcher")).json()
    assert [e["time"] for e in view["timeline"]] == ["05:17", "05:21", "05:26", "05:42", "06:40"]
    assert view["driverRecord"]["status"] == "Delivered 05:42" and view["driverRecord"]["photo"] == "POD photo 05:42"
    assert view["driverRecord"]["receivedBy"] == "S. Fernando" and view["driverRecord"]["units"] == "12 + 8"
    assert view["dispatchRecord"]["reached"] == "No: offline since 05:17"
    assert view["recommendation"]["choice"] == "keep_delivery"


def test_keeping_the_delivery_settles_the_synced_conflict(client, auth, reseed):
    """H16: Saad's resolve on a conflict that /sync opened."""
    from app.db import SessionLocal
    from app.models.comms import AuditEvent
    from app.models.enums import AuditType
    from app.models.orders import Deferral, Order

    _, _, answers = to_the_sync(client, auth)
    cid = answers[1]["conflictId"]
    advance(client, auth, "2026-09-29T06:44:00+05:30")
    res = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_delivery"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    assert res.json()["state"] == "resolved" and res.json()["outcome"] == "Delivered"

    assert statuses(*HERO) == {"ORD2001": "delivered", "ORD2002": "delivered"}
    with SessionLocal() as db:
        withdrawn = [d.withdrawn_at for d in db.scalars(select(Deferral).where(Deferral.order_id.in_(HERO)))]
        reruns = list(db.scalars(select(Order).where(Order.deferred_from_order_id.in_(HERO))))
        resolved = list(db.scalars(select(AuditEvent).where(AuditEvent.type == AuditType.CONFLICT_RESOLVED)))
    assert withdrawn and all(withdrawn)  # the deferral is withdrawn
    assert reruns == []  # the Wed re-run is removed
    assert {a.entity_id for a in resolved} >= {*HERO, str(cid)}


# --------------------------------------------------------------------------- replay


def test_replaying_the_same_batch_is_all_duplicate_and_changes_nothing(client, auth, reseed):
    _, batch, first = to_the_sync(client, auth)
    before, status_before = counts(), statuses(*HERO, "ORD2003")
    again = results(sync(client, auth, batch))
    assert [r["result"] for r in again] == ["duplicate"] * len(batch)
    # The phone still learns which conflict its records are in.
    assert [r["conflictId"] for r in again] == [r["conflictId"] for r in first]
    # By the replay the stop's conflict holds both orders, as the second answer of the first sync already said.
    assert again[1]["serverPayload"] == again[2]["serverPayload"] == first[2]["serverPayload"]
    assert first[2]["serverPayload"]["change"].startswith("ORD2001 + ORD2002 deferred")
    assert counts() == before and statuses(*HERO, "ORD2003") == status_before


# --------------------------------------------------------------------------- one bad record


def test_a_bad_record_is_an_error_and_the_rest_of_the_batch_goes_on(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.field import DeviceRecord

    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    good_before = record("driver.arrival", {"date": DAY, "outletId": "OUT087", "at": "05:48"}, "05:48", version)
    bad = record("driver.outcome", {"date": DAY, "outletId": "OUT087", "orderId": "ORD9999", "outcome": "Delivered", "unitsDelivered": 1}, "05:50", version)
    good_after = record(
        "driver.outcome", {"date": DAY, "outletId": "OUT087", "orderId": "ORD2003", "outcome": "Delivered", "unitsDelivered": 9}, "05:58", version
    )
    answers = results(sync(client, auth, [good_before, bad, good_after]))
    assert [r["result"] for r in answers] == ["accepted", "error", "accepted"]
    assert answers[1]["reason"] == "Order ORD9999 was not found"
    assert statuses("ORD2003") == {"ORD2003": "delivered"}
    with SessionLocal() as db:
        kept = db.get(DeviceRecord, uuid.UUID(bad["clientId"]))
        assert kept is not None and kept.result.value == "error" and kept.result_reason == "Order ORD9999 was not found"

    # The phone retries an error: it is processed again, never answered duplicate.
    retried = results(sync(client, auth, [bad]))
    assert retried[0]["result"] == "error"
    fixed = {**bad, "payload": {**bad["payload"], "orderId": "ORD2002", "outletId": "OUT084"}}
    assert results(sync(client, auth, [fixed]))[0]["result"] == "accepted"
    assert statuses("ORD2002") == {"ORD2002": "delivered"}
    with SessionLocal() as db:
        row = db.get(DeviceRecord, uuid.UUID(bad["clientId"]))
        assert row is not None and row.result.value == "accepted" and row.order_ids == ["ORD2002"]
    assert results(sync(client, auth, [fixed]))[0]["result"] == "duplicate"


def test_an_outcome_the_screen_words_is_mapped_to_the_rule(client, auth, reseed):
    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:00:00+05:30")
    closed = record(
        "driver.outcome", {"date": DAY, "outletId": "OUT087", "orderId": "ORD2003", "outcome": "Store closed", "unitsDelivered": 0}, "05:58", version
    )
    nonsense = record(
        "driver.outcome", {"date": DAY, "outletId": "OUT084", "orderId": "ORD2001", "outcome": "Teleported", "unitsDelivered": 0}, "05:59", version
    )
    answers = results(sync(client, auth, [closed, nonsense]))
    assert [r["result"] for r in answers] == ["accepted", "error"]
    assert statuses("ORD2003") == {"ORD2003": "issue"}
    from app.db import SessionLocal
    from app.models.orders import Order

    with SessionLocal() as db:
        order = db.get(Order, "ORD2003")
        assert order is not None and "Store closed" in order.tags
