"""The dispatcher screens' view models, built from a :class:`DispatchDay` (PRD v3 §3 D2 to D5).

Pure: no database, no clock, no FastAPI. The rules supply every figure (``waypoint_rules``); this module only
arranges them and writes the screen's words. The wording follows the screens' own copy, and the shapes are the ones
``frontend/src/api/DispatcherApi.ts`` already draws.
"""

from __future__ import annotations

from datetime import date, datetime

from waypoint_rules import (
    DeferredMinutes,
    Move,
    MoveResult,
    Plan,
    Trip,
    TripMinutes,
    TripSummary,
    headline,
    minutes_pools,
    planned_clock,
    scarcest_pool,
    trip_load,
    trip_minutes,
    vehicle_day_totals,
    why_this_vehicle,
)
from waypoint_rules.vocab import (
    FRESH_BUDGET_MIN,
    MAX_TRIPS_PER_VEHICLE,
    STYLE_TECH_BUDGET_MIN,
    Binding,
    Brand,
    DeferralType,
    DockType,
    VehicleTemp,
    VehicleType,
)

from ..models.enums import ActorKind, PlanState
from ..schemas import dispatcher as s
from .dispatch_model import AckRow, DeferralRow, DispatchDay, TripRow, VersionRow
from .plan_logic import gate, plan_of

DEPOTS: tuple[s.DepotId, ...] = ("peliyagoda", "kandy")
DOCK_LABEL = {DockType.REAR_DOCK: "Rear dock", DockType.STREET: "Street", DockType.MALL_BAY: "Mall bay"}
BINDING_LABEL: dict[Binding | None, str] = {
    Binding.REEFER_MINUTES: "reefer minutes",
    Binding.WEIGHT: "weight",
    Binding.VOLUME: "volume",
    Binding.VAN_ACCESS: "van access",
    Binding.WINDOW: "window",
    Binding.FUEL: "fuel",
    None: "none",
}
#: The headline of a deferral card, by the rule that bound it.
REASON_HEADLINE: dict[Binding | None, str] = {
    Binding.VAN_ACCESS: "Van-only access",
    Binding.WINDOW: "Outside window",
    Binding.REEFER_MINUTES: "Fresh minutes budget",
    Binding.WEIGHT: "Over weight",
    Binding.VOLUME: "Over volume",
    Binding.FUEL: "Weekly fuel quota",
    None: "No vehicle free",
}
CARDS_IN_POOL = 4
POLICY_CARDS_SHOWN = 5


# ---- small formatters -------------------------------------------------------


def hm(value: datetime) -> str:
    return f"{value:%H:%M}"


def when(value: datetime) -> str:
    """"Mon 16:05"."""
    return f"{value:%a %H:%M}"


def day_label(value: date) -> str:
    """"Wed 30 Sep"."""
    return f"{value:%a} {value.day} {value:%b}"


def until_label(now: datetime, to: datetime) -> str:
    total = round((to - now).total_seconds() / 60)
    if total <= 0:
        return "now"
    h, m = divmod(total, 60)
    return f"in {h} h {m} min" if h > 0 else f"in {m} min"


def _kg(value: float) -> str:
    return f"{value:,.0f}"


def vehicle_kind(day: DispatchDay, vehicle_id: str) -> str:
    v = day.ref.vehicles[vehicle_id]
    reefer = v.temp is VehicleTemp.REEFER
    if v.type is VehicleType.VAN:
        return "Reefer van" if reefer else "Ambient van"
    return "Reefer truck" if reefer else "Dry-box truck"


def _depot_title(depot: str) -> str:
    return depot.title()


# ---- shared lookups ---------------------------------------------------------


def _rules_trip(t: TripRow) -> Trip:
    return Trip(t.vehicle_id, t.trip_no, t.depart_at, list(t.order_ids))


def trips_at(day: DispatchDay, depot: str) -> list[TripRow]:
    return [t for t in day.trips if day.ref.vehicles[t.vehicle_id].depot == depot]


def deferrals_at(day: DispatchDay, depot: str) -> list[DeferralRow]:
    return [d for d in day.deferrals if day.depot_of(d.order_id) == depot]


def _plannable_at(day: DispatchDay, depot: str) -> list[str]:
    return sorted(o for o in day.plannable if day.depot_of(o) == depot)


def _orders_at(day: DispatchDay, depot: str) -> list[str]:
    return sorted(o for o in day.orders if day.depot_of(o) == depot)


def _is_capacity(d: DeferralRow) -> bool:
    return d.type is DeferralType.CAPACITY


def _is_policy(d: DeferralRow) -> bool:
    return d.type is DeferralType.POLICY


def _is_request(d: DeferralRow) -> bool:
    return d.type is DeferralType.STORE_REQUEST


def _version_infos(day: DispatchDay) -> list[s.PlanVersionInfo]:
    scope = " + ".join(_depot_title(d) for d in DEPOTS if d in {day.ref.vehicles[t.vehicle_id].depot for t in day.trips})
    chosen = day.chosen.number if day.chosen else None
    out: list[s.PlanVersionInfo] = []
    for v in day.versions:
        released = v.state is PlanState.RELEASED
        at = v.released_at if released and v.released_at else v.created_at
        out.append(
            s.PlanVersionInfo(
                number=v.number,
                state=v.state,
                at=when(at),
                note=v.note or "",
                scope=(v.note or scope) if released else None,
                current=v.number == chosen,
            )
        )
    return out


