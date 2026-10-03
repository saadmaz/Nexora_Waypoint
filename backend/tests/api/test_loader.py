"""The LoaderApi reads over HTTP: the dock board, the PIN sheet, a load list, a flag and a plan diff (PRD v3 §19, §16 step 7).

The dock's writes go through ``POST /sync``, so the story is played with the real endpoints throughout: Ruwan acknowledges and
loads VEH039 at Kandy, Priya flags VEH003 at Peliyagoda and Dispatch answers with a swap. These need the test database
(see ``conftest.py``), which the session shares, so every test that moves the clock or writes takes ``reseed``.

``diff_lines`` is pure, so the shapes the fixture world cannot reach (a departure time changing, an order added) are checked
on hand-made plans at the bottom of this file, with no database at all.
"""

from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy import select

from app.config import COLOMBO

from .test_dispatcher_live import advance, release
from .test_sync import DAY, record, results, sync

LOADER = "/api/v1/loader"
#: The seeded PIN people (``seed/accounts.py``): one per dock.
PRIYA, RUWAN = 1, 2
PINS = {PRIYA: "1234", RUWAN: "5678"}


# ---- helpers ----------------------------------------------------------------


def dock(client, auth, name: str = "kandy") -> dict:
    res = client.get(f"{LOADER}/docks/{name}", headers=auth("loader"))
    assert res.status_code == 200, res.text
    return res.json()


def trip_of(view: dict, vehicle_id: str, trip_no: int = 1) -> dict:
    found = [v for v in view["vehicles"] if v["vehicleId"] == vehicle_id and v["tripNo"] == trip_no]
    assert found, f"{vehicle_id} trip {trip_no} is not on the {view['dock']} dock: {view['vehicles']}"
    return found[0]


def load_plan(client, auth, vehicle_id: str, trip_no: int):
    return client.get(f"{LOADER}/vehicles/{vehicle_id}/trips/{trip_no}", headers=auth("loader"))


def plan_diff(client, auth, name: str, from_version: int, to_version: int):
    return client.get(f"{LOADER}/docks/{name}/diff", params={"from": from_version, "to": to_version}, headers=auth("loader"))


def verify(client, auth, person_id: int, pin: str):
    return client.post(f"{LOADER}/pins/verify", json={"personId": person_id, "pin": pin}, headers=auth("loader"))


def hm(iso: str | None) -> str:
    """A reply's timestamp as the dock reads it."""
    return datetime.fromisoformat(iso).astimezone(COLOMBO).strftime("%H:%M") if iso else ""


def dock_sync(client, auth, records: list[dict], device: str = "tablet-kandy"):
    return results(sync(client, auth, records, role="loader", device=device))


def latest_flag_id() -> int:
    """The id of the flag just synced. ``/sync`` does not answer with it yet (a gap for ``feature/offline-sync``)."""
    from app.db import SessionLocal
    from app.models.enums import ExceptionKind
    from app.models.field import FieldException

    with SessionLocal() as db:
        return db.scalars(
            select(FieldException.id).where(FieldException.kind == ExceptionKind.LOADER_SHORTFALL).order_by(FieldException.id.desc())
        ).first()


def route_order(vehicle_id: str, trip_no: int) -> list[str]:
    """The orders of a trip in route order (``trip_orders.seq``), straight from the latest released plan."""
    from app.db import SessionLocal
    from app.models.enums import PlanState
    from app.models.plans import PlanVersion, Trip, TripOrder

    with SessionLocal() as db:
        trip = db.scalars(
            select(Trip)
            .join(PlanVersion, PlanVersion.id == Trip.plan_version_id)
            .where(Trip.vehicle_id == vehicle_id, Trip.trip_no == trip_no, PlanVersion.state == PlanState.RELEASED)
            .order_by(PlanVersion.number.desc())
        ).first()
        rows = db.scalars(select(TripOrder).where(TripOrder.trip_id == trip.id).order_by(TripOrder.seq))
        return [r.order_id for r in rows]


def replacement_of(vehicle_id: str) -> str | None:
    from app.db import SessionLocal
    from app.models.plans import VehicleDayStatus

    with SessionLocal() as db:
        row = db.scalars(select(VehicleDayStatus).where(VehicleDayStatus.vehicle_id == vehicle_id)).first()
        return row.replaced_by if row is not None else None


