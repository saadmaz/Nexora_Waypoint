"""D8, the loading exception: pick the replacement, work out what has to give, and show it (PRD v3 §12 "D8 recommendation").

Pure, like the other view modules: ``recommend_swap`` and the constraint checks in ``waypoint_rules`` decide, this module
arranges the decision and writes the screen's words. The service that records a decision lives in ``exceptions``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

from waypoint_rules import (
    Order,
    Plan,
    SwapRecommendation,
    Trip,
    Vehicle,
    Violation,
    check_trip,
    check_vehicle_day,
    legal_vehicles,
    order_vehicle_violations,
    planned_clock,
    recommend_swap,
    trip_load,
    trip_minutes,
    vehicle_day_totals,
)
from waypoint_rules import messages as msg
from waypoint_rules.vocab import (
    FRESH_BUDGET_MIN,
    STYLE_TECH_BUDGET_MIN,
    Binding,
    Brand,
    DeferralType,
    RuleId,
    VehicleTemp,
    VehicleType,
)

from ..models.enums import ExceptionStatus
from ..schemas import dispatcher as s
from .dispatch_model import DispatchDay
from .dispatcher_views import day_label, hm
from .plan_logic import plan_of


@dataclass(frozen=True, slots=True)
class ExceptionRow:
    """A loader flag or a driver problem, as the dispatcher reviews it."""

    id: int
    kind: str
    type: str
    vehicle_id: str | None
    trip_id: int | None
    order_ids: tuple[str, ...]
    detail: str | None
    raised_by: str | None
    #: Naive Asia/Colombo.
    raised_at: datetime
    status: ExceptionStatus
    decision: dict[str, object] | None
    decided_by: str | None
    decided_at: datetime | None


@dataclass(slots=True)
class Swap:
    """What replacing a vehicle means for the plan."""

    failed: str
    replacement: Vehicle
    #: The failed vehicle's trips in the current plan, by trip number.
    trips: list[Trip]
    #: Per trip number: what the replacement is short by, and the rules' recommendation.
    recommendations: dict[int, SwapRecommendation]
    #: Orders to defer: the recommendation, or the dispatcher's own set.
    defer: list[str]
    #: The plan after the swap: the failed vehicle's trips move to the replacement, minus ``defer``.
    plan: Plan
    violations: list[Violation] = field(default_factory=list)

    @property
    def gap(self) -> tuple[float, float]:
        kg = max((r.gap_kg for r in self.recommendations.values()), default=0.0)
        m3 = max((r.gap_m3 for r in self.recommendations.values()), default=0.0)
        return kg, m3

    def focus(self) -> Trip | None:
        """The trip the screen talks about: the first one the replacement cannot carry whole, else the first."""
        short = [t for t in self.trips if self.recommendations[t.trip_no].gap_kg > 0 or self.recommendations[t.trip_no].gap_m3 > 0]
        return (short or self.trips or [None])[0]  # type: ignore[list-item]


# ---- choosing the replacement -----------------------------------------------


def failed_trips(day: DispatchDay, vehicle_id: str) -> list[Trip]:
    return sorted((t for t in plan_of(day).trips.values() if t.vehicle_id == vehicle_id and t.order_ids), key=lambda t: t.trip_no)


def _available(day: DispatchDay, vehicle: Vehicle) -> bool:
    """Free to run now: not held, and back from the workshop if it was in it."""
    vday = day.vehicle_days.get(vehicle.id)
    if vday is None:
        return True
    return not vday.held and (vday.available_from is None or vday.available_from <= day.now)


def _gaps(trips: list[Trip], vehicle: Vehicle, day: DispatchDay) -> dict[int, SwapRecommendation]:
    return {t.trip_no: recommend_swap(t, vehicle, day.orders, day.ref) for t in trips}


def choose_replacement(day: DispatchDay, failed: str) -> Vehicle | None:
    """The vehicle that has to give up the least: free, unused today, from the same depot, able to carry what is on the trips.

    Fewest kilograms to defer first, then the smaller vehicle, then the ID, so the choice is the same every time.
    """
    trips = failed_trips(day, failed)
    if not trips:
        return None
    depot = day.ref.vehicles[failed].depot
    used = {t.vehicle_id for t in day.trips}
    ordered = [o for t in trips for o in t.order_ids]
    best: tuple[tuple[float, float, str], Vehicle] | None = None
    for v in sorted(day.ref.vehicles.values(), key=lambda v: v.id):
        if v.id == failed or v.depot != depot or v.id in used or not _available(day, v):
            continue
        # Availability was checked above (``_available``), so only what the vehicle is made of is asked here.
        if any(order_vehicle_violations(day.orders[o], v, day.ref) for o in ordered):
            continue  # a reefer is needed, or the outlet takes vans only
        short = sum(r.gap_kg for r in _gaps(trips, v, day).values())
        key = (short, v.weight_cap_kg, v.id)
        if best is None or key < best[0]:
            best = (key, v)
    return best[1] if best else None


# ---- the swap ---------------------------------------------------------------


def build_swap(day: DispatchDay, failed: str, replacement: Vehicle, defer_override: list[str] | None = None) -> Swap:
    """The plan if ``replacement`` takes ``failed``'s trips, deferring ``defer_override`` or the rules' recommendation."""
    trips = failed_trips(day, failed)
    recs = _gaps(trips, replacement, day)
    on_trips = {o for t in trips for o in t.order_ids}
    defer = list(defer_override) if defer_override is not None else sorted({o for r in recs.values() for o in r.defer})
    violations: list[Violation] = []

    for oid in defer:
        order = day.orders.get(oid)
        if order is None or oid not in on_trips:
            violations.append(Violation(RuleId.WHOLE, f"{oid} is not on {failed}'s trips, so deferring it does not help"))
        elif order.deferred_yesterday and legal_vehicles(order, day.ref, day.vehicle_days):
            violations.append(Violation(RuleId.CONT, msg.continuity(order.outlet_id)))

    plan = plan_of(day)
    for t in trips:
        del plan.trips[(t.vehicle_id, t.trip_no)]
    new_trips: list[Trip] = []
    for t in trips:
        kept = [o for o in t.order_ids if o not in defer]
        if kept:
            moved = Trip(replacement.id, t.trip_no, t.depart_at, kept)
            plan.trips[moved.key] = moved
            new_trips.append(moved)
    plan.deferred.extend(o for o in defer if o not in plan.deferred)

    vday = day.vehicle_days.get(replacement.id)
    for t in new_trips:
        violations.extend(check_trip(t, day.orders, day.ref, vday))
    violations.extend(check_vehicle_day(replacement, new_trips, day.orders, day.ref, vday))
    return Swap(failed, replacement, trips, recs, defer, plan, _unique(violations))


def _unique(vs: list[Violation]) -> list[Violation]:
    seen: set[tuple[RuleId, str]] = set()
    out: list[Violation] = []
    for v in vs:
        if (v.rule, v.message) not in seen:
            seen.add((v.rule, v.message))
            out.append(v)
    return out


def deferral_reason(swap: Swap, trip_no: int | None, actor_name: str) -> str:
    """The reason line a swap deferral carries (PRD §4b): which vehicle failed and by how much the replacement is short."""
    rec = swap.recommendations.get(trip_no) if trip_no is not None else None
    if rec is not None and (rec.gap_kg > 0 or rec.gap_m3 > 0):
        return f"{swap.failed} failed its check; replacement {swap.replacement.id} is {rec.gap_kg:,.0f} kg / {rec.gap_m3:.1f} m³ short on Trip {trip_no}."
    return f"Deferred by {actor_name} when {swap.failed} was replaced by {swap.replacement.id}."


def deferral_binding(swap: Swap, trip_no: int | None) -> Binding:
    rec = swap.recommendations.get(trip_no) if trip_no is not None else None
    return Binding.VOLUME if rec is not None and rec.gap_kg <= 0 < rec.gap_m3 else Binding.WEIGHT


def trip_of_order(swap: Swap, order_id: str) -> int | None:
    return next((t.trip_no for t in swap.trips if order_id in t.order_ids), None)


# ---- the screen -------------------------------------------------------------


def _spec(v: Vehicle) -> str:
    kind = "Van" if v.type is VehicleType.VAN else "Truck"
    temp = "reefer" if v.temp is VehicleTemp.REEFER else "ambient"
    return f"{kind} · {temp} · {v.weight_cap_kg:,.0f} kg · {v.volume_cap_m3:.1f} m³"


def _impact(o: Order) -> str:
    if o.deferred_yesterday:
        return "Deferred yesterday"
    return "Served yesterday, not skipped before" if o.days_since_served == 1 else f"{o.days_since_served} days since served"


def _percent_note(used: float, limit: float, tail: str) -> str:
    pct = round(100 * used / limit) if limit else 0
    return f"{pct}%: {tail}" if pct >= 90 else f"{pct}% of capacity"


def _stops(trip: Trip, day: DispatchDay) -> list[str]:
    clock = planned_clock(trip, day.orders, day.ref)
    return [stop.outlet_id for stop in clock.stops]


def _after(day: DispatchDay, swap: Swap) -> s.ExceptionAfter | None:
    focus = swap.focus()
    if focus is None:
        return None
    new_trips = sorted((t for t in swap.plan.trips.values() if t.vehicle_id == swap.replacement.id), key=lambda t: t.trip_no)
    mine = next((t for t in new_trips if t.trip_no == focus.trip_no), None)
    if mine is None:
        return None
    kg, m3 = trip_load(mine, day.orders)
    v = swap.replacement
    totals = vehicle_day_totals(v, new_trips, day.orders, day.ref, day.vehicle_days.get(v.id))
    clock = planned_clock(mine, day.orders, day.ref)
    waits = next((st for st in clock.stops if st.waits), None)
    later = next((t for t in new_trips if t.trip_no != mine.trip_no), None)
    if later is not None:
        lc = planned_clock(later, day.orders, day.ref)
        last = lc.stops[-1] if lc.stops else None
        trip2 = f"{hm(later.depart_at)} → {last.outlet_id} {hm(last.arrival)}" if last else "No second trip"
    else:
        trip2 = "No second trip"
    fresh = Brand.FRESH in {day.ref.outlets[day.orders[o].outlet_id].brand for o in mine.order_ids}
    minutes, budget, label = (totals.fresh_min, FRESH_BUDGET_MIN, "") if fresh else (totals.style_tech_min, STYLE_TECH_BUDGET_MIN, "")
    return s.ExceptionAfter(
        weight=s.WarnMeter(used=kg, limit=v.weight_cap_kg, warn=_percent_note(kg, v.weight_cap_kg, "little room left")),
        volume=s.WarnMeter(used=round(m3, 1), limit=v.volume_cap_m3, warn=_percent_note(m3, v.volume_cap_m3, "full van" if v.type is VehicleType.VAN else "full truck")),
        trip1_minutes=trip_minutes(mine, day.orders, day.ref),
        trip2=trip2,
        fresh=f"{minutes} / {budget}{label} min",
        fuel=f"{totals.fuel_week_l:.1f} / {v.weekly_fuel_quota_l:.0f} L",
        stops=_dedupe(_stops(mine, day)),
        stops_note=(f"{waits.outlet_id} reached {hm(waits.arrival)} · waits to {hm(waits.handling_start)}" if waits else "No waiting at any stop"),
    )


def _dedupe(items: list[str]) -> list[str]:
    out: list[str] = []
    for i in items:
        if not out or out[-1] != i:
            out.append(i)
    return out


def exception_view(day: DispatchDay, row: ExceptionRow, *, next_run: date | None, decided_plan: dict[str, object] | None = None) -> s.ExceptionView:
    """What D8 shows for one exception.

    ``day`` is the plan the dispatcher is reviewing: the latest version while the exception is open, and the version
    before the swap once it is decided (so the before and after figures still describe the decision). ``decided_plan``
    carries what the decision recorded about the new version.
    """
    failed_id = row.vehicle_id or ""
    failed = day.ref.vehicles[failed_id]
    decided = row.status is ExceptionStatus.DECIDED
    trips = failed_trips(day, failed_id)
    first_depart = min((t.depart_at for t in trips), default=None)
    depot = failed.depot
    n_orders = sum(len(t.order_ids) for t in trips)
    reason = row.detail or row.type
    replacement: Vehicle | None = None
    if decided and row.decision and row.decision.get("replacement"):
        replacement = day.ref.vehicles[str(row.decision["replacement"])]
    elif not decided:
        replacement = choose_replacement(day, failed_id)

    depart_text = hm(first_depart) if first_depart else "its departure"
    base = dict(
        id=str(row.id),
        flagged_by=row.raised_by or "Loader",
        flagged_at=hm(row.raised_at),
        reason=reason,
        orders_text=(
            f"{n_orders} orders on {len(trips)} {'trip' if len(trips) == 1 else 'trips'} stay Planned. "
            f"Trip 1 departs {depart_text} from the {depot.title()} dock."
            if trips else "No orders are planned on this vehicle."
        ),
        minutes_to_departure=max(0, round((first_depart - day.now).total_seconds() / 60)) if first_depart else 0,
        failed=s.FailedVehicle(vehicle_id=failed_id, spec=_spec(failed), reason=reason, tag="Replaced" if decided else "Held"),
    )
    if replacement is None:
        return s.ExceptionView(
            **base, state="working", title=f"{failed_id} held: replace it before {depart_text}", candidates=[], need=s.Need(kg=0, m3=0)
        )

    override = [str(o) for o in row.decision.get("deferred", [])] if decided and row.decision else None  # type: ignore[union-attr]
    swap = build_swap(day, failed_id, replacement, override)
    focus = swap.focus()
    rec = swap.recommendations[focus.trip_no] if focus else None
    gap_kg, gap_m3 = swap.gap

    since = day.availability.get(replacement.id)
    since_text = hm(since.available_from) if since is not None and since.available_from is not None else "now"
    before = None
    if focus is not None and rec is not None:
        kg, m3 = trip_load(focus, day.orders)
        other = next((t for t in swap.trips if t.trip_no != focus.trip_no), None)
        if other is not None:
            okg, om3 = trip_load(other, day.orders)
            fits = swap.recommendations[other.trip_no].gap_kg <= 0 and swap.recommendations[other.trip_no].gap_m3 <= 0
            trip2 = f"Trip {other.trip_no} fits: {okg:,.0f} kg · {om3:.1f} m³" if fits else f"Trip {other.trip_no} is over by {swap.recommendations[other.trip_no].gap_kg:,.0f} kg"
        else:
            trip2 = "No second trip"
        before = s.ExceptionBefore(
            weight=s.OverMeter(used=kg, limit=replacement.weight_cap_kg, over=f"Over by {rec.gap_kg:,.0f} kg, defer one order or swap vehicle" if rec.gap_kg > 0 else "Fits"),
            volume=s.OverMeter(used=round(m3, 1), limit=replacement.volume_cap_m3, over=f"Over by {rec.gap_m3:.1f} m³" if rec.gap_m3 > 0 else "Fits"),
            trip2=trip2,
        )

    recommendation = None
    if swap.defer:
        first = swap.defer[0]
        o = day.orders[first]
        outlets = sorted({day.orders[d].outlet_id for d in swap.defer})
        cands = rec.candidates if rec is not None else []
        equal = len({c.impact_key for c in cands}) <= 1
        # One order closes the gap alone: say how many equal candidates it was chosen from. A set of orders is chosen by
        # lowest impact, then least surplus.
        why = (
            f"Vehicle unavailable · Least surplus of the {len(cands)} equal-impact orders"
            if equal and len(swap.defer) == 1 and len(cands) > 1
            else "Vehicle unavailable · Lowest impact on the store, then least surplus"
        )
        protected = [
            s.ProtectedOutlet(outlet_id=day.orders[p].outlet_id, order_id=p, text="Deferred yesterday: can't be skipped twice.")
            for p in (rec.protected if rec is not None else ())
        ]
        recommendation = s.ExceptionRecommendation(
            order_id=first,
            order_ids=list(swap.defer),
            outlet_id=o.outlet_id,
            title=f"{', '.join(outlets)}: chilled order" if len(outlets) == 1 else f"{', '.join(outlets)}: {len(swap.defer)} orders",
            kind=DeferralType.POLICY,
            type_note="Deferral type: policy: other reefers could legally carry it but are full",
            reason=why,
            decided_by=(f"{row.decided_by or 'Kumari'} · {hm(row.decided_at)}" if decided and row.decided_at else f"Recommended · {hm(day.now)}"),
            impact=_impact(o),
            frees=f"{sum(day.orders[d].weight_kg for d in swap.defer):,.0f} kg / {sum(day.orders[d].volume_m3 for d in swap.defer):.1f} m³",
            next_run=day_label(next_run) if next_run else "",
            protected=protected,
        )

    candidates: list[s.ExceptionCandidate] = []
    if focus is not None:
        for oid in focus.order_ids:
            c = day.orders[oid]
            chosen = oid in swap.defer
            candidates.append(
                s.ExceptionCandidate(
                    outlet_id=c.outlet_id, order_id=oid, impact=f"{_impact(c).split(',')[0]}" + (" · least surplus" if chosen else ""),
                    kg=c.weight_kg, m3=c.volume_m3, protected=c.deferred_yesterday, least_surplus=chosen,
                )
            )

    confirmed = None
    if decided and decided_plan is not None and row.decided_at is not None:
        at = hm(row.decided_at)
        new_no, old_no = decided_plan.get("plan"), decided_plan.get("fromPlan")
        mine = next((t for t in swap.plan.trips.values() if t.vehicle_id == replacement.id and t.trip_no == (focus.trip_no if focus else 1)), None)
        kg = trip_load(mine, day.orders)[0] if mine else 0.0
        stays = ", ".join(sorted({day.orders[p].outlet_id for p in (rec.protected if rec else ())}))
        who = [
            s.WhoKnows(who=f"{depot.title()} dock", what=f"'Plan changed v{old_no} → v{new_no}, review' · {at}"),
            s.WhoKnows(who=day.drivers.get(replacement.id, replacement.id), what=f"New trip on phone · {at}"),
            *[s.WhoKnows(who=oid_outlet, what=f"Deferral notice · {at} · not yet seen") for oid_outlet in sorted({day.orders[d].outlet_id for d in swap.defer})],
        ]
        after_counts = decided_plan.get("deferralsAfter")
        if isinstance(after_counts, dict):
            who.append(s.WhoKnows(who="Deferrals", what=f"Now {after_counts['total']} ({after_counts['capacity']} capacity · {after_counts['policy']} policy)"))
        confirmed = s.ExceptionConfirmed(
            plan=int(new_no),  # type: ignore[call-overload]
            at=at,
            text=f"{replacement.id} carries {kg:,.0f} / {replacement.weight_cap_kg:,.0f} kg on Trip {focus.trip_no if focus else 1}." + (f" {stays} stays on the truck." if stays else ""),
            who_knows=who,
            toast=f"Plan v{new_no} released. Loader asked to acknowledge.",
        )

    return s.ExceptionView(
        **base,
        state="confirmed" if decided else "recommendation",
        title=(f"{failed_id} replaced by {replacement.id}, plan v{decided_plan.get('plan')}" if decided and decided_plan else f"{failed_id} held: replace it before {depart_text}"),
        replacement=s.ReplacementVehicle(vehicle_id=replacement.id, spec=_spec(replacement), since=since_text),
        before=before,
        recommendation=recommendation,
        candidates=candidates,
        need=s.Need(kg=gap_kg, m3=round(gap_m3, 1)),
        after=_after(day, swap),
        confirmed=confirmed,
    )
