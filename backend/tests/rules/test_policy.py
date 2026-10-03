from copy import deepcopy
from dataclasses import replace

from waypoint_rules import (
    Binding,
    Order,
    Plan,
    Temp,
    Trip,
    VehicleTemp,
    check_plan,
    draft_plan,
    recommend_swap,
    repair_continuity,
)
from waypoint_rules.deferrals import binding_freed, policy_deferral_key

from .conftest import at
from .test_selection import DAY, placement, vehicle, world


def test_continuity_insertion_preserves_input():
    pool, ref = world([Order("A", "A", Temp.AMBIENT, 1, 50, 1),
                       Order("P", "P", Temp.AMBIENT, 1, 40, 1, True)], [vehicle("R")])
    trip = Trip("R", 1, at("03:30"), ["A"])
    original = Plan(DAY, {trip.key: trip}, ["P"])
    before = deepcopy(original)
    repaired = repair_continuity(original, pool, ref, {})
    assert original == before
    assert repaired.deferred == []
    assert check_plan(repaired, pool, ref) == []


def swap_world(relocate=False):
    orders = [Order("A", "A", Temp.AMBIENT, 1, 90, 1),
              Order("B", "B", Temp.CHILLED, 1, 90, 1, True),
              Order("P", "P", Temp.CHILLED, 1, 80, 1, True)]
    vehicles = [vehicle("R", temp=VehicleTemp.REEFER)]
    trips = [Trip("R", 1, at("03:30"), ["A"]), Trip("R", 2, at("04:00"), ["B"])]
    if relocate:
        orders.append(Order("C", "C", Temp.AMBIENT, 1, 20, 1))
        vehicles.append(vehicle("D", kg=120))
        trips.append(Trip("D", 1, at("03:30"), ["C"]))
    pool, ref = world(orders, vehicles)
    return Plan(DAY, {t.key: t for t in trips}, ["P"]), pool, ref


def test_continuity_single_swap():
    plan, pool, ref = swap_world()
    repaired = repair_continuity(plan, pool, ref, {})
    assert repaired.deferred == ["A"]
    assert repaired.trip_of_order("P").key == ("R", 1)
    assert check_plan(repaired, pool, ref) == []


def test_continuity_relocates_displaced_order():
    plan, pool, ref = swap_world(relocate=True)
    repaired = repair_continuity(plan, pool, ref, {})
    assert repaired.deferred == []
    assert repaired.trip_of_order("P").key == ("R", 1)
    assert repaired.trip_of_order("A").key == ("D", 1)
    assert check_plan(repaired, pool, ref) == []


def test_no_legal_continuity_repair_is_explicitly_warned():
    pool, ref = world([Order(oid, oid, Temp.AMBIENT, 1, 90, 1, True) for oid in ("A", "B", "P")], [vehicle("R")])
    result = draft_plan(pool, ref, {}, service_date=DAY)
    assert "P" not in placement(result)
    assert len(result.warnings) == 1 and "P" in result.warnings[0]
    assert check_plan(result.as_plan(), pool, ref) == []


def test_policy_key_orders_impact_count_surplus_and_ids():
    pool, _ = world([Order(oid, oid, Temp.AMBIENT, 1, 10, 1) for oid in ("A", "B", "C")], [vehicle("V")])
    def key(ids, freed):
        return policy_deferral_key(ids, pool, freed=freed, required=10)
    assert key(("A",), 20) < key(("B", "C"), 10)  # count before surplus
    assert key(("B",), 10) < key(("A",), 20)  # least surplus
    assert key(("A",), 10) < key(("B",), 10)  # ID tie-break
    pool["A"] = replace(pool["A"], days_since_served=3)
    assert key(("B", "C"), 20) < key(("A",), 20)  # overdue impact before count


def test_swap_frees_both_dimensions_and_excludes_protected():
    pool, ref = world([Order("A", "A", Temp.AMBIENT, 1, 30, 0.1),
                       Order("B", "B", Temp.AMBIENT, 1, 20, 2),
                       Order("P", "P", Temp.AMBIENT, 1, 80, 5, True)], [vehicle("V", 100, 6)])
    rec = recommend_swap(Trip("V", 1, at("03:30"), list(pool)), ref.vehicles["V"], pool, ref)
    assert rec.defer == ("A", "B")  # A alone meets kg but not volume
    assert rec.protected == ("P",)


def test_actual_binding_frees_handles_single_order_and_fuel():
    pool, ref = world([Order("A", "A", Temp.AMBIENT, 1, 50, 1)], [vehicle("V")])
    trip, empty = Trip("V", 1, at("03:30"), ["A"]), Trip("V", 1, at("03:30"), [])
    assert binding_freed(trip, empty, pool, ref, ref.vehicles["V"], Binding.REEFER_MINUTES) == 2
    assert binding_freed(trip, empty, pool, ref, ref.vehicles["V"], Binding.FUEL) == 0.2


def test_binding_ties_do_not_depend_on_dictionary_order():
    from waypoint_rules import binding_resource

    resources = {Binding.WEIGHT: (10, 20), Binding.VOLUME: (5, 10)}
    assert binding_resource(resources) == binding_resource(dict(reversed(list(resources.items()))))