def flag_veh003(client, auth) -> int:
    """Priya's 02:55 flag on VEH003, through the dock's own outbox: "the reefer is not holding temperature"."""
    advance(client, auth, "2026-09-29T02:55:00+05:30")
    answers = dock_sync(
        client, auth,
        [record(
            "loader.exception",
            {"date": DAY, "vehicleId": "VEH003", "trip": 1, "type": "Vehicle check failed", "orderIds": [],
             "reason": "Reefer not holding temperature", "personId": PRIYA, "personName": "Priya"},
            "02:55", 3, actor="Priya",
        )],
        device="tablet-peliyagoda",
    )
    assert [a["result"] for a in answers] == ["accepted"], answers
    return latest_flag_id()


# ---- L1: the dock board -----------------------------------------------------


def test_the_dock_waits_for_the_plan_without_failing(client, auth, reseed):
    """L1's empty state: before the release there is no plan, which is not an error (Mon 15:41)."""
    advance(client, auth, "2026-09-28T15:41:00+05:30")
    view = dock(client, auth, "kandy")
    assert view == {"dock": "kandy", "planVersion": 0, "acknowledged": False, "vehicles": [],
                    "people": [{"id": RUWAN, "name": "Ruwan", "dock": "kandy"}]}
    assert [p["name"] for p in dock(client, auth, "peliyagoda")["people"]] == ["Priya"]


def test_the_dock_never_hands_out_a_pin_hash(client, auth):
    res = client.get(f"{LOADER}/docks/peliyagoda", headers=auth("loader"))
    assert res.status_code == 200
    assert "pinHash" not in res.text and "pin_hash" not in res.text


def test_an_unknown_dock_is_not_found(client, auth):
    res = client.get(f"{LOADER}/docks/galle", headers=auth("loader"))
    assert res.status_code == 404
    assert res.json()["code"] == "not_found"


def test_the_dock_shows_the_released_plan_and_takes_an_acknowledgement(client, auth, reseed):
    """Step 7: v3 is released at 23:40, Kandy has the hero trip, and Ruwan acknowledges it at 04:15."""
    release(client, auth)
    view = dock(client, auth, "kandy")
    assert view["planVersion"] == 3
    assert view["acknowledged"] is False
    veh039 = trip_of(view, "VEH039")
    assert veh039["orders"] == 3
    # The departure is the planner's, echoed as it stands. The PRD's 05:10 belongs to the full dataset; this world has
    # fewer orders and so an earlier slot. What matters here is that the dock and the load list agree.
    assert hm(veh039["departAt"]) == hm(load_plan(client, auth, "VEH039", 1).json()["departAt"])
    assert veh039["planVersion"] == 3 and veh039["kg"] > 0
    assert veh039["tags"] == []

    advance(client, auth, "2026-09-29T04:15:00+05:30")
    answers = dock_sync(
        client, auth,
        [record("loader.ack", {"date": DAY, "version": 3, "dockId": "kandy", "personId": RUWAN, "personName": "Ruwan"}, "04:15", 3, actor="Ruwan")],
    )
    assert [a["result"] for a in answers] == ["accepted"], answers
    assert dock(client, auth, "kandy")["acknowledged"] is True
    # The acknowledgement belongs to one dock: Peliyagoda has not acknowledged anything.
    assert dock(client, auth, "peliyagoda")["acknowledged"] is False


def test_a_flagged_vehicle_is_held_on_the_dock(client, auth, reseed):
    """A flag changes no order status; the vehicle carries Held until Dispatch decides (D8)."""
    release(client, auth)
    assert trip_of(dock(client, auth, "peliyagoda"), "VEH003")["tags"] == []
    flag_veh003(client, auth)
    assert trip_of(dock(client, auth, "peliyagoda"), "VEH003")["tags"] == ["Held"]
    # The dock that did not flag anything is untouched.
    assert all(v["tags"] == [] for v in dock(client, auth, "kandy")["vehicles"])


# ---- the PIN sheet ----------------------------------------------------------


@pytest.fixture
def pin_sheet():
    """The wrong-PIN counter is process state, so each test starts and leaves it empty."""
    from app.services import loader as service

    service.reset_attempts()
    yield
    service.reset_attempts()


