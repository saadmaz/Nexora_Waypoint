"""D8 over HTTP: Priya flags VEH003 at 02:55, the dispatcher reviews the swap and decides it (PRD v3 §16 steps 11 and 12).

These need the test database (see ``conftest.py``). The loader's flag is written by ``/loader`` and ``/sync``, which are not
built yet, so the exception row is inserted straight into the table, as those endpoints will write it. The PRD's own D8
figures (VEH036 at 950 / 1,040 kg in 109 minutes) are checked on the hand-made v3 plan in ``test_exception_logic.py``; here the
plan is the planner's, so the checks are the rules' (every trip legal, the protected outlet kept) and the ledger of what changed.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select

from app.config import COLOMBO

EXC = "/api/v1/dispatcher/exceptions"


def advance(client, auth, to: str) -> None:
    res = client.post("/api/v1/demo/advance", json={"to": to}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text


def release(client, auth) -> dict:
    advance(client, auth, "2026-09-28T23:40:00+05:30")
    # D8 is a prescribed swap on the documented v3 trips, not a constraint on the generic
    # current-order allocator. Persist that canonical fixture through the real write validator.
    from app.db import SessionLocal
    from app.models.enums import AuditType
    from app.services import planning
    from app.services import planning_repo as repo
    from tests.rules.conftest import plan_v3
    from waypoint_rules import classify_deferral, frees, impact_on_store

    with SessionLocal() as db:
        now = datetime(2026, 9, 28, 23, 40)
        day = repo.load_day(db, datetime(2026, 9, 29).date(), now)
        canonical = plan_v3()
        for trip in canonical.trips.values():
            trip.order_ids = [oid for oid in trip.order_ids if oid in day.orders]
        canonical.deferred = [oid for oid in canonical.deferred if oid in day.orders]
        represented = {oid for trip in canonical.trips.values() for oid in trip.order_ids} | set(canonical.deferred)
        canonical.deferred.extend(sorted(set(day.orders) - represented))
        specs = []
        for oid in canonical.deferred:
            order = day.orders[oid]
            impact, freed = impact_on_store(order, day.ref), frees(order, day.ref)
            specs.append(planning.DeferralSpec(
                oid, classify_deferral(order, day.ref), None, "Reference v3 constraint",
                {"deferred_yesterday": impact.deferred_yesterday, "days_since_served": impact.days_since_served, "consequence": impact.consequence},
                {"kg": freed.kg, "m3": freed.m3, "minutes": freed.minutes}, datetime(2026, 9, 30).date(), "Kumari",
            ))
        planning._save_draft(db, day, canonical, specs, note="Canonical D8 reference fixture", actor="Kumari",
                             audit_type=AuditType.PLAN_DRAFTED, now=now)
        db.commit()
    res = client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": True}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    return res.json()


def flag_veh003() -> int:
    """Priya's flag at 02:55: "Vehicle check failed" on VEH003. Returns the exception's id."""
    from app.db import SessionLocal
    from app.models.enums import ExceptionKind, ExceptionStatus
    from app.models.field import FieldException
    from app.models.plans import Trip

    with SessionLocal() as db:
        trip = db.scalars(select(Trip).where(Trip.vehicle_id == "VEH003").order_by(Trip.id.desc())).first()
        row = FieldException(
            kind=ExceptionKind.LOADER_SHORTFALL, type="Vehicle check failed", vehicle_id="VEH003", trip_id=trip.id if trip else None,
            order_ids=[], units_short={}, detail="Reefer not holding temperature", raised_by="Priya",
            raised_at=datetime(2026, 9, 29, 2, 55, tzinfo=COLOMBO), status=ExceptionStatus.OPEN,
        )
        db.add(row)
        db.commit()
        return row.id


def review(client, auth, exception_id: int) -> dict:
    res = client.get(f"{EXC}/{exception_id}", headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    return res.json()


def decide(client, auth, exception_id: int, defer: list[str] | None = None):
    return client.post(
        f"{EXC}/{exception_id}/decide", json={"decision": "swap_vehicle", "deferOrderIds": defer or []}, headers=auth("dispatcher")
    )


def plan(client, auth) -> dict:
    return client.get("/api/v1/dispatcher/plan?depot=peliyagoda", headers=auth("dispatcher")).json()


# --------------------------------------------------------------------------- review


def test_the_screen_is_still_working_while_the_van_is_in_the_workshop(client, auth, reseed):
    release(client, auth)
    advance(client, auth, "2026-09-29T02:30:00+05:30")
    view = review(client, auth, flag_veh003())
    assert view["state"] == "working" and view["replacement"] is None and view["recommendation"] is None
    assert view["title"] == "VEH003 held: replace it before 03:30"
    assert view["failed"]["tag"] == "Held"


def test_the_recommendation_names_the_van_and_protects_out012(client, auth, reseed):
    release(client, auth)
    advance(client, auth, "2026-09-29T02:56:00+05:30")
    view = review(client, auth, flag_veh003())
    assert view["state"] == "recommendation"
    assert (view["flaggedBy"], view["flaggedAt"], view["reason"]) == ("Priya", "02:55", "Reefer not holding temperature")
    assert view["replacement"]["vehicleId"] == "VEH036" and view["replacement"]["since"] == "02:45"
    assert view["need"]["kg"] > 0 and view["before"]["weight"]["over"].startswith("Over by ")
    rec = view["recommendation"]
    assert rec["kind"] == "policy" and rec["decidedBy"] == "Recommended · 02:56"
    assert {p["outletId"] for p in rec["protected"]} == {"OUT012"}
    protected = next(c for c in view["candidates"] if c["orderId"] == "ORD1001")
    assert protected["protected"] and not protected["leastSurplus"]
    assert view["after"]["weight"]["used"] <= view["after"]["weight"]["limit"]


def test_reviewing_an_unknown_exception_is_a_404(client, auth):
    res = client.get(f"{EXC}/999999", headers=auth("dispatcher"))
    assert res.status_code == 404 and res.json()["code"] == "not_found"


# --------------------------------------------------------------------------- decide


def test_deciding_swaps_the_vehicle_and_releases_the_next_version(client, auth, reseed):
    released = release(client, auth)
    advance(client, auth, "2026-09-29T02:56:00+05:30")
    eid = flag_veh003()
    before = review(client, auth, eid)
    res = decide(client, auth, eid)
    assert res.status_code == 200, res.text
    done = res.json()
    assert done["state"] == "confirmed" and done["failed"]["tag"] == "Replaced"
    after = plan(client, auth)
    assert after["version"]["number"] == released["version"]["number"] + 1 and after["version"]["state"] == "released"
    assert done["title"] == f"VEH003 replaced by VEH036, plan v{after['version']['number']}"
    assert done["confirmed"]["plan"] == after["version"]["number"]

    lanes = {lane["vehicleId"]: lane for lane in after["lanes"]}
    assert lanes["VEH003"]["status"] == "replaced" and lanes["VEH003"]["trips"] == []
    assert lanes["VEH036"]["trips"], "VEH036 now carries VEH003's trips"
    for trip in lanes["VEH036"]["trips"]:
        assert trip["kg"] <= trip["kgCap"] and trip["m3"] <= trip["m3Cap"]
    kept = {s["outletId"] for t in lanes["VEH036"]["trips"] for s in t["stops"]}
    assert "OUT012" in kept  # the protected outlet stays on the truck

    deferred_ids = {c["orderId"] for c in before["recommendation"]["protected"]}  # protected are never deferred
    assert not deferred_ids & {c["orderId"] for c in after["deferred"] if c["kind"] == "policy" and c["binding"] in ("weight", "volume")}


def test_the_deferred_orders_are_policy_deferrals_with_their_notices_and_copies(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.comms import AuditEvent, Notice
    from app.models.enums import AuditType, ExceptionStatus
    from app.models.field import FieldException
    from app.models.orders import Order
    from app.models.plans import VehicleDayStatus

    release(client, auth)
    advance(client, auth, "2026-09-29T02:56:00+05:30")
    eid = flag_veh003()
    rec_order = review(client, auth, eid)["recommendation"]["orderId"]
    assert decide(client, auth, eid).status_code == 200

    cards = client.get("/api/v1/dispatcher/deferrals?depot=peliyagoda", headers=auth("dispatcher")).json()
    swapped = next(c for c in cards["policy"] + cards["capacity"] if c["orderId"] == rec_order)
    assert swapped["kind"] == "policy" and swapped["binding"] in ("weight", "volume")
    assert swapped["reason"]["detail"].startswith("VEH003 failed its check; replacement VEH036 is ")
    assert swapped["newInVersion"] is not None and swapped["storeTold"]["state"] == "sent"

    with SessionLocal() as db:
        order = db.get(Order, rec_order)
        copy = db.get(Order, f"{rec_order}-R")
        audiences = {(f"{n.audience_kind.value}:{n.outlet_id or n.vehicle_id or n.depot_id}", n.tag.value) for n in db.scalars(select(Notice))}
        swaps = list(db.scalars(select(AuditEvent).where(AuditEvent.type == AuditType.VEHICLE_SWAPPED)))
        exc = db.get(FieldException, eid)
        status = db.get(VehicleDayStatus, ("VEH003", datetime(2026, 9, 29).date()))
    assert order.status.value == "deferred" and copy is not None and copy.deferred_from_order_id == rec_order
    assert ("dock:peliyagoda", "Change") in audiences and ("driver:VEH036", "Change") in audiences and ("driver:VEH003", "Change") in audiences
    assert any(a.startswith("store:") and tag == "Deferral" for a, tag in audiences)
    assert len(swaps) == 1 and swaps[0].payload["replacement"] == "VEH036"
    assert exc.status is ExceptionStatus.DECIDED and exc.decision["replacement"] == "VEH036" and exc.decided_by == "Kumari"
    assert status.replaced_by == "VEH036" and status.held_at is not None


def test_a_decision_cannot_be_taken_twice(client, auth, reseed):
    release(client, auth)
    advance(client, auth, "2026-09-29T02:56:00+05:30")
    eid = flag_veh003()
    assert decide(client, auth, eid).status_code == 200
    again = decide(client, auth, eid)
    assert again.status_code == 409 and again.json()["code"] == "already_decided"


def test_a_decision_needs_a_free_vehicle(client, auth, reseed):
    release(client, auth)
    advance(client, auth, "2026-09-29T02:30:00+05:30")  # VEH036 is still in the workshop
    res = decide(client, auth, flag_veh003())
    assert res.status_code == 409 and res.json()["code"] == "no_replacement"


def test_a_protected_outlet_cannot_be_the_deferred_one(client, auth, reseed):
    release(client, auth)
    advance(client, auth, "2026-09-29T02:56:00+05:30")
    res = decide(client, auth, flag_veh003(), ["ORD1001"])
    assert res.status_code == 409 and res.json()["code"] == "illegal_swap"
    assert "R-CONT" in {d["rule"] for d in res.json()["details"]}


def test_deferring_nothing_leaves_the_van_overloaded_so_it_is_refused(client, auth, reseed):
    release(client, auth)
    advance(client, auth, "2026-09-29T02:56:00+05:30")
    eid = flag_veh003()
    assert review(client, auth, eid)["need"]["kg"] > 0
    res = decide(client, auth, eid, ["ORD1013"])  # too small to close the gap on its own
    assert res.status_code == 409 and res.json()["code"] == "illegal_swap"
    assert {"R-KG"} <= {d["rule"] for d in res.json()["details"]}


def test_the_dispatcher_can_adjust_the_set_by_hand(client, auth, reseed):
    release(client, auth)
    advance(client, auth, "2026-09-29T02:56:00+05:30")
    eid = flag_veh003()
    view = review(client, auth, eid)
    recommended = {c["orderId"] for c in view["candidates"] if c["leastSurplus"]}
    assert recommended, "the rules recommend something"
    res = decide(client, auth, eid, sorted(recommended))
    assert res.status_code == 200, res.text
    assert res.json()["state"] == "confirmed"


def test_a_decided_exception_reads_back_as_confirmed(client, auth, reseed):
    release(client, auth)
    advance(client, auth, "2026-09-29T02:56:00+05:30")
    eid = flag_veh003()
    decide(client, auth, eid)
    again = review(client, auth, eid)
    assert again["state"] == "confirmed" and again["confirmed"] is not None
    assert again["confirmed"]["toast"].endswith("Loader asked to acknowledge.")
    assert any(w["who"] == "Peliyagoda dock" for w in again["confirmed"]["whoKnows"])


# --------------------------------------------------------------------------- who may call


def test_the_exception_endpoints_are_dispatcher_only(client, auth):
    for role in ("store", "loader", "driver"):
        assert client.get(f"{EXC}/1", headers=auth(role)).status_code == 403
        assert client.post(f"{EXC}/1/decide", json={"decision": "swap_vehicle", "deferOrderIds": []}, headers=auth(role)).status_code == 403