# ---- D3 trip board ----------------------------------------------------------


def _stops(day: DispatchDay, trip: TripRow) -> list[s.PlanStop]:
    rules_trip = _rules_trip(trip)
    clock = planned_clock(rules_trip, day.orders, day.ref)
    out: list[s.PlanStop] = []
    for i, stop in enumerate(clock.stops):
        kg = sum(day.orders[o].weight_kg for o in stop.order_ids)
        m3 = sum(day.orders[o].volume_m3 for o in stop.order_ids)
        out.append(
            s.PlanStop(
                order_id=" + ".join(stop.order_ids),
                order_ids=list(stop.order_ids),
                outlet_id=stop.outlet_id,
                seq=i + 1,
                arrival=hm(stop.arrival),
                note=f"waits to {hm(stop.handling_start)}" if stop.waits else None,
                protected=any(day.orders[o].deferred_yesterday for o in stop.order_ids),
                kg=kg,
                m3=round(m3, 3),
                window=_effective_window(day, stop.outlet_id),
                access=_access_tags(day, stop.outlet_id),
            )
        )
    return out


def _plan_trip(day: DispatchDay, trip: TripRow) -> s.PlanTrip:
    vehicle = day.ref.vehicles[trip.vehicle_id]
    rules_trip = _rules_trip(trip)
    kg, m3 = trip_load(rules_trip, day.orders)
    minutes = trip_minutes(rules_trip, day.orders, day.ref)
    budget = FRESH_BUDGET_MIN if trip.brand is Brand.FRESH else STYLE_TECH_BUDGET_MIN
    return s.PlanTrip(
        vehicle_id=trip.vehicle_id,
        trip=trip.trip_no,
        departs=hm(trip.depart_at),
        brand=trip.brand,
        district=trip.district,
        stops=_stops(day, trip),
        kg=kg,
        kg_cap=vehicle.weight_cap_kg,
        m3=round(m3, 1),
        m3_cap=vehicle.volume_cap_m3,
        minutes=minutes,
        fill=s.Fill(kg=kg / vehicle.weight_cap_kg, m3=m3 / vehicle.volume_cap_m3, minutes=minutes / budget),
    )


def _meters(day: DispatchDay, vehicle_id: str, trips: list[TripRow]) -> list[s.LabelledMeter]:
    vehicle = day.ref.vehicles[vehicle_id]
    totals = vehicle_day_totals(vehicle, [_rules_trip(t) for t in trips], day.orders, day.ref, day.vehicle_days.get(vehicle_id))
    meters: list[s.LabelledMeter] = []
    if totals.fresh_min > 0 or (totals.style_tech_min == 0 and vehicle.temp is VehicleTemp.REEFER):
        meters.append(s.LabelledMeter(label="Fresh", used=totals.fresh_min, limit=FRESH_BUDGET_MIN, unit="min"))
    if totals.style_tech_min > 0 or (totals.fresh_min == 0 and vehicle.temp is not VehicleTemp.REEFER):
        meters.append(s.LabelledMeter(label="Style+Tech", used=totals.style_tech_min, limit=STYLE_TECH_BUDGET_MIN, unit="min"))
    meters.append(s.LabelledMeter(label="Fuel", used=round(totals.fuel_week_l, 1), limit=vehicle.weekly_fuel_quota_l, unit="L"))
    return meters


def _lanes(day: DispatchDay, depot: str) -> list[s.PlanLane]:
    by_vehicle: dict[str, list[TripRow]] = {}
    for t in trips_at(day, depot):
        by_vehicle.setdefault(t.vehicle_id, []).append(t)
    lanes: list[s.PlanLane] = []
    for vid in sorted(v.id for v in day.ref.vehicles.values() if v.depot == depot):
        avail = day.availability.get(vid)
        trips = sorted(by_vehicle.get(vid, []), key=lambda t: t.trip_no)
        replaced = avail is not None and avail.replaced_by is not None
        idle_workshop = avail is not None and avail.available_from is not None and not trips
        vday = day.vehicle_days.get(vid)
        held = vday is not None and vday.held
        vehicle = day.ref.vehicles[vid]
        status: str = "active"
        until: str | None = None
        if replaced:
            status = "replaced"
        elif idle_workshop and avail is not None and avail.available_from is not None:
            status = "spare" if avail.available_from <= day.now else "workshop"
            until = hm(avail.available_from)
        elif not trips:
            # Free all morning with nothing planned: the dispatcher can start a run on it.
            status = "idle"
        can_add = not replaced and not held and len(trips) < MAX_TRIPS_PER_VEHICLE
        lanes.append(
            s.PlanLane(
                vehicle_id=vid,
                kind=vehicle_kind(day, vid),
                reefer=vehicle.temp is VehicleTemp.REEFER,
                status=status,  # type: ignore[arg-type]
                workshop_until=until,
                driver=day.drivers.get(vid),
                # The same number the rules would open (``next_trip_no``): one after the last trip, never one already there.
                next_trip=max((t.trip_no for t in trips), default=0) + 1 if can_add else None,
                meters=_meters(day, vid, trips),
                trips=[_plan_trip(day, t) for t in trips],
            )
        )
    return lanes


