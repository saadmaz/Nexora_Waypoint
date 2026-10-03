"""D9, the baseline capacity outlook (PRD v3 §12 "D9 baseline", A15): reefer minutes demanded against reefer minutes available, by ISO week."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from app.services import forecast as fc

NOW = datetime(2026, 9, 28, 15, 30)  # Mon 28 Sep
REEFERS = 8


def _calendar(*, payday: set[date] = frozenset(), ramp: dict[date, float] | None = None, sundays_off: bool = True) -> dict[date, fc.CalendarFacts]:
    out: dict[date, fc.CalendarFacts] = {}
    for i in range(0, 50):
        d = date(2026, 9, 28) + timedelta(days=i)
        out[d] = fc.CalendarFacts(d, operating=not (sundays_off and d.weekday() == 6), payday=d in payday, ramp=(ramp or {}).get(d, 0.0))
    return out


def test_the_next_four_mondays_start_after_today():
    assert fc.next_mondays(date(2026, 9, 28)) == [date(2026, 10, 5), date(2026, 10, 12), date(2026, 10, 19), date(2026, 10, 26)]
    assert fc.next_mondays(date(2026, 9, 30))[0] == date(2026, 10, 5)  # a Wednesday: the Monday after


def test_a_week_over_capacity_is_short_with_its_gap_and_levers():
    # 6 operating days x 8 reefers x 270 min = 12,960 available; 2,400 a day asks for 14,400 = 111%.
    view = fc.forecast_view("peliyagoda", NOW, _calendar(), demand_per_day=2400, usable_reefers=REEFERS)
    week = view.weeks[0]
    assert (week.monday, week.percent, week.status) == ("Mon 5 Oct", 111, "Short")
    assert week.gap is not None and week.gap.minutes == 1440
    assert week.lever == "Move workshop slots · pre-warn stores"
    assert week.levers == ["Move 6 workshop slots out of this week", "Pre-warn Fresh stores of likely deferrals"]
    assert week.days is not None and [d.day for d in week.days] == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    assert view.label == "Baseline forecast: Datathon Task 2A model not wired in" and view.as_of == "Mon 28 Sep" and view.depot == "peliyagoda"


def test_a_week_just_under_capacity_is_tight_and_a_comfortable_one_is_left_out():
    tight = fc.forecast_view("peliyagoda", NOW, _calendar(), demand_per_day=2100, usable_reefers=REEFERS)  # 97%
    assert [(w.status, w.percent, w.lever, w.gap) for w in tight.weeks][0] == ("Tight", 97, "Watch", None)
    assert fc.forecast_view("peliyagoda", NOW, _calendar(), demand_per_day=1500, usable_reefers=REEFERS).weeks == []  # 69%


def test_a_payday_and_a_festival_ramp_raise_their_weeks_and_are_flagged():
    # Fri 16 Oct is a payday (week of Mon 12 Oct); Thu 22 Oct carries a 25% ramp (week of Mon 19 Oct).
    calendar = _calendar(payday={date(2026, 10, 16)}, ramp={date(2026, 10, 22): 0.25})
    view = fc.forecast_view("peliyagoda", NOW, calendar, demand_per_day=2100, usable_reefers=REEFERS)
    by = {w.monday: w for w in view.weeks}
    payday = by["Mon 12 Oct"]
    assert (payday.flags, payday.status, payday.percent) == (["Payday"], "Tight", 98)  # 5 x 2,100 + 2,100 x 1.06 = 12,726 of 12,960
    ramp = by["Mon 19 Oct"]
    assert (ramp.flags, ramp.status, ramp.percent) == (["Festival ramp"], "Short", 101)  # 5 x 2,100 + 2,100 x 1.25 = 13,125
    assert [d.day for d in ramp.days if d.flag == "ramp"] == ["Thu"]  # type: ignore[union-attr]
    assert by["Mon 5 Oct"].flags == [] and by["Mon 5 Oct"].percent == 97


def test_a_depot_with_no_usable_reefer_has_no_outlook_to_give():
    assert fc.forecast_view("kandy", NOW, _calendar(), demand_per_day=2000, usable_reefers=0).weeks == []


def test_a_week_the_calendar_does_not_cover_is_skipped():
    short = {d: f for d, f in _calendar().items() if d < date(2026, 10, 12)}  # nothing after the first Monday's week
    weeks = fc.forecast_view("peliyagoda", NOW, short, demand_per_day=2400, usable_reefers=REEFERS).weeks
    assert [w.monday for w in weeks] == ["Mon 5 Oct"]


def test_the_endpoint_serves_both_depots(client, auth):
    for depot in ("peliyagoda", "kandy"):
        res = client.get(f"/api/v1/dispatcher/forecast?depot={depot}", headers=auth("dispatcher"))
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["depot"] == depot and body["label"] == "Baseline forecast: Datathon Task 2A model not wired in"
        assert body["asOf"] == "Mon 28 Sep"
        assert all(w["percent"] >= 90 and w["status"] in ("Short", "Tight") for w in body["weeks"])
    assert client.get("/api/v1/dispatcher/forecast?depot=nowhere", headers=auth("dispatcher")).status_code == 422
