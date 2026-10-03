"""Capability, whole-plan and policy boundaries on synthetic changes to the documented reference day."""

from copy import deepcopy
from dataclasses import replace

import pytest

from waypoint_rules import (
    Brand,
    DeferralType,
    RuleId,
    VehicleTemp,
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


@pytest.mark.parametrize("mutation", ["duplicate", "served_and_deferred", "missing", "unknown", "trip_key", "service_date"])
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
    elif mutation == "trip_key":
        plan.trips[("VEH003", 2)].trip_no = 1
    else:
        plan.trips[("VEH003", 1)].depart_at = at("03:30").replace(day=30)
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


@pytest.mark.parametrize(("case", "rule"), [
    ("weight", RuleId.KG), ("volume", RuleId.M3), ("temp", RuleId.TEMP),
    ("van", RuleId.VAN), ("depot", RuleId.DEPOT), ("brand", RuleId.BRAND),
    ("district", RuleId.DISTRICT), ("window", RuleId.WINDOW), ("mall", RuleId.MALL),
])
def test_trip_rules_each_pass_and_fail(v3, orders, ref, case, rule):
    from datetime import time

    trip = v3.trips[("VEH003", 1)]
    assert check_trip(trip, orders, ref) == []
    vehicle, outlet = ref.vehicles["VEH003"], ref.outlets["OUT011"]
    if case == "weight":
        vehicle = replace(vehicle, weight_cap_kg=1)
    elif case == "volume":
        vehicle = replace(vehicle, volume_cap_m3=0.1)
    elif case == "temp":
        vehicle = replace(vehicle, temp=VehicleTemp.AMBIENT)
    elif case == "van":
        outlet = replace(outlet, van_only=True)
    elif case == "depot":
        outlet = replace(outlet, depot="kandy")
    elif case == "brand":
        outlet = replace(outlet, brand=Brand.STYLE)
    elif case == "district":
        outlet = replace(outlet, district="Gampaha")
    elif case == "window":
        outlet = replace(outlet, window_close=time(3, 50))
    else:
        outlet = replace(outlet, mall_dock=True, mall_open=time(3), mall_close=time(3, 50))
    changed = replace(ref, vehicles={**ref.vehicles, vehicle.id: vehicle}, outlets={**ref.outlets, outlet.id: outlet})
    assert rule in {v.rule for v in check_trip(trip, orders, changed)}


def test_vehicle_day_budget_fuel_and_availability_pass_and_fail(v3, orders, ref, vdays):
    vehicle = ref.vehicles["VEH003"]
    trips = v3.trips_of(vehicle.id)
    assert check_vehicle_day(vehicle, trips, orders, ref, vdays[vehicle.id]) == []
    assert RuleId.FUEL in {v.rule for v in check_vehicle_day(replace(vehicle, weekly_fuel_quota_l=1), trips, orders, ref, vdays[vehicle.id])}
    assert RuleId.AVAIL in {v.rule for v in check_vehicle_day(vehicle, trips, orders, ref, replace(vdays[vehicle.id], held=True))}
    longer = deepcopy(trips)
    longer[0].order_ids *= 2
    assert RuleId.BUDGET_FRESH in {v.rule for v in check_vehicle_day(vehicle, longer, orders, ref)}
    style = deepcopy(v3.trips[("VEH011", 1)])
    assert check_vehicle_day(ref.vehicles["VEH011"], [style], orders, ref) == []
    style.order_ids *= 9
    assert RuleId.BUDGET_STYLE_TECH in {v.rule for v in check_vehicle_day(ref.vehicles["VEH011"], [style], orders, ref)}
