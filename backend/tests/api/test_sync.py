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

from app.config import COLOMBO, get_settings

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
    from app.models.plans import Trip

    with SessionLocal() as db:
        conflicts = list(db.scalars(select(Conflict)))
        rows = {r.order_ids[0]: r for r in db.scalars(select(DeviceRecord).where(DeviceRecord.type == "driver.outcome"))}
        trip_nos = {t.id: t.trip_no for t in db.scalars(select(Trip))}
    assert len(conflicts) == 1 and conflicts[0].order_ids == list(HERO)
    assert conflicts[0].recommendation.value == "keep_delivery" and conflicts[0].device_snapshot["units"] == "12 + 8"
    # The trip comes from the plan the phone held: the deferral took ORD2001 + ORD2002 off VEH039 in the new version.
    for oid in HERO:
        assert (rows[oid].vehicle_id, trip_nos[rows[oid].trip_id], rows[oid].outlet_id) == ("VEH039", 1, "OUT084")
        assert rows[oid].result.value == "conflict" and rows[oid].conflict_id == cid
    assert (rows["ORD2003"].vehicle_id, trip_nos[rows["ORD2003"].trip_id], rows["ORD2003"].result.value) == ("VEH039", 1, "accepted")


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


# --------------------------------------------------------------------------- attachments

PHOTO = b"\xff\xd8\xff\xe0" + b"waypoint-pod" * 32 + b"\xff\xd9"


def upload(client, auth, blob_id: str, body: bytes = PHOTO, role: str = "driver"):
    return client.post(
        "/api/v1/attachments",
        data={"clientId": blob_id, "kind": "photo"},
        files={"file": ("photo.jpg", body, "image/jpeg")},
        headers=auth(role),
    )


def test_an_attachment_uploaded_twice_is_one_row_and_one_file(client, auth, reseed, tmp_path, monkeypatch):
    from app.db import SessionLocal
    from app.models.field import Attachment

    monkeypatch.setattr(get_settings(), "uploads_dir", tmp_path)
    blob_id = str(uuid.uuid4())
    first = upload(client, auth, blob_id)
    assert first.status_code == 201, first.text
    assert first.json() == {"id": blob_id, "kind": "photo", "mime": "image/jpeg", "bytes": len(PHOTO), "duplicate": False}
    again = upload(client, auth, blob_id, body=b"a different body the server must not take")
    assert again.status_code == 201 and again.json()["duplicate"] is True and again.json()["bytes"] == len(PHOTO)

    with SessionLocal() as db:
        rows = list(db.scalars(select(Attachment).where(Attachment.id == uuid.UUID(blob_id))))
    assert len(rows) == 1
    files = [p for p in tmp_path.iterdir()]
    assert [p.name for p in files] == [f"{blob_id}.jpg"] and files[0].read_bytes() == PHOTO


def test_a_photo_is_tied_to_its_record_whichever_arrives_first(client, auth, reseed, tmp_path, monkeypatch):
    from app.db import SessionLocal
    from app.models.field import Attachment

    monkeypatch.setattr(get_settings(), "uploads_dir", tmp_path)
    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:00:00+05:30")
    after, before = str(uuid.uuid4()), str(uuid.uuid4())

    # The usual order: the record, then its photo.
    outcome = record(
        "driver.outcome", {"date": DAY, "outletId": "OUT087", "orderId": "ORD2003", "outcome": "Delivered", "unitsDelivered": 9,
                           "receiverName": "M. Perera", "photoBlobId": after}, "05:58", version,
    )
    outcome["blobIds"] = [after]
    synced = results(sync(client, auth, [outcome]))[0]
    assert synced["result"] == "accepted", synced
    assert upload(client, auth, after).status_code == 201

    # A photo that arrives first waits unlinked, and is tied when its record is synced.
    assert upload(client, auth, before).status_code == 201
    arrival = record("driver.arrival", {"date": DAY, "outletId": "OUT084", "at": "05:26"}, "05:26", version)
    arrival["blobIds"] = [before]
    with SessionLocal() as db:
        assert db.get(Attachment, uuid.UUID(before)).device_record_id is None
    linked = results(sync(client, auth, [arrival]))[0]
    assert linked["result"] == "accepted", linked

    with SessionLocal() as db:
        assert str(db.get(Attachment, uuid.UUID(after)).device_record_id) == outcome["clientId"]
        assert str(db.get(Attachment, uuid.UUID(before)).device_record_id) == arrival["clientId"]


def test_an_empty_attachment_is_refused_and_leaves_no_file(client, auth, tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "uploads_dir", tmp_path)
    res = upload(client, auth, str(uuid.uuid4()), body=b"")
    assert res.status_code == 422 and res.json()["code"] == "empty_file"
    assert list(tmp_path.iterdir()) == []


# --------------------------------------------------------------------------- the dock's acknowledgement