def _deferred_card(day: DispatchDay, d: DeferralRow) -> s.DeferredCard:
    order = day.orders[d.order_id]
    outlet = day.outlets[order.outlet_id]
    return s.DeferredCard(
        order_id=d.order_id,
        outlet_id=outlet.id,
        brand=outlet.brand,
        temp=order.temp,
        kind=d.type,
        binding="none: store asked" if _is_request(d) else BINDING_LABEL[d.binding],
        next_run=f"{d.next_run_date:%a}" if d.next_run_date else "",
        kg=order.weight_kg,
        m3=order.volume_m3,
        window=_effective_window(day, outlet.id),
        dock=DOCK_LABEL[outlet.dock_type],
        district=outlet.district,
    )


_KIND_ORDER = {DeferralType.CAPACITY: 0, DeferralType.POLICY: 1, DeferralType.STORE_REQUEST: 2}


def _sorted_deferrals(rows: list[DeferralRow]) -> list[DeferralRow]:
    return sorted(rows, key=lambda d: (_KIND_ORDER[d.type], d.order_id))


def plan_view(day: DispatchDay, depot: s.DepotId) -> s.PlanView:
    infos = _version_infos(day)
    current = next((i for i in infos if i.current), None) or s.PlanVersionInfo(
        number=0, state=PlanState.DRAFT, at="", note="No plan yet", current=True
    )
    placed_all = {o for t in day.trips for o in t.order_ids}
    all_deferrals = day.deferrals
    pool = _sorted_deferrals(deferrals_at(day, depot))
    checks = gate(day) if day.chosen is not None else [("No plan yet", False)]
    ready = bool(
        day.chosen is not None
        and day.latest is not None
        and day.chosen.number == day.latest.number
        and day.chosen.state is PlanState.DRAFT
        and all(ok for _, ok in checks)
    )
    by_depot: list[s.DepotReceivers] = []
    for dep in DEPOTS:
        orders = _plannable_at(day, dep)
        served = [o for o in orders if o in placed_all]
        drivers = {t.vehicle_id for t in trips_at(day, dep)}
        loader = day.loaders.get(dep, "Dock")
        by_depot.append(
            s.DepotReceivers(
                depot=dep,
                orders=len(orders),
                served=len(served),
                deferred=len(deferrals_at(day, dep)),
                receivers=f"{loader} · {len(drivers)} drivers",
            )
        )
    drivers_all = {t.vehicle_id for t in day.trips}
    return s.PlanView(
        depot=depot,
        version=current,
        versions=infos,
        read_only=current.state is PlanState.RELEASED,
        lanes=_lanes(day, depot),
        deferred=[_deferred_card(day, d) for d in pool[:CARDS_IN_POOL]],
        deferred_total=len(pool),
        summary=s.PlanReleaseSummary(
            orders=len(day.plannable),
            served=len(placed_all),
            deferred=len(all_deferrals),
            capacity_deferred=sum(1 for d in all_deferrals if _is_capacity(d)),
            policy_deferred=sum(1 for d in all_deferrals if _is_policy(d)),
            trips=len(day.trips),
            receivers=s.Receivers(
                docks=len({day.ref.vehicles[t.vehicle_id].depot for t in day.trips}),
                drivers=len(drivers_all),
            ),
            by_depot=by_depot,
        ),
        checks=[s.PlanCheck(text=text, ok=ok) for text, ok in checks],
        ready_to_release=ready,
    )


# ---- D3.2 to D3.7 moves -----------------------------------------------------


def _rule_checks(day: DispatchDay, plan: Plan, order_id: str) -> list[s.RuleCheck]:
    return [
        s.RuleCheck(rule=item.label, detail=item.detail, ok=item.ok)
        for item in why_this_vehicle(plan, order_id, day.orders, day.ref, day.vehicle_days)
    ]


def move_target(move: Move) -> s.MoveTarget:
    if move.to is None:
        return s.MoveTarget(deferred=True)
    return s.MoveTarget(vehicle_id=move.to[0], trip=move.to[1])


