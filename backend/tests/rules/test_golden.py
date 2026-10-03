"""Golden tests: the rules reproduce the numbers in PRD v3 §4a and §4c."""

from __future__ import annotations

from datetime import date, datetime

import pytest

from waypoint_rules import (
    Binding,
    DeferralType,
    IllegalTransition,
    LatenessRisk,
    Move,
    OrderEvent,
    OrderStatus,
    RemainingStop,
    Role,
    RuleId,
    Trip,
    binding_resource,
    check_trip,
    check_vehicle_day,
    classify_deferral,
    headline,
    lateness_risk,
    legal_vehicles,
    planned_clock,
    recommend_swap,
    service_day_for,
    status_label,
    store_arrival,
    transition,
    trip_minutes,
    validate_move,
    vehicle_day_totals,
    why_this_vehicle,
)
from waypoint_rules.calc import hhmm

from .conftest import at

# --------------------------------------------------------------------------- trip minutes


@pytest.mark.parametrize(
    ("key", "minutes"),
    [(("VEH003", 1), 132), (("VEH003", 2), 109), (("VEH035", 1), 125), (("VEH035", 2), 101),
     (("VEH011", 1), 83), (("VEH039", 1), 73)],
)
def test_trip_minutes_match_plan_v3(v3, orders, ref, key, minutes):
    assert trip_minutes(v3.trips[key], orders, ref) == minutes


def test_vehicle_totals_match_plan_v3(v3, orders, ref, vdays):
    def totals(vid):
        return vehicle_day_totals(ref.vehicles[vid], v3.trips_of(vid), orders, ref, vdays[vid])

    assert totals("VEH003").fresh_min == 241
    assert round(totals("VEH003").fuel_week_l, 1) == 74.2
    assert totals("VEH035").fresh_min == 226
    assert round(totals("VEH035").fuel_week_l, 1) == 54.3
    assert totals("VEH011").style_tech_min == 83
    assert round(totals("VEH011").fuel_week_l, 1) == 68.9
    assert totals("VEH039").fresh_min == 73
    assert round(totals("VEH039").fuel_week_l, 1) == 75.4


# --------------------------------------------------------------------------- planned clock


def _arrivals(trip, orders, ref):
    return [hhmm(s.arrival) for s in planned_clock(trip, orders, ref).stops]


def test_planned_clock_veh003(v3, orders, ref):
    t1 = v3.trips[("VEH003", 1)]
    assert _arrivals(t1, orders, ref) == ["03:54", "04:17", "04:41", "05:04", "05:27"]
    clock = planned_clock(t1, orders, ref)
    assert clock.stops[-1].waits and hhmm(clock.stops[-1].handling_start) == "05:30"
    assert hhmm(clock.back_at_depot) == "06:09"  # trip 2 departs 06:09
    assert _arrivals(v3.trips[("VEH003", 2)], orders, ref) == ["06:33", "06:56", "07:19", "07:42"]


def test_planned_clock_veh035_and_veh011(v3, orders, ref):
    t1 = v3.trips[("VEH035", 1)]
    assert _arrivals(t1, orders, ref) == ["04:07", "04:31", "04:56", "05:20"]
    assert hhmm(planned_clock(t1, orders, ref).back_at_depot) == "06:12"
    assert _arrivals(v3.trips[("VEH035", 2)], orders, ref) == ["06:49", "07:14", "07:38"]
    assert _arrivals(v3.trips[("VEH011", 1)], orders, ref) == ["09:00"]


def test_planned_clock_hero_two_orders_share_one_arrival(v3, orders, ref):
    clock = planned_clock(v3.trips[("VEH039", 1)], orders, ref)
    assert [s.order_ids for s in clock.stops] == [("ORD2001", "ORD2002"), ("ORD2003",)]
    assert hhmm(clock.stops[0].arrival) == "05:26" and hhmm(clock.stops[0].handling_start) == "05:30"
    assert hhmm(clock.stops[1].arrival) == "06:06"


# --------------------------------------------------------------------------- hard constraints


def test_plan_v3_breaks_no_rule(v3, orders, ref, vdays):
    for trip in v3.trips.values():
        assert check_trip(trip, orders, ref, vdays[trip.vehicle_id]) == [], trip.key
    for vid in {k[0] for k in v3.trips}:
        assert check_vehicle_day(ref.vehicles[vid], v3.trips_of(vid), orders, ref, vdays[vid]) == [], vid


