"""Planner: Guided Adaptive Allocation (PRD v3 §12).

``draft_plan`` turns the closed queue into trips and deferrals. It is pure and deterministic: the same input
gives the same plan, because every sort ends on the order ID. It uses only the rules in this package
(``legal_vehicles``, ``check_trip``, ``check_vehicle_day``, ``planned_clock``, ``classify_deferral`` and the
deferral explanations), so a plan it writes can never break a hard constraint.

The steps, in order:

1. **Pool.** The orders given, per depot; vehicles that are available for the whole morning.
2. **Capacity deferrals.** An order no vehicle can carry whole is *Deferred · capacity*.
3. **Group** by (depot, brand, district). Fresh trips leave at 03:30; Style and Tech leave so they reach the
   first window as it opens.
4. **Priority** inside a group: continuity-protected orders first, then the earliest window close, then the
   most days since served, then the order ID.
5. **Build trips** greedily on the best-fit legal vehicle, adding orders in priority order while every rule
   still passes. A second trip leaves after the first one is back.
6. **Policy deferrals.** Bounded continuity insertion/swap/relocation repairs protected orders first.
   Unprotected exchanges use store impact per binding unit. Unrepairable continuity is explicitly warned.
7. **Explain.** Each deferral carries its type, the rule that bound, a reason line, its impact on the store,
   what it frees and its next run.

Stop sequence inside a trip (PRD §12 leaves it open, recorded as a departure): by window open, then window
close, then outlet ID, then order ID. Orders for one outlet are therefore adjacent and share one arrival.
``load_no`` is the reverse of ``seq``: the last stop is loaded first.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from copy import deepcopy
from dataclasses import dataclass, field, replace
from datetime import date, datetime, time, timedelta
from math import fsum

from . import messages as msg
from .calc import planned_clock, planned_fuel, trip_load, trip_minutes
from .constraints import (
    Violation,
    check_plan,
    check_trip,
    check_vehicle_day,
    order_vehicle_violations,
    trip_brand,
    usable_vehicles,
    vehicle_day_totals,
)
from .deferrals import (
    Frees,
    Impact,
    binding_freed,
    classify_deferral,
    frees,
    impact_on_store,
    policy_candidate_sets,
    policy_deferral_key,
)
from .model import Order, Plan, RefData, Trip, Vehicle, VehicleDay
from .schedule import next_operating_day
from .vocab import FRESH_BUDGET_MIN, MAX_TRIPS_PER_VEHICLE, Binding, Brand, DeferralType, RuleId, Temp

#: A Fresh first trip never leaves before the Fresh operating window opens (PRD §4a, A5).
FRESH_FIRST_DEPARTURE = time(3, 30)

#: A Fresh first trip reaches its first outlet this many minutes before the window opens, so it is there as the doors open (A5:
#: VEH039 leaves at 05:10 for OUT084, which opens at 05:30 and is 16 minutes out).
FRESH_ARRIVAL_SLACK_MIN = 4

#: The rule that refused an order, as the binding-resource tag (PRD §4b). A rule that is not a resource has none.
_BINDING_OF_RULE: dict[RuleId, Binding] = {
    RuleId.KG: Binding.WEIGHT,
    RuleId.M3: Binding.VOLUME,
    RuleId.VAN: Binding.VAN_ACCESS,
    RuleId.WINDOW: Binding.WINDOW,
    RuleId.MALL: Binding.WINDOW,
    RuleId.BUDGET_FRESH: Binding.REEFER_MINUTES,
    RuleId.FUEL: Binding.FUEL,
}


@dataclass(frozen=True, slots=True)
class OutletHistory:
    """What the continuity guard and the impact block know about an outlet. Overrides the order's own values."""

    deferred_yesterday: bool
    days_since_served: int


@dataclass(frozen=True, slots=True)
class DraftStop:
    order_id: str
    seq: int
    #: Reverse of ``seq``: the last stop is loaded first.
    load_no: int