def move_result_view(day: DispatchDay, move: Move, result: MoveResult, after: Plan) -> s.MoveResult:
    """What the trip board shows for a move: every violation, the rule checklist, and the consequence preview."""
    target = move_target(move)
    order = day.orders[move.order_id]
    opens = hm(result.opens_trip_at) if result.opens_trip_at is not None else None
    if not result.ok:
        violations = [s.MoveViolation(rule=v.rule.value, text=v.message) for v in result.violations]
        protected = next((v.message for v in result.violations if v.rule.value == "R-CONT"), None)
        where = f"{move.to[0]} · Trip {move.to[1]}" if move.to else "the deferred pool"
        return s.MoveResult(
            ok=False,
            order_id=move.order_id,
            to=target,
            violations=violations,
            checks=_rule_checks(day, after, move.order_id) if move.to else [],
            protected_reason=protected,
            summary=f"Can't defer {move.order_id}" if move.to is None
            else f"Can't start {where} with {move.order_id}" if opens else f"Can't move {move.order_id} to {where}",
            opens_trip=opens,
        )

    if move.to is None:
        next_run = next((d.next_run_date for d in day.deferrals), None)
        label = day_label(next_run) if next_run else "the next operating day"
        return s.MoveResult(
            ok=True,
            order_id=move.order_id,
            to=target,
            violations=[],
            checks=[],
            summary=f"Defer {move.order_id}",
            preview=s.MovePreview(
                headline=f"If you defer {move.order_id}",
                rows=[],
                note=f"Policy deferral, next run {label}",
                verdict="Drop to defer",
            ),
        )

    after_t = result.target_after
    vehicle = day.ref.vehicles[move.to[0]]
    before = result.target_before
    if before is None and after_t is not None:
        # A trip the move starts carries nothing yet; the vehicle-day figures are what its other trips already use.
        tot = vehicle_day_totals(vehicle, plan_of(day).trips_of(vehicle.id), day.orders, day.ref, day.vehicle_days.get(vehicle.id))
        before = TripSummary(vehicle.id, move.to[1], 0, 0.0, 0.0, 0, None, tot.fresh_min, tot.style_tech_min, round(tot.fuel_week_l, 1))
    rows: list[s.PreviewRow] = []
    if before is not None and after_t is not None:
        rows = [
            s.PreviewRow(
                label="Weight", text=f"{_kg(before.kg)} → {_kg(after_t.kg)} / {_kg(vehicle.weight_cap_kg)} kg",
                before=before.kg, after=after_t.kg, limit=vehicle.weight_cap_kg, ok=after_t.kg <= vehicle.weight_cap_kg,
            ),
            s.PreviewRow(
                label="Volume", text=f"{before.m3:.1f} → {after_t.m3:.1f} / {vehicle.volume_cap_m3:.1f} m³",
                before=before.m3, after=after_t.m3, limit=vehicle.volume_cap_m3, ok=after_t.m3 <= vehicle.volume_cap_m3 + 1e-9,
            ),
            s.PreviewRow(
                label="Window",
                text=f"Window: arrives {after_t.last_arrival}, inside {day.ref.outlets[order.outlet_id].window_close:%H:%M}"
                if after_t.last_arrival else "Window: no arrival",
                ok=True,
            ),
        ]
        budget_after = after_t.vehicle_fresh_min if before.vehicle_fresh_min or after_t.vehicle_fresh_min else after_t.vehicle_style_tech_min
        budget_before = before.vehicle_fresh_min if before.vehicle_fresh_min or after_t.vehicle_fresh_min else before.vehicle_style_tech_min
        limit = FRESH_BUDGET_MIN if before.vehicle_fresh_min or after_t.vehicle_fresh_min else STYLE_TECH_BUDGET_MIN
        name = "Fresh" if limit == FRESH_BUDGET_MIN else "Style and Tech"
        rows.append(
            s.PreviewRow(
                label=f"{name} minutes", text=f"{name} minutes {budget_before} → {budget_after} / {limit}",
                before=budget_before, after=budget_after, limit=limit, ok=budget_after <= limit,
            )
        )
    src = result.source_before
    source = (
        s.PreviewSource(
            title=f"{src.vehicle_id} · Trip {src.trip_no}",
            frees=f"Frees {_kg(order.weight_kg)} kg / {order.volume_m3:.1f} m³",
        )
        if src is not None
        else None
    )
    joins = next((o for o in after.trips[move.to].order_ids if o != move.order_id and day.orders[o].outlet_id == order.outlet_id), None)
    driver = day.drivers.get(move.to[0])
    if opens:
        note = f"Starts {move.to[0]} · Trip {move.to[1]}{f' for {driver}' if driver else ''}, leaving {opens}"
    else:
        note = f"Joins the stop at {order.outlet_id}" if joins else "New stop added at the end"
    return s.MoveResult(
        ok=True,
        order_id=move.order_id,
        to=target,
        violations=[],
        checks=_rule_checks(day, after, move.order_id),
        summary="All rules pass: drop to accept",
        opens_trip=opens,
        preview=s.MovePreview(
            headline=f"If you move {move.order_id} here",
            rows=rows,
            source=source,
            note=note,
            verdict="All rules pass: drop to accept",
        ),
    )


# ---- D4 deferrals -----------------------------------------------------------


def _effective_window(day: DispatchDay, outlet_id: str) -> s.TimeRange:
    o = day.ref.outlets[outlet_id]
    return s.TimeRange(start=f"{o.effective_open:%H:%M}", end=f"{o.effective_close:%H:%M}")


def _access_tags(day: DispatchDay, outlet_id: str) -> list[str]:
    o = day.outlets[outlet_id]
    tags = [DOCK_LABEL[o.dock_type]]
    if o.van_only:
        tags.append("Van only")
    ref = day.ref.outlets.get(outlet_id)
    if ref is not None and ref.mall_dock and ref.mall_open is not None and ref.mall_close is not None:
        # The mall's own access hours: a delivery outside them is refused at the bay (R-MALL).
        tags.append(f"Mall {ref.mall_open:%H:%M}–{ref.mall_close:%H:%M}")
    return tags


def _store_told(d: DeferralRow) -> s.StoreNotice:
    if d.notice_seen_at is not None:
        return s.StoreNotice(state="seen", at=hm(d.notice_seen_at))
    if d.notice_sent_at is not None:
        return s.StoreNotice(state="sent", at=hm(d.notice_sent_at), note="not yet seen")
    return s.StoreNotice(state="not sent")


