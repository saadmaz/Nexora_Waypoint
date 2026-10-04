"""Dispatch fix plan P1 in the rules package: frozen goods (task 5) and travel time by hour (task 6)."""

from __future__ import annotations

from dataclasses import replace

from waypoint_rules import RuleId, Temp, check_trip, planned_clock, trip_minutes


def test_frozen_goods_need_a_reefer(v3, orders, ref, vdays):
    frozen = {**orders, "ORD1007": replace(orders["ORD1007"], temp=Temp.FROZEN)}
    trip = v3.trips[("VEH011", 1)]  # VEH011 is ambient
    assert RuleId.TEMP in {v.rule for v in check_trip(trip, frozen, ref, vdays["VEH011"])}
    assert Temp.FROZEN.needs_reefer and Temp.CHILLED.needs_reefer and not Temp.AMBIENT.needs_reefer


def test_slower_roads_push_arrivals_later_but_leave_the_budget_formula_alone(v3, orders, ref):
    trip = v3.trips[("VEH003", 1)]
    base = planned_clock(trip, orders, ref)
    slow = replace(ref, travel={("Colombo", hour): 1.5 for hour in range(24)})
    later = planned_clock(trip, orders, slow)
    assert later.stops[0].arrival > base.stops[0].arrival
    assert later.back_at_depot is not None and base.back_at_depot is not None and later.back_at_depot > base.back_at_depot
    assert trip_minutes(trip, orders, slow) == trip_minutes(trip, orders, ref)  # booklet Task 2B stays free flow


def test_without_traffic_data_every_leg_is_free_flow(v3, orders, ref):
    trip = v3.trips[("VEH003", 1)]
    assert planned_clock(trip, orders, replace(ref, travel={})) == planned_clock(trip, orders, ref)