def test_the_right_pin_names_the_person(client, auth, pin_sheet):
    assert verify(client, auth, PRIYA, PINS[PRIYA]).json() == {"ok": True, "person": {"id": PRIYA, "name": "Priya", "dock": "peliyagoda"}}
    assert verify(client, auth, RUWAN, PINS[RUWAN]).json()["person"]["dock"] == "kandy"


def test_a_wrong_pin_and_an_unknown_person_look_the_same(client, auth, pin_sheet):
    """The sheet says the PIN is wrong, never which half of it was."""
    assert verify(client, auth, RUWAN, "0000").json() == {"ok": False, "person": None}
    assert verify(client, auth, 9999, PINS[RUWAN]).json() == {"ok": False, "person": None}


def test_five_wrong_pins_close_the_sheet(client, auth, pin_sheet):
    """``docs/auth-audit.md`` finding 12: a tablet left on a bench is not a PIN oracle."""
    for _ in range(5):
        assert verify(client, auth, PRIYA, "0000").json()["ok"] is False
    locked = verify(client, auth, PRIYA, "0000")
    assert locked.status_code == 429
    assert locked.json()["code"] == "too_many_attempts"
    # Locked means locked: the right PIN waits too.
    assert verify(client, auth, PRIYA, PINS[PRIYA]).status_code == 429
    # One person's mistakes do not lock the other dock out.
    assert verify(client, auth, RUWAN, PINS[RUWAN]).json()["ok"] is True


# ---- L2: the load list ------------------------------------------------------


def test_the_load_list_is_in_reverse_stop_order(client, auth, reseed):
    """The truck is loaded last stop first, so the load list is exactly the route reversed: the first stop goes in last.

    The route itself is the planner's, so it is read from the plan rather than asserted: this world's VEH039 serves
    OUT087 before OUT084, where the PRD's fuller day has them the other way round.
    """
    release(client, auth)
    res = load_plan(client, auth, "VEH039", 1)
    assert res.status_code == 200, res.text
    out = res.json()
    assert out["planVersion"] == 3 and out["tripNo"] == 1
    assert hm(out["departAt"]) == hm(trip_of(dock(client, auth, "kandy"), "VEH039")["departAt"])
    assert out["confirmedAt"] is None
    route = route_order("VEH039", 1)
    assert sorted(route) == ["ORD2001", "ORD2002", "ORD2003"]
    assert [line["loadNo"] for line in out["lines"]] == [1, 2, 3]
    assert [line["orderId"] for line in out["lines"]] == list(reversed(route))

    first_stop = {line["orderId"]: line for line in out["lines"]}[route[0]]
    assert first_stop["loadNo"] == len(route)  # the first stop is loaded last
    chilled = {line["orderId"]: line for line in out["lines"]}["ORD2001"]
    assert chilled["outletId"] == "OUT084" and chilled["unitsExpected"] == 12
    assert chilled["unitsLoaded"] is None
    assert set(chilled["window"]) == {"start", "end"}
    # The reference data in this world carries no outlet names, so the line falls back to the id (never an empty label).
    assert chilled["outletName"] == "OUT084"


def test_counting_and_confirming_show_on_the_load_list(client, auth, reseed):
    """A count is a fact and the latest one wins; the gate is what the driver's R1.3 reads as "Confirmed by Ruwan"."""
    release(client, auth)
    advance(client, auth, "2026-09-29T04:20:00+05:30")
    answers = dock_sync(
        client, auth,
        [
            record("loader.check", {"date": DAY, "vehicleId": "VEH039", "trip": 1, "orderId": "ORD2001", "unitsLoaded": 11, "personId": RUWAN}, "04:20", 3, actor="Ruwan"),
            record("loader.check", {"date": DAY, "vehicleId": "VEH039", "trip": 1, "orderId": "ORD2001", "unitsLoaded": 12, "personId": RUWAN}, "04:25", 3, actor="Ruwan"),
        ],
    )
    assert [a["result"] for a in answers] == ["accepted", "accepted"], answers
    lines = {line["orderId"]: line for line in load_plan(client, auth, "VEH039", 1).json()["lines"]}
    assert lines["ORD2001"]["unitsLoaded"] == 12
    assert lines["ORD2003"]["unitsLoaded"] is None

    advance(client, auth, "2026-09-29T04:50:00+05:30")
    answers = dock_sync(
        client, auth,
        [record("loader.confirmLoaded", {"date": DAY, "vehicleId": "VEH039", "trip": 1, "personId": RUWAN, "personName": "Ruwan"}, "04:50", 3, actor="Ruwan")],
    )
    assert [a["result"] for a in answers] == ["accepted"], answers
    assert hm(load_plan(client, auth, "VEH039", 1).json()["confirmedAt"]) == "04:50"