def _impact_line(d: DeferralRow) -> str:
    days = int(d.impact.get("days_since_served", 1) or 1)
    base = "Deferred yesterday" if d.impact.get("deferred_yesterday") else f"{days} day{'s' if days != 1 else ''} since served"
    consequence = str(d.impact.get("consequence", "") or "")
    return f"{base} · {consequence}" if consequence else base


def _frees_line(d: DeferralRow) -> str:
    if _is_capacity(d):
        return "(no legal vehicle)"
    return f"{_kg(float(d.frees.get('kg', 0) or 0))} kg / {float(d.frees.get('m3', 0) or 0):.1f} m³"


def _decided_line(d: DeferralRow, version: int) -> str:
    return f"Decided by {d.decided_by or 'System draft'} · plan v{version}"


def _deferral_card(day: DispatchDay, d: DeferralRow) -> s.DeferralCard:
    order = day.orders[d.order_id]
    outlet = day.outlets[order.outlet_id]
    version = day.chosen.number if day.chosen else 0
    head = "Other · store request" if _is_request(d) else REASON_HEADLINE[d.binding]
    binding = "none: store asked" if _is_request(d) else BINDING_LABEL[d.binding]
    label = day_label(d.next_run_date) if d.next_run_date else ""
    title = (
        f"{outlet.id}: {order.temp.value} order, {order.units} units" if _is_capacity(d) else f"{outlet.id}: {order.temp.value} order"
    )
    kind_text = (
        "Capacity: no legal vehicle exists" if _is_capacity(d) else "Store request" if _is_request(d) else "Policy: a legal vehicle exists"
    )
    return s.DeferralCard(
        order_id=d.order_id,
        outlet_id=outlet.id,
        outlet_name=outlet.name,
        brand=outlet.brand,
        temp=order.temp,
        access=_access_tags(day, outlet.id),
        kind=d.type,
        line=f"{head} · {d.reason_text}",
        title=title,
        reason=s.DeferralReason(headline=head, detail=d.reason_text),
        decided_by=d.decided_by or "System draft",
        store_told=_store_told(d),
        impact=_impact_line(d),
        frees=_frees_line(d),
        next_run=label,
        binding=binding,
        new_in_version=version if version > 1 and d.order_id not in day.earlier_deferred else None,
        detail=s.DeferralDetail(
            type=kind_text,
            binding_text=f"Binding: {binding}",
            freed=_frees_line(d),
            next_run=label,
            decided_line=_decided_line(d, version),
            why_not_others=[],
            window=_effective_window(day, outlet.id),
            kg=order.weight_kg,
            m3=order.volume_m3,
            dock=DOCK_LABEL[outlet.dock_type],
        ),
    )


def deferrals_view(day: DispatchDay, depot: s.DepotId) -> s.DeferralsView:
    rows = _sorted_deferrals(deferrals_at(day, depot))
    cap = [d for d in rows if _is_capacity(d)]
    pol = sorted((d for d in rows if _is_policy(d)), key=lambda d: (-int(d.impact.get("days_since_served", 1) or 1), d.order_id))
    req = [d for d in rows if _is_request(d)]
    total = len(rows)
    forced = len(cap) + len(pol)
    sent = sum(1 for d in rows if d.notice_sent_at is not None)
    seen = sum(1 for d in rows if d.notice_seen_at is not None)
    next_run = next((d.next_run_date for d in rows if d.next_run_date), None)
    label = day_label(next_run) if next_run else "the next run"
    placed = {o for t in trips_at(day, depot) for o in t.order_ids}
    orders_here = _plannable_at(day, depot)

    all_told = total > 0 and sent == total
    plan_row = day.chosen
    if depot == "kandy" or (forced == 0 and req):
        banner = s.Banner(
            tone="info",
            title=f"{forced} deferrals forced by capacity at {_depot_title(depot)}. {len(req)} at store request.",
            text=(
                f"{_depot_title(depot)} has enough capacity today, these wait only because the store asked."
                if req
                else f"{_depot_title(depot)} has enough capacity today."
            ),
        )
    elif all_told:
        first = max((d.notice_sent_at for d in rows if d.notice_sent_at), default=None)
        banner = s.Banner(
            tone="success",
            title=f"{sent} notices sent at {hm(first) if first else ''} · {seen} seen so far.",
            text="Stores that haven't opened Waypoint will see the notice next time they do.",
        )
    elif forced == 0:
        banner = s.Banner(tone="info", title=f"No deferrals at {_depot_title(depot)}.", text="Every order has a place on a trip.")
    else:
        banner = s.Banner(
            tone="warning",
            title=headline(depot, len(cap), len(pol)).split(". ")[0] + ".",
            text=f"{len(cap)} {'has' if len(cap) == 1 else 'have'} no legal vehicle; policy chose the other {len(pol)}. Each one below says why.",
        )

    if sent == 0:
        note = "Notices go out when you release, or now with Notify stores."
    else:
        note = f"{seen} seen · {total - seen} not yet seen, they'll see it on next open."

    protected = [
        s.ProtectedOutlet(outlet_id=day.orders[o].outlet_id, order_id=o, text="Deferred yesterday: protected by the continuity guard")
        for o in sorted(placed)
        if day.orders[o].deferred_yesterday
    ]
    return s.DeferralsView(
        depot=depot,
        plan=s.DeferralsPlanRef(
            number=plan_row.number if plan_row else 0,
            state=plan_row.state if plan_row else PlanState.DRAFT,
            at=(when(plan_row.released_at) if plan_row and plan_row.released_at else "draft"),
        ),
        headline=f"{total} orders wait for {label}",
        counts=s.DeferralCounts(total=total, capacity=len(cap), policy=len(pol), store_request=len(req)),
        banner=banner,
        capacity=[_deferral_card(day, d) for d in cap],
        policy=[_deferral_card(day, d) for d in pol[:POLICY_CARDS_SHOWN]],
        orders=len(orders_here),
        served=len([o for o in orders_here if o in placed]),
        policy_more=max(0, len(pol) - POLICY_CARDS_SHOWN),
        store_request=[_deferral_card(day, d) for d in req],
        protected=protected,
        notices=s.NoticeCounts(sent=sent, total=total, seen=seen, note=note),
        side=None,
        can_release=bool(day.latest and day.latest.state is PlanState.DRAFT),
    )


