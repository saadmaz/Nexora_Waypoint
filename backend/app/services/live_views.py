"""The exception-first live board (D6) and the inbox, built from plain data (PRD v3 §3 D6, §4a lateness risk).

Pure. Nothing here invents movement: a vehicle is Departed when its run says so, delivered when its orders are, and
offline when the rules say it has been silent too long. The wording follows ``frontend/src/screens/dispatcher/mock/live.ts``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from waypoint_rules import RemainingStop, Trip, is_offline, lateness_risk, planned_clock
from waypoint_rules.vocab import DeferralType, LatenessRisk, OrderStatus, VehicleTemp, VehicleType

from ..models.enums import ConflictStatus, ExceptionStatus, PlanState
from ..schemas import dispatcher as s
from .dispatch_model import TripRow
from .dispatcher_views import day_label, hm
from .exception_logic import ExceptionRow
from .live_model import ConflictRow, LiveDay, RunRow

#: Rows shown without "Show all": those needing attention first, up to this many in all.
DEFAULT_ROWS = 4

_DONE = (OrderStatus.DELIVERED, OrderStatus.PARTIAL, OrderStatus.ISSUE, OrderStatus.CONFLICT, OrderStatus.DEFERRED)
_OPEN_STOP = (OrderStatus.PLANNED, OrderStatus.LOADED, OrderStatus.DEPARTED, OrderStatus.CONFIRMED, OrderStatus.ORDERED)
_RISK_LABEL = {
    LatenessRisk.ON_TIME: "On time",
    LatenessRisk.AT_RISK: "At risk",
    LatenessRisk.UNKNOWN_OFFLINE: "Unknown · offline",
}


def _ago(now: datetime, then: datetime) -> str:
    total = round((now - then).total_seconds() / 60)
    if total <= 0:
        return "now"
    return f"{total // 60} h {total % 60} min" if total >= 60 else f"{total} min"


def _rules_trip(t: TripRow) -> Trip:
    return Trip(t.vehicle_id, t.trip_no, t.depart_at, list(t.order_ids))


@dataclass(slots=True)
class _Facts:
    """What the board works out once per vehicle."""

    vehicle_id: str
    #: The trips the phone holds (the plan version it has), which can be older than the latest.
    basis: list[TripRow]
    latest: list[TripRow]
    trip: TripRow
    run: RunRow | None
    plan_on_device: int
    change_pending: bool
    departed: bool
    offline: bool
    held: bool
    all_done: bool
    pending_stop: str | None


def _statuses(live: LiveDay, ids: tuple[str, ...] | list[str]) -> list[OrderStatus]:
    return [live.status.get(o, OrderStatus.PLANNED) for o in ids]


def _stop_orders(live: LiveDay, trip: TripRow) -> list[tuple[str, list[str]]]:
    """The trip's stops as (outlet, orders), consecutive orders for one outlet sharing a stop."""
    stops: list[tuple[str, list[str]]] = []
    for oid in trip.order_ids:
        outlet = live.day.orders[oid].outlet_id
        if stops and stops[-1][0] == outlet:
            stops[-1][1].append(oid)
        else:
            stops.append((outlet, [oid]))
    return stops


def _stop_done(live: LiveDay, ids: list[str]) -> bool:
    return all(st in _DONE for st in _statuses(live, ids))


def _trip_departed(live: LiveDay, trip: TripRow) -> bool:
    run = live.runs.get((trip.vehicle_id, trip.trip_no))
    if run is not None and run.departed_at is not None:
        return True
    return any(st in (OrderStatus.DEPARTED, OrderStatus.DELIVERED, OrderStatus.PARTIAL, OrderStatus.ISSUE, OrderStatus.CONFLICT) for st in _statuses(live, trip.order_ids))


#: Orders the driver has already acted on. A later plan version may drop them from the trip, but the board still shows the stop.
_SERVED = (OrderStatus.DELIVERED, OrderStatus.PARTIAL, OrderStatus.ISSUE, OrderStatus.CONFLICT)