def test_a_trip_that_is_not_in_the_plan_is_not_found(client, auth, reseed):
    release(client, auth)
    missing = load_plan(client, auth, "VEH039", 2)
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"
    assert load_plan(client, auth, "VEH999", 1).status_code == 404


def test_a_trip_is_one_or_two(client, auth):
    refused = load_plan(client, auth, "VEH039", 7)
    assert refused.status_code == 422
    assert refused.json()["code"] == "validation_error"


# ---- L3: the flag and the decision ------------------------------------------


def test_a_flag_reads_back_with_the_time_it_was_raised(client, auth, reseed):
    release(client, auth)
    flag_id = flag_veh003(client, auth)
    res = client.get(f"{LOADER}/exceptions/{flag_id}", headers=auth("loader"))
    assert res.status_code == 200, res.text
    out = res.json()
    assert out["type"] == "Vehicle check failed"
    assert out["vehicleId"] == "VEH003" and out["tripNo"] == 1
    assert out["status"] == "open" and out["decision"] is None
    # The dock's own time, not when the record reached the server.
    assert hm(out["raisedAt"]) == "02:55"
    assert out["detail"] == "Reefer not holding temperature"


def test_the_dock_cannot_read_another_role_s_exception(client, auth, reseed):
    """A loader reads loader flags. A driver's problem and a store's issue are not its business."""
    from app.db import SessionLocal
    from app.models.enums import ExceptionKind, ExceptionStatus
    from app.models.field import FieldException

    with SessionLocal() as db:
        other = FieldException(
            kind=ExceptionKind.DRIVER_PROBLEM, type="Access blocked", vehicle_id="VEH039", order_ids=[], units_short={},
            detail="Gate locked", raised_by="Nimal", raised_at=datetime(2026, 9, 29, 5, 30, tzinfo=COLOMBO),
            status=ExceptionStatus.OPEN,
        )
        db.add(other)
        db.commit()
        other_id = other.id
    assert client.get(f"{LOADER}/exceptions/{other_id}", headers=auth("loader")).status_code == 404
    assert client.get(f"{LOADER}/exceptions/999999", headers=auth("loader")).status_code == 404


def test_the_decision_carries_the_keys_the_sheet_reads(client, auth, reseed):
    """Steps 11 and 12: Dispatch swaps the vehicle at 03:00 and the dock's sheet says so, with who and when."""
    release(client, auth)
    flag_id = flag_veh003(client, auth)
    advance(client, auth, "2026-09-29T03:00:00+05:30")
    decided = client.post(
        f"/api/v1/dispatcher/exceptions/{flag_id}/decide",
        json={"decision": "swap_vehicle", "deferOrderIds": []},
        headers=auth("dispatcher"),
    )
    assert decided.status_code == 200, decided.text

    out = client.get(f"{LOADER}/exceptions/{flag_id}", headers=auth("loader")).json()
    assert out["status"] == "decided"
    decision = out["decision"]
    # Dispatch stores ``plan``; the dock's sheet reads ``version``, ``by`` and ``at``.
    assert decision["version"] == decision["plan"] == 4
    assert decision["decision"] == "swap_vehicle"
    assert decision["by"] and decision["at"] == "03:00"
    assert decision["replacement"] == replacement_of("VEH003")


