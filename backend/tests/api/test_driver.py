"""The driver's reads over HTTP: the route package, notices and history through the hero day (PRD v3 §2 H7 to H16, §19).

The writes go through the real ``/sync`` (``test_sync`` helpers), so what the driver reads is what the phone sent. These need
the test database (``conftest.py``).
"""

from __future__ import annotations

from datetime import date

import pytest

from .test_dispatcher_live import advance, release
from .test_sync import DAY, on_the_road, record, results, sync, to_the_sync

RUN = f"/api/v1/driver/runs/{DAY}"
NOTICES = "/api/v1/driver/notices"
HISTORY = "/api/v1/driver/history"


def get_run(client, auth, path: str = RUN) -> dict:
    res = client.get(path, headers=auth("driver"))
    assert res.status_code == 200, res.text
    return res.json()


def by_order(run: dict) -> dict[str, dict]:
    return {s["orderId"]: s for s in run["stops"]}


def test_before_release_there_is_no_run_yet(client, auth, reseed):
    run = get_run(client, auth)
    assert run["state"] == "no_run"
    assert run["noRun"]["reason"] == "not_released"
    assert run["stops"] == [] and run["tripNo"] is None


def test_the_released_run_is_veh039_trip_1_with_its_stops(client, auth, reseed):
    release(client, auth)
    run = get_run(client, auth)
    assert run["state"] == "run" and run["vehicleId"] == "VEH039" and run["tripNo"] == 1 and run["trips"] == [1]
    assert run["driver"] == "Nimal" and run["acknowledged"] is False and run["loaderConfirmation"] is None
    assert run["vehicle"]["temperature"] == "reefer" and run["vehicle"]["tags"] == ["Available"]
    assert run["planReleasedAt"] is not None

    stops = by_order(run)
    assert {"ORD2001", "ORD2002", "ORD2003"} <= set(stops)
    hero = stops["ORD2001"]
    assert hero["outletId"] == "OUT084" and hero["window"] == {"start": "05:30", "end": "08:00"}
    assert hero["dock"] == "rear_dock" and hero["brand"] == "Fresh" and hero["unloadMinutes"] is not None
    assert hero["weightKg"] > 0 and hero["status"] == "planned"
    assert [s["seq"] for s in run["stops"]] == sorted(s["seq"] for s in run["stops"])


def test_the_acknowledgement_and_the_loader_gate_show_on_the_run(client, auth, reseed):
    version = on_the_road(client, auth)
    run = get_run(client, auth)
    assert run["planVersion"] == version and run["acknowledged"] is True
    assert run["loaderConfirmation"]["by"] == "Ruwan"
    assert run["loaderConfirmation"]["at"].startswith(f"{DAY}T04:50")
    assert all(s["status"] == "departed" for s in run["stops"])


def test_after_the_sync_the_run_carries_the_servers_answer(client, auth, reseed):
    version, _, _ = to_the_sync(client, auth)
    run = get_run(client, auth)
    # The 05:21 deferral took the hero orders off the trip in the new version; the phone still sees them, in conflict.
    assert run["planVersion"] == version + 1 and run["acknowledged"] is False
    stops = by_order(run)
    assert (stops["ORD2001"]["status"], stops["ORD2002"]["status"], stops["ORD2003"]["status"]) == ("conflict", "conflict", "delivered")


def test_an_unknown_trip_is_not_found(client, auth, reseed):
    release(client, auth)
    res = client.get(f"{RUN}?trip=9", headers=auth("driver"))
    assert res.status_code == 404 and res.json()["code"] == "not_found"
    assert get_run(client, auth, f"{RUN}?trip=1")["tripNo"] == 1


def test_a_sunday_has_no_run_and_says_when_the_next_plan_comes(client, auth):
    run = get_run(client, auth, "/api/v1/driver/runs/2026-10-04")
    assert run["state"] == "no_run" and run["noRun"]["reason"] == "sunday"
    assert run["noRun"]["nextPlanAt"].startswith("2026-10-04T23:40")


def test_the_release_is_a_plan_notice_and_the_kept_delivery_is_resolved(client, auth, reseed):
    version, _, answers = to_the_sync(client, auth)
    notices = client.get(NOTICES, headers=auth("driver")).json()
    assert notices and {n["tag"] for n in notices} == {"plan_released"}

    advance(client, auth, "2026-09-29T06:44:00+05:30")
    cid = answers[1]["conflictId"]
    kept = client.post(f"/api/v1/dispatcher/conflicts/{cid}/resolve", json={"resolution": "keep_delivery"}, headers=auth("dispatcher"))
    assert kept.status_code == 200, kept.text

    newest = client.get(NOTICES, headers=auth("driver")).json()[0]
    assert newest["tag"] == "resolved"
    assert newest["link"] == {"outletId": "OUT084", "decision": "keep_delivery", "by": "Kumari"}

    since = client.get(NOTICES, params={"since": newest["createdAt"]}, headers=auth("driver")).json()
    assert since == []


def test_history_lists_the_run_once_it_is_finished(client, auth, reseed):
    version = on_the_road(client, auth)
    assert client.get(HISTORY, headers=auth("driver")).json() == []
    finished = results(sync(client, auth, [record("driver.finishRun", {"date": DAY, "gpsKm": 19.4, "fuelLEst": 3.9}, "07:10", version)]))
    assert [r["result"] for r in finished] == ["accepted"]

    rows = client.get(HISTORY, headers=auth("driver")).json()
    assert len(rows) == 1
    row = rows[0]
    assert (row["date"], row["vehicleId"], row["tripNo"], row["km"], row["fuelL"]) == (DAY, "VEH039", 1, 19.4, 3.9)
    assert row["stops"] >= 2 and row["finishedAt"] is not None


def test_the_driver_reads_are_for_the_driver_only(client, auth):
    for role in ("store", "loader", "dispatcher"):
        for path in (RUN, NOTICES, HISTORY):
            assert client.get(path, headers=auth(role)).status_code == 403


def test_a_driver_account_without_a_vehicle_is_refused(client):
    from app.db import SessionLocal
    from app.deps import CurrentUser
    from app.errors import ApiError
    from app.services import driver as driver_service
    from waypoint_rules.vocab import Role

    unlinked = CurrentUser(id=3, email="driver@waypoint.demo", role=Role.DRIVER, display_name="Nimal", depot="kandy", outlet_id=None, vehicle_id=None)
    with SessionLocal() as db:
        for read in (
            lambda: driver_service.run(db, unlinked, date(2026, 9, 29), None),
            lambda: driver_service.notices(db, unlinked, None),
            lambda: driver_service.history(db, unlinked),
        ):
            with pytest.raises(ApiError) as refused:
                read()
            assert refused.value.status == 403
