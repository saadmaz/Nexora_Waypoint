"""Starting a run by hand (dispatch fix plan task 2): a move into a vehicle's next trip opens it.

Plan v3 leaves VEH036 (reefer van, free from 02:45) and VEH037 (ambient van) without a trip, and VEH011 with one.
"""

from __future__ import annotations

from dataclasses import replace

import pytest

from waypoint_rules import Move, NoSuchTrip, RuleId, planned_clock, validate_move
from waypoint_rules.moves import next_trip_no


def test_a_move_into_an_idle_vehicles_trip_1_opens_it(v3, orders, ref, vdays):
    res = validate_move(v3, Move("ORD1012", ("VEH036", 1)), orders, ref, vdays)
    assert res.opens_trip_at is not None
    assert res.target_before is None and res.inserted_at == 0
    assert res.target_after is not None and res.target_after.stops == 1
    assert "VEH036" not in {k[0] for k in v3.trips}  # the plan passed in is untouched


def test_a_second_trip_leaves_after_the_first_is_back(v3, orders, ref, vdays):
    res = validate_move(v3, Move("ORD1012", ("VEH011", 2)), orders, ref, vdays)
    first = v3.trips[("VEH011", 1)]
    back = planned_clock(first, orders, ref).back_at_depot
    assert res.opens_trip_at is not None and back is not None and res.opens_trip_at >= back


def test_a_third_trip_opens_and_is_refused_by_r_trips(v3, orders, ref, vdays):
    res = validate_move(v3, Move("ORD1007", ("VEH003", 3)), orders, ref, vdays)
    assert res.opens_trip_at is not None
    assert not res.ok and RuleId.TRIPS in {v.rule for v in res.violations}


def test_a_held_vehicle_cannot_start_a_run(v3, orders, ref, vdays):
    held = {**vdays, "VEH037": replace(vdays["VEH037"], held=True)}
    res = validate_move(v3, Move("ORD1007", ("VEH037", 1)), orders, ref, held)
    assert not res.ok and RuleId.AVAIL in {v.rule for v in res.violations}


def test_trip_numbers_must_follow_on(v3, orders, ref, vdays):
    assert next_trip_no(v3, "VEH037") == 1 and next_trip_no(v3, "VEH003") == 3
    with pytest.raises(NoSuchTrip):
        validate_move(v3, Move("ORD1012", ("VEH037", 2)), orders, ref, vdays)
    with pytest.raises(NoSuchTrip):
        validate_move(v3, Move("ORD1012", ("VEH999", 1)), orders, ref, vdays)


def test_an_existing_trip_is_still_a_plain_move(v3, orders, ref, vdays):
    res = validate_move(v3, Move("ORD1009", ("VEH003", 2)), orders, ref, vdays)
    assert res.opens_trip_at is None and res.target_before is not None
