"""Deferral typing and explanation: capacity vs policy, Impact on store, Frees, the D2/D4
headline, and the D8 swap recommendation (PRD §4b, §12).

Show reasons, never a score. Ties go to the order that frees the least surplus.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations
from math import fsum

from .calc import planned_clock, planned_fuel, trip_load, trip_minutes
from .constraints import capable_vehicles
from .model import Order, RefData, Trip, Vehicle, VehicleDay
from .vocab import FRESH_BUDGET_MIN, STYLE_TECH_BUDGET_MIN, Binding, Brand, DeferralType


def classify_deferral(order: Order, ref: RefData, vehicle_days: dict[str, VehicleDay] | None = None) -> DeferralType:
    """``capacity`` when no legal vehicle exists for the whole order, else ``policy``."""
    return DeferralType.POLICY if capable_vehicles(order, ref) else DeferralType.CAPACITY


@dataclass(frozen=True, slots=True)
class Impact:
    deferred_yesterday: bool
    days_since_served: int
    consequence: str


def impact_on_store(order: Order, ref: RefData) -> Impact:
    outlet = ref.outlets[order.outlet_id]
    if outlet.brand is Brand.FRESH:
        consequence = "Misses Fresh morning sales"
    elif outlet.mall_dock:
        consequence = "Misses the next mall slot"
    else:
        consequence = "Waits for the next run"
    return Impact(order.deferred_yesterday, order.days_since_served, consequence)


@dataclass(frozen=True, slots=True)
class Frees:
    kg: float
    m3: float
    minutes: int


def frees(order: Order, ref: RefData, trip: Trip | None = None, orders: dict[str, Order] | None = None) -> Frees:
    """Capacity freed by leaving the order out: its load, its handling and one inter-stop hop."""
    outlet = ref.outlets[order.outlet_id]
    district = ref.district_of(outlet)
    minutes = ref.allowance(outlet) + district.inter_stop_min
    if trip is not None and orders is not None:
        kept = Trip(trip.vehicle_id, trip.trip_no, trip.depart_at, [oid for oid in trip.order_ids if oid != order.id])
        minutes = trip_minutes(trip, orders, ref) - trip_minutes(kept, orders, ref)
    return Frees(order.weight_kg, order.volume_m3, minutes)


def binding_freed(before: Trip, after: Trip, orders: dict[str, Order], ref: RefData,
                  vehicle: Vehicle, binding: Binding) -> float:
    """Actual marginal load, budget minutes, litres or physical route duration of removing orders."""
    if binding is Binding.WEIGHT:
        return trip_load(before, orders)[0] - trip_load(after, orders)[0]
    if binding is Binding.VOLUME:
        return trip_load(before, orders)[1] - trip_load(after, orders)[1]
    if binding is Binding.FUEL:
        return planned_fuel(before, vehicle, orders, ref).litres - planned_fuel(after, vehicle, orders, ref).litres
    if binding is Binding.WINDOW:
        old = planned_clock(before, orders, ref).last_handling_end
        new = planned_clock(after, orders, ref).last_handling_end
        old_duration = (old - before.depart_at).total_seconds() / 60 if old else 0
        new_duration = (new - after.depart_at).total_seconds() / 60 if new else 0
        return old_duration - new_duration
    return trip_minutes(before, orders, ref) - trip_minutes(after, orders, ref)


def headline(depot: str, capacity_count: int, policy_count: int) -> str:
    """D2 and D4. Store-request deferrals are not counted."""
    n = capacity_count + policy_count
    has = "has" if capacity_count == 1 else "have"
    return (
        f"Capacity forces {n} deferrals at {depot.title()}. "
        f"{capacity_count} {has} no legal vehicle; policy chose the other {policy_count}."
    )


@dataclass(frozen=True, slots=True)
class BindingResult:
    resource: Binding
    demand: float
    supply: float

    @property
    def percent(self) -> int:
        return round(100 * self.demand / self.supply) if self.supply else 0

    @property
    def over_by(self) -> float:
        return max(0.0, self.demand - self.supply)


def binding_resource(resources: dict[Binding, tuple[float, float]]) -> BindingResult:
    """The scarcest resource: highest demand ÷ supply. D2 shows reefer Fresh minutes 2,590 vs
    2,160 = 120 %, over by 430."""
    res, (d, s) = min(resources.items(), key=lambda kv: (-(kv[1][0] / kv[1][1]) if kv[1][1] else -float("inf"), kv[0].value))
    return BindingResult(res, d, s)


@dataclass(frozen=True, slots=True)
class TripMinutes:
    """One planned trip, as the minute budgets see it."""

    brand: Brand
    on_reefer: bool
    minutes: float


@dataclass(frozen=True, slots=True)
class DeferredMinutes:
    """A forced deferral: the minutes it would need if it were served."""

    brand: Brand
    chilled: bool
    minutes: float


@dataclass(frozen=True, slots=True)
class MinutesPool:
    """Budgeted minutes of one fleet: what is asked of it against what it can give."""

    label: str
    demand: float
    supply: float
    available: int
    per_vehicle: int

    @property
    def percent(self) -> int:
        return round(100 * self.demand / self.supply) if self.supply else 0

    @property
    def over_by(self) -> float:
        return max(0.0, self.demand - self.supply)


def minutes_pools(
    trips: list[TripMinutes], deferred: list[DeferredMinutes], usable: int, usable_reefers: int
) -> list[MinutesPool]:
    """The minute budgets, each measuring demand and supply on the same fleet (D2).

    Chilled orders can only ride reefers, so the reefer pool counts the Fresh trips that run on reefers and the chilled
    Fresh orders left out. Ambient Fresh on a dry truck is the all-vehicle pool's business, never the reefers'.
    """
    fresh = [t for t in trips if t.brand is Brand.FRESH]
    other = [t for t in trips if t.brand is not Brand.FRESH]
    fresh_left = [d for d in deferred if d.brand is Brand.FRESH]
    other_left = [d for d in deferred if d.brand is not Brand.FRESH]
    pools = [
        MinutesPool(
            "Reefer Fresh minutes",
            sum(t.minutes for t in fresh if t.on_reefer) + sum(d.minutes for d in fresh_left if d.chilled),
            usable_reefers * FRESH_BUDGET_MIN, usable_reefers, FRESH_BUDGET_MIN,
        ),
        MinutesPool(
            "Fresh minutes (all vehicles)",
            sum(t.minutes for t in fresh) + sum(d.minutes for d in fresh_left),
            usable * FRESH_BUDGET_MIN, usable, FRESH_BUDGET_MIN,
        ),
        MinutesPool(
            "Style + Tech minutes",
            sum(t.minutes for t in other) + sum(d.minutes for d in other_left),
            usable * STYLE_TECH_BUDGET_MIN, usable, STYLE_TECH_BUDGET_MIN,
        ),
    ]
    return [p for p in pools if p.supply]


def scarcest_pool(pools: list[MinutesPool]) -> MinutesPool | None:
    """The pool with the highest demand ÷ supply, or ``None`` when there is no pool. Ties keep the first."""
    return max(pools, key=lambda p: p.demand / p.supply, default=None)


@dataclass(frozen=True, slots=True)
class SwapCandidate:
    order_ids: tuple[str, ...]
    kg: float
    m3: float
    surplus_kg: float
    surplus_m3: float
    impact_key: tuple[int, int]


@dataclass(slots=True)
class SwapRecommendation:
    gap_kg: float
    gap_m3: float
    defer: tuple[str, ...]
    surplus_kg: float
    surplus_m3: float
    protected: tuple[str, ...]
    candidates: list[SwapCandidate] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)


def policy_deferral_key(
    order_ids: tuple[str, ...], orders: dict[str, Order], *, freed: float, required: float,
    surplus_kg: float = 0.0, surplus_m3: float = 0.0,
) -> tuple[float, int, float, float, float, tuple[str, ...]]:
    """Internal binding-resource comparator, never a displayed policy score.

    Store impact is overdue days above the normal one-day delivery cadence per actual unit freed.
    The PRD gives no numeric impact formula; this explicit interpretation preserves its equal-impact
    D8 golden case (all four candidates served yesterday). Continuity candidates are excluded by callers.
    Tie order: count, binding surplus, kg surplus, m³ surplus, sorted IDs. Round ranking only.
    """
    overdue = sum(max(0, orders[oid].days_since_served - 1) for oid in order_ids)
    return (round(overdue / freed, 9) if freed > 0 else float("inf"), len(order_ids),
            round(max(0.0, freed - required), 9), round(surplus_kg, 9), round(surplus_m3, 9), tuple(sorted(order_ids)))


def policy_candidate_sets(order_ids: list[str], orders: dict[str, Order]) -> list[tuple[str, ...]]:
    """Bounded set choices, retaining the existing whole-order D8 recommendation architecture.

    Exact sets for up to 12 orders; on larger trips, singles/pairs/triples plus deterministic prefixes.
    This is a bounded greedy policy aid, not unbounded optimization; every proposed result is validated.
    """
    pool = sorted(oid for oid in order_ids if not orders[oid].deferred_yesterday)
    limit = len(pool) if len(pool) <= 12 else 3
    sets = {combo for size in range(1, limit + 1) for combo in combinations(pool, size)}
    ordered = sorted(pool, key=lambda oid: (orders[oid].days_since_served, oid))
    sets.update(tuple(sorted(ordered[:size])) for size in range(1, len(ordered) + 1))
    return sorted(sets, key=lambda combo: (len(combo), combo))


def recommend_swap(
    trip: Trip,
    replacement: Vehicle,
    orders: dict[str, Order],
    ref: RefData,
) -> SwapRecommendation:
    """Which orders to defer so ``trip`` fits ``replacement`` (D8).

    Protected orders (outlet deferred yesterday) are never candidates. Smallest set first;
    within a size, lowest impact, then least surplus (kg, then m³). VEH003 trip 1 on VEH036:
    gap 120 kg / 0.7 m³ → defer ORD1002 (OUT009), surplus 90 kg / 0.7 m³.
    """
    kg, m3 = trip_load(trip, orders)
    gap_kg = max(0.0, kg - replacement.weight_cap_kg)
    gap_m3 = max(0.0, m3 - replacement.volume_cap_m3)
    protected = tuple(sorted(o for o in trip.order_ids if orders[o].deferred_yesterday))
    pool = [o for o in trip.order_ids if o not in protected]
    rec = SwapRecommendation(gap_kg, round(gap_m3, 6), (), 0.0, 0.0, protected)
    if gap_kg <= 0 and gap_m3 <= 0:
        return rec
    cands: list[SwapCandidate] = []
    for combo in policy_candidate_sets(pool, orders):
        ckg = fsum(orders[o].weight_kg for o in combo)
        cm3 = fsum(orders[o].volume_m3 for o in combo)
        if ckg + 1e-9 >= gap_kg and cm3 + 1e-9 >= gap_m3:
            impact = (0, sum(max(0, orders[o].days_since_served - 1) for o in combo))
            cands.append(SwapCandidate(combo, ckg, cm3, ckg - gap_kg, cm3 - gap_m3, impact))
    if cands:
        cands.sort(key=lambda c: policy_deferral_key(c.order_ids, orders,
                   freed=c.kg if gap_kg > 0 else c.m3, required=gap_kg if gap_kg > 0 else gap_m3,
                   surplus_kg=c.surplus_kg, surplus_m3=c.surplus_m3))
        best = cands[0]
        # Keep the public recommendation figures rounded, after selection/feasibility checks.
        rec.candidates = [c for c in cands if len(c.order_ids) == len(best.order_ids)]
        rec.defer = best.order_ids
        rec.surplus_kg, rec.surplus_m3 = round(best.surplus_kg, 3), round(best.surplus_m3, 3)
        rec.reasons = [
            f"{replacement.id} is {gap_kg:,.0f} kg and {gap_m3:.1f} m³ short on trip {trip.trip_no}",
            "Equal impact on every candidate store" if len({c.impact_key for c in rec.candidates}) == 1 else "Lowest overdue store impact per unit freed",
            f"Least surplus: frees {best.kg:,.0f} kg / {best.m3:.1f} m³, {rec.surplus_kg:,.0f} kg / {rec.surplus_m3:.1f} m³ more than needed",
        ]
        if protected:
            rec.reasons.append(", ".join(ref.outlets[orders[o].outlet_id].id for o in protected) + " protected: deferred yesterday")
    return rec
