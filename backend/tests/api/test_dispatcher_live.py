"""D6 and D7 over HTTP: the hero degradation, H11 to H16 (PRD v3 §2, §16 steps 8 to 16).

VEH039 leaves and goes quiet, the dispatcher defers OUT084's stop at the store's request, the phone syncs a delivery it made
without ever hearing of the deferral, and the dispatcher settles the two records. These need the test database (see ``conftest.py``).

The driver, loader and ``/sync`` endpoints are not built yet, so what they write is inserted straight into the tables, in the shape
their endpoints will use: ``runs`` for departures and last-heard, order statuses for the road, ``device_records`` and a ``conflicts``
row produced by ``waypoint_rules.reconcile`` for the sync at the end.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select

from app.config import COLOMBO

LIVE = "/api/v1/dispatcher/live"
KANDY = "?depot=kandy"
HERO = ("ORD2001", "ORD2002")


def at(day: int, hhmm: str) -> datetime:
    h, m = map(int, hhmm.split(":"))
    return datetime(2026, 9, day, h, m, tzinfo=COLOMBO)


def advance(client, auth, to: str) -> None:
    res = client.post("/api/v1/demo/advance", json={"to": to}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text


def place_hero_orders() -> None:
    """Step 1: Anusha's two orders for OUT084, placed before the cutoff (the store's endpoint is not built)."""
    from app.db import SessionLocal
    from app.models.enums import ServerStatus
    from app.models.orders import Order
    from waypoint_rules.vocab import Temp

    with SessionLocal() as db:
        for oid, temp, units, kg, m3 in (("ORD2001", Temp.CHILLED, 12, 70.0, 0.7), ("ORD2002", Temp.AMBIENT, 8, 45.0, 0.6)):
            db.add(
                Order(
                    id=oid, outlet_id="OUT084", service_date=datetime(2026, 9, 29).date(), temp=temp, units=units, weight_kg=kg,
                    volume_m3=m3, status=ServerStatus.ORDERED, tags=[], received_at=at(28, "15:40"), placed_by="store@waypoint.demo",
                    after_cutoff=False, row_version=1,
                )
            )
        db.commit()


def depart_veh039(heard: str = "03:40") -> int:
    """The driver starts the route (what ``/sync`` writes for ``driver.startRoute``): Departed, a run, and last heard."""
    from app.db import SessionLocal
    from app.models.enums import ServerStatus
    from app.models.field import Run
    from app.models.orders import Order
    from app.models.plans import PlanVersion, Trip

    with SessionLocal() as db:
        version = db.scalars(select(PlanVersion).where(PlanVersion.state == "released").order_by(PlanVersion.number.desc())).first()
        trip = db.scalars(select(Trip).where(Trip.plan_version_id == version.id, Trip.vehicle_id == "VEH039")).first()
        trip_orders = list(db.scalars(select(Order).where(Order.id.in_(HERO + ("ORD2003",)))))
        for o in trip_orders:
            o.status = ServerStatus.DEPARTED
        h, m = map(int, heard.split(":"))
        run = Run(vehicle_id="VEH039", trip_id=trip.id, departed_at=at(29, "03:30"), last_heard_at=at(29, heard), plan_version_seen=version.id)
        db.add(run)
        db.commit()
        return run.id


def board(client, auth, extra: str = KANDY) -> dict:
    res = client.get(LIVE + extra, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    return res.json()


def release(client, auth) -> None:
    advance(client, auth, "2026-09-28T15:41:00+05:30")
    place_hero_orders()
    advance(client, auth, "2026-09-28T23:40:00+05:30")
    res = client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text


def defer_hero(client, auth, kind: str = "store_request"):
    return client.post(
        "/api/v1/dispatcher/stops/defer",
        json={"orderIds": list(HERO), "kind": kind, "reason": "Receiving staff unavailable today"},
        headers=auth("dispatcher"),
    )


def sync_the_delivery(units_received: dict[str, int] | None = None) -> int:
    """H15: the phone is back in coverage and syncs a delivery made on v3. Writes what ``/sync`` writes: records, conflict, statuses."""
    from app.db import SessionLocal
    from app.models.enums import (
        ConflictRecommendation,
        ConflictStatus,
        DeviceRecordType,
        ServerStatus,
        SyncResultKind,
    )
    from app.models.field import Conflict, DeviceRecord, Run
    from app.models.orders import Order
    from app.models.plans import PlanVersion
    from waypoint_rules import DeviceRecord as RuleRecord
    from waypoint_rules import OrderStatus, Outcome, RecordType, ServerOrderState, SyncResult, reconcile

    with SessionLocal() as db:
        latest = db.scalars(select(PlanVersion).order_by(PlanVersion.number.desc())).first()
        ruling = reconcile(
            ServerOrderState("ORD2001", OrderStatus.DEFERRED, changed_in_version=latest.number),
            RuleRecord(RecordType.DRIVER_OUTCOME, latest.number - 1, Outcome.DELIVERED, has_photo=True, has_receiver=True),
        )
        assert ruling.result is SyncResult.CONFLICT and ruling.recommendation is not None
        synced_at = at(29, "06:40")
        conflict = Conflict(
            order_ids=list(HERO),
            device_record_ids=[],
            server_snapshot={"status": "deferred", "planVersion": latest.number, "type": "store_request", "decidedAt": at(29, "05:21").isoformat(),
                             "decidedBy": "Kumari", "reason": "Receiving staff unavailable today", "reachedDriver": False},
            device_snapshot={"vehicleId": "VEH039", "outcome": "delivered", "deviceTime": at(29, "05:42").isoformat(), "receivedBy": "S. Fernando (night staff)",
                             "units": "12 + 8", "photo": True, "planVersionOnDevice": latest.number - 1, "arrivedAt": at(29, "05:26").isoformat(),
                             "offlineSince": at(29, "05:17").isoformat(), "syncedAt": synced_at.isoformat()},
            recommendation=ConflictRecommendation(ruling.recommendation.value),
            reasons=list(ruling.reasons),
            status=ConflictStatus.OPEN,
        )
        db.add(conflict)
        db.flush()
        for oid in HERO:
            db.add(
                DeviceRecord(
                    client_id=uuid.uuid4(), device_id="phone-veh039", actor="Nimal", type=DeviceRecordType.DRIVER_OUTCOME, order_ids=[oid],
                    outlet_id="OUT084", vehicle_id="VEH039", trip_no=1, payload={"outcome": "delivered", "receivedBy": "S. Fernando"},
                    device_time=at(29, "05:42"), plan_version_on_device=latest.number - 1, received_at=synced_at,
                    result=SyncResultKind.CONFLICT, result_reason=ruling.reasons[0], conflict_id=conflict.id,
                )
            )
        db.add(
            DeviceRecord(
                client_id=uuid.uuid4(), device_id="phone-veh039", actor="Nimal", type=DeviceRecordType.DRIVER_OUTCOME, order_ids=["ORD2003"],
                outlet_id="OUT087", vehicle_id="VEH039", trip_no=1, payload={"outcome": "delivered"}, device_time=at(29, "05:58"),
                plan_version_on_device=latest.number - 1, received_at=synced_at, result=SyncResultKind.ACCEPTED,
            )
        )
        for o in db.scalars(select(Order).where(Order.id.in_(HERO))):
            o.status = ServerStatus.CONFLICT
        for o in db.scalars(select(Order).where(Order.id == "ORD2003")):
            o.status = ServerStatus.DELIVERED
        run = db.scalars(select(Run).where(Run.vehicle_id == "VEH039")).first()
        run.last_heard_at = synced_at
        run.plan_version_seen = latest.id
        db.commit()
        return conflict.id


def add_store_report(conflict_id: int, received: int, ordered: int = 12) -> None:
    from app.db import SessionLocal
    from app.models.field import Conflict

    with SessionLocal() as db:
        c = db.get(Conflict, conflict_id)
        c.server_snapshot = {**c.server_snapshot, "storeReport": {"orderId": "ORD2001", "unitsReceived": received, "unitsOrdered": ordered, "by": "Anusha", "at": at(29, "07:04").isoformat()}}
        db.commit()


# --------------------------------------------------------------------------- H12: the board


def test_the_board_shows_a_silent_phone_as_unknown_offline(client, auth, reseed):
    release(client, auth)
    depart_veh039("03:40")
    advance(client, auth, "2026-09-29T03:41:00+05:30")
    assert board(client, auth)["rows"][0]["risk"] == "On time"
    advance(client, auth, "2026-09-29T03:46:00+05:30")
    row = board(client, auth)["rows"][0]
    assert row["vehicleId"] == "VEH039" and row["status"] == "Departed" and row["risk"] == "Unknown · offline"
    assert row["lastHeard"]["time"] == "03:40" and row["lastHeard"]["age"] == "6 min · known gap"
    assert row["planOnDevice"] >= 3 and row["changePending"] is False


def test_the_board_scopes_by_depot(client, auth, reseed):
    release(client, auth)
    depart_veh039()
    both = board(client, auth, "")
    kandy = board(client, auth, KANDY)
    peliyagoda = board(client, auth, "?depot=peliyagoda")
    assert {r["vehicleId"] for r in kandy["rows"]} == {"VEH039"} and "VEH039" not in {r["vehicleId"] for r in peliyagoda["rows"]}
    assert both["depot"] == "both" and kandy["depot"] == "kandy"
    assert both["stats"]["departed"]["value"] >= 1


# --------------------------------------------------------------------------- H12 to H13: defer the stop


def test_deferring_the_stop_releases_the_next_version_and_tells_everyone(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.comms import Notice
    from app.models.orders import Deferral, Order

    release(client, auth)
    depart_veh039("03:40")
    advance(client, auth, "2026-09-29T03:46:00+05:30")
    before = client.get("/api/v1/dispatcher/plan?depot=kandy", headers=auth("dispatcher")).json()["version"]["number"]
    res = defer_hero(client, auth)
    assert res.status_code == 200, res.text
    assert res.json() == {"plan": before + 1, "deferred": list(HERO)}

    plan = client.get("/api/v1/dispatcher/plan?depot=kandy", headers=auth("dispatcher")).json()
    assert plan["version"]["number"] == before + 1 and plan["version"]["state"] == "released"
    assert plan["version"]["note"] == "ORD2001 + ORD2002 deferred (store request); VEH039 driver offline since 03:40"
    cards = client.get("/api/v1/dispatcher/deferrals?depot=kandy", headers=auth("dispatcher")).json()
    assert cards["counts"]["storeRequest"] == 2 and cards["counts"]["capacity"] == 0 and cards["counts"]["policy"] == 0
    assert cards["storeRequest"][0]["kind"] == "store_request" and cards["storeRequest"][0]["binding"] == "none: store asked"

    with SessionLocal() as db:
        statuses = {o.id: o.status.value for o in db.scalars(select(Order).where(Order.id.in_(HERO)))}
        copies = {o.id for o in db.scalars(select(Order).where(Order.deferred_from_order_id.in_(HERO)))}
        audiences = {(n.audience, n.tag.value) for n in db.scalars(select(Notice))}
        sent = [d.notice_sent_at is not None for d in db.scalars(select(Deferral).where(Deferral.order_id.in_(HERO), Deferral.plan_version_id.is_not(None)).order_by(Deferral.id.desc()).limit(2))]
    assert set(statuses.values()) == {"deferred"} and copies == {"ORD2001-R", "ORD2002-R"}
    assert ("driver:VEH039", "Change") in audiences and ("store:OUT084", "Deferral") in audiences and ("dock:kandy", "Change") in audiences
    assert all(sent)


def test_the_board_marks_the_change_the_phone_has_not_received(client, auth, reseed):
    release(client, auth)
    depart_veh039("03:40")
    advance(client, auth, "2026-09-29T03:46:00+05:30")
    defer_hero(client, auth)
    view = board(client, auth)
    row = view["rows"][0]
    assert row["changePending"] is True and row["risk"] == "Unknown · offline"
    hero = next(s for s in row["stopsDetail"] if s["outletId"] == "OUT084")
    assert hero["status"] == "Change pending" and hero["change"].startswith("Deferred · store request") and hero["canDefer"] is False
    pending = next(d for d in view["decisions"] if d["id"] == "pending")
    assert pending["infoOnly"] and "hasn't received v" in pending["title"]
    assert "VEH039 records pending sync" in view["stats"]["delivered"]["foot"]


def test_a_stop_cannot_be_deferred_twice_or_before_release_or_for_capacity(client, auth, reseed):
    advance(client, auth, "2026-09-28T15:41:00+05:30")
    place_hero_orders()
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    early = defer_hero(client, auth)
    assert early.status_code == 409 and early.json()["code"] == "not_released"

    advance(client, auth, "2026-09-28T23:40:00+05:30")
    client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher"))
    assert defer_hero(client, auth, "capacity").json()["code"] == "not_capacity"
    assert defer_hero(client, auth).status_code == 200
    again = defer_hero(client, auth)
    assert again.status_code == 409 and again.json()["code"] == "already_deferred"


def test_a_delivered_stop_cannot_be_deferred(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.enums import ServerStatus
    from app.models.orders import Order

    release(client, auth)
    with SessionLocal() as db:
        for o in db.scalars(select(Order).where(Order.id.in_(HERO))):
            o.status = ServerStatus.DELIVERED
        db.commit()
    res = defer_hero(client, auth)
    assert res.status_code == 409 and res.json()["code"] == "already_done"


def test_a_protected_outlet_cannot_be_deferred_for_policy(client, auth, reseed):
    release(client, auth)
    res = client.post(
        "/api/v1/dispatcher/stops/defer", json={"orderIds": ["ORD1001"], "kind": "policy", "reason": "Out of room"}, headers=auth("dispatcher")
    )
    assert res.status_code == 409 and res.json()["code"] == "illegal_move"
    assert res.json()["details"][0]["rule"] == "R-CONT"


# --------------------------------------------------------------------------- H15 to H16: the conflict


def conflict_after_the_sync(client, auth) -> int:
    release(client, auth)
    depart_veh039("03:40")
    advance(client, auth, "2026-09-29T03:46:00+05:30")
    assert defer_hero(client, auth).status_code == 200
    advance(client, auth, "2026-09-29T06:41:00+05:30")
    return sync_the_delivery()


def test_the_synced_delivery_opens_a_conflict_in_the_inbox_and_on_the_board(client, auth, reseed):
    cid = conflict_after_the_sync(client, auth)
    inbox = client.get("/api/v1/dispatcher/inbox", headers=auth("dispatcher")).json()["items"]
    item = next(i for i in inbox if i["kind"] == "conflict")
    assert item["id"] == f"c{cid}" and item["title"] == "OUT084 · ORD2001 + ORD2002: needs a decision" and item["chip"] == "Conflict"
    assert item["action"]["to"] == f"/dispatcher/conflicts/{cid}?depot=kandy" and item["at"] == "06:40"
    view = board(client, auth)
    assert view["stats"]["issues"] == {"value": 1, "foot": "1 conflict needs a decision", "bad": True}
    row = view["rows"][0]
    assert row["stops"] == {"done": 2, "total": 2} and row["lastHeard"]["note"] == "1 synced · 1 conflict" and row["lastHeard"]["synced"] is True
    assert next(s for s in row["stopsDetail"] if s["outletId"] == "OUT084")["status"] == "Conflict"


def test_the_conflict_screen_shows_both_records_and_recommends_keeping_the_delivery(client, auth, reseed):
    cid = conflict_after_the_sync(client, auth)
    res = client.get(f"/api/v1/dispatcher/conflicts/{cid}", headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    view = res.json()
    assert (view["outletId"], view["district"], view["state"]) == ("OUT084", "Kandy", "needs decision")
    assert [e["time"] for e in view["timeline"]] == ["05:17", "05:21", "05:26", "05:42", "06:40"]
    assert view["driverRecord"]["status"] == "Delivered 05:42" and view["driverRecord"]["photo"] == "POD photo 05:42"
    assert view["dispatchRecord"]["status"].startswith("Deferred · store request → ") and view["dispatchRecord"]["reached"] == "No: offline since 05:17"
    assert view["recommendation"]["choice"] == "keep_delivery" and view["recommendation"]["title"] == "Recommended: Keep delivery"
    assert view["recommendation"]["reasons"][0] == "The goods are at the store, with photo, receiver and units"
    assert client.get("/api/v1/dispatcher/conflicts/999999", headers=auth("dispatcher")).status_code == 404


def test_asking_the_store_waits_for_its_answer(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.comms import Notice

    cid = conflict_after_the_sync(client, auth)
    res = client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    view = res.json()
    assert view["state"] == "awaiting store" and view["recommendation"]["pausedNote"] == "Paused until the store answers"
    assert view["asked"]["text"] == "Asked OUT084 at 06:41: 'Did you receive this delivery?'"
    with SessionLocal() as db:
        asked = [n for n in db.scalars(select(Notice).where(Notice.audience == "store:OUT084")) if n.title == "Did you receive this delivery?"]
    assert len(asked) == 1 and asked[0].tag.value == "Review"
    again = client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher"))
    assert again.status_code == 200
    with SessionLocal() as db:
        assert len([n for n in db.scalars(select(Notice).where(Notice.audience == "store:OUT084")) if n.title == "Did you receive this delivery?"]) == 1


def test_keeping_the_delivery_withdraws_the_deferral_and_removes_the_re_run(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.comms import AuditEvent, Notice
    from app.models.enums import AuditType
    from app.models.orders import Deferral, Order, OutletServiceHistory

    cid = conflict_after_the_sync(client, auth)
    plans_before = client.get("/api/v1/dispatcher/plan?depot=kandy", headers=auth("dispatcher")).json()["version"]["number"]
    res = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_delivery"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    view = res.json()
    assert view["state"] == "resolved" and view["outcome"] == "Delivered"
    assert view["resolved"]["title"].startswith("Resolved by Kumari ") and view["resolved"]["title"].endswith("kept delivery.")
    assert view["resolved"]["toast"] == "Conflict resolved. Driver and store told."

    with SessionLocal() as db:
        statuses = {o.id: o.status.value for o in db.scalars(select(Order).where(Order.id.in_(HERO)))}
        copies = list(db.scalars(select(Order).where(Order.deferred_from_order_id.in_(HERO))))
        withdrawn = [d.withdrawn_at is not None for d in db.scalars(select(Deferral).where(Deferral.order_id.in_(HERO)))]
        notices = {(n.audience, n.tag.value) for n in db.scalars(select(Notice))}
        audits = list(db.scalars(select(AuditEvent).where(AuditEvent.type == AuditType.CONFLICT_RESOLVED)))
        history = db.get(OutletServiceHistory, ("OUT084", datetime(2026, 9, 29).date()))
    assert set(statuses.values()) == {"delivered"} and copies == []  # the Wed re-run is removed
    assert withdrawn and all(withdrawn)
    assert ("driver:VEH039", "Review") in notices and ("store:OUT084", "Delivery") in notices and ("dock:kandy", "Plan") in notices
    assert history.outcome.value == "served"
    assert len(audits) >= 3  # both orders and the conflict itself
    after = client.get("/api/v1/dispatcher/plan?depot=kandy", headers=auth("dispatcher")).json()["version"]["number"]
    assert after == plans_before  # A16: a decision on the records, not a new plan version
    counts = client.get("/api/v1/dispatcher/deferrals?depot=kandy", headers=auth("dispatcher")).json()["counts"]
    assert counts["storeRequest"] == 0


def test_replaying_the_resolution_changes_nothing_but_a_different_one_is_refused(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.comms import Notice

    cid = conflict_after_the_sync(client, auth)
    first = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_delivery"}, headers=auth("dispatcher"))
    with SessionLocal() as db:
        n = len(list(db.scalars(select(Notice))))
    again = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_delivery"}, headers=auth("dispatcher"))
    assert again.status_code == 200 and again.json()["resolved"] == first.json()["resolved"]
    with SessionLocal() as db:
        assert len(list(db.scalars(select(Notice)))) == n
    other = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_deferral"}, headers=auth("dispatcher"))
    assert other.status_code == 409 and other.json()["code"] == "already_resolved"
    assert client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher")).json()["code"] == "not_open"


def test_a_partial_needs_the_stores_shortage_report(client, auth, reseed):
    cid = conflict_after_the_sync(client, auth)
    res = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_partial"}, headers=auth("dispatcher"))
    assert res.status_code == 409 and res.json()["code"] == "no_shortage"


def test_a_short_delivery_is_kept_as_a_partial_with_a_follow_up(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.orders import Order

    cid = conflict_after_the_sync(client, auth)
    client.post(f"/api/v1/dispatcher/conflicts/{cid}/ask-store", headers=auth("dispatcher"))
    add_store_report(cid, received=10)
    shown = client.get(f"/api/v1/dispatcher/conflicts/{cid}", headers=auth("dispatcher")).json()
    assert shown["state"] == "store reported an issue" and shown["recommendation"]["choice"] == "keep_partial"
    assert shown["recommendation"]["title"] == "Recommended: Keep delivery as Partial (10 / 12)"

    res = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_partial"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    assert res.json()["outcome"] == "Partial" and "kept as Partial (10 / 12)" in res.json()["resolved"]["title"]
    with SessionLocal() as db:
        statuses = {o.id: o.status.value for o in db.scalars(select(Order).where(Order.id.in_(HERO)))}
        follow_up = db.get(Order, "ORD2001-F")
        copies = list(db.scalars(select(Order).where(Order.deferred_from_order_id.in_(HERO))))
    assert statuses == {"ORD2001": "partial", "ORD2002": "delivered"}
    assert follow_up is not None and follow_up.units == 2 and follow_up.status.value == "confirmed" and "Follow-up created" in follow_up.tags
    assert copies == []


def test_keeping_the_deferral_returns_the_orders_to_deferred(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.orders import Order

    cid = conflict_after_the_sync(client, auth)
    res = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_deferral"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    assert res.json()["state"] == "resolved" and res.json()["outcome"] is None
    assert res.json()["resolved"]["title"].endswith("kept the deferral.")
    with SessionLocal() as db:
        assert {o.status.value for o in db.scalars(select(Order).where(Order.id.in_(HERO)))} == {"deferred"}
        assert len(list(db.scalars(select(Order).where(Order.deferred_from_order_id.in_(HERO))))) == 2  # the re-run stands


def test_the_settled_stop_is_delivered_on_the_board_with_its_tooltip(client, auth, reseed):
    cid = conflict_after_the_sync(client, auth)
    client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_delivery"}, headers=auth("dispatcher"))
    view = board(client, auth)
    hero = next(s for s in view["rows"][0]["stopsDetail"] if s["outletId"] == "OUT084")
    assert hero["status"] == "Delivered" and hero["tooltip"].startswith("Resolved by Kumari ") and "kept delivery" in hero["tooltip"]
    assert view["stats"]["issues"]["value"] == 0 and view["stats"]["issues"]["foot"].startswith("Resolved ")
    assert not [i for i in client.get("/api/v1/dispatcher/inbox", headers=auth("dispatcher")).json()["items"] if i["kind"] == "conflict"]


# --------------------------------------------------------------------------- who may call


def test_the_live_and_conflict_endpoints_are_dispatcher_only(client, auth):
    for role in ("store", "loader", "driver"):
        for method, path in (("GET", LIVE), ("GET", "/api/v1/dispatcher/inbox"), ("GET", "/api/v1/dispatcher/conflicts/1")):
            assert client.request(method, path, headers=auth(role)).status_code == 403, (role, path)