def test_a_loader_ack_of_an_old_version_is_a_conflict_and_the_current_one_is_taken(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.field import Conflict
    from app.models.plans import Acknowledgement

    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T05:21:00+05:30")
    assert defer_hero(client, auth).status_code == 200
    ack = {"dockId": "kandy", "personId": "Ruwan", "personName": "Ruwan"}
    old = record("loader.ack", {**ack, "version": version}, "05:30", version, actor="Ruwan")
    new = record("loader.ack", {**ack, "version": version + 1}, "05:31", version + 1, actor="Ruwan")
    answers = results(sync(client, auth, [old, new], role="loader", device="tablet-kandy"))

    assert [r["result"] for r in answers] == ["conflict", "accepted"]
    assert answers[0]["reason"] == f"Plan v{version + 1} replaced v{version}" and answers[0]["conflictId"] is None
    assert answers[0]["serverPayload"] == {"currentVersion": version + 1}
    with SessionLocal() as db:
        assert db.scalars(select(Conflict)).first() is None  # the dock reviews the change itself (L1.5); nothing for D7
        acks = [(a.actor_kind.value, a.depot_id) for a in db.scalars(select(Acknowledgement).where(Acknowledgement.pin_person_id == 2))]
    assert acks == [("pin_person", "kandy")]


# --------------------------------------------------------------------------- who may send what


def test_sync_and_attachments_are_for_the_field_roles_only(client, auth):
    body = {"deviceId": "x", "records": [record("driver.arrival", {"date": DAY, "outletId": "OUT084"}, "05:26", 3)]}
    for role in ("store", "dispatcher"):
        assert client.post(SYNC, json=body, headers=auth(role)).status_code == 403
        res = client.post(
            "/api/v1/attachments", data={"clientId": str(uuid.uuid4())}, files={"file": ("p.jpg", PHOTO, "image/jpeg")}, headers=auth(role)
        )
        assert res.status_code == 403
    assert client.post(SYNC, json=body).status_code == 401


def test_a_phone_cannot_write_for_another_vehicle_or_role(client, auth, reseed):
    version = on_the_road(client, auth)
    other_vehicle = record("driver.arrival", {"date": DAY, "outletId": "OUT084", "vehicleId": "VEH003"}, "05:26", version)
    mine = record("driver.arrival", {"date": DAY, "outletId": "OUT084"}, "05:27", version)
    answers = results(sync(client, auth, [other_vehicle, mine]))
    assert [r["result"] for r in answers] == ["error", "accepted"]
    assert answers[0]["reason"] == "That vehicle isn't linked to your account"

    from_the_tablet = results(sync(client, auth, [record("driver.arrival", {"date": DAY, "outletId": "OUT084"}, "05:28", version)], role="loader"))
    assert from_the_tablet[0]["result"] == "error" and from_the_tablet[0]["reason"] == "Driver records come from a driver's phone"


# --------------------------------------------------------------------------- what the store is told


def test_the_store_hears_under_review_and_never_conflict(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.comms import Notice

    _, _, answers = to_the_sync(client, auth)
    with SessionLocal() as db:
        review = [n for n in db.scalars(select(Notice).where(Notice.outlet_id == "OUT084")) if n.tag.value == "Review"]
    assert [n.title for n in review] == ["Your delivery is under review"]
    assert review[0].refs["orderIds"] == list(HERO) and review[0].refs["conflictId"] == answers[1]["conflictId"]

    advance(client, auth, "2026-09-29T06:44:00+05:30")
    res = client.post(f"/api/v1/dispatcher/conflicts/{answers[1]['conflictId']}/resolve", json={"resolution": "keep_delivery"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    with SessionLocal() as db:
        told = [f"{n.title} {n.body}" for n in db.scalars(select(Notice).where(Notice.audience_kind == "store"))]
    assert told and not [t for t in told if "conflict" in t.lower()]


# --------------------------------------------------------------------------- R6 problems and R9 finish, as the phone sends them


def test_a_problem_thread_and_the_run_finish_land_as_the_phone_sends_them(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.field import DeviceRecord, FieldException, Run

    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:45:00+05:30")
    first = record(
        "driver.problem",
        {"date": DAY, "type": "Can't reach the store", "stopId": "OUT087", "outletId": "OUT087", "orderIds": ["ORD2003"], "note": "Gate locked", "blobIds": []},
        "05:50", version,
    )
    update = record(
        "driver.problem",
        {"date": DAY, "type": "Can't reach the store", "stopId": "OUT087", "outletId": "OUT087", "orderIds": ["ORD2003"], "note": "Gate open now",
         "blobIds": [], "updatesClientId": first["clientId"]},
        "06:05", version,
    )
    finish = record("driver.finishRun", {"date": DAY, "at": "06:45", "gpsKm": 19.4, "gpsGapFilledKm": 0, "fuelLEst": 3.9}, "06:45", version)
    assert [r["result"] for r in results(sync(client, auth, [first, update, finish]))] == ["accepted"] * 3

    with SessionLocal() as db:
        problems = list(db.scalars(select(FieldException).where(FieldException.kind == "driver_problem").order_by(FieldException.id)))
        assert [(p.type, p.detail, list(p.order_ids)) for p in problems] == [
            ("Can't reach the store", "Gate locked", ["ORD2003"]),
            ("Can't reach the store", "Gate open now", ["ORD2003"]),
        ]
        # No schema change for threads (V40): the update keeps its parent in the device record.
        kept = db.get(DeviceRecord, uuid.UUID(update["clientId"]))
        assert kept is not None and kept.payload["updatesClientId"] == first["clientId"]
        run = db.scalars(select(Run)).first()
        assert run is not None and run.finished_at is not None
        assert (run.gps_km, run.gps_gap_filled_km, run.fuel_l_est) == (19.4, 0.0, 3.9)
