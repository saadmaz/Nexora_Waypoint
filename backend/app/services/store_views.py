"""The store's delivery days, history, issues and updates feed as its screens read them (PRD §3 S2 to S4).

Pure shaping and wording: :mod:`store_model` values in, ``schemas/store.py`` models out. No ``Session`` and
no SQLAlchemy, which is what makes the wording testable on its own. The same split as the dispatcher's
``queue_views`` and ``dispatcher_views``.

Two rules decide most of what is here:

* **The journey.** ``frontend/src/domain/delivery.ts`` ``buildJourney`` is the contract: Ordered and Confirmed
  never carry the amber marker, and once Delivered is reached the current step is Receipt confirmed, because
  that one waits on the store (A45).
* **Under review is a label, not a status.** The wire keeps ``conflict``; the store's own vocabulary turns it
  into "Under review" (``domain/status.ts``). The one exception is A47: once the store has answered "Yes, we
  received it", its screens read Delivered at once, while the review stays Dispatch's to close.

Times are naive local ISO with no offset, or ``HH:MM`` where the screens print a clock time.
"""

from __future__ import annotations

from datetime import date, datetime

from waypoint_rules.schedule import is_offline, store_arrival_range
from waypoint_rules.vocab import DeferralType, OrderStatus, Temp

from ..models.enums import ExceptionStatus
from ..schemas.common import Window
from ..schemas.store import (
    ArrivalRange,
    DeliveryDeferralOut,
    DeliveryOrderOut,
    DeliveryOut,
    IssueLineOut,
    IssueOut,
    JourneyStepOut,
    ProofOfDeliveryOut,
    RecentOrderDayOut,
    StoreUpdateOut,
    UpdatesFeedOut,
)
from .dispatcher_views import day_label, hm
from .store_model import (
    DeferralFacts,
    DeliveryDay,
    HistoryDay,
    IssueFacts,
    NoticeFacts,
    OrderFacts,
)
from .store_orders import STORE_TEMP

#: The seven journey steps and who acts at each (``frontend/src/domain/delivery.ts``).
JOURNEY: tuple[tuple[str, str], ...] = (
    ("Ordered", "You"),
    ("Confirmed", "Dispatch"),
    ("Planned", "Dispatch"),
    ("Loaded", "Loader"),
    ("Departed", "Driver"),
    ("Delivered", "Driver"),
    ("Receipt confirmed", "You"),
)

#: Steps that never carry the amber marker: the plan is not out yet, so nothing is in motion (A45).
_NEVER_CURRENT = ("Ordered", "Confirmed")

#: The statuses a day is still running through, least advanced first. The card shows the earliest one reached.
_IN_FLIGHT = (
    OrderStatus.ORDERED,
    OrderStatus.CONFIRMED,
    OrderStatus.PLANNED,
    OrderStatus.LOADED,
    OrderStatus.DEPARTED,
)

#: How a feed row's tag reaches the store. ``Change`` is a dock and driver tag; a store hears it as a delivery.
_FEED_TAG = {
    "Order": "Order",
    "Plan": "Plan",
    "Delivery": "Delivery",
    "Deferral": "Deferral",
    "Review": "Review",
    "Change": "Delivery",
}

#: The label for the next run, by deferral type. The store's own ETA moved; a policy call is the next run.
_NEXT_RUN_LABEL = {
    DeferralType.STORE_REQUEST: "New ETA",
    DeferralType.POLICY: "Next run",
    DeferralType.CAPACITY: "Next run",
}


# ---- small formatters -------------------------------------------------------


def _window(day: DeliveryDay) -> Window:
    return Window(start=hm(day.outlet.window_open), end=hm(day.outlet.window_close))


# ---- the day's standing -----------------------------------------------------


