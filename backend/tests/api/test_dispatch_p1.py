"""Dispatch fix plan P1 through the API: the service day's calendar flags (task 8), the weekly fuel the quota has
left (task 7), and what a trip stop says about its outlet (task 9). These change state and put the seed back."""

from __future__ import annotations

from datetime import date

DEPOT = "?depot=peliyagoda"
TUE, WED = date(2026, 9, 29), date(2026, 9, 30)


def advance(client, auth, to: str) -> None:
    res = client.post("/api/v1/demo/advance", json={"to": to}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text


def test_the_queue_and_capacity_say_what_kind_of_day_it_is(client, auth, reseed):
    from app.db import SessionLocal
    from app.models.reference import CalendarDay

    with SessionLocal() as db:
        cal = db.get(CalendarDay, TUE)
        saved = (cal.is_payday, cal.monsoon, cal.festival, cal.festival_ramp)
        cal.is_payday, cal.monsoon, cal.festival, cal.festival_ramp = True, True, "Vesak", 0.2
        db.commit()
    try:
        queue = client.get("/api/v1/dispatcher/queue" + DEPOT, headers=auth("dispatcher")).json()
        kinds = {f["kind"] for f in queue["day"]["flags"]}
        assert {"payday", "monsoon", "festival"} <= kinds
        assert queue["day"]["label"] == "Tue 29 Sep" and queue["day"]["nextRun"] == "Wed 30 Sep"
        festival = next(f for f in queue["day"]["flags"] if f["kind"] == "festival")
        assert festival["label"] == "Vesak" and "20 %" in festival["detail"]

        capacity = client.get("/api/v1/dispatcher/capacity" + DEPOT, headers=auth("dispatcher")).json()
        assert {f["kind"] for f in capacity["day"]["flags"]} == kinds
    finally:
        with SessionLocal() as db:
            cal = db.get(CalendarDay, TUE)
            cal.is_payday, cal.monsoon, cal.festival, cal.festival_ramp = saved
            db.commit()


def test_a_released_day_spends_the_weekly_fuel_for_the_rest_of_the_week(client, auth, reseed):
    from app.db import SessionLocal
    from app.services import planning_repo as repo

    with SessionLocal() as db:
        before = repo.week_fuel_used(db, WED)
    advance(client, auth, "2026-09-28T23:31:00+05:30")
    released = client.post("/api/v1/dispatcher/plan/release", json={"sendNotices": False}, headers=auth("dispatcher"))
    assert released.status_code == 200, released.text
    with SessionLocal() as db:
        after = repo.week_fuel_used(db, WED)
        same_day = repo.week_fuel_used(db, TUE)
    on_tuesday = {t["vehicleId"] for lane in released.json()["lanes"] for t in lane["trips"]}
    assert on_tuesday
    for vid in on_tuesday:
        assert after[vid] > before.get(vid, 0.0), vid  # Wednesday's quota has Tuesday's litres taken off
    assert same_day == before  # Tuesday itself never counts its own plan twice


def test_a_trip_stop_carries_its_window_and_access(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    plan = client.get("/api/v1/dispatcher/plan" + DEPOT, headers=auth("dispatcher")).json()
    stops = [s for lane in plan["lanes"] for t in lane["trips"] for s in t["stops"]]
    assert stops and all(s["window"] and s["access"] for s in stops)
    assert all(s["access"][0] in ("Rear dock", "Street", "Mall bay") for s in stops)