@dataclass(frozen=True, slots=True)
class DraftTrip:
    vehicle_id: str
    trip_no: int
    brand: Brand
    district: str
    depart_at: datetime
    stops: tuple[DraftStop, ...]

    @property
    def order_ids(self) -> list[str]:
        return [s.order_id for s in self.stops]

    def to_trip(self) -> Trip:
        return Trip(self.vehicle_id, self.trip_no, self.depart_at, self.order_ids)


@dataclass(frozen=True, slots=True)
class DraftDeferral:
    order_id: str
    type: DeferralType
    #: The rule that bound. ``None`` when the refusal is not a resource (every vehicle busy, a Style budget).
    binding: Binding | None
    reason_text: str
    impact: Impact
    frees: Frees
    next_run_date: date


@dataclass(frozen=True, slots=True)
class PlanDraft:
    service_date: date
    trips: tuple[DraftTrip, ...]
    deferrals: tuple[DraftDeferral, ...]
    #: Things a person should look at, for example a protected order the planner could not place.
    warnings: tuple[str, ...] = field(default=())

    def as_plan(self) -> Plan:
        trips = {t.to_trip().key: t.to_trip() for t in self.trips}
        return Plan(self.service_date, trips, deferred=[d.order_id for d in self.deferrals])


@dataclass(slots=True)
class _VehicleState:
    vehicle: Vehicle
    vday: VehicleDay | None
    trips: list[Trip] = field(default_factory=list)


def _usable(vday: VehicleDay | None) -> bool:
    """Available for the whole morning: a workshop vehicle that returns at 02:45 is not in the 16:05 draft."""
    return vday is None or (not vday.held and vday.available_from is None)


def _sequence(order_ids: Iterable[str], orders: dict[str, Order], ref: RefData) -> list[str]:
    def key(oid: str) -> tuple[time, time, str, str]:
        outlet = ref.outlets[orders[oid].outlet_id]
        return (outlet.effective_open, outlet.effective_close, outlet.id, oid)

    return sorted(order_ids, key=key)


def _priority(oid: str, orders: dict[str, Order], ref: RefData) -> tuple[bool, time, int, str]:
    order = orders[oid]
    return (not order.deferred_yesterday, ref.outlets[order.outlet_id].effective_close, -order.days_since_served, oid)


def _departure(
    sequence: list[str],
    orders: dict[str, Order],
    ref: RefData,
    service_date: date,
    brand: Brand,
    not_before: datetime | None,
) -> datetime:
    first = ref.outlets[orders[sequence[0]].outlet_id]
    midnight = datetime.combine(service_date, time(0, 0))
    if brand is Brand.FRESH:
        base = datetime.combine(service_date, FRESH_FIRST_DEPARTURE)
        if not_before is None:
            # Handling starts when the window opens either way, so leaving later never makes a stop late.
            opens = datetime.combine(service_date, first.effective_open)
            base = max(base, opens - timedelta(minutes=ref.district_of(first).outbound_min + FRESH_ARRIVAL_SLACK_MIN))
    else:
        # Reach the first window as it opens, with no waiting.
        opens = datetime.combine(service_date, first.effective_open)
        base = max(midnight, opens - timedelta(minutes=ref.district_of(first).outbound_min))
    return max(base, not_before) if not_before is not None else base


def _back_at_depot(trip: Trip, orders: dict[str, Order], ref: RefData) -> datetime | None:
    return planned_clock(trip, orders, ref).back_at_depot


@dataclass(frozen=True, slots=True)
class FeasibleInsertion:
    vehicle_id: str
    trip_no: int
    #: The resulting complete vehicle day, including recalculated later departures.
    trips: tuple[Trip, ...]


def _retime(trips: Iterable[Trip], orders: dict[str, Order], ref: RefData, service_date: date) -> list[Trip]:
    result: list[Trip] = []
    for trip in sorted(trips, key=lambda t: t.trip_no):
        if not trip.order_ids:
            continue
        sequence = _sequence(trip.order_ids, orders, ref)
        brand = ref.outlets[orders[sequence[0]].outlet_id].brand
        before = _back_at_depot(result[-1], orders, ref) if result else None
        depart = _departure(sequence, orders, ref, service_date, brand, before)
        result.append(Trip(trip.vehicle_id, trip.trip_no, depart, sequence))
    return result