def day_status(day: DeliveryDay) -> OrderStatus:
    """The status the day's orders share, as the S2 card shows it.

    A day with orders at different stages reads as the earliest stage still in flight, because that is
    what the store is still waiting for. Among finished orders the worst one speaks: a reported problem
    over a shortfall, a shortfall over a clean delivery.
    """
    statuses = [o.status for o in day.orders]
    if not statuses:
        return OrderStatus.ORDERED
    if all(s is OrderStatus.DEFERRED for s in statuses):
        return OrderStatus.DEFERRED
    if OrderStatus.CONFLICT in statuses:
        # A47: "Yes, we received it" settles it for the store; Dispatch still closes the review.
        return OrderStatus.DELIVERED if _settled_by_the_store(day) else OrderStatus.CONFLICT
    for status in _IN_FLIGHT:
        if status in statuses:
            return status
    if OrderStatus.ISSUE in statuses:
        return OrderStatus.ISSUE
    if OrderStatus.PARTIAL in statuses:
        return OrderStatus.PARTIAL
    return OrderStatus.DELIVERED


def _settled_by_the_store(day: DeliveryDay) -> bool:
    """A47. A shortage report is an answer too, but it settles nothing: D7.4 B makes the order Partial."""
    c = day.conflict
    return c is not None and c.answered and not c.reported_short


def _order_status(order: OrderFacts, day: DeliveryDay) -> OrderStatus:
    if order.status is OrderStatus.CONFLICT and _settled_by_the_store(day):
        return OrderStatus.DELIVERED
    return order.status


# ---- the journey (S2 "Show all steps") --------------------------------------


def journey_times(day: DeliveryDay) -> dict[str, datetime]:
    """When each step of this day happened, as far as it has got."""
    times: dict[str, datetime] = {}
    ordered = [o.received_at for o in day.orders if o.received_at is not None]
    if ordered:
        times["Ordered"] = min(ordered)
    # Past Ordered means the 16:00 cutoff closed the queue, whatever the day has done since.
    if day.cutoff_at is not None and day_status(day) is not OrderStatus.ORDERED:
        times["Confirmed"] = day.cutoff_at
    if day.released and day.released_at is not None:
        times["Planned"] = day.released_at
    if day.loaded_at is not None:
        times["Loaded"] = day.loaded_at
    if day.departed_at is not None:
        times["Departed"] = day.departed_at
    delivered = _delivered_at(day)
    if delivered is not None:
        times["Delivered"] = delivered
    receipt = _receipt_at(day)
    if receipt is not None:
        times["Receipt confirmed"] = receipt
    return times


def _delivered_at(day: DeliveryDay) -> datetime | None:
    """When the goods arrived: the driver's record, which a review does not take away (S2.7 keeps showing it)."""
    if day.proof is not None:
        return day.proof.at
    return day.conflict.delivered_at if day.conflict is not None else None


def _receipt_at(day: DeliveryDay) -> datetime | None:
    return max((r.confirmed_at for r in day.receipts), default=None)


def journey(day: DeliveryDay) -> list[JourneyStepOut]:
    """The seven steps with their state, reproducing ``buildJourney`` (A45)."""
    times = journey_times(day)
    reached = [step for step, _ in JOURNEY if step in times]
    last = reached[-1] if reached else None
    if last == "Delivered":
        current: str | None = "Receipt confirmed"  # the step that waits on the store (S2.8)
    elif last is None or last == "Receipt confirmed" or last in _NEVER_CURRENT:
        current = None
    else:
        current = last
    out: list[JourneyStepOut] = []
    for step, actor in JOURNEY:
        at = times.get(step)
        state = "current" if step == current else "done" if at is not None else "pending"
        out.append(JourneyStepOut(step=step, actor=actor, at=hm(at) if at is not None else None, state=state))
    return out


# ---- arrival (PRD §4a) ------------------------------------------------------


def arrival(day: DeliveryDay) -> ArrivalRange | None:
    """The arrival range, once the plan is out and the day is still to be served.

    The rule is ``waypoint_rules.schedule.store_arrival_range``: the later of predicted arrival and the
    window opening, with the earlier arrival named only when the truck would have to wait. A day with no
    trip of its own is told the window's own opening.
    """
    if not day.released or _standing_deferral(day) is not None:
        return None
    shown = store_arrival_range(day.predicted_arrival or day.outlet.window_open, day.outlet.window_open)
    return ArrivalRange(
        from_=hm(shown.start),
        may_arrive_at=hm(shown.may_arrive_at) if shown.may_arrive_at is not None else None,
    )


