"""Plan logic with no database: a stored version as a rules ``Plan``, a move applied to one, and the release gate.

The services write and the views read; both need these, so they live here and import nothing but the rules and
the plain data in ``dispatch_model``.
"""

from __future__ import annotations

import copy

from waypoint_rules import Move, MoveResult, Order, Plan, Trip, check_trip, check_vehicle_day

from .dispatch_model import DispatchDay


def plan_of(day: DispatchDay) -> Plan:
    """The chosen version as a rules ``Plan``: its trips, and the orders in its deferred pool."""
    trips = {(t.vehicle_id, t.trip_no): Trip(t.vehicle_id, t.trip_no, t.depart_at, list(t.order_ids)) for t in day.trips}
    return Plan(day.service_date, trips, deferred=[d.order_id for d in day.deferrals])


def after_move(plan: Plan, move: Move, orders: dict[str, Order], result: MoveResult) -> Plan:
    """``plan`` with ``move`` applied, using the insertion point the validator chose. The plan passed in is not changed."""
    out = copy.deepcopy(plan)
    source = out.trip_of_order(move.order_id)
    if source is not None:
        source.order_ids.remove(move.order_id)
    elif move.order_id in out.deferred:
        out.deferred.remove(move.order_id)
    if move.to is None:
        out.deferred.append(move.order_id)
    else:
        if move.to not in out.trips and result.opens_trip_at is not None:
            # The move starts this trip (the validator chose when it leaves).
            out.trips[move.to] = Trip(move.to[0], move.to[1], result.opens_trip_at, [])
        target = out.trips[move.to]
        idx = result.inserted_at if result.inserted_at is not None else len(target.order_ids)
        target.order_ids.insert(idx, move.order_id)
    return out


def renumbered(plan: Plan) -> Plan:
    """``plan`` with each vehicle's trips that carry orders numbered 1, 2 in the order they leave; empty trips dropped.

    A move can empty a vehicle's trip 1 and leave its trip 2; without this the vehicle would show only "Trip 2", and the
    next trip a dispatcher starts would be "Trip 3". The plan passed in is not changed.
    """
    out = copy.deepcopy(plan)
    trips: dict[tuple[str, int], Trip] = {}
    for vid in sorted({k[0] for k in out.trips}):
        kept = sorted((t for t in out.trips_of(vid) if t.order_ids), key=lambda t: (t.depart_at, t.trip_no))
        for n, trip in enumerate(kept, start=1):
            trip.trip_no = n
            trips[(vid, n)] = trip
    out.trips = trips
    return out


def gate(day: DispatchDay) -> list[tuple[str, bool]]:
    """The release checklist (PRD §12, D5): every trip legal, every deferral explained, every vehicle manned."""
    plan = plan_of(day)
    on_trips = [t for t in plan.trips.values() if t.order_ids]
    legal = True
    for trip in on_trips:
        if check_trip(trip, day.orders, day.ref, day.vehicle_days.get(trip.vehicle_id)):
            legal = False
    for vid in {t.vehicle_id for t in on_trips}:
        if check_vehicle_day(day.ref.vehicles[vid], plan.trips_of(vid), day.orders, day.ref, day.vehicle_days.get(vid)):
            legal = False
    placed = {o for t in on_trips for o in t.order_ids}
    explained = {d.order_id for d in day.deferrals if d.reason_text}
    unplaced = sorted(day.plannable - placed - explained)
    manned = all(v in day.drivers for v in {t.vehicle_id for t in on_trips}) and all(
        depot in day.loaders for depot in {day.ref.vehicles[t.vehicle_id].depot for t in on_trips}
    )
    return [
        ("All trips pass every rule", legal),
        (f"{len(day.deferrals)} deferral notices ready", True),
        (f"{len(unplaced)} unplaced orders without a reason", not unplaced),
        ("Every vehicle has a driver and dock assigned", manned),
    ]