def test_a_swap_says_which_vehicle_stands_in_for_which(client, auth, reseed):
    """The dock and the load list name both ends of a swap, so the screen needs no vehicle id of its own."""
    release(client, auth)
    flag_id = flag_veh003(client, auth)
    advance(client, auth, "2026-09-29T03:00:00+05:30")
    assert client.post(
        f"/api/v1/dispatcher/exceptions/{flag_id}/decide", json={"decision": "swap_vehicle", "deferOrderIds": []}, headers=auth("dispatcher")
    ).status_code == 200
    replacement = replacement_of("VEH003")
    assert replacement is not None

    dock = client.get("/api/v1/loader/docks/peliyagoda", headers=auth("loader")).json()
    by_vehicle = {v["vehicleId"]: v for v in dock["vehicles"]}
    assert by_vehicle[replacement]["replaces"] == "VEH003"
    assert all(v["replaces"] is None for k, v in by_vehicle.items() if k != replacement)

    plan = client.get(f"/api/v1/loader/vehicles/{replacement}/trips/{by_vehicle[replacement]['tripNo']}", headers=auth("loader")).json()
    assert plan["replaces"] == "VEH003"


# ---- L4: what changed between two released versions -------------------------


def test_the_diff_of_the_reefer_swap(client, auth, reseed):
    """L4 after the 03:00 decision: VEH003's trip is VEH036's now, and Kandy sees no change at all."""
    release(client, auth)
    flag_id = flag_veh003(client, auth)
    advance(client, auth, "2026-09-29T03:00:00+05:30")
    assert client.post(
        f"/api/v1/dispatcher/exceptions/{flag_id}/decide", json={"decision": "swap_vehicle", "deferOrderIds": []}, headers=auth("dispatcher")
    ).status_code == 200
    replacement = replacement_of("VEH003")
    assert replacement is not None

    res = plan_diff(client, auth, "peliyagoda", 3, 4)
    assert res.status_code == 200, res.text
    out = res.json()
    assert (out["dock"], out["fromVersion"], out["toVersion"]) == ("peliyagoda", 3, 4)
    swaps = [line for line in out["lines"] if line["change"] == "vehicle"]
    assert swaps, out["lines"]
    assert {line["before"] for line in swaps} == {"VEH003"}
    assert {line["after"] for line in swaps} == {replacement}
    # The new vehicle has to be the one named, or the dock would mark it "No change".
    assert {line["vehicleId"] for line in swaps} == {replacement}
    assert all(line["orderId"] is None for line in swaps)
    # Orders the swap explains are not repeated as moves.
    assert not [line for line in out["lines"] if line["change"] == "moved" and line["before"].startswith("VEH003")]
    # Removed is loudest and comes first (L4).
    changes = [line["change"] for line in out["lines"]]
    assert changes == sorted(changes, key=["removed", "vehicle", "moved", "added", "time"].index)

    assert plan_diff(client, auth, "kandy", 3, 4).json()["lines"] == []


def test_the_diff_of_one_version_against_itself_is_empty(client, auth, reseed):
    release(client, auth)
    assert plan_diff(client, auth, "peliyagoda", 3, 3).json()["lines"] == []


def test_a_diff_needs_two_released_versions(client, auth, reseed):
    """The dock only ever sees released plans: v1 and v2 are drafts, and v9 does not exist."""
    release(client, auth)
    assert plan_diff(client, auth, "peliyagoda", 2, 3).status_code == 404
    assert plan_diff(client, auth, "peliyagoda", 3, 9).status_code == 404
    backwards = plan_diff(client, auth, "peliyagoda", 3, 2)
    assert backwards.status_code == 422
    assert backwards.json()["code"] == "validation_error"
    assert plan_diff(client, auth, "galle", 3, 3).status_code == 404


# ---- the role guard ---------------------------------------------------------


LOADER_ROUTES = [
    ("GET", f"{LOADER}/docks/kandy"),
    ("POST", f"{LOADER}/pins/verify"),
    ("GET", f"{LOADER}/vehicles/VEH039/trips/1"),
    ("GET", f"{LOADER}/exceptions/1"),
    ("GET", f"{LOADER}/docks/kandy/diff?from=1&to=1"),
]


@pytest.mark.parametrize(("method", "path"), LOADER_ROUTES)
@pytest.mark.parametrize("role", ["dispatcher", "driver", "store"])
def test_only_the_dock_tablet_reaches_the_loader_routes(client, auth, method, path, role):
    res = client.request(method, path, json={"personId": PRIYA, "pin": "1234"}, headers=auth(role))
    assert res.status_code == 403, res.text
    assert res.json()["code"] == "forbidden"


@pytest.mark.parametrize(("method", "path"), LOADER_ROUTES)
def test_the_loader_routes_need_a_token(client, method, path):
    res = client.request(method, path, json={"personId": PRIYA, "pin": "1234"})
    assert res.status_code == 401
    assert res.json()["code"] == "unauthenticated"