# ---- the deferral notice (S2.6, S2.9) ---------------------------------------


def _standing_deferral(day: DeliveryDay) -> DeferralFacts | None:
    """The deferral that still stands. A withdrawn one leaves a tag behind, not a notice."""
    d = day.deferral
    return d if d is not None and d.withdrawn_at is None else None


def _temps(day: DeliveryDay) -> str:
    """"chilled", "dry", or "chilled and dry": the kinds the deferral moved, in the store's own words."""
    kinds = [STORE_TEMP[o.temp] for o in day.orders]
    unique = list(dict.fromkeys(kinds))
    return " and ".join(unique) if unique else "order"


def deferral_out(day: DeliveryDay) -> DeliveryDeferralOut | None:
    """The deferral as S2 announces it: the type's own headline, the reason, who decided and the next run.

    Not announced while a review is open: the driver delivered anyway, so the store is told Under review (S2.7), and
    a deferral card drawn over that would hide the question it has to answer. The deferral itself still stands.
    """
    d = _standing_deferral(day)
    if d is None or (day.conflict is not None and day.conflict.resolved_at is None):
        return None
    next_run = d.next_run_date or day.next_run
    label = day_label(next_run) if next_run is not None else "the next run"
    headline = "Deferred at your request" if d.type is DeferralType.STORE_REQUEST else f"Your {_temps(day)} order moved to {label}"
    subline = f"Next run {label}." if d.type is DeferralType.STORE_REQUEST else None
    return DeliveryDeferralOut(
        id=d.id,
        type=d.type,
        headline=headline,
        subline=subline,
        explanation=_explanation(d.type, d.reason, label),
        reason=d.reason,
        decided_by=d.decided_by,
        decided_at=hm(d.decided_at) if d.decided_at is not None else "",
        next_run_label=_NEXT_RUN_LABEL[d.type],
        next_run=f"{label} · from {hm(day.outlet.window_open)}" if d.type is DeferralType.STORE_REQUEST else label,
        next_run_short=f"{next_run:%a}" if next_run is not None else "",
        acknowledged=d.seen_at is not None,
    )


def _explanation(kind: DeferralType, reason: str, label: str) -> str | None:
    """Why a deferral the store did not ask for happened. A store-request deferral needs no explaining."""
    if kind is DeferralType.STORE_REQUEST:
        return None
    if kind is DeferralType.CAPACITY:
        return f"{reason} No vehicle on the road today can carry the whole order, and orders are never split, so it moves to {label}."
    return f"{reason} Orders are never split, so one had to move. Your store is served on the next run, {label}."


# ---- the orders on the card -------------------------------------------------


def _issue_tag(issues: list[IssueFacts], order: OrderFacts) -> str | None:
    """The tag an order carries for a report that names it: Missing on part of an order reads Short."""
    for issue in issues:
        if order.id not in issue.order_ids:
            continue
        affected = issue.units.get(order.id, order.units)
        return "Short" if issue.type == "Missing" and affected < order.units else issue.type
    return None


def delivery_orders(day: DeliveryDay) -> list[DeliveryOrderOut]:
    # `received` is the count of a line that came up short, as the mock sends it: S3 prints "10 of 12 units received"
    # and the shortfall reason under it, which a line counted in full must not get.
    counted = {r.order_id: r.units_received for r in day.receipts}
    return [
        DeliveryOrderOut(
            id=o.id,
            kind=o.temp,
            units=o.units,
            status=_order_status(o, day),
            issue=_issue_tag(day.issues, o),
            received=counted[o.id] if o.id in counted and counted[o.id] < o.units else None,
        )
        for o in day.orders
    ]


# ---- issues (S3.4, S3.7) ----------------------------------------------------


