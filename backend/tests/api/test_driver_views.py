"""The driver views' choices, without a database."""

from __future__ import annotations

from app.services.driver_rows import TripChoice
from app.services.driver_views import no_run_reason, notice_kind, parking_note, pick_trip


def test_the_requested_trip_wins_and_an_unknown_one_is_none():
    trips = [TripChoice(1, True), TripChoice(2, False)]
    assert pick_trip(trips, 1) == 1
    assert pick_trip(trips, 3) is None


def test_without_a_request_the_earliest_unfinished_trip_else_the_last():
    assert pick_trip([TripChoice(2, False), TripChoice(1, True)], None) == 2
    assert pick_trip([TripChoice(1, True), TripChoice(2, True)], None) == 2
    assert pick_trip([], None) is None


def test_a_closed_day_is_a_sunday_or_a_holiday_before_anything_else():
    assert no_run_reason(is_operating=False, is_holiday=False, released=True, has_trip=True) == "sunday"
    assert no_run_reason(is_operating=False, is_holiday=True, released=False, has_trip=False) == "holiday"


def test_an_open_day_needs_a_released_plan_and_a_trip():
    assert no_run_reason(is_operating=True, is_holiday=False, released=False, has_trip=False) == "not_released"
    assert no_run_reason(is_operating=None, is_holiday=False, released=True, has_trip=False) == "no_trip"
    assert no_run_reason(is_operating=True, is_holiday=False, released=True, has_trip=True) is None


def test_stored_notices_become_the_phones_kinds():
    assert notice_kind("Plan", {}) == "plan_released"
    assert notice_kind("Change", {"planVersion": 5}) == "plan_released"
    assert notice_kind("Review", {"conflictId": 3}) == "resolved"
    assert notice_kind("Review", {}) is None
    assert notice_kind("Delivery", {}) is None


def test_parking_is_said_in_the_screens_words():
    assert parking_note("normal") is None and parking_note(None) is None
    assert parking_note("van_only") == "Vans only"
    assert parking_note("loading_bay_only") == "Loading bay only"