def _with_served_history(live: LiveDay, vehicle_id: str, trip: TripRow) -> TripRow:
    """``trip`` plus the stops an earlier version had that the driver has since delivered or put in conflict, in route order."""
    sequence: list[str] = []
    for number in sorted(live.trips_by_version):
        for t in live.trips_by_version[number]:
            if t.vehicle_id == vehicle_id and t.trip_no == trip.trip_no:
                sequence.extend(o for o in t.order_ids if o not in sequence)
    keep = [o for o in sequence if o in trip.order_ids or live.status.get(o) in _SERVED]
    extra = [o for o in trip.order_ids if o not in keep]
    return TripRow(trip.vehicle_id, trip.trip_no, trip.brand, trip.district, trip.depart_at, tuple(keep + extra))


def _facts(live: LiveDay, vehicle_id: str) -> _Facts | None:
    day = live.day
    latest = sorted((t for t in day.trips if t.vehicle_id == vehicle_id), key=lambda t: t.trip_no)
    if not latest:
        return None
    # The trip in hand: the first one with a stop still to do, else the last.
    def pick(trips: list[TripRow]) -> TripRow:
        for t in trips:
            if not all(_stop_done(live, ids) for _, ids in _stop_orders(live, t)):
                return t
        return trips[-1]

    current = pick(latest)
    run = live.runs.get((vehicle_id, current.trip_no))
    newest = day.latest.number if day.latest else 0
    plan_on_device = (run.plan_version_seen if run and run.plan_version_seen else None) or live.acknowledged.get(vehicle_id) or live.released_number or newest
    basis_all = live.trips_by_version.get(plan_on_device)
    basis = sorted((t for t in (basis_all or []) if t.vehicle_id == vehicle_id), key=lambda t: t.trip_no) or latest
    change_pending = plan_on_device < (live.released_number or newest) and [(t.trip_no, t.order_ids) for t in basis] != [(t.trip_no, t.order_ids) for t in latest]
    held = any(e.vehicle_id == vehicle_id and e.status is ExceptionStatus.OPEN for e in live.exceptions)
    trip = _with_served_history(live, vehicle_id, next((t for t in basis if t.trip_no == current.trip_no), current))
    departed = _trip_departed(live, current)
    stops = _stop_orders(live, trip)
    pending = next((outlet for outlet, ids in stops if not _stop_done(live, ids)), None)
    heard = run.last_heard_at if run else None
    in_progress = departed and (run is None or run.finished_at is None) and pending is not None
    offline = is_offline(heard, day.now, in_progress=in_progress)
    return _Facts(vehicle_id, basis, latest, trip, run, plan_on_device, change_pending, departed, offline, held, pending is None, pending)


# ---- one row ----------------------------------------------------------------


def _stop_status(live: LiveDay, ids: list[str], f: _Facts) -> str:
    st = _statuses(live, ids)
    if OrderStatus.CONFLICT in st:
        return "Conflict"
    if OrderStatus.DEFERRED in st:
        return "Change pending" if f.change_pending else "Deferred"
    if all(x in (OrderStatus.DELIVERED, OrderStatus.PARTIAL, OrderStatus.ISSUE) for x in st):
        return "Delivered"
    if any(x is OrderStatus.DEPARTED for x in st):
        return "Departed"
    if any(x is OrderStatus.LOADED for x in st):
        return "Loaded"
    return "Departed" if f.departed else "Planned"


def _resolved_tooltip(live: LiveDay, ids: list[str]) -> str | None:
    for c in live.conflicts:
        if c.status is ConflictStatus.RESOLVED and set(ids) & set(c.order_ids) and c.resolved_at is not None:
            kept = {"keep_delivery": "kept delivery", "keep_partial": "kept as Partial", "keep_deferral": "kept the deferral"}.get(c.resolution or "", "decided")
            return f"Resolved by {c.resolved_by or 'Kumari'} {hm(c.resolved_at)}, {kept}. Both records kept in the audit."
    return None