def issue_out(
    issue: IssueFacts,
    outlet_id: str,
    service_date: date,
    sizes: dict[str, tuple[Temp, int]],
) -> IssueOut:
    """One reported problem. ``sizes`` gives each named order's kind and size."""
    lines = [
        IssueLineOut(
            order_id=oid,
            kind=sizes.get(oid, (Temp.AMBIENT, 0))[0],
            units=issue.units.get(oid, sizes.get(oid, (Temp.AMBIENT, 0))[1]),
            order_units=sizes.get(oid, (Temp.AMBIENT, 0))[1],
        )
        for oid in issue.order_ids
    ]
    return IssueOut(
        id=str(issue.id),
        outlet_id=outlet_id,
        date=service_date,
        type=issue.type,
        lines=lines,
        note=issue.note,
        photo=issue.photo,
        reported_at=hm(issue.raised_at),
        resolved=issue.status is ExceptionStatus.DECIDED,
    )


def day_issues(day: DeliveryDay, sizes: dict[str, tuple[Temp, int]]) -> list[IssueOut]:
    """This day's reported problems, newest first (S3.4)."""
    return [issue_out(i, day.outlet.id, day.service_date, sizes) for i in day.issues]


# ---- one delivery day (S2) --------------------------------------------------


def delivery_out(day: DeliveryDay, sizes: dict[str, tuple[Temp, int]]) -> DeliveryOut:
    """One delivery day as S2.1 to S2.11 read it."""
    status = day_status(day)
    deferral = deferral_out(day)
    receipt_at = _receipt_at(day)
    receipt_by = next((r.confirmed_by for r in day.receipts if r.confirmed_by), None)
    shortfall = next((r.shortfall_reason for r in day.receipts if r.shortfall_reason), None)

    tags: list[str] = []
    if day.deferral is not None and day.deferral.withdrawn_at is not None:
        tags.append("Deferral withdrawn")
    if receipt_at is not None:
        tags.append("Receipt confirmed")

    withdrawn_run = day.deferral.next_run_date if day.deferral is not None else None
    withdrawn_note = (
        f"{day_label(withdrawn_run or day.next_run)} re-run removed."
        if "Deferral withdrawn" in tags and (withdrawn_run or day.next_run) is not None
        else None
    )

    return DeliveryOut(
        date=day.service_date,
        outlet_id=day.outlet.id,
        outlet_name=day.outlet.name,
        district=day.outlet.district,
        window=_window(day),
        dock=day.outlet.dock,
        vehicle=day.vehicle if day.released else None,
        orders=delivery_orders(day),
        status=status,
        journey=journey(day),
        arrival=arrival(day),
        plan_pending=status in (OrderStatus.ORDERED, OrderStatus.CONFIRMED),
        loaded=_loaded(day),
        on_the_way=_on_the_way(day, status),
        last_update=_last_update(day, status),
        receivers_cue=day.released and status in (OrderStatus.PLANNED, OrderStatus.LOADED, OrderStatus.DEPARTED),
        deferral=deferral,
        review=_review(day),
        proof=_proof(day),
        tags=tags,
        withdrawn_note=withdrawn_note,
        receipt_confirmed_at=hm(receipt_at) if receipt_at is not None else None,
        receipt_by=receipt_by,
        shortfall_reason=shortfall,
        issues=day_issues(day, sizes),
        received_answered=day.conflict is not None and day.conflict.answered,
    )


def _loaded(day: DeliveryDay) -> dict[str, str] | None:
    """"Loaded at Kandy dock 04:50": shown until the truck leaves (S2.3)."""
    if day.loaded_at is None or day.departed_at is not None:
        return None
    return {"place": day.loaded_place or "the dock", "at": hm(day.loaded_at)}


def _on_the_way(day: DeliveryDay, status: OrderStatus) -> dict[str, str] | None:
    """The predicted arrival and the window opening while the truck is out (S2.4)."""
    if status is not OrderStatus.DEPARTED or day.departed_at is None:
        return None
    return {
        "arrivesAbout": hm(day.predicted_arrival or day.outlet.window_open),
        "unloadingFrom": hm(day.outlet.window_open),
    }