# ---- the diff itself, with no database --------------------------------------


def shape(vehicle_id: str, trip_no: int, depart: str, *order_ids: str):
    from app.services.loader import TripShape

    h, m = map(int, depart.split(":"))
    return TripShape(vehicle_id, trip_no, datetime(2026, 9, 29, h, m, tzinfo=COLOMBO), order_ids)


def changes(before, after) -> list[tuple]:
    from app.services.loader import diff_lines

    return [(line.change, line.vehicle_id, line.trip_no, line.order_id, line.before, line.after) for line in diff_lines(before, after)]


def test_an_unchanged_plan_has_no_diff():
    plan = [shape("VEH035", 1, "03:30", "ORD1023", "ORD1024"), shape("VEH035", 2, "06:12", "ORD1004")]
    assert changes(plan, plan) == []


def test_a_swap_is_one_change_per_trip_not_one_per_order():
    before = [shape("VEH003", 1, "03:30", "ORD1016", "ORD1014"), shape("VEH003", 2, "09:10", "ORD1012")]
    after = [shape("VEH036", 1, "03:30", "ORD1016", "ORD1014"), shape("VEH036", 2, "09:10", "ORD1012")]
    assert changes(before, after) == [
        ("vehicle", "VEH036", 1, None, "VEH003", "VEH036"),
        ("vehicle", "VEH036", 2, None, "VEH003", "VEH036"),
    ]


def test_a_removed_order_comes_before_the_swap_that_carried_the_rest():
    """The 03:00 decision: VEH003 becomes VEH036 and ORD1002 is deferred. Removed is the line the dock must not miss."""
    before = [shape("VEH003", 1, "03:30", "ORD1016", "ORD1002", "ORD1012")]
    after = [shape("VEH036", 1, "03:30", "ORD1016", "ORD1012")]
    assert changes(before, after) == [
        ("removed", "VEH003", 1, "ORD1002", "VEH003 · trip 1", None),
        ("vehicle", "VEH036", 1, None, "VEH003", "VEH036"),
    ]


def test_a_moved_order_names_both_stops():
    before = [shape("VEH035", 1, "03:30", "ORD1023", "ORD1024"), shape("VEH035", 2, "06:12", "ORD1004")]
    after = [shape("VEH035", 1, "03:30", "ORD1023"), shape("VEH035", 2, "06:12", "ORD1004", "ORD1024")]
    assert changes(before, after) == [
        ("moved", "VEH035", 2, "ORD1024", "VEH035 · trip 1 · stop 2", "VEH035 · trip 2 · stop 2"),
    ]


def test_a_reordered_stop_is_a_move_too():
    before = [shape("VEH035", 1, "03:30", "ORD1023", "ORD1024")]
    after = [shape("VEH035", 1, "03:30", "ORD1024", "ORD1023")]
    assert changes(before, after) == [
        ("moved", "VEH035", 1, "ORD1023", "VEH035 · trip 1 · stop 1", "VEH035 · trip 1 · stop 2"),
        ("moved", "VEH035", 1, "ORD1024", "VEH035 · trip 1 · stop 2", "VEH035 · trip 1 · stop 1"),
    ]


def test_an_added_order_and_a_later_departure():
    before = [shape("VEH035", 1, "03:30", "ORD1023")]
    after = [shape("VEH035", 1, "04:05", "ORD1023", "ORD1099")]
    assert changes(before, after) == [
        ("added", "VEH035", 1, "ORD1099", None, "VEH035 · trip 1"),
        ("time", "VEH035", 1, None, "03:30", "04:05"),
    ]


def test_a_vehicle_that_was_already_driving_is_not_read_as_a_swap():
    """Only an idle vehicle taking over looks like a swap. Otherwise the orders are ordinary moves, which is honest."""
    before = [shape("VEH003", 1, "03:30", "ORD1016"), shape("VEH035", 1, "03:30", "ORD1023")]
    after = [shape("VEH035", 1, "03:30", "ORD1023", "ORD1016")]
    assert changes(before, after) == [
        ("moved", "VEH035", 1, "ORD1016", "VEH003 · trip 1 · stop 1", "VEH035 · trip 1 · stop 2"),
    ]