def _live_stops(live: LiveDay, f: _Facts) -> list[s.LiveStop]:
    day = live.day
    clock = planned_clock(_rules_trip(f.trip), day.orders, day.ref)
    arrival = {st.outlet_id: st for st in clock.stops}
    latest_deferred = {d.order_id: d for d in day.deferrals}
    out: list[s.LiveStop] = []
    for outlet_id, ids in _stop_orders(live, f.trip):
        outlet = day.outlets[outlet_id]
        ref_outlet = day.ref.outlets[outlet_id]
        timing = arrival.get(outlet_id)
        window = s.TimeRange(start=f"{ref_outlet.window_open:%H:%M}", end=f"{ref_outlet.window_close:%H:%M}")
        status = _stop_status(live, ids, f)
        note: str | None = None
        change: str | None = None
        if status == "Delivered":
            done_at = max((live.outcome_at[o] for o in ids if o in live.outcome_at), default=None)
            receipt = max((live.receipt_at[o] for o in ids if o in live.receipt_at), default=None)
            if receipt is not None:
                note = f"Receipt confirmed {hm(receipt)}"
            elif OrderStatus.PARTIAL in _statuses(live, ids):
                note = "Partial · follow-up created"
            elif done_at is not None:
                note = f"Delivered {hm(done_at)}"
        if status == "Change pending":
            d = next((latest_deferred[o] for o in ids if o in latest_deferred), None)
            if d is not None:
                change = f"Deferred · {d.type.value.replace('_', ' ')}" + (f" → {d.next_run_date:%a}" if d.next_run_date else "")
        out.append(
            s.LiveStop(
                outlet_id=outlet_id,
                outlet_name=outlet.name,
                brand=outlet.brand,
                orders=[s.LiveOrder(id=o, temp=day.orders[o].temp, units=day.orders[o].units) for o in ids],
                eta=f"ETA {hm(timing.arrival)} · window {window.start}-{window.end}" if timing else f"window {window.start}-{window.end}",
                window=window,
                status=status,  # type: ignore[arg-type]
                status_note=note,
                change=change,
                tooltip=_resolved_tooltip(live, ids),
                can_defer=all(st in (OrderStatus.PLANNED, OrderStatus.LOADED, OrderStatus.DEPARTED) for st in _statuses(live, ids)),
            )
        )
    return out


def _next_stop(live: LiveDay, f: _Facts) -> str:
    day = live.day
    clock = planned_clock(_rules_trip(f.trip), day.orders, day.ref)
    if not f.departed:
        return f"Loading · departs {hm(f.trip.depart_at)}"
    if f.pending_stop is None:
        return "Returning to the depot"
    timing = next((st for st in clock.stops if st.outlet_id == f.pending_stop), None)
    arrived = live.arrivals.get((f.vehicle_id, f.pending_stop))
    ref_outlet = day.ref.outlets[f.pending_stop]
    if arrived is not None and timing is not None and day.now < timing.handling_start:
        return f"At {f.pending_stop} · waiting for {ref_outlet.window_open:%H:%M}"
    return f"{f.pending_stop} · ETA {hm(timing.arrival)}" if timing else f.pending_stop


def _risk(live: LiveDay, f: _Facts) -> str:
    day = live.day
    clock = planned_clock(_rules_trip(f.trip), day.orders, day.ref)
    remaining = [
        RemainingStop(st.outlet_id, st.arrival, st.window_close)
        for st in clock.stops
        if not _stop_done(live, [o for o in st.order_ids])
    ]
    return _RISK_LABEL[lateness_risk(remaining, offline=f.offline, held=f.held)]