def _last_update(day: DeliveryDay, status: OrderStatus) -> str | None:
    """The last status the store has while the driver is out of coverage (S2.5). A muted line, not an alert."""
    if day.last_heard_at is None or status is not OrderStatus.DEPARTED:
        return None
    running = day.departed_at is not None and day.finished_at is None
    return hm(day.last_heard_at) if is_offline(day.last_heard_at, day.now, in_progress=running) else None


def _review(day: DeliveryDay) -> dict[str, str] | None:
    """The question Dispatch asked while it settles two records (S2.7, A51).

    Shown only once Dispatch has asked and the three facts the question needs are known. ``conflictId`` is
    part of the contract: the answer route is keyed by the review, and the client reads the id out of here.
    """
    c = day.conflict
    if c is None or c.resolved_at is not None or c.answered:
        return None
    if c.asked_at is None or c.delivered_at is None or c.received_by is None:
        return None
    return {
        "conflictId": str(c.id),
        "askedAt": hm(c.asked_at),
        "deliveredAt": hm(c.delivered_at),
        "receivedBy": c.received_by,
    }


def _proof(day: DeliveryDay) -> ProofOfDeliveryOut | None:
    """The driver's record of the stop (A13). It stands through a review: the goods are at the store."""
    if day.proof is None:
        return None
    return ProofOfDeliveryOut(
        received_by=day.proof.received_by,
        at=hm(day.proof.at),
        driver=day.proof.driver,
        vehicle=day.proof.vehicle,
        units=[o.delivered_units if o.delivered_units is not None else o.units for o in day.orders],
    )


# ---- the past days (S1.6, S2.10, S4.2) --------------------------------------


def recent_out(row: HistoryDay) -> RecentOrderDayOut:
    """One history row. ``current`` is set on the running day only: older rows are display-only (PRD §3 S4)."""
    deferral = (
        {
            "type": row.deferral_type.value,
            **({"nextRunShort": f"{row.next_run_date:%a}"} if row.next_run_date is not None else {}),
        }
        if row.deferral_type is not None
        else None
    )
    return RecentOrderDayOut(
        date=row.service_date,
        order_count=row.order_count,
        status=row.status,
        deferral=deferral,
        delivered_at=hm(row.delivered_at) if row.delivered_at is not None else None,
        short_units=row.short_units or None,
        served_next_day=row.served_next_day if row.deferral_type is not None else None,
        order_ids=list(row.order_ids) or None,
        deferral_withdrawn=True if row.deferral_withdrawn else None,
        receipt_confirmed_at=hm(row.receipt_confirmed_at) if row.receipt_confirmed_at is not None else None,
        current=True if row.current else None,
    )


# ---- the updates feed (S4.1) ------------------------------------------------


def update_out(row: NoticeFacts) -> StoreUpdateOut:
    """One feed row: the tag, the time, what happened, and the screen View opens."""
    return StoreUpdateOut(
        id=str(row.id),
        tag=_FEED_TAG.get(row.tag, "Delivery"),
        date=row.created_at.date(),
        time=hm(row.created_at),
        title=row.title,
        body=row.body,
        view_label="View delivery" if row.resolved_at is not None and row.tag == "Delivery" else None,
        target=_target(row),
        unread=row.read_at is None,
        resolved_at=hm(row.resolved_at) if row.resolved_at is not None and row.tag == "Review" else None,
    )


def _target(row: NoticeFacts) -> dict[str, str]:
    """Where View goes. The notice names a screen; a delivery row also needs its day."""
    screen = str(row.link.get("screen") or "")
    if screen != "orders" and row.service_date is not None:
        return {"screen": "delivery", "date": row.service_date.isoformat()}
    return {"screen": "orders"}


def updates_out(rows: list[NoticeFacts]) -> UpdatesFeedOut:
    """The feed newest first, with the unread count for the bell (A37, A53)."""
    updates = [update_out(r) for r in rows]
    return UpdatesFeedOut(updates=updates, unread=sum(1 for u in updates if u.unread))


__all__ = [
    "arrival",
    "day_issues",
    "day_status",
    "deferral_out",
    "delivery_orders",
    "delivery_out",
    "issue_out",
    "journey",
    "journey_times",
    "recent_out",
    "update_out",
    "updates_out",
]