# ---- D2 capacity ------------------------------------------------------------


def _usable_vehicles(day: DispatchDay, depot: str) -> list[str]:
    """Vehicles available for the whole morning: not held, not in the workshop at the draft."""
    out: list[str] = []
    for v in sorted(day.ref.vehicles.values(), key=lambda v: v.id):
        if v.depot != depot:
            continue
        vday = day.vehicle_days.get(v.id)
        if vday is not None and (vday.held or vday.available_from is not None):
            continue
        out.append(v.id)
    return out


def _percent_note(percents: list[float]) -> str:
    top = max(percents, default=0.0)
    for cap in (50, 60, 70, 80, 90, 100):
        if top < cap:
            return f"All other vehicles under {cap}%"
    return "Every other vehicle is at its limit"


def capacity_view(day: DispatchDay, depot: s.DepotId) -> s.CapacityView:
    other: s.DepotId = "kandy" if depot == "peliyagoda" else "peliyagoda"
    trips = trips_at(day, depot)
    defers = deferrals_at(day, depot)
    forced = [d for d in defers if not _is_request(d)]
    cap_n = sum(1 for d in forced if _is_capacity(d))
    pol_n = sum(1 for d in forced if _is_policy(d))
    latest = day.latest

    plan_ref = None
    if latest is not None:
        plan_ref = s.PlanSummaryRef(
            number=latest.number,
            state=latest.state,
            at=when(latest.released_at if latest.released_at and latest.state is PlanState.RELEASED else latest.created_at),
            released_at=hm(latest.released_at) if latest.released_at else None,
        )

    vehicles_here = sorted((v for v in day.ref.vehicles.values() if v.depot == depot), key=lambda v: v.id)
    in_workshop_now = [
        v for v in vehicles_here
        if (a := day.availability.get(v.id)) is not None and a.available_from is not None and a.available_from > day.now
    ]
    held = [v for v in vehicles_here if (vd := day.vehicle_days.get(v.id)) is not None and vd.held]
    reefers = [v for v in vehicles_here if v.temp is VehicleTemp.REEFER]
    reefers_ready = [v for v in reefers if v not in in_workshop_now and v not in held]
    used_vehicles = {t.vehicle_id for t in trips}

    spare = next(
        (
            v for v in vehicles_here
            if (a := day.availability.get(v.id)) is not None
            and a.available_from is not None
            and a.available_from <= day.now
            and v.id not in used_vehicles
            and a.replaced_by is None
        ),
        None,
    )
    if in_workshop_now and reefers:
        back = next((v for v in in_workshop_now if v.temp is VehicleTemp.REEFER), None)
        reefer_note = (
            f"{back.id} in workshop until {hm(day.availability[back.id].available_from)}"  # type: ignore[arg-type]
            if back is not None
            else f"{_depot_title(depot)} reefer trucks and vans"
        )
    elif spare is not None and spare.temp is VehicleTemp.REEFER:
        reefer_note = f"{spare.id} is spare"
    else:
        reefer_note = f"{_depot_title(depot)} reefer trucks and vans"

    usable = _usable_vehicles(day, depot)
    usable_reefers = [v for v in usable if day.ref.vehicles[v].temp is VehicleTemp.REEFER]
    pools = (
        minutes_pools(
            [TripMinutes(t.brand, day.ref.vehicles[t.vehicle_id].temp is VehicleTemp.REEFER, trip_minutes(_rules_trip(t), day.orders, day.ref)) for t in trips],
            [
                DeferredMinutes(
                    day.outlets[day.orders[d.order_id].outlet_id].brand, day.orders[d.order_id].temp.needs_reefer, float(d.frees.get("minutes", 0) or 0)
                )
                for d in forced
            ],
            len(usable),
            len(usable_reefers),
        )
        if latest is not None
        else []
    )
    worst = scarcest_pool(pools)
    binding = (
        s.CapacityBinding(
            resource=worst.label, demand=worst.demand, supply=worst.supply, available=worst.available, per_vehicle=worst.per_vehicle,
            percent=worst.percent, over_by=worst.over_by,
        )
        if worst is not None and worst.demand > worst.supply
        else None
    )

    # Busiest budget and closest fuel quota, across the vehicles that run.
    stats: list[tuple[str, float, float, str, float, float, float]] = []
    for vid in sorted(used_vehicles):
        veh = day.ref.vehicles[vid]
        tot = vehicle_day_totals(veh, [_rules_trip(t) for t in trips if t.vehicle_id == vid], day.orders, day.ref, day.vehicle_days.get(vid))
        if tot.fresh_min >= tot.style_tech_min:
            stats.append((vid, tot.fresh_min, FRESH_BUDGET_MIN, "Fresh minutes", tot.fuel_week_l, veh.weekly_fuel_quota_l, tot.fresh_min / FRESH_BUDGET_MIN))
        else:
            stats.append((vid, tot.style_tech_min, STYLE_TECH_BUDGET_MIN, "Style + Tech minutes", tot.fuel_week_l, veh.weekly_fuel_quota_l, tot.style_tech_min / STYLE_TECH_BUDGET_MIN))
    if stats:
        top = max(stats, key=lambda x: (x[6], x[0]))
        busiest = s.VehicleCard(
            label=top[3], vehicle_id=top[0], used=top[1], limit=top[2], unit="min",
            note=_percent_note([100 * x[6] for x in stats if x[0] != top[0]]) if len(stats) > 1 else "Only vehicle on a trip",
        )
        near = max(stats, key=lambda x: (x[4] / x[5], x[0]))
        closest = s.ClosestCard(
            label="Fuel quota", vehicle_id=near[0], used=round(near[4], 1), limit=near[5], unit="L",
            note="Weekly quota resets Mon", caption="This week incl. tonight",
        )
    else:
        first = vehicles_here[0].id if vehicles_here else ""
        quota = vehicles_here[0].weekly_fuel_quota_l if vehicles_here else 0.0
        busiest = s.VehicleCard(label="Fresh minutes", vehicle_id=first, used=0, limit=FRESH_BUDGET_MIN, unit="min", note="No trips planned yet")
        closest = s.ClosestCard(label="Fuel quota", vehicle_id=first, used=0, limit=quota, unit="L", note="Weekly quota resets Mon", caption="This week incl. tonight")

    other_defers = [d for d in deferrals_at(day, other) if not _is_request(d)]
    view = s.CapacityView(
        depot=depot,
        service_date=day.service_date,
        orders=len(_orders_at(day, depot)),
        plan=plan_ref,
        deferrals=s.DeferralTotals(total=cap_n + pol_n, capacity=cap_n, policy=pol_n),
        binding=binding,
        reefers=s.ReeferCounts(available=len(reefers_ready), total=len(reefers), note=reefer_note),
        vehicles=s.VehicleCounts(available=len(vehicles_here) - len(in_workshop_now) - len(held), total=len(vehicles_here), in_workshop=len(in_workshop_now)),
        busiest=busiest,
        closest=closest,
        pool=s.PoolInfo(depot=other, orders=len(_orders_at(day, other)), deferred=len(other_defers), enough=len(other_defers) == 0),
    )
    if spare is not None:
        view.spare = s.SpareVehicle(
            vehicle_id=spare.id, label=vehicle_kind(day, spare.id), kg=spare.weight_cap_kg, m3=spare.volume_cap_m3,
            since=hm(day.availability[spare.id].available_from),  # type: ignore[arg-type]
        )
    if latest is not None and latest.state is PlanState.RELEASED:
        placed = {o for t in day.trips for o in t.order_ids}
        view.released = s.ReleasedTotals(
            orders=len(day.plannable), served=len(placed), deferred=len(day.deferrals),
            at=hm(latest.released_at) if latest.released_at else "",
        )
    if binding is None:
        classes = [
            ("Reefer trucks", VehicleTemp.REEFER, VehicleType.TRUCK, True, "reefer-truck"),
            ("Dry-box trucks", VehicleTemp.AMBIENT, VehicleType.TRUCK, False, "dry-truck"),
            ("Reefer vans", VehicleTemp.REEFER, VehicleType.VAN, True, "reefer-van"),
            ("Ambient vans", VehicleTemp.AMBIENT, VehicleType.VAN, False, "ambient-van"),
        ]
        view.fleet = s.Fleet(
            total=len(vehicles_here),
            classes=[
                s.FleetClass(label=label, count=sum(1 for v in vehicles_here if v.temp is temp and v.type is kind), chilled=chilled, kind=key)  # type: ignore[arg-type]
                for label, temp, kind, chilled, key in classes
            ],
        )
        if stats:
            heaviest = max(stats, key=lambda x: (x[1], x[0]))
            vid = heaviest[0]
            run = len([t for t in trips if t.vehicle_id == vid])
            vtrips = [t for t in trips if t.vehicle_id == vid]
            kg = sum(trip_load(_rules_trip(t), day.orders)[0] for t in vtrips)
            m3 = sum(trip_load(_rules_trip(t), day.orders)[1] for t in vtrips)
            veh = day.ref.vehicles[vid]
            meters = _meters(day, vid, vtrips)
            view.lane = s.CapacityLane(
                vehicle_id=vid,
                title=f"{vid} · {vehicle_kind(day, vid)} · Run 1" if run == 1 else f"{vid} · {vehicle_kind(day, vid)} · {run} runs",
                summary=f"{vid} · " + " · ".join(
                    f"{m.label} {m.used:g} / {m.limit:g} {m.unit}".replace("Fuel ", "fuel ") for m in meters
                ),
                meters=[
                    s.LabelledMeter(label="Weight", used=kg, limit=veh.weight_cap_kg, unit="kg"),
                    s.LabelledMeter(label="Volume", used=round(m3, 1), limit=veh.volume_cap_m3, unit="m³"),
                    *[
                        s.LabelledMeter(label=("Fresh minutes" if m.label == "Fresh" else m.label), used=m.used, limit=m.limit, unit=m.unit)
                        for m in meters
                    ],
                ],
            )
        if usable_reefers:
            fresh_supply = len(usable_reefers) * FRESH_BUDGET_MIN
            fresh_used = sum(trip_minutes(_rules_trip(t), day.orders, day.ref) for t in trips if t.brand is Brand.FRESH)
            view.fresh_use = round(min(1.0, fresh_used / fresh_supply), 2) if fresh_supply else 0.0
    return view


