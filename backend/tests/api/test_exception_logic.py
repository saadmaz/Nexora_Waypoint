"""D8, the loading exception, on the PRD's own plan v3 (PRD v3 §4c, §12 "D8 recommendation"), with no database.

The planner draws its own plan, so these tests start from the hand-made v3 in ``tests/rules/conftest.py``: VEH003 fails at
02:55, VEH036 is back from the workshop at 02:45 and is 120 kg / 0.7 m³ short on Trip 1, and the rules defer ORD1002.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime

import pytest

from app.models.enums import ExceptionStatus, PlanState
from app.services import exception_logic as ex
from app.services.dispatch_model import DeferralRow, DispatchDay, OutletRow, TripRow, VehicleAvailability, VersionRow
from tests.rules.conftest import ORDERS, REF, SERVICE, VEHICLE_DAYS, plan_v3
from waypoint_rules import check_trip, trip_minutes
from waypoint_rules.vocab import Binding, DeferralType, RuleId

NOW = datetime(2026, 9, 29, 3, 0)
NEXT_RUN = datetime(2026, 9, 30).date()


def _day(now: datetime = NOW, *, held: tuple[str, ...] = ()) -> DispatchDay:
    v3 = plan_v3()
    outlets = {o.id: OutletRow(o.id, o.id, o.brand, o.district, o.depot, o.dock_type, o.van_only, o.mall_dock) for o in REF.outlets.values()}
    trips = [
        TripRow(t.vehicle_id, t.trip_no, REF.outlets[ORDERS[t.order_ids[0]].outlet_id].brand, REF.outlets[ORDERS[t.order_ids[0]].outlet_id].district, t.depart_at, tuple(t.order_ids))
        for t in v3.trips.values()
    ]
    deferrals = [
        DeferralRow(i + 1, oid, DeferralType.CAPACITY if oid == "ORD1020" else DeferralType.POLICY, Binding.WINDOW, "v3", {}, {}, NEXT_RUN, "System draft", None, None, None)
        for i, oid in enumerate(v3.deferred)
    ]
    vdays = dict(VEHICLE_DAYS)
    for vid in held:
        vdays[vid] = vdays[vid].__class__(vid, held=True, fuel_used_before_l=vdays[vid].fuel_used_before_l)
    return DispatchDay(
        service_date=SERVICE, now=now, ref=REF, orders=dict(ORDERS), outlets=outlets, plannable=set(ORDERS),
        versions=[VersionRow(3, 3, PlanState.RELEASED, "Peliyagoda + Kandy", "Kumari", datetime(2026, 9, 28, 23, 40), datetime(2026, 9, 28, 23, 40))],
        chosen=VersionRow(3, 3, PlanState.RELEASED, "Peliyagoda + Kandy", "Kumari", datetime(2026, 9, 28, 23, 40), datetime(2026, 9, 28, 23, 40)),
        trips=trips, deferrals=deferrals, vehicle_days=vdays,
        availability={vid: VehicleAvailability(vd.available_from is not None, vd.available_from, None) for vid, vd in vdays.items()},
        drivers={"VEH036": "R. Silva", "VEH003": "Kasun", "VEH035": "P. Kumara", "VEH011": "S. Jayasena", "VEH037": "X", "VEH039": "Nimal"},
        loaders={"peliyagoda": "Priya", "kandy": "Ruwan"},
    )


def _row(status: ExceptionStatus = ExceptionStatus.OPEN, decision: dict | None = None) -> ex.ExceptionRow:
    return ex.ExceptionRow(
        1, "loader_shortfall", "Vehicle check failed", "VEH003", None, (), "Reefer not holding temperature", "Priya",
        datetime(2026, 9, 29, 2, 55), status, decision, "Kumari" if decision else None, datetime(2026, 9, 29, 3, 0) if decision else None,
    )


# --------------------------------------------------------------------------- choosing and swapping


def test_the_replacement_is_the_free_reefer_van():
    replacement = ex.choose_replacement(_day(), "VEH003")
    assert replacement is not None and replacement.id == "VEH036"


def test_nothing_is_chosen_while_the_van_is_still_in_the_workshop():
    assert ex.choose_replacement(_day(now=datetime(2026, 9, 29, 2, 30)), "VEH003") is None


def test_a_held_vehicle_is_not_a_replacement():
    assert ex.choose_replacement(_day(held=("VEH036",)), "VEH003") is None


def test_the_rules_defer_ord1002_and_protect_out012():
    day = _day()
    swap = ex.build_swap(day, "VEH003", REF.vehicles["VEH036"])
    rec = swap.recommendations[1]
    assert (rec.gap_kg, rec.gap_m3) == (120.0, 0.7)
    assert swap.defer == ["ORD1002"]
    assert rec.protected == ("ORD1001",)
    assert swap.violations == []
    assert swap.gap == (120.0, 0.7)


def test_after_the_swap_the_van_carries_950_kg_in_109_minutes():
    day = _day()
    swap = ex.build_swap(day, "VEH003", REF.vehicles["VEH036"])
    first = swap.plan.trips[("VEH036", 1)]
    assert first.order_ids == ["ORD1014", "ORD1016", "ORD1011", "ORD1001"]
    assert sum(ORDERS[o].weight_kg for o in first.order_ids) == 950
    assert round(sum(ORDERS[o].volume_m3 for o in first.order_ids), 1) == 6.3
    assert trip_minutes(first, ORDERS, REF) == 109
    assert ("VEH003", 1) not in swap.plan.trips and "ORD1002" in swap.plan.deferred
    assert check_trip(first, ORDERS, REF, VEHICLE_DAYS["VEH036"]) == []


def test_the_second_trip_moves_across_unchanged():
    swap = ex.build_swap(_day(), "VEH003", REF.vehicles["VEH036"])
    second = swap.plan.trips[("VEH036", 2)]
    assert second.order_ids == ["ORD1013", "ORD1015", "ORD1018", "ORD1012"] and second.depart_at == datetime(2026, 9, 29, 6, 9)


def test_the_deferral_reason_is_the_prd_line():
    swap = ex.build_swap(_day(), "VEH003", REF.vehicles["VEH036"])
    assert ex.deferral_reason(swap, 1, "Kumari") == "VEH003 failed its check; replacement VEH036 is 120 kg / 0.7 m³ short on Trip 1."
    assert ex.deferral_binding(swap, 1) is Binding.WEIGHT
    assert ex.trip_of_order(swap, "ORD1002") == 1


# --------------------------------------------------------------------------- adjusting manually (D8.3)


def test_another_order_can_be_chosen_if_it_closes_the_gap():
    swap = ex.build_swap(_day(), "VEH003", REF.vehicles["VEH036"], ["ORD1014"])
    assert swap.violations == [] and swap.defer == ["ORD1014"]


def test_deferring_nothing_leaves_the_van_over_its_limits():
    rules = {v.rule for v in ex.build_swap(_day(), "VEH003", REF.vehicles["VEH036"], []).violations}
    assert {RuleId.KG, RuleId.M3} <= rules


def test_a_protected_outlet_cannot_be_the_one_deferred():
    violations = ex.build_swap(_day(), "VEH003", REF.vehicles["VEH036"], ["ORD1001"]).violations
    assert RuleId.CONT in {v.rule for v in violations}


def test_an_order_from_another_vehicle_does_not_help():
    violations = ex.build_swap(_day(), "VEH003", REF.vehicles["VEH036"], ["ORD1023"]).violations
    assert RuleId.WHOLE in {v.rule for v in violations}


# --------------------------------------------------------------------------- what the screen shows


def test_the_screen_before_a_decision():
    view = ex.exception_view(_day(), _row(), next_run=NEXT_RUN)
    assert view.state == "recommendation" and view.title == "VEH003 held: replace it before 03:30"
    assert (view.flagged_by, view.flagged_at, view.reason) == ("Priya", "02:55", "Reefer not holding temperature")
    assert view.orders_text == "9 orders on 2 trips stay Planned. Trip 1 departs 03:30 from the Peliyagoda dock."
    assert view.minutes_to_departure == 30
    assert view.failed.tag == "Held" and view.failed.spec == "Truck · reefer · 5,510 kg · 26.4 m³"
    assert view.replacement is not None and view.replacement.vehicle_id == "VEH036"
    assert view.replacement.spec == "Van · reefer · 1,040 kg · 7.0 m³" and view.replacement.since == "02:45"
    assert (view.need.kg, view.need.m3) == (120, 0.7)


def test_before_and_after_match_the_design():
    view = ex.exception_view(_day(), _row(), next_run=NEXT_RUN)
    assert view.before is not None and view.after is not None
    assert (view.before.weight.used, view.before.weight.limit) == (1160, 1040)
    assert view.before.weight.over == "Over by 120 kg, defer one order or swap vehicle"
    assert (view.before.volume.used, view.before.volume.limit, view.before.volume.over) == (7.7, 7.0, "Over by 0.7 m³")
    assert view.before.trip2 == "Trip 2 fits: 340 kg · 3.3 m³"
    assert (view.after.weight.used, view.after.weight.warn) == (950, "91%: little room left")
    assert (view.after.volume.used, view.after.volume.warn) == (6.3, "90%: full van")
    assert view.after.trip1_minutes == 109 and view.after.trip2 == "06:09 → OUT004 07:42"
    assert view.after.fresh == "218 / 270 min" and view.after.fuel == "29.0 / 480 L"
    assert view.after.stops == ["OUT011", "OUT006", "OUT005", "OUT012"]
    assert view.after.stops_note == "OUT012 reached 05:04 · waits to 05:30"


def test_the_recommendation_names_the_order_and_what_it_frees():
    rec = ex.exception_view(_day(), _row(), next_run=NEXT_RUN).recommendation
    assert rec is not None
    assert (rec.order_id, rec.outlet_id, rec.title, rec.kind) == ("ORD1002", "OUT009", "OUT009: chilled order", DeferralType.POLICY)
    assert rec.order_ids == ["ORD1002"]
    assert rec.frees == "210 kg / 1.4 m³" and rec.next_run == "Wed 30 Sep" and rec.decided_by == "Recommended · 03:00"
    assert rec.reason == "Vehicle unavailable · Least surplus of the 4 equal-impact orders"
    assert [(p.outlet_id, p.order_id) for p in rec.protected] == [("OUT012", "ORD1001")]


def _short_replacement_day() -> DispatchDay:
    """A replacement 510 kg short, which no single order closes: on the generated day VEH003 carries ten orders."""
    day = _day()
    small = replace(REF.vehicles["VEH036"], weight_cap_kg=650.0)
    day.ref = replace(REF, vehicles={**REF.vehicles, "VEH036": small})
    return day


def test_a_gap_that_needs_several_orders_recommends_the_whole_set():
    view = ex.exception_view(_short_replacement_day(), _row(), next_run=NEXT_RUN)
    rec = view.recommendation
    assert rec is not None and view.replacement is not None and view.replacement.vehicle_id == "VEH036"
    assert len(rec.order_ids) == 3 and rec.order_id == rec.order_ids[0]
    assert "ORD1001" not in rec.order_ids  # the protected order is never part of the set
    assert rec.title.endswith("3 orders") and rec.frees.startswith(f"{sum(ORDERS[o].weight_kg for o in rec.order_ids):,.0f} kg")


def test_deferring_only_the_first_of_the_set_is_refused_but_the_set_is_accepted():
    day = _short_replacement_day()
    rec = ex.exception_view(day, _row(), next_run=NEXT_RUN).recommendation
    assert rec is not None
    replacement = day.ref.vehicles["VEH036"]

    one = ex.build_swap(day, "VEH003", replacement, [rec.order_id])
    assert RuleId.KG in {v.rule for v in one.violations}  # what the server answered with illegal_swap

    whole = ex.build_swap(day, "VEH003", replacement, rec.order_ids)
    assert whole.violations == [] and set(rec.order_ids) <= set(whole.plan.deferred)


def test_the_candidates_include_the_protected_order_but_not_as_a_choice():
    candidates = ex.exception_view(_day(), _row(), next_run=NEXT_RUN).candidates
    by = {c.order_id: c for c in candidates}
    assert set(by) == {"ORD1014", "ORD1016", "ORD1011", "ORD1002", "ORD1001"}
    assert by["ORD1001"].protected and not by["ORD1001"].least_surplus
    assert by["ORD1002"].least_surplus and by["ORD1002"].impact.endswith("least surplus")
    assert [c.least_surplus for c in candidates].count(True) == 1


def test_with_no_replacement_the_screen_is_still_working_it_out():
    view = ex.exception_view(_day(now=datetime(2026, 9, 29, 2, 30)), _row(), next_run=NEXT_RUN)
    assert view.state == "working" and view.replacement is None and view.recommendation is None and view.after is None


def test_a_decided_exception_shows_what_was_done():
    decision = {
        "decision": "swap_vehicle", "replacement": "VEH036", "deferred": ["ORD1002"], "fromPlan": 3, "plan": 4,
        "deferralsAfter": {"total": 20, "capacity": 1, "policy": 19},
    }
    view = ex.exception_view(_day(), _row(ExceptionStatus.DECIDED, decision), next_run=NEXT_RUN, decided_plan=decision)
    assert view.state == "confirmed" and view.title == "VEH003 replaced by VEH036, plan v4" and view.failed.tag == "Replaced"
    assert view.confirmed is not None
    assert view.confirmed.plan == 4 and view.confirmed.at == "03:00"
    assert view.confirmed.text == "VEH036 carries 950 / 1,040 kg on Trip 1. OUT012 stays on the truck."
    assert view.confirmed.toast == "Plan v4 released. Loader asked to acknowledge."
    who = {w.who: w.what for w in view.confirmed.who_knows}
    assert who["Peliyagoda dock"] == "'Plan changed v3 → v4, review' · 03:00"
    assert who["R. Silva"] == "New trip on phone · 03:00"
    assert who["OUT009"] == "Deferral notice · 03:00 · not yet seen"
    assert who["Deferrals"] == "Now 20 (1 capacity · 19 policy)"
    assert view.recommendation is not None and view.recommendation.decided_by == "Kumari · 03:00"


@pytest.mark.parametrize("vehicle", ["VEH035", "VEH011", "VEH039"])
def test_a_vehicle_with_no_free_replacement_is_not_swapped(vehicle):
    """Only a free, unused vehicle that can carry the orders may replace one: VEH036 is chilled and in this depot only."""
    day = _day()
    replacement = ex.choose_replacement(day, vehicle)
    assert replacement is None or replacement.depot == REF.vehicles[vehicle].depot