def _row(live: LiveDay, f: _Facts) -> s.LiveRow:
    day = live.day
    done = sum(1 for _, ids in _stop_orders(live, f.trip) if _stop_done(live, ids))
    total = len(_stop_orders(live, f.trip))
    loaded = any(st is OrderStatus.LOADED for st in _statuses(live, f.trip.order_ids))
    status = "Delivered" if f.all_done and f.departed else "Departed" if f.departed else "Loading" if loaded else "Planned"
    heard = f.run.last_heard_at if f.run else None
    last_heard = s.LastHeard()
    if heard is not None:
        age = _ago(day.now, heard)
        last_heard = s.LastHeard(
            time=hm(heard),
            age=f"{age} · known gap" if f.offline else age,
            note=f.run.sync_note if f.run else None,
            synced=True if f.run and f.run.sync_note else None,
        )
    elif f.held:
        exc = next(e for e in live.exceptions if e.vehicle_id == f.vehicle_id and e.status is ExceptionStatus.OPEN)
        last_heard = s.LastHeard(time=hm(exc.raised_at), note=exc.raised_by)
    attention = f.offline or f.change_pending or f.held or any(st is OrderStatus.CONFLICT for st in _statuses(live, f.trip.order_ids))
    return s.LiveRow(
        vehicle_id=f.vehicle_id,
        trip=f.trip.trip_no,
        driver=day.drivers.get(f.vehicle_id, ""),
        plan_on_device=f.plan_on_device,
        change_pending=f.change_pending,
        next_stop=_next_stop(live, f),
        risk=_risk(live, f),  # type: ignore[arg-type]
        stops=s.StopProgress(done=done, total=total),
        last_heard=last_heard,
        status=status,  # type: ignore[arg-type]
        held=f.held,
        stops_detail=_live_stops(live, f) if (f.departed or attention) else [],
        expanded=attention,
        offline_note="The phone keeps recording offline. Records arrive when it's back in coverage." if f.offline else None,
    )


def _attention(row: s.LiveRow) -> tuple[int, str]:
    conflict = any(st.status == "Conflict" for st in row.stops_detail)
    rank = (
        0 if conflict else 1 if row.held else 2 if row.risk == "Unknown · offline" else 3 if row.risk == "At risk" else 4 if row.change_pending
        else 5 if row.status == "Departed" else 6 if row.status in ("Loading", "Planned") else 7
    )
    return rank, row.vehicle_id


# ---- decisions --------------------------------------------------------------


def _conflict_text(live: LiveDay, c: ConflictRow) -> str:
    day = live.day
    dev, srv = c.device_snapshot, c.server_snapshot
    outcome = str(dev.get("outcome", "delivered")).capitalize()
    when = _iso_hm(dev.get("deviceTime"))
    who = dev.get("receivedBy")
    proof = ", photo" if dev.get("photo") else ""
    version = srv.get("planVersion") or (day.latest.number if day.latest else "")
    kind = str(srv.get("type", "store_request")).replace("_", " ")
    decided = _iso_hm(srv.get("decidedAt"))
    return f"Driver recorded {outcome} {when} ({who}{proof}). Plan v{version} says Deferred · {kind} {decided}."


def _iso_hm(value: object) -> str:
    if isinstance(value, str):
        try:
            return hm(datetime.fromisoformat(value))
        except ValueError:
            return value
    return ""


def _conflict_decision(live: LiveDay, c: ConflictRow) -> s.Decision:
    day = live.day
    outlet = day.orders[c.order_ids[0]].outlet_id
    depot = day.ref.outlets[outlet].depot
    return s.Decision(
        id=f"c{c.id}",
        kind="conflict",
        title=f"{outlet} · {' + '.join(c.order_ids)}: needs a decision",
        text=_conflict_text(live, c),
        at=_iso_hm(c.device_snapshot.get("syncedAt")) or None,
        chip="Conflict",
        action=s.DecisionAction(label="Resolve", to=f"/dispatcher/conflicts/{c.id}?depot={depot}"),
    )