def test_d33_refused_move_window(v3, orders, ref, vdays):
    res = validate_move(v3, Move("ORD1009", ("VEH003", 2)), orders, ref, vdays)
    assert not res.ok
    assert [(v.rule, v.message) for v in res.violations] == [
        (RuleId.WINDOW, "Arrives 08:06, after OUT014 closes at 08:00")
    ]
    assert res.target_after.stops == 5 and res.inserted_at == 4


def test_orD1006_on_veh035_trip2_would_arrive_0802(v3, orders, ref, vdays):
    res = validate_move(v3, Move("ORD1006", ("VEH035", 2)), orders, ref, vdays)
    assert [v.message for v in res.violations] == ["Arrives 08:02, after OUT033 closes at 08:00"]


def test_d34_refused_move_lists_every_rule(v3, orders, ref, vdays):
    res = validate_move(v3, Move("ORD1002", ("VEH011", 1)), orders, ref, vdays)
    assert [(v.rule, v.message) for v in res.violations] == [
        (RuleId.TEMP, "Needs a reefer: VEH011 is ambient"),
        (RuleId.BRAND, "Two brands on one trip: Fresh and Style"),
    ]


def test_d35_continuity_guard(v3, orders, ref, vdays):
    res = validate_move(v3, Move("ORD1001", None), orders, ref, vdays)
    assert [(v.rule, v.message) for v in res.violations] == [
        (RuleId.CONT, "OUT012 was deferred yesterday; the continuity guard protects it")
    ]


def test_accepted_move_has_consequence_preview(v3, orders, ref, vdays):
    # ORD1012 (OUT004, street, last stop of VEH003 trip 2) is not protected, so deferring it is legal.
    res = validate_move(v3, Move("ORD1012", None), orders, ref, vdays)
    assert res.ok and res.violations == []
    assert res.source_before.stops == 4 and res.source_after.stops == 3
    assert res.source_after.minutes == 109 - 8 - 16  # one inter-stop leg and a Fresh street allowance
    assert res.source_after.vehicle_fresh_min == 241 - 24
    assert res.source_after.last_arrival == "07:19"
    assert res.deferral_changes == ["ORD1012 is deferred"]


def test_why_this_vehicle_all_pass(v3, orders, ref, vdays):
    items = why_this_vehicle(v3, "ORD2001", orders, ref, vdays)
    assert all(i.ok for i in items)
    assert {i.rule for i in items} >= {RuleId.TEMP, RuleId.KG, RuleId.M3, RuleId.DEPOT, RuleId.WINDOW, RuleId.FUEL}


def test_workshop_vehicle_unavailable_before_0245(orders, ref, vdays):
    trip = Trip("VEH036", 1, at("02:30"), ["ORD1014"])
    assert [v.rule for v in check_trip(trip, orders, ref, vdays["VEH036"])] == [RuleId.AVAIL]
    trip.depart_at = at("03:30")
    assert check_trip(trip, orders, ref, vdays["VEH036"]) == []


# --------------------------------------------------------------------------- deferrals


def test_orD1020_is_capacity_no_legal_vehicle(orders, ref, vdays):
    assert legal_vehicles(orders["ORD1020"], ref, vdays) == []
    assert classify_deferral(orders["ORD1020"], ref, vdays) is DeferralType.CAPACITY
    assert classify_deferral(orders["ORD1009"], ref, vdays) is DeferralType.POLICY


def test_d8_recommend_swap_defers_orD1002(v3, orders, ref):
    rec = recommend_swap(v3.trips[("VEH003", 1)], ref.vehicles["VEH036"], orders, ref)
    assert (rec.gap_kg, rec.gap_m3) == (120, 0.7)
    assert rec.defer == ("ORD1002",)
    assert (rec.surplus_kg, rec.surplus_m3) == (90, 0.7)
    assert rec.protected == ("ORD1001",)


def test_v4_veh036_after_swap(v3, orders, ref, vdays):
    t1 = Trip("VEH036", 1, at("03:30"), ["ORD1014", "ORD1016", "ORD1011", "ORD1001"])
    t2 = Trip("VEH036", 2, at("06:09"), list(v3.trips[("VEH003", 2)].order_ids))
    assert check_trip(t1, orders, ref, vdays["VEH036"]) == []
    assert trip_minutes(t1, orders, ref) == 109
    assert hhmm(planned_clock(t1, orders, ref).back_at_depot) == "06:09"
    tot = vehicle_day_totals(ref.vehicles["VEH036"], [t1, t2], orders, ref, vdays["VEH036"])
    assert tot.fresh_min == 218 and round(tot.fuel_week_l, 1) == 29.0