# ---- D5 acknowledgements ----------------------------------------------------


def _ack_for(acks: list[AckRow], *, depot: str | None = None, vehicle: str | None = None) -> AckRow | None:
    for a in acks:
        if depot is not None and a.actor_kind is ActorKind.PIN_PERSON and a.dock == depot:
            return a
        if vehicle is not None and a.actor_kind is ActorKind.DRIVER and a.vehicle_id == vehicle:
            return a
    return None


def _same_trips(a: list[TripRow], b: list[TripRow], vehicles: set[str]) -> bool:
    def key(trips: list[TripRow]) -> list[tuple[str, int, str, tuple[str, ...]]]:
        return sorted((t.vehicle_id, t.trip_no, hm(t.depart_at), t.order_ids) for t in trips if t.vehicle_id in vehicles)

    return key(a) == key(b)


def acknowledgements_view(day: DispatchDay) -> s.AcknowledgementsView:
    version = day.chosen.number if day.chosen else 0
    rows: list[s.AcknowledgementRow] = []
    depots = [d for d in DEPOTS if trips_at(day, d)]
    prev = day.previous
    for depot in depots:
        vehicles = {t.vehicle_id for t in trips_at(day, depot)}
        mine = _ack_for(day.acks, depot=depot)
        before = _ack_for(day.previous_acks, depot=depot) if prev else None
        unchanged = prev is not None and _same_trips(day.trips, day.previous_trips, vehicles)
        rows.append(_ack_row(day.loaders.get(depot, "Dock"), "Loader", f"{_depot_title(depot)} dock", version, mine, before, prev, unchanged, "n/a"))
    for vid in sorted({t.vehicle_id for t in day.trips}):
        mine = _ack_for(day.acks, vehicle=vid)
        before = _ack_for(day.previous_acks, vehicle=vid) if prev else None
        unchanged = prev is not None and _same_trips(day.trips, day.previous_trips, {vid})
        first = min((t for t in day.trips if t.vehicle_id == vid), key=lambda t: t.trip_no)
        departs = f"Departed {hm(first.depart_at)}" if first.depart_at <= day.now else until_label(day.now, first.depart_at)
        rows.append(_ack_row(day.drivers.get(vid, vid), "Driver", vid, version, mine, before, prev, unchanged, departs))

    done = sum(1 for r in rows if r.state in ("acknowledged", "no change"))
    banner = _ack_banner(day, rows, version)
    return s.AcknowledgementsView(version=version, acknowledged=done, total=len(rows), rows=rows, banner=banner)