def feasible_insertions(
    order: Order, plan: Plan, orders: dict[str, Order], ref: RefData,
    vehicle_days: Mapping[str, VehicleDay],
) -> list[FeasibleInsertion]:
    """All legal insertions for the current order, sorted by vehicle and trip number.

    Other orders in the input may still be in the provisional deferred pool. This operation changes
    one assignment only; trip/day checks plus complete partition validation protect each candidate.
    """
    if plan.trip_of_order(order.id) is not None:
        return []
    out: list[FeasibleInsertion] = []
    for vid in usable_vehicles(order, ref, vehicle_days):
        existing = plan.trips_of(vid)
        numbers = {trip.trip_no for trip in existing}
        targets = sorted(numbers | ({1, 2} - numbers if len(existing) < MAX_TRIPS_PER_VEHICLE else set()))
        for number in targets:
            trial = [Trip(t.vehicle_id, t.trip_no, t.depart_at, list(t.order_ids)) for t in existing]
            target = next((t for t in trial if t.trip_no == number), None)
            if target is None:
                target = Trip(vid, number, datetime.combine(plan.service_date, time()), [])
                trial.append(target)
            target.order_ids.append(order.id)
            retimed = _retime(trial, orders, ref, plan.service_date)
            vday = vehicle_days.get(vid)
            if any(check_trip(t, orders, ref, vday) for t in retimed):
                continue
            if check_vehicle_day(ref.vehicles[vid], retimed, orders, ref, vday):
                continue
            proposed = Plan(plan.service_date, {**plan.trips, **{t.key: t for t in retimed}},
                            [oid for oid in plan.deferred if oid != order.id])
            if not check_plan(proposed, orders, ref, vehicle_days):
                out.append(FeasibleInsertion(vid, number, tuple(retimed)))
    return out


def _insert(plan: Plan, insertion: FeasibleInsertion, order_id: str) -> Plan:
    after = deepcopy(plan)
    for trip in insertion.trips:
        after.trips[trip.key] = trip
    after.deferred.remove(order_id)
    return after


def _replace_orders(plan: Plan, key: tuple[str, int], remove: str, add: str,
                    orders: dict[str, Order], ref: RefData) -> Plan:
    after = deepcopy(plan)
    target = after.trips[key]
    target.order_ids.remove(remove)
    target.order_ids.append(add)
    after.deferred.remove(add)
    after.deferred.append(remove)
    for trip in _retime(after.trips_of(key[0]), orders, ref, plan.service_date):
        after.trips[trip.key] = trip
    return after


def repair_continuity(
    plan: Plan, orders: dict[str, Order], ref: RefData, vehicle_days: Mapping[str, VehicleDay],
    *, eligible: set[str] | None = None,
) -> Plan:
    """Bounded deterministic repair: existing insertion, one unprotected swap, then relocation.

    Every accepted candidate passes complete plan validation. Stable vehicle/trip/order traversal
    accepts the first repair; physical impossibility never overrides rules. The caller records
    explicit warnings for protected orders still deferred. Input is never mutated.
    """
    result = deepcopy(plan)
    protected = sorted(oid for oid in plan.deferred if orders[oid].deferred_yesterday
                       and (eligible is None or oid in eligible)
                       and classify_deferral(orders[oid], ref) is DeferralType.POLICY)
    for oid in protected:
        inserted = next((c for c in feasible_insertions(orders[oid], result, orders, ref, vehicle_days)
                         if (c.vehicle_id, c.trip_no) in result.trips), None)
        if inserted is not None:
            result = _insert(result, inserted, oid)
            continue
        repaired: Plan | None = None
        for key in sorted(result.trips):
            for displaced in sorted(result.trips[key].order_ids):
                if orders[displaced].deferred_yesterday:
                    continue
                trial = _replace_orders(result, key, displaced, oid, orders, ref)
                if check_plan(trial, orders, ref, vehicle_days):
                    continue
                relocated = next((c for c in feasible_insertions(orders[displaced], trial, orders, ref, vehicle_days)
                                  if (c.vehicle_id, c.trip_no) != key and (c.vehicle_id, c.trip_no) in trial.trips), None)
                repaired = _insert(trial, relocated, displaced) if relocated is not None else trial
                break
            if repaired is not None:
                break
        if repaired is not None:
            result = repaired
    return result


