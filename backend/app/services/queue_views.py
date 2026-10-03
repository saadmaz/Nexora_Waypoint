"""The order queue (D1) and the order history drawer (D1.5), built from plain data (PRD v3 §3).

Pure, like ``dispatcher_views``: the rules decide what is flagged ("No legal vehicle", the continuity guard), this
module groups, filters and words it. The wording and shapes follow ``frontend/src/screens/dispatcher/mock/queue.ts``.
"""

from __future__ import annotations

from datetime import timedelta

from waypoint_rules import Order, legal_vehicles
from waypoint_rules.vocab import OrderStatus

from ..schemas import dispatcher as s
from .dispatch_model import OutletRow
from .dispatcher_views import DOCK_LABEL, day_label, hm
from .queue_model import AuditRow, HistoryInput, QueueDay, QueueFilter, QueueOrderRow

DEPOTS: tuple[s.DepotId, ...] = ("peliyagoda", "kandy")
#: Statuses a "No legal vehicle" flag is still useful for: the order has not gone out yet.
PRE_RUN = (OrderStatus.ORDERED, OrderStatus.CONFIRMED, OrderStatus.PLANNED, OrderStatus.DEFERRED)
JUST_IN_MINUTES = 10

_REACHED: dict[OrderStatus, int] = {
    OrderStatus.ORDERED: 0,
    OrderStatus.CONFIRMED: 1,
    OrderStatus.PLANNED: 2,
    OrderStatus.DEFERRED: 2,
    OrderStatus.LOADED: 3,
    OrderStatus.DEPARTED: 4,
    OrderStatus.DELIVERED: 5,
    OrderStatus.PARTIAL: 5,
    OrderStatus.ISSUE: 4,
    OrderStatus.PENDING_SYNC: 4,
    OrderStatus.CONFLICT: 4,
}
_STEPS = ("Ordered", "Confirmed", "Planned", "Loaded", "Departed", "Delivered", "Receipt confirmed")
#: The order event (``waypoint_rules.OrderEvent``) whose audit row stamps each journey step.
_STEP_OF_EVENT = {
    "cutoff": "Confirmed",
    "plan": "Planned",
    "load": "Loaded",
    "depart": "Departed",
    "deliver": "Delivered",
    "resolve_delivered": "Delivered",
    "receipt": "Receipt confirmed",
}


def _rules_order(day: QueueDay, r: QueueOrderRow) -> Order:
    past = day.history.get(r.outlet_id)
    return Order(
        r.id, r.outlet_id, r.temp, r.units, r.weight_kg, r.volume_m3,
        past.deferred_yesterday if past else False, past.days_since_served if past else 1,
    )


def _depot_of(day: QueueDay, r: QueueOrderRow) -> str:
    return day.ref.outlets[r.outlet_id].depot


def _window(day: QueueDay, outlet_id: str) -> s.TimeRange:
    o = day.ref.outlets[outlet_id]
    if o.mall_dock and o.mall_open is not None and o.mall_close is not None:
        return s.TimeRange(start=f"{o.mall_open:%H:%M}", end=f"{o.mall_close:%H:%M}")
    return s.TimeRange(start=f"{o.window_open:%H:%M}", end=f"{o.window_close:%H:%M}")


def _access(outlet: OutletRow) -> list[str]:
    tags = [DOCK_LABEL[outlet.dock_type]]
    if outlet.van_only:
        tags.append("Van only")
    if outlet.mall_dock:
        tags.append("Mall dock")
    return tags


def _no_legal_note(day: QueueDay, r: QueueOrderRow, outlet: OutletRow) -> str:
    parts: list[str] = []
    if outlet.van_only:
        parts.append("Van only")
    parts.append(f"{r.volume_m3:.1f} m³")
    parts.append(f"no {'van' if outlet.van_only else 'vehicle'} free on {day_label(day.service_date)}")
    return " · ".join(parts)


