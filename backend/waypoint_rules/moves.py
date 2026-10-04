"""Dispatcher edits: validate a move and preview its consequence (D3.2 to D3.6, D3.7)."""

from __future__ import annotations

import copy
from dataclasses import dataclass, field

from . import messages as msg
from .calc import hhmm, planned_clock, planned_fuel, trip_load, trip_minutes
from .constraints import STRUCTURAL, Violation, check_trip, check_vehicle_day, legal_vehicles, vehicle_day_totals
from .model import Order, Plan, RefData, Trip, VehicleDay
from .vocab import RuleId, Temp


@dataclass(frozen=True, slots=True)
class Move:
    order_id: str
    #: (vehicle_id, trip_no) of the target trip, or None for the deferred pool.
    to: tuple[str, int] | None


@dataclass(frozen=True, slots=True)
class TripSummary:
    vehicle_id: str
    trip_no: int
    stops: int
    kg: float
    m3: float
    minutes: int
    last_arrival: str | None
    vehicle_fresh_min: int
    vehicle_style_tech_min: int
    vehicle_fuel_week_l: float


@dataclass(slots=True)
class MoveResult:
    ok: bool
    violations: list[Violation] = field(default_factory=list)
    source_before: TripSummary | None = None
    source_after: TripSummary | None = None
    target_before: TripSummary | None = None
    target_after: TripSummary | None = None
    #: e.g. "ORD1009 leaves the deferred pool"
    deferral_changes: list[str] = field(default_factory=list)
    #: Where the order was inserted in the target trip (0-based), for the consequence preview.
    inserted_at: int | None = None


def summarize(plan: Plan, trip: Trip, orders: dict[str, Order], ref: RefData,
              vehicle_days: dict[str, VehicleDay]) -> TripSummary:
    vehicle = ref.vehicles[trip.vehicle_id]
    kg, m3 = trip_load(trip, orders)
    clock = planned_clock(trip, orders, ref)
    tot = vehicle_day_totals(vehicle, plan.trips_of(trip.vehicle_id), orders, ref, vehicle_days.get(trip.vehicle_id))
    return TripSummary(
        vehicle_id=trip.vehicle_id,
        trip_no=trip.trip_no,
        stops=len(clock.stops),
        kg=kg,
        m3=round(m3, 3),
        minutes=trip_minutes(trip, orders, ref),
        last_arrival=hhmm(clock.stops[-1].arrival) if clock.stops else None,
        vehicle_fresh_min=tot.fresh_min,
        vehicle_style_tech_min=tot.style_tech_min,
        vehicle_fuel_week_l=round(tot.fuel_week_l, 1),
    )


def _insert_index(trip: Trip, order: Order, orders: dict[str, Order]) -> int:
    """Next to the same outlet's orders if the trip already stops there, else a new stop at the end."""
    idx = None
    for i, oid in enumerate(trip.order_ids):
        if orders[oid].outlet_id == order.outlet_id:
            idx = i + 1
    return idx if idx is not None else len(trip.order_ids)


