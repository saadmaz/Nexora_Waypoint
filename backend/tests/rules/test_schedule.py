"""When the next plan is expected (``next_plan_at``)."""

from __future__ import annotations

from datetime import date, datetime

from waypoint_rules import next_plan_at

OPS = [date(2026, 9, 26), date(2026, 9, 28), date(2026, 9, 29)]


def test_the_next_plan_comes_the_evening_before_the_next_operating_day():
    # Sun 27 Sep is closed: Monday's plan is released at 23:40 on Sunday.
    assert next_plan_at(date(2026, 9, 27), OPS) == datetime(2026, 9, 27, 23, 40)
    assert next_plan_at(date(2026, 9, 28), OPS) == datetime(2026, 9, 28, 23, 40)


def test_past_the_end_of_the_calendar_there_is_no_next_plan():
    assert next_plan_at(date(2026, 9, 29), OPS) is None