def _policy_replacements(
    plan: Plan, eligible: set[str], orders: dict[str, Order], ref: RefData, days: Mapping[str, VehicleDay],
) -> Plan:
    """One bounded set exchange per waiting order, strictly reducing store impact on the binding resource.

    Whole-plan checks prove enough actual resource is freed, including windows/return sequencing.
    A protected order is never displaced. Equal keys retain the stable greedy allocation.
    """
    result = plan
    for oid in sorted(set(plan.deferred) & eligible, key=lambda o: _priority(o, orders, ref)):
        if oid not in result.deferred or orders[oid].deferred_yesterday:
            continue
        choices: list[tuple[tuple[float, int, float, float, float, tuple[str, ...]], tuple[str, int], Plan]] = []
        for key in sorted(result.trips):
            trip = result.trips[key]
            vehicle = ref.vehicles[trip.vehicle_id]
            augmented = Trip(trip.vehicle_id, trip.trip_no, trip.depart_at, _sequence([*trip.order_ids, oid], orders, ref))
            violations = check_trip(augmented, orders, ref, days.get(vehicle.id)) + check_vehicle_day(
                vehicle, [t for t in result.trips_of(vehicle.id) if t.key != key] + [augmented], orders, ref, days.get(vehicle.id))
            binding = next((_BINDING_OF_RULE[v.rule] for v in violations if v.rule in _BINDING_OF_RULE), None)
            if binding is None:
                continue
            gap_kg = max(0.0, trip_load(augmented, orders)[0] - vehicle.weight_cap_kg)
            gap_m3 = max(0.0, trip_load(augmented, orders)[1] - vehicle.volume_cap_m3)
            if binding is Binding.WEIGHT:
                required = gap_kg
            elif binding is Binding.VOLUME:
                required = gap_m3
            elif binding is Binding.FUEL:
                before = days.get(vehicle.id)
                required = max(0.0, (before.fuel_used_before_l if before else 0.0)
                               + sum(planned_fuel(t, vehicle, orders, ref).litres for t in result.trips_of(vehicle.id) if t.key != key)
                               + planned_fuel(augmented, vehicle, orders, ref).litres - vehicle.weekly_fuel_quota_l)
            elif binding is Binding.REEFER_MINUTES:
                total = vehicle_day_totals(vehicle, result.trips_of(vehicle.id), orders, ref, days.get(vehicle.id))
                required = max(0.0, total.fresh_min - trip_minutes(trip, orders, ref)
                               + trip_minutes(augmented, orders, ref) - FRESH_BUDGET_MIN)
            else:
                required = max((max(0.0, (stop.arrival - stop.window_close).total_seconds() / 60)
                                for stop in planned_clock(augmented, orders, ref).stops), default=0.0)
            for displaced in policy_candidate_sets(trip.order_ids, orders):
                trial = deepcopy(result)
                target = trial.trips[key]
                target.order_ids = [o for o in target.order_ids if o not in displaced] + [oid]
                trial.deferred.remove(oid)
                trial.deferred.extend(displaced)
                for retimed in _retime(trial.trips_of(key[0]), orders, ref, trial.service_date):
                    trial.trips[retimed.key] = retimed
                if check_plan(trial, orders, ref, days):
                    continue
                reduced = Trip(trip.vehicle_id, trip.trip_no, trip.depart_at, [o for o in trip.order_ids if o not in displaced])
                old_units = binding_freed(trip, reduced, orders, ref, vehicle, binding)
                new_units = binding_freed(augmented, trip, orders, ref, vehicle, binding)
                if old_units + 1e-9 < required:
                    continue
                removed_kg = trip_load(trip, orders)[0] - trip_load(reduced, orders)[0]
                removed_m3 = trip_load(trip, orders)[1] - trip_load(reduced, orders)[1]
                old_key = policy_deferral_key(displaced, orders, freed=old_units, required=required,
                                             surplus_kg=max(0.0, removed_kg - gap_kg), surplus_m3=max(0.0, removed_m3 - gap_m3))
                waiting_key = policy_deferral_key((oid,), orders, freed=new_units, required=required,
                                                 surplus_kg=max(0.0, orders[oid].weight_kg - gap_kg),
                                                 surplus_m3=max(0.0, orders[oid].volume_m3 - gap_m3))
                if old_key < waiting_key:
                    choices.append((old_key, key, trial))
        if choices:
            result = min(choices, key=lambda item: (item[0], item[1]))[2]
    return result


