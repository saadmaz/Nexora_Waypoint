"""The planner (PRD v3 §12) on the §4c reference day: the pinned orders, six story vehicles and three districts.

Every plan it writes must break no hard constraint, serve each order once, and be the same plan every time. Where
the planner and the hand-made v3 plan differ, ``test_report_against_plan_v3`` prints the comparison instead of
asserting it (PRD §18 DP-01: computed numbers are allowed).
"""

from __future__ import annotations

from dataclasses import replace

import pytest

from waypoint_rules import (
    Binding,
    DeferralType,
    OutletHistory,
    PlanDraft,
    check_trip,
    check_vehicle_day,
    draft_plan,
    hhmm,
    planned_clock,
    trip_minutes,
)

from .conftest import ORDERS, REF, SERVICE, VEHICLE_DAYS, plan_v3


@pytest.fixture(scope="module")
def draft() -> PlanDraft:
    return draft_plan(ORDERS, REF, VEHICLE_DAYS, service_date=SERVICE)


def _by_order(draft: PlanDraft) -> dict[str, tuple[str, int]]:
    return {s.order_id: (t.vehicle_id, t.trip_no) for t in draft.trips for s in t.stops}


def _deferred(draft: PlanDraft) -> dict[str, object]:
    return {d.order_id: d for d in draft.deferrals}


# --------------------------------------------------------------------------- hard constraints


def test_no_trip_breaks_a_rule(draft):
    for t in draft.trips:
        assert check_trip(t.to_trip(), ORDERS, REF, VEHICLE_DAYS.get(t.vehicle_id)) == [], (t.vehicle_id, t.trip_no)


def test_no_vehicle_day_breaks_a_rule(draft):
    plan = draft.as_plan()
    for vid in {t.vehicle_id for t in draft.trips}:
        found = check_vehicle_day(REF.vehicles[vid], plan.trips_of(vid), ORDERS, REF, VEHICLE_DAYS.get(vid))
        assert found == [], vid


def test_every_order_is_served_once_or_deferred_once(draft):
    served = [s.order_id for t in draft.trips for s in t.stops]
    deferred = [d.order_id for d in draft.deferrals]
    assert len(served) == len(set(served))
    assert not set(served) & set(deferred)
    assert sorted(served + deferred) == sorted(ORDERS)


def test_the_workshop_vehicle_is_not_in_the_draft(draft):
    """VEH036 is in the workshop until 02:45, so the 16:05 draft does not use it (PRD §12 step 1)."""
    assert "VEH036" not in {t.vehicle_id for t in draft.trips}


def test_a_held_vehicle_is_not_used():
    vdays = {**VEHICLE_DAYS, "VEH003": replace(VEHICLE_DAYS["VEH003"], held=True)}
    draft = draft_plan(ORDERS, REF, vdays, service_date=SERVICE)
    assert "VEH003" not in {t.vehicle_id for t in draft.trips}


# --------------------------------------------------------------------------- deferrals


def test_ord1020_is_a_capacity_deferral_by_van_access(draft):
    d = _deferred(draft)["ORD1020"]
    assert d.type is DeferralType.CAPACITY
    assert d.binding is Binding.VAN_ACCESS
    assert d.reason_text == (
        "van_only and 1,250 kg; the largest Peliyagoda reefer van carries 1,040 kg; whole orders can't split."
    )


def test_every_deferral_is_explained(draft):
    for d in draft.deferrals:
        assert d.reason_text
        assert d.next_run_date > SERVICE
        assert d.next_run_date.weekday() != 6  # Waypoint does not run on Sundays
        assert d.impact.consequence
        assert d.frees.kg > 0


def test_next_run_follows_the_calendar_when_given():
    from datetime import date

    draft = draft_plan(ORDERS, REF, VEHICLE_DAYS, service_date=SERVICE, operating_days=[date(2026, 9, 29), date(2026, 10, 1)])
    assert {d.next_run_date for d in draft.deferrals} == {date(2026, 10, 1)}


def test_protected_outlets_are_never_policy_deferred(draft):
    """OUT012 (ORD1001) and OUT029 (ORD1005) were deferred yesterday: the continuity guard keeps them on a trip."""
    placed = _by_order(draft)
    assert "ORD1001" in placed
    assert "ORD1005" in placed
    assert draft.warnings == ()


def test_continuity_comes_before_everything_else_under_pressure():
    """With one reefer van left and more orders than it can carry, the protected orders are the ones that stay."""
    vdays = {**VEHICLE_DAYS, "VEH003": replace(VEHICLE_DAYS["VEH003"], held=True)}
    colombo = {
        k: v
        for k, v in ORDERS.items()
        if REF.outlets[v.outlet_id].district == "Colombo" and v.temp.value == "chilled" and k != "ORD1020"
    }
    plain = draft_plan(colombo, REF, vdays, service_date=SERVICE)
    assert plain.deferrals, "the scenario must be tight enough to defer something"
    assert "ORD1001" in _by_order(plain)  # OUT012 is protected in the orders themselves

    # A history record that protects OUT014 replaces what the order says, and moves ORD1009 to the front of the queue.
    protected = draft_plan(colombo, REF, vdays, {"OUT014": OutletHistory(True, 2)}, service_date=SERVICE)
    assert "ORD1009" in _by_order(protected)
    assert all(d.order_id != "ORD1009" for d in protected.deferrals)