def _exception_decision(live: LiveDay, e: ExceptionRow) -> s.Decision:
    day = live.day
    trips = [t for t in day.trips if t.vehicle_id == e.vehicle_id]
    first = min((t.depart_at for t in trips), default=None)
    n = sum(len(t.order_ids) for t in trips)
    minutes = max(0, round((first - day.now).total_seconds() / 60)) if first else 0
    return s.Decision(
        id=f"x{e.id}",
        kind="held",
        title=f"{e.vehicle_id} held: vehicle check failed" if e.type == "Vehicle check failed" else f"{e.vehicle_id} held: {e.type.lower()}",
        text=f"{e.detail or e.type} · flagged by {e.raised_by or 'the loader'} {hm(e.raised_at)} · {n} orders on {len(trips)} {'trip' if len(trips) == 1 else 'trips'}"
        + (f" · departs {hm(first)}" if first else ""),
        countdown=f"{minutes} min to departure" if first else None,
        action=s.DecisionAction(label="Review", to=f"/dispatcher/exceptions/{e.id}"),
    )


def decision_entries(live: LiveDay) -> list[tuple[str, s.Decision]]:
    """What needs the dispatcher, each with the depot it belongs to: conflicts first, then held vehicles, then the information that explains them."""
    day = live.day
    out: list[tuple[str, s.Decision]] = []
    open_conflicts = [c for c in live.conflicts if c.status is not ConflictStatus.RESOLVED]
    for c in open_conflicts:
        out.append((day.ref.outlets[day.orders[c.order_ids[0]].outlet_id].depot, _conflict_decision(live, c)))
    open_exc = [e for e in live.exceptions if e.status is ExceptionStatus.OPEN and e.vehicle_id and any(t.vehicle_id == e.vehicle_id for t in day.trips)]
    for e in open_exc:
        out.append((day.ref.vehicles[str(e.vehicle_id)].depot, _exception_decision(live, e)))

    if open_exc:
        used = {t.vehicle_id for t in day.trips}
        for vid in sorted(day.ref.vehicles):
            a = day.availability.get(vid)
            if a is not None and a.available_from is not None and a.available_from <= day.now and vid not in used and a.replaced_by is None:
                v = day.ref.vehicles[vid]
                kind = ("Reefer " if v.temp is VehicleTemp.REEFER else "Ambient ") + ("van" if v.type is VehicleType.VAN else "truck")
                out.append(
                    (
                        v.depot,
                        s.Decision(
                            id="spare", kind="info", title=f"{vid} available since {hm(a.available_from)}",
                            text=f"{kind} · {v.weight_cap_kg:,.0f} kg · {v.volume_cap_m3:.1f} m³ · back from the workshop", info_only=True,
                        ),
                    )
                )

    for vid in sorted({t.vehicle_id for t in day.trips}):
        f = _facts(live, vid)
        if f is None or not (f.change_pending and f.offline):
            continue
        deferred = [d for d in day.deferrals if any(d.order_id in t.order_ids for t in f.basis if t.vehicle_id == vid)]
        if not deferred:
            continue
        since = day.latest.released_at if day.latest and day.latest.released_at else day.now
        outlets = sorted({day.orders[d.order_id].outlet_id for d in deferred})
        why = f"at {outlets[0]}'s request" if all(d.type is DeferralType.STORE_REQUEST for d in deferred) else "by policy"
        number = day.latest.number if day.latest else ""
        out.append(
            (
                day.ref.vehicles[vid].depot,
                s.Decision(
                    id="pending", kind="info",
                    title=f"{vid} hasn't received v{number}, pending since {hm(since)}",
                    text=f"{' + '.join(d.order_id for d in deferred)} deferred {why}. The phone gets v{number} when it's back in coverage.",
                    info_only=True,
                ),
            )
        )
    return out


def decisions(live: LiveDay) -> list[s.Decision]:
    return [d for _, d in decision_entries(live)]