def _vehicle_rank(
    insertion: FeasibleInsertion, order: Order, orders: dict[str, Order], ref: RefData,
    *, chilled_remains: bool, legal_ambient_exists: bool,
) -> tuple[int, float, float, float, float, str, int]:
    vehicle = ref.vehicles[insertion.vehicle_id]
    target = next(t for t in insertion.trips if t.trip_no == insertion.trip_no)
    kg, m3 = trip_load(target, orders)
    remaining_kg = (vehicle.weight_cap_kg - kg) / vehicle.weight_cap_kg
    remaining_m3 = (vehicle.volume_cap_m3 - m3) / vehicle.volume_cap_m3
    reserve = int(order.temp is Temp.AMBIENT and vehicle.is_reefer and chilled_remains and legal_ambient_exists)
    # Nine decimal places for ranking only. Rule checks above use the unrounded loads.
    return (reserve, round(max(remaining_kg, remaining_m3), 9), round(remaining_kg + remaining_m3, 9),
            vehicle.weight_cap_kg, vehicle.volume_cap_m3, vehicle.id, insertion.trip_no)


def _explain(
    oid: str,
    group_trips: list[tuple[_VehicleState, Trip]],
    orders: dict[str, Order],
    ref: RefData,
    depot: str,
) -> tuple[Binding | None, str]:
    """Why this order did not fit: the violations of the closest trip it could have joined."""
    best: list[Violation] | None = None
    for state, trip in group_trips:
        sequence = _sequence([*trip.order_ids, oid], orders, ref)
        trial = Trip(trip.vehicle_id, trip.trip_no, trip.depart_at, sequence)
        others = [t for t in state.trips if t.key != trip.key]
        found = check_trip(trial, orders, ref, state.vday) + check_vehicle_day(
            state.vehicle, [*others, trial], orders, ref, state.vday
        )
        if found and (best is None or len(found) < len(best)):
            best = found
    if best is None:
        # None of this group's trips could take it, and there was no trip to try it on: every vehicle is busy.
        return None, msg.no_vehicle_free(depot)
    first = best[0]
    return _BINDING_OF_RULE.get(first.rule), first.message


def _capacity_reason(order: Order, ref: RefData, depot: str) -> str:
    outlet = ref.outlets[order.outlet_id]
    needs: list[str] = []
    if outlet.van_only:
        needs.append("van_only")
    able = [v for v in ref.vehicles.values() if v.depot == depot and not order_vehicle_violations(order, v, ref)]
    largest = max(able, key=lambda v: (v.weight_cap_kg, v.volume_cap_m3, v.id), default=None)
    if largest is None:
        needs.append("chilled" if order.temp is Temp.CHILLED else f"{order.weight_kg:,.0f} kg")
        return msg.no_legal_vehicle(needs, None, None, depot)
    if order.weight_kg > largest.weight_cap_kg:
        needs.append(f"{order.weight_kg:,.0f} kg")
    elif order.volume_m3 > largest.volume_cap_m3:
        needs.append(f"{order.volume_m3:.1f} m³")
    kind = ("reefer " if largest.is_reefer else "") + ("van" if largest.is_van else "truck")
    return msg.no_legal_vehicle(needs, kind, largest.weight_cap_kg, depot)


def _next_run(service_date: date, operating_days: Iterable[date] | None) -> date:
    if operating_days is not None:
        return next_operating_day(service_date, operating_days)
    nxt = service_date + timedelta(days=1)
    return nxt + timedelta(days=1) if nxt.weekday() == 6 else nxt  # Waypoint operates Monday to Saturday (R-OPDAY)