def validate_move(
    plan: Plan,
    move: Move,
    orders: dict[str, Order],
    ref: RefData,
    vehicle_days: dict[str, VehicleDay] | None = None,
) -> MoveResult:
    """Apply a move to a copy of the plan and report every rule it breaks.

    A refused move lists **all** violations (D3.4 shows two). The plan passed in is not changed.
    """
    vehicle_days = vehicle_days or {}
    order = orders[move.order_id]
    after = copy.deepcopy(plan)
    source = plan.trip_of_order(move.order_id)
    result = MoveResult(ok=True)

    if source is not None:
        result.source_before = summarize(plan, source, orders, ref, vehicle_days)
        s_after = after.trips[source.key]
        s_after.order_ids.remove(move.order_id)
    elif move.order_id in after.deferred:
        after.deferred.remove(move.order_id)
        result.deferral_changes.append(f"{move.order_id} leaves the deferred pool")

    violations: list[Violation] = []
    if move.to is None:
        after.deferred.append(move.order_id)
        result.deferral_changes.append(f"{move.order_id} is deferred")
        if order.deferred_yesterday and legal_vehicles(order, ref, vehicle_days):
            violations.append(Violation(RuleId.CONT, msg.continuity(order.outlet_id)))
    else:
        target_before = plan.trips.get(move.to)
        if target_before is None:
            raise KeyError(f"No trip {move.to} in the plan")
        result.target_before = summarize(plan, target_before, orders, ref, vehicle_days)
        target = after.trips[move.to]
        idx = _insert_index(target, order, orders)
        target.order_ids.insert(idx, move.order_id)
        result.inserted_at = idx
        vday = vehicle_days.get(target.vehicle_id)
        violations.extend(check_trip(target, orders, ref, vday))
        vehicle = ref.vehicles[target.vehicle_id]
        violations.extend(check_vehicle_day(vehicle, after.trips_of(target.vehicle_id), orders, ref, vday))
        result.target_after = summarize(after, target, orders, ref, vehicle_days)

    if source is not None:
        result.source_after = summarize(after, after.trips[source.key], orders, ref, vehicle_days)

    # Like the window rules in check_trip, turnaround is a schedule rule: a trip that breaks a structural rule cannot
    # run at all, so when it would return is not a reason worth listing.
    if any(v.rule in STRUCTURAL for v in violations):
        violations = [v for v in violations if v.rule is not RuleId.TURN]
    result.violations = _unique(violations)
    result.ok = not result.violations
    return result


def _unique(vs: list[Violation]) -> list[Violation]:
    seen: set[tuple[RuleId, str]] = set()
    out = []
    for v in vs:
        if (v.rule, v.message) not in seen:
            seen.add((v.rule, v.message))
            out.append(v)
    return out


@dataclass(frozen=True, slots=True)
class CheckItem:
    rule: RuleId
    label: str
    ok: bool
    detail: str


def why_this_vehicle(plan: Plan, order_id: str, orders: dict[str, Order], ref: RefData,
                     vehicle_days: dict[str, VehicleDay] | None = None) -> list[CheckItem]:
    """D3.7 checklist: every rule the order's current trip passes, with figures."""
    vehicle_days = vehicle_days or {}
    trip = plan.trip_of_order(order_id)
    if trip is None:
        return []
    order = orders[order_id]
    vehicle = ref.vehicles[trip.vehicle_id]
    outlet = ref.outlets[order.outlet_id]
    kg, m3 = trip_load(trip, orders)
    clock = planned_clock(trip, orders, ref)
    stop = clock.stop_for_order(order_id)
    tot = vehicle_day_totals(vehicle, plan.trips_of(vehicle.id), orders, ref, vehicle_days.get(vehicle.id))
    fuel = planned_fuel(trip, vehicle, orders, ref)
    items = [
        CheckItem(RuleId.TEMP, "Reefer", order.temp is not Temp.CHILLED or vehicle.is_reefer,
                  f"{vehicle.id} is {'a reefer' if vehicle.is_reefer else 'ambient'}"),
        CheckItem(RuleId.KG, "Weight", kg <= vehicle.weight_cap_kg, f"{kg:,.0f} / {vehicle.weight_cap_kg:,.0f} kg"),
        CheckItem(RuleId.M3, "Volume", m3 <= vehicle.volume_cap_m3 + 1e-9, f"{m3:.1f} / {vehicle.volume_cap_m3:.1f} m³"),
        CheckItem(RuleId.DEPOT, "Home depot", outlet.depot == vehicle.depot, f"{vehicle.depot.title()} = {outlet.depot.title()}"),
        CheckItem(RuleId.VAN, "Access", not outlet.van_only or vehicle.is_van,
                  "van only" if outlet.van_only else f"{outlet.dock_type.value.replace('_', ' ')}"),
        CheckItem(RuleId.WINDOW, "Window", bool(stop and not stop.late),
                  f"arrives {hhmm(stop.arrival)}, window {outlet.window_open:%H:%M} to {outlet.window_close:%H:%M}" if stop else ""),
        CheckItem(RuleId.FUEL, "Fuel", tot.fuel_week_l <= vehicle.weekly_fuel_quota_l + 1e-9,
                  f"{tot.fuel_week_l:.1f} / {vehicle.weekly_fuel_quota_l:.0f} L this week (trip {fuel.litres:.1f} L)"),
    ]
    return items
