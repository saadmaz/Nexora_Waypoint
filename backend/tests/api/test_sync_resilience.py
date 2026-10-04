"""``POST /sync`` when many phones come back at once (PRD v3 section 15 Offline).

A phone that was offline for the whole run reconnects with a long backlog; the same phone open in two tabs sends the same
records at the same moment; several phones sync together. Nothing may be lost, counted twice or answered with a 500.
These need the test database (``conftest.py``).
"""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import func, select

from .test_dispatcher_live import advance
from .test_sync import DAY, hero_batch, on_the_road, record, results, sync


def _count(model) -> int:
    from app.db import SessionLocal

    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(model)) or 0


def test_the_same_batch_sent_by_two_tabs_at_once_is_taken_once(client, auth, reseed):
    from app.models.field import DeviceRecord

    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    before = _count(DeviceRecord)
    batch = hero_batch(version)
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(lambda _: sync(client, auth, batch), range(4)))

    # Every request is answered (no 500), and every record is taken exactly once across them.
    assert [r.status_code for r in responses] == [200] * 4, [r.text for r in responses if r.status_code != 200]
    answers = [r.json()["results"] for r in responses]
    for i, rec in enumerate(batch):
        kinds = sorted(a[i]["result"] for a in answers)
        assert kinds.count("duplicate") >= 3, (rec["type"], kinds)
        assert set(kinds) <= {"accepted", "conflict", "duplicate"}, kinds
    assert _count(DeviceRecord) == before + len(batch)
    # The racing requests never overwrote the stored answer with an error.
    from app.db import SessionLocal

    with SessionLocal() as db:
        stored = {str(r.client_id): r.result.value for r in db.scalars(select(DeviceRecord).where(DeviceRecord.client_id.in_([uuid.UUID(x["clientId"]) for x in batch])))}
    assert len(stored) == len(batch) and "error" not in stored.values()


def test_a_failed_record_retried_by_two_tabs_at_once_is_applied_once(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.comms import AuditEvent
    from app.models.enums import AuditType

    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    bad = record("driver.outcome", {"date": DAY, "outletId": "OUT087", "orderId": "ORD9999", "outcome": "Delivered", "unitsDelivered": 9}, "05:58", version)
    assert results(sync(client, auth, [bad]))[0]["result"] == "error"
    fixed = {**bad, "payload": {**bad["payload"], "orderId": "ORD2003"}}
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(lambda _: sync(client, auth, [fixed]), range(4)))
    assert [r.status_code for r in responses] == [200] * 4
    assert sorted(results(r)[0]["result"] for r in responses) == ["accepted", "duplicate", "duplicate", "duplicate"]
    with SessionLocal() as db:
        delivered = db.scalar(
            select(func.count()).select_from(AuditEvent).where(AuditEvent.entity_id == "ORD2003", AuditEvent.type == AuditType.OUTCOME_RECORDED)
        )
    assert delivered == 1  # applied once, not once per tab


def test_a_phone_back_after_a_long_gap_sends_its_whole_backlog_in_one_batch(client, auth, reseed):
    from app.models.field import DeviceRecord

    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    before = _count(DeviceRecord)
    # A whole run's worth of arrivals recorded offline, repeated: 150 records in one request.
    backlog = [record("driver.arrival", {"date": DAY, "outletId": "OUT084" if i % 2 else "OUT087"}, "05:30", version) for i in range(150)]
    answers = results(sync(client, auth, backlog))
    assert [a["result"] for a in answers] == ["accepted"] * 150
    assert _count(DeviceRecord) == before + 150
    # And sent again (the phone did not hear the answer): nothing new.
    assert {a["result"] for a in results(sync(client, auth, backlog))} == {"duplicate"}
    assert _count(DeviceRecord) == before + 150


def test_the_dock_tablet_and_the_phone_syncing_together_both_land(client, auth, reseed):
    from app.models.field import DeviceRecord

    version = on_the_road(client, auth)
    advance(client, auth, "2026-09-29T06:40:00+05:30")
    before = _count(DeviceRecord)
    phone = [record("driver.arrival", {"date": DAY, "outletId": "OUT087"}, "05:48", version)]
    tablet = [
        record("loader.check", {"vehicleId": "VEH039", "trip": 1, "orderId": "ORD2003", "unitsLoaded": 9, "personId": "Ruwan"}, "04:40", None, actor="Ruwan"),
    ]
    with ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(sync, client, auth, phone)
        b = pool.submit(lambda: sync(client, auth, tablet, role="loader", device="tablet-kandy"))
        ra, rb = a.result(), b.result()
    assert (ra.status_code, rb.status_code) == (200, 200), (ra.text, rb.text)
    assert results(ra)[0]["result"] == "accepted" and results(rb)[0]["result"] == "accepted"
    assert _count(DeviceRecord) == before + 2


def test_an_unknown_record_type_is_refused_by_the_contract_and_changes_nothing(client, auth, reseed):
    from app.models.field import DeviceRecord

    before = _count(DeviceRecord)
    res = client.post(
        "/api/v1/sync",
        json={"deviceId": "p", "records": [{"clientId": str(uuid.uuid4()), "type": "driver.teleport", "payload": {}, "deviceTime": "2026-09-29T05:00:00+05:30"}]},
        headers=auth("driver"),
    )
    assert res.status_code == 422 and res.json()["code"] == "validation_error"
    assert _count(DeviceRecord) == before