def _ack_row(
    person: str, role: str, place: str, version: int, mine: AckRow | None, before: AckRow | None,
    prev: VersionRow | None, unchanged: bool, departs: str,
) -> s.AcknowledgementRow:
    if mine is not None:
        return s.AcknowledgementRow(person=person, role=role, place=place, has=version, state="acknowledged", at=hm(mine.acknowledged_at), departs_in=departs)  # type: ignore[arg-type]
    if prev is not None and unchanged and before is not None:
        return s.AcknowledgementRow(
            person=person, role=role, place=place, has=prev.number, state="no change", at=hm(before.acknowledged_at),  # type: ignore[arg-type]
            note=f"no change in v{version}", departs_in=departs,
        )
    return s.AcknowledgementRow(person=person, role=role, place=place, has=version, state="pending", departs_in=departs)  # type: ignore[arg-type]


def _ack_banner(day: DispatchDay, rows: list[s.AcknowledgementRow], version: int) -> s.AcknowledgementsBanner | None:
    if not rows:
        return None
    pending_docks = [r for r in rows if r.role == "Loader" and r.state == "pending"]
    if pending_docks:
        dock = pending_docks[0]
        depot = dock.place.removesuffix(" dock")
        soonest = min(
            (t for t in day.trips if day.ref.vehicles[t.vehicle_id].depot.lower() == depot.lower()),
            key=lambda t: t.depart_at,
            default=None,
        )
        return s.AcknowledgementsBanner(
            tone="warning",
            title=f"{dock.place.replace(' dock', '')} dock hasn't acknowledged v{version}, the load gate stays blocked for its vehicles.",
            text=(f"{soonest.vehicle_id} departs {hm(soonest.depart_at)}. " if soonest else "") + f"{dock.person} sees v{version} on the dock tablet now.",
            action="call-kandy" if depot.lower() == "kandy" else None,
        )
    if all(r.state in ("acknowledged", "no change") for r in rows):
        return s.AcknowledgementsBanner(
            tone="success",
            title=f"Everyone has plan v{version}.",
            text="Both docks and every driver acknowledged. Load gates are open.",
        )
    return None