# ---- the board --------------------------------------------------------------


def live_board_view(live: LiveDay, depot: str, *, show_all: bool = False) -> s.LiveBoardView:
    day = live.day
    vehicles = sorted({t.vehicle_id for t in day.trips})
    if depot != "both":
        vehicles = [v for v in vehicles if day.ref.vehicles[v].depot == depot]
    rows = [_row(live, f) for v in vehicles if (f := _facts(live, v)) is not None]
    rows.sort(key=_attention)
    # Rows are sorted needing-attention first, so "the top few" never hides a problem.
    needing = sum(1 for r in rows if _attention(r)[0] <= 4)
    shown = rows if show_all else rows[: max(DEFAULT_ROWS, needing)]

    all_trips = [t for t in day.trips if depot == "both" or day.ref.vehicles[t.vehicle_id].depot == depot]
    departed_trips = [t for t in all_trips if _trip_departed(live, t)]
    loading = [t for t in all_trips if t not in departed_trips and any(st is OrderStatus.LOADED for st in _statuses(live, t.order_ids))]
    delivered = sum(1 for o, st in live.status.items() if st in (OrderStatus.DELIVERED, OrderStatus.PARTIAL) and (depot == "both" or day.depot_of(o) == depot))
    decision_list = [d for dep, d in decision_entries(live) if depot == "both" or dep == depot]
    conflicts_open = sum(1 for d in decision_list if d.kind == "conflict")
    held_open = [d for d in decision_list if d.kind == "held"]
    resolved = [c.resolved_at for c in live.conflicts if c.status is ConflictStatus.RESOLVED and c.resolved_at]
    first_depart = min((t.depart_at for t in all_trips), default=None)
    pending_sync = sorted({r.vehicle_id for r in rows if r.change_pending and r.risk == "Unknown · offline"})

    def by_depot(trips: list[TripRow]) -> str:
        counts = {d: sum(1 for t in trips if day.ref.vehicles[t.vehicle_id].depot == d) for d in ("peliyagoda", "kandy")}
        return f"Peliyagoda {counts['peliyagoda']} · Kandy {counts['kandy']}"

    if conflicts_open:
        issues_foot = "1 conflict needs a decision" if conflicts_open == 1 else f"{conflicts_open} conflicts need a decision"
    elif held_open:
        issues_foot = ", ".join(sorted({d.title.split(" ")[0] for d in held_open})) + " held"
    elif resolved:
        issues_foot = f"Resolved {hm(max(resolved))}"
    else:
        issues_foot = "nothing reported"

    n_dep, n_load = len(departed_trips), len(loading)
    caption = (
        f"{len(shown)} of {n_dep} departed shown · needing attention first" if n_dep
        else f"{len(shown)} of {n_load or len(rows)} loading shown · needing attention first"
    )
    view = s.LiveBoardView(
        as_of=hm(day.now),
        date=day_label(day.service_date),
        plan=f"Plan v{day.latest.number}" if day.latest and day.latest.state is PlanState.RELEASED else None,
        decisions=decision_list,
        stats=s.LiveStats(
            departed=s.StatCard(value=n_dep, foot=f"of {len(all_trips)} trips today" if n_dep else (f"first departures {hm(first_depart)}" if first_depart else "no trips yet")),
            loading=s.StatCard(value=n_load, foot=by_depot(loading)),
            delivered=s.StatCard(value=delivered, foot="orders so far" + (f" · {', '.join(pending_sync)} records pending sync" if pending_sync else "")),
            issues=s.IssuesStat(value=conflicts_open + len(held_open), foot=issues_foot, bad=bool(conflicts_open)),
        ),
        caption=caption,
        rows=shown,
        depot=depot,  # type: ignore[arg-type]
    )
    return view


def inbox_view(live: LiveDay) -> s.InboxView:
    return s.InboxView(items=decisions(live))
