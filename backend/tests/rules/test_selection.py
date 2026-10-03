"""Small synthetic fleets isolate the documented current-order comparator and complete candidate scan."""

from dataclasses import replace
from datetime import date, time
from random import Random

from waypoint_rules import (
    Brand,
    District,
    DockType,
    Order,
    Outlet,
    RefData,
    Temp,
    Vehicle,
    VehicleDay,
    VehicleTemp,
    VehicleType,
    check_plan,
    draft_plan,
)

DAY = date(2026, 9, 29)


def world(orders, vehicles):
    outlets = {o.outlet_id: Outlet(o.outlet_id, Brand.FRESH, "D", "depot", DockType.REAR_DOCK,
                                 time(3), time(12)) for o in orders}
    return ({o.id: o for o in orders}, RefData(outlets, {"D": District("D", "depot", 1, 1, 0, 1)},
            {v.id: v for v in vehicles}, {(Brand.FRESH, DockType.REAR_DOCK): 1}))


def vehicle(vid, kg=100, m3=10, temp=VehicleTemp.AMBIENT):
    return Vehicle(vid, "depot", VehicleType.TRUCK, temp, kg, m3, 10, 1000)


def placement(draft):
    return {oid: (trip.vehicle_id, trip.trip_no) for trip in draft.trips for oid in trip.order_ids}


def test_twelve_earlier_misses_do_not_hide_later_small_order():
    first = [Order("A", "A", Temp.AMBIENT, 1, 90, 1, True), Order("B", "B", Temp.AMBIENT, 1, 90, 1, True)]
    misses = [Order(f"M{i:02}", f"M{i:02}", Temp.AMBIENT, 1, 20, 1) for i in range(12)]
    small = Order("Z", "Z", Temp.AMBIENT, 1, 10, 1)
    pool, ref = world([*first, *misses, small], [vehicle("V")])
    draft = draft_plan(pool, ref, {}, service_date=DAY)
    assert "Z" in placement(draft)
    assert len(draft.deferrals) == 12
    assert check_plan(draft.as_plan(), pool, ref) == []


def test_tightest_balanced_fit_and_id_tie_break():
    order = Order("O", "O", Temp.AMBIENT, 1, 80, 5)
    pool, ref = world([order], [vehicle("L", 110, 20), vehicle("Z"), vehicle("A")])
    expected = draft_plan(pool, ref, {}, service_date=DAY)
    assert placement(expected)["O"] == ("A", 1)
    backwards = replace(ref, vehicles=dict(reversed(list(ref.vehicles.items()))))
    assert draft_plan(pool, backwards, {}, service_date=DAY) == expected


def test_reefer_reservation_for_unplanned_chilled_work():
    pool, ref = world([Order("A", "A", Temp.AMBIENT, 1, 90, 1),
                       Order("B", "B", Temp.CHILLED, 1, 90, 1)],
                      [vehicle("R", temp=VehicleTemp.REEFER), vehicle("D", kg=200)])
    result = draft_plan(pool, ref, {}, service_date=DAY)
    assert placement(result)["A"][0] == "D"  # R is a tighter fit, but chilled work still needs it
    assert placement(result)["B"][0] == "R"


def test_shuffling_all_inputs_preserves_the_result():
    pool, ref = world([Order(f"O{i}", f"O{i}", Temp.AMBIENT, 1, 20 + i, 1) for i in range(8)],
                      [vehicle("A"), vehicle("B"), vehicle("C")])
    days = {vid: VehicleDay(vid) for vid in ref.vehicles}
    expected = draft_plan(pool, ref, days, service_date=DAY)
    rng = Random(2026)
    for _ in range(5):
        items, fleet, vdays = list(pool.items()), list(ref.vehicles.items()), list(days.items())
        rng.shuffle(items)
        rng.shuffle(fleet)
        rng.shuffle(vdays)
        assert draft_plan(dict(items), replace(ref, vehicles=dict(fleet)), dict(vdays), service_date=DAY) == expected