def test_a_second_trip_leaves_after_the_first_is_back():
    vdays = {**VEHICLE_DAYS, "VEH003": replace(VEHICLE_DAYS["VEH003"], held=True)}
    colombo = {
        k: v
        for k, v in ORDERS.items()
        if REF.outlets[v.outlet_id].district == "Colombo" and v.temp.value == "chilled" and k != "ORD1020"
    }
    draft = draft_plan(colombo, REF, vdays, service_date=SERVICE)
    trips = [t for t in draft.trips if t.vehicle_id == "VEH035"]
    assert [t.trip_no for t in trips] == [1, 2]
    first, second = (t.to_trip() for t in trips)
    back = planned_clock(first, ORDERS, REF).back_at_depot
    assert back is not None and second.depart_at >= back
    assert check_vehicle_day(REF.vehicles["VEH035"], [first, second], ORDERS, REF, vdays["VEH035"]) == []


# --------------------------------------------------------------------------- shape of a trip


def test_stops_follow_the_window_and_load_numbers_reverse_them(draft):
    for t in draft.trips:
        n = len(t.stops)
        assert [s.seq for s in t.stops] == list(range(1, n + 1))
        assert [s.load_no for s in t.stops] == list(range(n, 0, -1))
        keys = [
            (REF.outlets[ORDERS[s.order_id].outlet_id].effective_open, REF.outlets[ORDERS[s.order_id].outlet_id].effective_close,
             ORDERS[s.order_id].outlet_id, s.order_id)
            for s in t.stops
        ]
        assert keys == sorted(keys)


def test_each_trip_has_one_brand_and_one_district(draft):
    for t in draft.trips:
        outlets = {REF.outlets[ORDERS[s.order_id].outlet_id] for s in t.stops}
        assert {o.brand for o in outlets} == {t.brand}
        assert {o.district for o in outlets} == {t.district}


def test_departures_follow_the_brand(draft):
    for t in draft.trips:
        if t.trip_no == 1 and t.brand.value == "Fresh":
            assert hhmm(t.depart_at) == "03:30"
    mall = next(t for t in draft.trips if "ORD1007" in t.order_ids)
    assert hhmm(mall.depart_at) == "08:36"  # reaches the 09:00 mall window as it opens
    assert hhmm(planned_clock(mall.to_trip(), ORDERS, REF).stops[0].arrival) == "09:00"


def test_the_kandy_orders_ride_together_on_veh039_trip_1(draft):
    placed = _by_order(draft)
    assert placed["ORD2001"] == placed["ORD2002"] == placed["ORD2003"] == ("VEH039", 1)


def test_vehicles_stay_in_their_own_depot(draft):
    for t in draft.trips:
        depots = {REF.outlets[ORDERS[s.order_id].outlet_id].depot for s in t.stops}
        assert depots == {REF.vehicles[t.vehicle_id].depot}


# --------------------------------------------------------------------------- determinism


def test_the_same_input_gives_the_same_plan(draft):
    assert draft_plan(ORDERS, REF, VEHICLE_DAYS, service_date=SERVICE) == draft


def test_the_order_of_the_input_does_not_matter(draft):
    shuffled = dict(reversed(list(ORDERS.items())))
    assert draft_plan(shuffled, REF, dict(reversed(list(VEHICLE_DAYS.items()))), service_date=SERVICE) == draft


def test_an_empty_queue_is_an_empty_plan():
    draft = draft_plan({}, REF, VEHICLE_DAYS, service_date=SERVICE)
    assert draft.trips == () and draft.deferrals == ()


# --------------------------------------------------------------------------- report


def test_report_against_plan_v3(draft, capsys):
    """Prints the computed plan against the v3 table in PRD §4c. Nothing is asserted: the numbers are the planner's own."""
    v3 = plan_v3()
    peliyagoda = [d for d in draft.deferrals if REF.outlets[ORDERS[d.order_id].outlet_id].depot == "peliyagoda"]
    lines = ["", "PLANNER vs PLAN v3 (PRD 4c), pinned orders only", "-" * 60]
    for t in draft.trips:
        tr = t.to_trip()
        kg = sum(ORDERS[s.order_id].weight_kg for s in t.stops)
        lines.append(
            f"{t.vehicle_id} trip {t.trip_no}  dep {hhmm(t.depart_at)}  {trip_minutes(tr, ORDERS, REF):>3} min  "
            f"{kg:>5.0f} kg  stops {[s.order_id for s in t.stops]}"
        )
    lines += ["", "v3 (hand-made)"]
    for key, tr in sorted(v3.trips.items()):
        lines.append(f"{key[0]} trip {key[1]}  dep {hhmm(tr.depart_at)}  {trip_minutes(tr, ORDERS, REF):>3} min  stops {tr.order_ids}")
    lines += ["", f"Deferred (planner): {[(d.order_id, d.type.value, d.binding.value if d.binding else None) for d in draft.deferrals]}"]
    lines.append(f"Deferred (v3):      {v3.deferred}")
    lines.append(f"Peliyagoda deferrals: {len(peliyagoda)} (target 19 with the generated orders; this day has only the pinned ones)")
    with capsys.disabled():
        print("\n".join(lines))