@dataclass(frozen=True, slots=True)
class _Strategy:
    """One deterministic way to order the groups and to treat the tail of a group."""

    #: Groups with the most weight take vehicles first (otherwise the lightest do).
    heaviest_first: bool


#: Preserve the existing bounded heavy/light group-order strategies. Global result quality is separate
#: from the local current-order vehicle comparator; there is no minimum batch-size cutoff.
_STRATEGIES = (_Strategy(True), _Strategy(False))


@dataclass(slots=True)
class _DepotPlan:
    states: list[_VehicleState]
    #: Policy deferrals: order -> (binding, reason line).
    policy: dict[str, tuple[Binding | None, str]]
    warnings: list[str]

    @property
    def quality(self) -> tuple[int, int, int]:
        """Lower is better: continuity breaches, then deferrals, then trips."""
        return (len(self.warnings), len(self.policy), sum(len(s.trips) for s in self.states))


def _plan_depot(
    depot: str,
    placeable: list[str],
    pool: dict[str, Order],
    ref: RefData,
    vdays: Mapping[str, VehicleDay],
    service_date: date,
    strategy: _Strategy,
) -> _DepotPlan:
    """Steps 3 to 6 for one depot under one strategy."""
    states = [
        _VehicleState(v, vdays.get(v.id))
        for v in sorted(ref.vehicles.values(), key=lambda v: v.id)
        if v.depot == depot and _usable(vdays.get(v.id))
    ]
    result = _DepotPlan(states, {}, [])

    # Group exactly by brand/district within this depot. Temperature and access restrict candidates,
    # never raise an order's operational priority.
    groups: dict[tuple[Brand, str], list[str]] = {}
    for oid in placeable:
        outlet = ref.outlets[pool[oid].outlet_id]
        groups.setdefault((outlet.brand, outlet.district), []).append(oid)
    sign = -1 if strategy.heaviest_first else 1
    group_order = {key: (sign * fsum(pool[o].weight_kg for o in sorted(members)), key[0].value, key[1])
                   for key, members in groups.items()}
    # The complete provisional partition enables the same check_plan used at the write boundary.
    plan = Plan(service_date, {}, sorted(pool))
    for key in sorted(groups, key=lambda k: group_order[k]):
        for oid in sorted(groups[key], key=lambda o: _priority(o, pool, ref)):
            candidates = feasible_insertions(pool[oid], plan, pool, ref, vdays)
            if not candidates:
                continue  # all remaining orders are still evaluated, regardless of earlier misses
            ambient = any(not ref.vehicles[c.vehicle_id].is_reefer for c in candidates)
            chilled = any(pool[o].temp is Temp.CHILLED for o in plan.deferred if o in placeable)
            chosen = min(candidates, key=lambda c: _vehicle_rank(c, pool[oid], pool, ref,
                         chilled_remains=chilled, legal_ambient_exists=ambient))
            for trip in chosen.trips:
                plan.trips[trip.key] = trip
            plan.deferred.remove(oid)
    plan = repair_continuity(plan, pool, ref, vdays, eligible=set(placeable))
    plan = _policy_replacements(plan, set(placeable), pool, ref, vdays)
    for state in states:
        state.trips = plan.trips_of(state.vehicle.id)
    for oid in placeable:
        if oid not in plan.deferred:
            continue
        outlet = ref.outlets[pool[oid].outlet_id]
        group_trips = [(state, trip) for state in states for trip in state.trips
                       if ref.outlets[pool[trip.order_ids[0]].outlet_id].brand is outlet.brand
                       and ref.outlets[pool[trip.order_ids[0]].outlet_id].district == outlet.district]
        result.policy[oid] = _explain(oid, group_trips, pool, ref, depot)
        if pool[oid].deferred_yesterday:
            binding, reason = result.policy[oid]
            warning = msg.continuity_unrepaired(oid, pool[oid].outlet_id, reason)
            result.policy[oid] = (binding, warning)
            result.warnings.append(warning)
    return result


