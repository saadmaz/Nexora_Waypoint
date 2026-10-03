"""Hard constraints (PRD §4a). ``check_trip`` and ``check_vehicle_day`` return every violation;
an empty list means the trip or vehicle day is legal.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from . import messages as msg
from .calc import hhmm, planned_clock, planned_fuel, trip_load, trip_minutes
from .model import Order, RefData, Trip, Vehicle, VehicleDay
from .vocab import FRESH_BUDGET_MIN, MAX_TRIPS_PER_VEHICLE, STYLE_TECH_BUDGET_MIN, Brand, RuleId, Temp


@dataclass(frozen=True, slots=True)
class Violation:
    rule: RuleId
    message: str
    figures: dict[str, Any] = field(default_factory=dict)


#: Rules about what a trip is made of. Schedule rules are only meaningful once these pass.
STRUCTURAL = frozenset(
    {RuleId.TEMP, RuleId.VAN, RuleId.DEPOT, RuleId.BRAND, RuleId.DISTRICT, RuleId.AVAIL}
)


def order_vehicle_violations(
    order: Order,
    vehicle: Vehicle,
    ref: RefData,
    vday: VehicleDay | None = None,
    depart_at: datetime | None = None,
    *,
    check_capacity_alone: bool = False,
) -> list[Violation]:
    """Can this vehicle carry this order at all? (temperature, van access, depot, availability)."""
    outlet = ref.outlets[order.outlet_id]
    out: list[Violation] = []
    if order.temp is Temp.CHILLED and not vehicle.is_reefer:
        out.append(Violation(RuleId.TEMP, msg.needs_reefer(vehicle.id)))
    if outlet.van_only and not vehicle.is_van:
        out.append(Violation(RuleId.VAN, msg.van_only(outlet.id, vehicle.id)))
    if outlet.depot != vehicle.depot:
        out.append(Violation(RuleId.DEPOT, msg.wrong_depot(vehicle.id, vehicle.depot, outlet.id, outlet.depot)))
    out.extend(availability_violations(vehicle, vday, depart_at))
    if check_capacity_alone:
        if order.weight_kg > vehicle.weight_cap_kg:
            out.append(Violation(RuleId.KG, msg.kg_over(vehicle.id, order.weight_kg, vehicle.weight_cap_kg),
                                 {"load_kg": order.weight_kg, "cap_kg": vehicle.weight_cap_kg}))
        if order.volume_m3 > vehicle.volume_cap_m3:
            out.append(Violation(RuleId.M3, msg.m3_over(vehicle.id, order.volume_m3, vehicle.volume_cap_m3),
                                 {"load_m3": order.volume_m3, "cap_m3": vehicle.volume_cap_m3}))
    return out


def availability_violations(vehicle: Vehicle, vday: VehicleDay | None, depart_at: datetime | None) -> list[Violation]:
    if vday is None:
        return []
    if vday.held:
        return [Violation(RuleId.AVAIL, msg.unavailable(vehicle.id, None))]
    if vday.available_from is not None and (depart_at is None or depart_at < vday.available_from):
        return [Violation(RuleId.AVAIL, msg.unavailable(vehicle.id, hhmm(vday.available_from)),
                          {"available_from": hhmm(vday.available_from)})]
    return []


def _dedupe(vs: Iterable[Violation]) -> list[Violation]:
    seen: set[tuple[RuleId, str]] = set()
    out: list[Violation] = []
    for v in vs:
        k = (v.rule, v.message)
        if k not in seen:
            seen.add(k)
            out.append(v)
    return out


def check_trip(
    trip: Trip,
    orders: dict[str, Order],
    ref: RefData,
    vday: VehicleDay | None = None,
) -> list[Violation]:
    """Every rule a single trip breaks.

    Schedule rules (window, mall window) are evaluated only when the trip is structurally
    valid (same brand, same district, right vehicle): a Fresh order on a Style mall trip has
    no meaningful planned clock, and the design lists only the structural reasons (D3.4).
    """
    vehicle = ref.vehicles[trip.vehicle_id]
    out: list[Violation] = []
    for oid in trip.order_ids:
        out.extend(order_vehicle_violations(orders[oid], vehicle, ref))
    out.extend(availability_violations(vehicle, vday, trip.depart_at))

    outlets = [ref.outlets[orders[o].outlet_id] for o in trip.order_ids]
    brands = sorted({o.brand.value for o in outlets})
    if len(brands) > 1:
        out.append(Violation(RuleId.BRAND, msg.two_brands(brands[0], brands[1])))
    districts = sorted({o.district for o in outlets})
    if len(districts) > 1:
        out.append(Violation(RuleId.DISTRICT, msg.two_districts(districts[0], districts[1])))

    kg, m3 = trip_load(trip, orders)
    if kg > vehicle.weight_cap_kg:
        out.append(Violation(RuleId.KG, msg.kg_over(vehicle.id, kg, vehicle.weight_cap_kg),
                             {"load_kg": kg, "cap_kg": vehicle.weight_cap_kg}))
    if m3 > vehicle.volume_cap_m3 + 1e-9:
        out.append(Violation(RuleId.M3, msg.m3_over(vehicle.id, m3, vehicle.volume_cap_m3),
                             {"load_m3": round(m3, 3), "cap_m3": vehicle.volume_cap_m3}))

    if not any(v.rule in STRUCTURAL for v in out):
        clock = planned_clock(trip, orders, ref)
        for stop in clock.stops:
            if stop.late:
                outlet = ref.outlets[stop.outlet_id]
                mall_binds = outlet.mall_dock and outlet.mall_close is not None and outlet.mall_close < outlet.window_close
                if mall_binds:
                    out.append(Violation(RuleId.MALL, msg.after_mall(hhmm(stop.arrival), outlet.id, hhmm(stop.window_close)),
                                         {"arrival": hhmm(stop.arrival), "close": hhmm(stop.window_close)}))
                else:
                    out.append(Violation(RuleId.WINDOW, msg.after_window(hhmm(stop.arrival), outlet.id, hhmm(stop.window_close)),
                                         {"arrival": hhmm(stop.arrival), "close": hhmm(stop.window_close)}))
    return _dedupe(out)


def trip_brand(trip: Trip, orders: dict[str, Order], ref: RefData) -> Brand | None:
    if not trip.order_ids:
        return None
    return ref.outlets[orders[trip.order_ids[0]].outlet_id].brand


@dataclass(frozen=True, slots=True)
class VehicleDayTotals:
    fresh_min: int
    style_tech_min: int
    planned_fuel_l: float
    fuel_week_l: float  #: used before tonight + tonight's planned litres


def vehicle_day_totals(
    vehicle: Vehicle, trips: list[Trip], orders: dict[str, Order], ref: RefData, vday: VehicleDay | None
) -> VehicleDayTotals:
    fresh = st = 0
    litres = 0.0
    for t in trips:
        mins = trip_minutes(t, orders, ref)
        if trip_brand(t, orders, ref) is Brand.FRESH:
            fresh += mins
        else:
            st += mins
        litres += planned_fuel(t, vehicle, orders, ref).litres
    before = vday.fuel_used_before_l if vday else 0.0
    return VehicleDayTotals(fresh, st, litres, before + litres)


def check_vehicle_day(
    vehicle: Vehicle,
    trips: list[Trip],
    orders: dict[str, Order],
    ref: RefData,
    vday: VehicleDay | None = None,
) -> list[Violation]:
    """Rules across a vehicle's whole day: trip count, minute budgets, weekly fuel."""
    trips = [t for t in trips if t.order_ids]
    out: list[Violation] = []
    if len(trips) > MAX_TRIPS_PER_VEHICLE:
        out.append(Violation(RuleId.TRIPS, msg.too_many_trips(vehicle.id, len(trips))))
    tot = vehicle_day_totals(vehicle, trips, orders, ref, vday)
    if tot.fresh_min > FRESH_BUDGET_MIN:
        out.append(Violation(RuleId.BUDGET_FRESH, msg.over_budget(vehicle.id, "Fresh", tot.fresh_min, FRESH_BUDGET_MIN),
                             {"minutes": tot.fresh_min, "budget": FRESH_BUDGET_MIN}))
    if tot.style_tech_min > STYLE_TECH_BUDGET_MIN:
        out.append(Violation(RuleId.BUDGET_STYLE_TECH,
                             msg.over_budget(vehicle.id, "Style and Tech", tot.style_tech_min, STYLE_TECH_BUDGET_MIN),
                             {"minutes": tot.style_tech_min, "budget": STYLE_TECH_BUDGET_MIN}))
    if tot.fuel_week_l > vehicle.weekly_fuel_quota_l + 1e-9:
        out.append(Violation(RuleId.FUEL, msg.over_fuel(vehicle.id, tot.fuel_week_l, vehicle.weekly_fuel_quota_l),
                             {"litres": round(tot.fuel_week_l, 1), "quota": vehicle.weekly_fuel_quota_l}))
    return out


def legal_vehicles(
    order: Order,
    ref: RefData,
    vehicle_days: dict[str, VehicleDay] | None = None,
    depart_at: datetime | None = None,
) -> list[str]:
    """Vehicles that could carry the whole order alone (temperature, van access, depot,
    availability, weight and volume). Empty → the deferral is typed ``capacity``."""
    out: list[str] = []
    for v in sorted(ref.vehicles.values(), key=lambda v: v.id):
        vday = (vehicle_days or {}).get(v.id)
        # A workshop vehicle that becomes available later in the morning still counts as legal
        # for typing purposes unless it is held; departure timing is the planner's job.
        probe = VehicleDay(v.id, None, vday.held, vday.fuel_used_before_l) if vday and depart_at is None else vday
        if not order_vehicle_violations(order, v, ref, probe, depart_at, check_capacity_alone=True):
            out.append(v.id)
    return out