def queue_order(day: QueueDay, r: QueueOrderRow) -> s.QueueOrder:
    outlet = day.outlets[r.outlet_id]
    past = day.history.get(r.outlet_id)
    carry = bool(past and past.deferred_yesterday) and not r.after_cutoff
    tags: list[s.QueueTag] = []
    note: str | None = None
    if carry:
        tags += ["Carry-over", "Protected"]
        note = "Deferred yesterday: protected by the continuity guard"
    if not r.after_cutoff and r.status in PRE_RUN and not legal_vehicles(_rules_order(day, r), day.ref, day.vehicle_days):
        tags.append("No legal vehicle")
        note = _no_legal_note(day, r, outlet)
    if r.after_cutoff:
        tags.append("After cutoff")
        note = f"Moves to the following run ({day_label(day.following_run)})"
    just_in = (
        r.received_at is not None and day.now < day.cutoff and day.now - timedelta(minutes=JUST_IN_MINUTES) <= r.received_at <= day.now
    )
    return s.QueueOrder(
        id=r.id,
        outlet_id=r.outlet_id,
        brand=outlet.brand,
        district=outlet.district,
        temp=r.temp,
        access=_access(outlet),
        window=_window(day, r.outlet_id),
        mall_window=outlet.mall_dock,
        units=r.units,
        kg=r.weight_kg,
        m3=r.volume_m3,
        status=OrderStatus.ORDERED if r.after_cutoff else r.status,
        tags=tags,
        received_at=hm(r.received_at) if r.received_at else "",
        note=note,
        days_since_served=(past.days_since_served if carry and past else None),
        just_in=True if just_in else None,
    )


def _bucket(start: str) -> str:
    hours = int(start[:2]) + int(start[3:]) / 60
    return "early" if hours < 5 else "mid" if hours < 6 else "late"


def _matches(order: s.QueueOrder, name: str, f: QueueFilter) -> bool:
    if f.brand and order.brand not in f.brand:
        return False
    if f.temp and order.temp not in f.temp:
        return False
    if f.status and order.status not in f.status:
        return False
    if f.district and order.district not in f.district:
        return False
    if f.window and _bucket(order.window.start) not in f.window:
        return False
    if f.tags and not any((t in order.access) if t in ("Van only", "Mall dock") else (t in order.tags) for t in f.tags):
        return False
    needle = f.search.strip().lower()
    return not needle or needle in f"{order.id} {order.outlet_id} {name}".lower()


def _sorted(rows: list[QueueOrderRow]) -> list[QueueOrderRow]:
    return sorted(rows, key=lambda r: (r.received_at is None, r.received_at, r.id))


