"""Capability, whole-plan and policy boundaries on synthetic changes to the documented reference day."""

from copy import deepcopy
from dataclasses import replace

import pytest

from waypoint_rules import (
    DeferralType,
    RuleId,
    capable_vehicles,
    check_plan,
    check_trip,
    check_vehicle_day,
    classify_deferral,
    usable_vehicles,
    validate_policy_action,
)

from .conftest import at


def test_capability_and_usability_are_distinct(orders, ref, vdays):
    order = orders["ORD1014"]
    held = {vid: replace(day, held=True) for vid, day in vdays.items()}
    assert capable_vehicles(order, ref) == ["VEH003", "VEH035", "VEH036"]
    assert usable_vehicles(order, ref, held) == []
    assert classify_deferral(order, ref, held) is DeferralType.POLICY
    assert "VEH036" not in usable_vehicles(order, ref, vdays)
    assert "VEH036" in usable_vehicles(order, ref, vdays, at("03:30"))
    assert capable_vehicles(orders["ORD1020"], ref) == []


def test_complete_plan_and_metadata(v3, orders, ref, vdays):
    reasons = {oid: (classify_deferral(orders[oid], ref), "A real constraint") for oid in v3.deferred}
    assert check_plan(v3, orders, ref, vdays, deferral_reasons=reasons) == []
    reasons["ORD1009"] = (DeferralType.POLICY, " ")
    assert any(v.rule is RuleId.WHOLE for v in check_plan(v3, orders, ref, vdays, deferral_reasons=reasons))


@pytest.mark.parametrize("mutation", ["duplicate", "served_and_deferred", "missing", "unknown", "trip_key"])
def test_corrupt_assignment_is_rejected(v3, orders, ref, vdays, mutation):
    plan = deepcopy(v3)
    if mutation == "duplicate":
        plan.trips[("VEH003", 2)].order_ids.append("ORD1002")
    elif mutation == "served_and_deferred":
        plan.deferred.append("ORD1002")
    elif mutation == "missing":
        plan.deferred.remove("ORD1009")
    elif mutation == "unknown":
        plan.deferred.append("UNKNOWN")
    else:
        plan.trips[("VEH003", 2)].trip_no = 1
    assert check_plan(plan, orders, ref, vdays)


def test_second_trip_must_wait_for_return(v3, orders, ref, vdays):
    trips = deepcopy(v3.trips_of("VEH003"))
    trips[1].depart_at = at("06:08")
    found = check_vehicle_day(ref.vehicles["VEH003"], trips, orders, ref, vdays["VEH003"])
    assert [v.rule for v in found] == [RuleId.TRIPS]
    assert "returns at 06:09" in found[0].message
    trips[1].trip_no = 3
    assert RuleId.TRIPS in {v.rule for v in check_trip(trips[1], orders, ref)}


def test_policy_continuity_does_not_override_store_request_or_physics(orders, ref):
    order = orders["ORD1001"]
    assert [v.rule for v in validate_policy_action(order, DeferralType.POLICY, ref, reason="Shortfall")] == [RuleId.CONT]
    assert validate_policy_action(order, DeferralType.STORE_REQUEST, ref, reason="Store closed") == []
    impossible = replace(order, weight_kg=100_000)
    assert validate_policy_action(impossible, DeferralType.CAPACITY, ref, reason="No capable vehicle") == []
    assert validate_policy_action(order, DeferralType.CAPACITY, ref, reason="Shortfall")