def test_headline_and_binding():
    assert headline("peliyagoda", 1, 18) == (
        "Capacity forces 19 deferrals at Peliyagoda. 1 has no legal vehicle; policy chose the other 18."
    )
    b = binding_resource({Binding.REEFER_MINUTES: (2590, 2160), Binding.WEIGHT: (100, 1000)})
    assert b.resource is Binding.REEFER_MINUTES and b.percent == 120 and b.over_by == 430


# --------------------------------------------------------------------------- calendar and store view

OPS = [date(2026, 9, d) for d in (21, 22, 23, 24, 25, 26, 28, 29, 30)] + [date(2026, 10, 1)]


def test_service_day_before_and_after_cutoff():
    before = service_day_for(datetime(2026, 9, 28, 15, 40), OPS)
    assert before.service_date == date(2026, 9, 29) and not before.after_cutoff
    assert before.editable_until == datetime(2026, 9, 28, 16, 0)
    after = service_day_for(datetime(2026, 9, 28, 16, 7), OPS)
    assert after.service_date == date(2026, 9, 30) and after.after_cutoff
    assert after.editable_until == datetime(2026, 9, 29, 16, 0)
    saturday = service_day_for(datetime(2026, 9, 26, 15, 0), OPS)
    assert saturday.service_date == date(2026, 9, 28)  # Sun 27 is not an operating day


def test_store_arrival_range():
    assert store_arrival(at("05:26"), at("05:30")) == "from 05:30 (truck may arrive 05:26 and wait)"
    assert store_arrival(at("06:06"), at("03:00")) == "about 06:06"


def test_lateness_risk():
    ok = [RemainingStop("OUT087", at("06:06"), at("08:00"))]
    late = [RemainingStop("OUT014", at("08:06"), at("08:00"))]
    assert lateness_risk(ok, offline=False) is LatenessRisk.ON_TIME
    assert lateness_risk(late, offline=False) is LatenessRisk.AT_RISK
    assert lateness_risk(ok, offline=False, held=True) is LatenessRisk.AT_RISK
    assert lateness_risk(ok, offline=True) is LatenessRisk.UNKNOWN_OFFLINE


# --------------------------------------------------------------------------- statuses


def test_hero_order_lifecycle():
    s = OrderStatus.ORDERED
    for ev in (OrderEvent.CUTOFF, OrderEvent.PLAN, OrderEvent.LOAD, OrderEvent.DEPART,
               OrderEvent.DEFER, OrderEvent.CONFLICT, OrderEvent.RESOLVE_DELIVERED):
        s = transition(s, ev)
    assert s is OrderStatus.DELIVERED
    with pytest.raises(IllegalTransition, match="delivered can't load"):
        transition(OrderStatus.DELIVERED, OrderEvent.LOAD)
    with pytest.raises(IllegalTransition):
        transition(OrderStatus.CONFIRMED, OrderEvent.CANCEL)


def test_store_never_sees_conflict():
    assert status_label(OrderStatus.CONFLICT, Role.STORE) == "Under review"
    assert status_label(OrderStatus.CONFLICT, Role.DISPATCHER) == "Conflict"


# --------------------------------------------------------------------------- offline (D6)


def test_a_silent_run_is_offline_and_a_parked_vehicle_is_not():
    from waypoint_rules import OFFLINE_AFTER_MINUTES, is_offline

    heard = datetime(2026, 9, 29, 5, 17)
    assert OFFLINE_AFTER_MINUTES == 3
    assert not is_offline(heard, datetime(2026, 9, 29, 5, 20), in_progress=True)  # exactly 3 minutes is not yet silent
    assert is_offline(heard, datetime(2026, 9, 29, 5, 21), in_progress=True)  # H12: the deferral at 05:21 meets a silent phone
    assert not is_offline(heard, datetime(2026, 9, 29, 5, 21), in_progress=False)
    assert not is_offline(None, datetime(2026, 9, 29, 5, 21), in_progress=True)