def draft_plan(
    orders: Mapping[str, Order],
    ref: RefData,
    vehicle_days: Mapping[str, VehicleDay],
    history: Mapping[str, OutletHistory] | None = None,
    *,
    service_date: date,
    operating_days: Iterable[date] | None = None,
) -> PlanDraft:
    """The system draft (v1) for ``service_date`` from the closed queue.

    ``history`` is per outlet and, when given, replaces the continuity and days-since-served values on the
    orders. ``operating_days`` is the calendar for the Next run date; without it the next Monday to Saturday is used.
    """
    pool: dict[str, Order] = {}
    for oid in sorted(orders):
        order = orders[oid]
        past = (history or {}).get(order.outlet_id)
        if past:
            order = replace(order, deferred_yesterday=past.deferred_yesterday, days_since_served=past.days_since_served)
        pool[oid] = order

    vdays = dict(vehicle_days)
    next_run = _next_run(service_date, operating_days)
    deferrals: dict[str, DraftDeferral] = {}
    warnings: list[str] = []
    trips: list[DraftTrip] = []

    def defer(oid: str, kind: DeferralType, binding: Binding | None, reason: str) -> None:
        deferrals[oid] = DraftDeferral(
            oid, kind, binding, reason, impact_on_store(pool[oid], ref), frees(pool[oid], ref), next_run
        )

    # Step 1 and 2: pool per depot, and the orders no vehicle can carry whole.
    by_depot: dict[str, list[str]] = {}
    for oid in pool:
        by_depot.setdefault(ref.outlets[pool[oid].outlet_id].depot, []).append(oid)

    for depot in sorted(by_depot):
        placeable: list[str] = []
        for oid in by_depot[depot]:
            if classify_deferral(pool[oid], ref, vdays) is DeferralType.CAPACITY:
                defer(oid, DeferralType.CAPACITY, _capacity_binding(pool[oid], ref), _capacity_reason(pool[oid], ref, depot))
            else:
                placeable.append(oid)

        # Steps 3 to 6 under each strategy; keep the one that defers the fewest orders.
        best: _DepotPlan | None = None
        for strategy in _STRATEGIES:
            candidate = _plan_depot(depot, placeable, pool, ref, vdays, service_date, strategy)
            if best is None or candidate.quality < best.quality:
                best = candidate
            if not best.warnings and not best.policy:
                break  # nothing deferred: no strategy can do better
        assert best is not None
        warnings.extend(best.warnings)
        for oid in sorted(best.policy):
            binding, reason = best.policy[oid]
            defer(oid, DeferralType.POLICY, binding, reason)

        for state in best.states:
            for trip in state.trips:
                brand_of = trip_brand(trip, pool, ref)
                assert brand_of is not None
                first = ref.outlets[pool[trip.order_ids[0]].outlet_id]
                n = len(trip.order_ids)
                stops = tuple(DraftStop(o, i + 1, n - i) for i, o in enumerate(trip.order_ids))
                trips.append(DraftTrip(trip.vehicle_id, trip.trip_no, brand_of, first.district, trip.depart_at, stops))

    trips.sort(key=lambda t: (t.vehicle_id, t.trip_no))
    result = PlanDraft(
        service_date,
        tuple(trips),
        tuple(deferrals[o] for o in sorted(deferrals)),
        tuple(warnings),
    )
    violations = check_plan(result.as_plan(), pool, ref, vdays,
                            deferral_reasons={d.order_id: (d.type, d.reason_text) for d in result.deferrals})
    if violations:
        raise ValueError("Planner produced an invalid result: " + "; ".join(v.message for v in violations))
    return result


def _capacity_binding(order: Order, ref: RefData) -> Binding:
    """The resource that forced a capacity deferral: van access first, then weight, then volume."""
    if ref.outlets[order.outlet_id].van_only:
        return Binding.VAN_ACCESS
    depot = ref.outlets[order.outlet_id].depot
    able = [v for v in ref.vehicles.values() if v.depot == depot and not order_vehicle_violations(order, v, ref)]
    if able and order.weight_kg > max(v.weight_cap_kg for v in able):
        return Binding.WEIGHT
    return Binding.VOLUME if able else Binding.WEIGHT
