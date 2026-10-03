"""Deferral typing and explanation: capacity vs policy, Impact on store, Frees, the D2/D4
headline, and the D8 swap recommendation (PRD §4b, §12).

Show reasons, never a score. Ties go to the order that frees the least surplus.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations

from .calc import trip_load
from .constraints import legal_vehicles
from .model import Order, RefData, Trip, Vehicle, VehicleDay
from .vocab import FRESH_BUDGET_MIN, STYLE_TECH_BUDGET_MIN, Binding, Brand, DeferralType


def classify_deferral(order: Order, ref: RefData, vehicle_days: dict[str, VehicleDay] | None = None) -> DeferralType:
    """``capacity`` when no legal vehicle exists for the whole order, else ``policy``."""
    return DeferralType.POLICY if legal_vehicles(order, ref, vehicle_days) else DeferralType.CAPACITY


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


def frees(order: Order, ref: RefData) -> Frees:
    """Capacity freed by leaving the order out: its load, its handling and one inter-stop hop."""
    outlet = ref.outlets[order.outlet_id]
    district = ref.district_of(outlet)
    return Frees(order.weight_kg, order.volume_m3, ref.allowance(outlet) + district.inter_stop_min)


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
    res, (d, s) = max(resources.items(), key=lambda kv: (kv[1][0] / kv[1][1]) if kv[1][1] else float("inf"))
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
    gap_m3 = max(0.0, round(m3 - replacement.volume_cap_m3, 6))
    protected = tuple(o for o in trip.order_ids if orders[o].deferred_yesterday)
    pool = [o for o in trip.order_ids if o not in protected]
    rec = SwapRecommendation(gap_kg, gap_m3, (), 0.0, 0.0, protected)
    if gap_kg <= 0 and gap_m3 <= 0:
        return rec
    for size in range(1, len(pool) + 1):
        cands: list[SwapCandidate] = []
        for combo in combinations(pool, size):
            ckg = sum(orders[o].weight_kg for o in combo)
            cm3 = sum(orders[o].volume_m3 for o in combo)
            if ckg + 1e-9 >= gap_kg and cm3 + 1e-9 >= gap_m3:
                # Impact: fewer days since served and not deferred yesterday = lower impact.
                impact = (sum(orders[o].deferred_yesterday for o in combo), sum(orders[o].days_since_served for o in combo))
                cands.append(SwapCandidate(combo, ckg, round(cm3, 3), ckg - gap_kg, round(cm3 - gap_m3, 3), impact))
        if cands:
            cands.sort(key=lambda c: (c.impact_key, c.surplus_kg, c.surplus_m3, c.order_ids))
            best = cands[0]
            rec.candidates = cands
            rec.defer = best.order_ids
            rec.surplus_kg, rec.surplus_m3 = best.surplus_kg, best.surplus_m3
            rec.reasons = [
                f"{replacement.id} is {gap_kg:,.0f} kg and {gap_m3:.1f} m³ short on trip {trip.trip_no}",
                "Equal impact on every candidate store" if len({c.impact_key for c in cands}) == 1 else "Lowest impact on the store",
                f"Least surplus: frees {best.kg:,.0f} kg / {best.m3:.1f} m³, {best.surplus_kg:,.0f} kg / {best.surplus_m3:.1f} m³ more than needed",
            ]
            if protected:
                rec.reasons.append(", ".join(ref.outlets[orders[o].outlet_id].id for o in protected) + " protected: deferred yesterday")
            return rec
    return rec