def queue_view(day: QueueDay, depot: s.DepotId, f: QueueFilter | None = None) -> s.QueueView:
    f = f or QueueFilter()
    mine = _sorted([r for r in day.rows if _depot_of(day, r) == depot])
    shown_all = [(queue_order(day, r), day.outlets[r.outlet_id].name) for r in mine]
    kept = [o for o, name in shown_all if _matches(o, name, f)]
    carry_all = sum(1 for o, _ in shown_all if "Carry-over" in o.tags)
    carry_kept = sum(1 for o in kept if "Carry-over" in o.tags)

    groups: list[s.QueueGroup]
    if depot == "kandy":
        by_outlet: dict[str, list[s.QueueOrder]] = {}
        for o in kept:
            by_outlet.setdefault(o.outlet_id, []).append(o)
        groups = []
        for outlet_id in sorted(by_outlet):
            outlet = day.outlets[outlet_id]
            orders = by_outlet[outlet_id]
            multi = len(orders) > 1
            groups.append(
                s.QueueGroup(
                    key=outlet_id,
                    title=f"{outlet_id} · {outlet.name}" if outlet.name != outlet_id else outlet_id,
                    kind="outlet",
                    outlet=s.OutletInfo(
                        id=outlet_id,
                        brand=outlet.brand if multi else None,
                        dock=DOCK_LABEL[outlet.dock_type] if multi else None,
                        window=_window(day, outlet_id) if multi else None,
                        note=f"{len(orders)} orders · tracked separately" if multi else None,
                    ),
                    orders=orders,
                )
            )
    else:
        carry = [o for o in kept if "Carry-over" in o.tags]
        other = [o for o in kept if "Carry-over" not in o.tags]
        groups = [
            g
            for g in (
                s.QueueGroup(key="carry", title=f"Carry-overs · {len(carry)}", kind="carry", orders=carry),
                s.QueueGroup(key="other", title="Other orders", kind="other", orders=other),
            )
            if g.orders
        ]

    counts = {d: sum(1 for r in day.rows if _depot_of(day, r) == d) for d in DEPOTS}
    received = sorted(o.received_at for o, _ in shown_all if o.received_at)
    minutes_left = max(0, -(-int((day.cutoff - day.now).total_seconds()) // 60))
    return s.QueueView(
        depot=depot,
        service_date=day.service_date,
        cutoff=s.QueueCutoff(closed=day.now >= day.cutoff, at=hm(day.cutoff), minutes_left=minutes_left),
        counts=s.DepotCounts(peliyagoda=counts["peliyagoda"], kandy=counts["kandy"]),
        carry_overs=carry_all,
        at_risk=sum(1 for o, _ in shown_all if "No legal vehicle" in o.tags),
        groups=groups,
        shown=len(kept),
        total=counts[depot],
        matching=len(kept) if f.active else None,
        hidden_carry_overs=carry_all - carry_kept,
        last_received=received[-1] if received else None,
    )


# ---- D1.5 history drawer ----------------------------------------------------


def _who(actor: str) -> str:
    if actor.lower().startswith("system"):
        return "System"
    if "@" in actor:
        return actor.split("@")[0].title()
    return actor


def _stamp(audit: list[AuditRow], step: str) -> str | None:
    hits = [a for a in audit if _STEP_OF_EVENT.get(a.event) == step]
    return f"{_who(hits[-1].actor)} · {hm(hits[-1].at)}" if hits else None


def _run_label(outcome: str) -> tuple[str, str]:
    if outcome in ("served", "partial"):
        return "served", "Served" if outcome == "served" else "Partial"
    if outcome == "deferred":
        return "deferred", "Deferred"
    return "pending", "No run"


def order_history_view(day: QueueDay, row: QueueOrderRow, hist: HistoryInput) -> s.OrderHistory:
    order = queue_order(day, row)
    outlet = day.outlets[row.outlet_id]
    past = day.history.get(row.outlet_id)
    protected = bool(past and past.deferred_yesterday)
    reached = _REACHED[order.status]
    journey: list[s.OrderJourneyStep] = []
    for i, step in enumerate(_STEPS):
        by: str | None = None
        if step == "Ordered":
            by = f"Store · {order.received_at}" if order.received_at else None
        elif i <= reached:
            by = _stamp(hist.audit, step) or (f"System · {hm(day.cutoff)}" if step == "Confirmed" else None)
        journey.append(
            s.OrderJourneyStep(step=step, by=by, state="done" if i < reached else "current" if i == reached else "pending")  # type: ignore[arg-type]
        )

    runs = [
        s.OrderHistoryRun(date=day_label(r.day), outcome=_run_label(r.outcome)[0], label=_run_label(r.outcome)[1])  # type: ignore[arg-type]
        for r in sorted(hist.runs, key=lambda r: r.day)[-4:]
    ]
    today = {
        OrderStatus.DELIVERED: ("served", "Served"),
        OrderStatus.PARTIAL: ("served", "Partial"),
        OrderStatus.DEFERRED: ("deferred", "Deferred"),
    }.get(row.status, ("pending", "Today pending"))
    runs.append(s.OrderHistoryRun(date=day_label(day.service_date), outcome=today[0], label=today[1]))  # type: ignore[arg-type]

    notes: list[str] = []
    d = hist.deferral
    if d is not None:
        notes.append(f"Deferred ({d.type.value.replace('_', ' ')}): {d.reason_text}")
        if d.next_run_date:
            notes.append(f"Next run {day_label(d.next_run_date)}")
    return s.OrderHistory(
        order=order,
        outlet_name=outlet.name,
        summary=f"{outlet.brand.value} · {outlet.district} · {row.temp.value} · {DOCK_LABEL[outlet.dock_type].lower()}",
        continuity=s.Continuity(
            protected=protected,
            text=(
                f"Deferred yesterday · {past.days_since_served} days since last served · Protected by continuity guard"
                if protected and past
                else "Served on the last run · not protected"
            ),
        ),
        last_runs=runs,
        journey=journey,
        notes=notes,
    )
