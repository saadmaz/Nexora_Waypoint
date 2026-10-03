"""The store's writes: confirm receipt, report a problem, acknowledge a deferral, answer a review (PRD §3 S3).

Four small transactions, each one a handoff back to Dispatch (handoff 10):

* **Confirm receipt** closes the loop on a delivery. Counts that match leave the order Delivered and add the
  Receipt confirmed tag the store reads; a lower count is a shortfall, which is the one receipt that moves the
  order on, to Partial. A receipt taken while a review is open is recorded and the review stays open (S3.6).
* **Report a problem** raises a ``store_issue`` exception, moves the orders it names to Issue and tells Dispatch.
* **Got it** on a deferral stamps ``notice_seen_at``, which is what the dispatcher's D4 sent / seen column reads.
* **"Yes, we received it"** records the store's answer on the review. It never settles the review and never
  changes the recommendation: D7 and ``services.conflicts`` own that (A47).

Every one writes its audit row in the same transaction, and order transitions go through ``services.orders``,
so ``waypoint_rules.transition`` is the only thing that decides a status.
"""

from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy.orm import Session

from waypoint_rules import OrderEvent
from waypoint_rules.vocab import OrderStatus

from .. import clock
from ..deps import CurrentUser, require_outlet
from ..errors import ApiError, not_found
from ..models import field as field_models
from ..models.comms import Notice
from ..models.enums import (
    AuditType,
    ConflictStatus,
    ExceptionKind,
    ExceptionStatus,
    NoticeTag,
)
from ..schemas.store import AnswerReceivedIn, ConfirmReceiptIn, DeliveryOut, IssueOut, ReportIssueIn
from . import audit, store_deliveries, store_repo, store_views
from . import orders as order_service
from . import planning_repo as repo
from .dispatcher_views import day_label
from .store_model import DeliveryDay, OrderFacts
from .store_orders import outlet_of

#: The problem types a store may report (PRD §4b Issue type, minus the driver's own outcomes).
#: ``Short`` is never chosen: it is the tag a Missing report on part of an order earns (A49).
ISSUE_TYPES = ("Missing", "Damaged", "Wrong item", "Late", "Arrived warm", "Other")

#: An order the driver has acted on. Nothing can be received before one of these exists.
_ARRIVED = (OrderStatus.DELIVERED, OrderStatus.PARTIAL, OrderStatus.ISSUE, OrderStatus.CONFLICT)


# ---- the day a write is about -----------------------------------------------


def _day(db: Session, user: CurrentUser, service_date: date) -> tuple[DeliveryDay, datetime]:
    """The outlet's own delivery day, or a 404. The outlet comes from the token, never from the body."""
    outlet = outlet_of(db, user)
    now = clock.now(db).replace(tzinfo=None)
    day = store_repo.delivery_day(db, outlet, service_date, now)
    if day is None:
        raise not_found(f"A delivery for {service_date.isoformat()}")
    return day, now


def _named_orders(day: DeliveryDay, order_ids: list[str]) -> dict[str, OrderFacts]:
    """The day's orders a request names, or a 404 naming the first one that is not on it."""
    out: dict[str, OrderFacts] = {}
    for oid in order_ids:
        order = day.order(oid)
        if order is None:
            raise not_found(f"Order {oid} on {day.service_date.isoformat()}")
        out[oid] = order
    return out


# ---- S3.1: confirm receipt --------------------------------------------------


def confirm(db: Session, user: CurrentUser, body: ConfirmReceiptIn) -> DeliveryOut:
    """What the store counted, in one transaction. A count below what was ordered needs a reason (A50)."""
    day, now = _day(db, user, body.date)
    named = _named_orders(day, [line.order_id for line in body.lines])
    if not any(o.status in _ARRIVED for o in day.orders):
        raise ApiError(
            409,
            "not_delivered",
            f"Nothing has been delivered for {day_label(day.service_date)} yet, so there is nothing to confirm.",
            {"date": day.service_date.isoformat(), "status": store_views.day_status(day).value},
        )

    short: dict[str, int] = {}
    for line in body.lines:
        order = named[line.order_id]
        units = order.units
        if line.received > units:
            raise ApiError(
                400,
                "more_than_ordered",
                f"{line.order_id} was ordered as {units} units, so {line.received} cannot have arrived.",
                {"orderId": line.order_id, "ordered": units, "received": line.received},
            )
        if line.received < units:
            short[line.order_id] = units - line.received
    if short and not (body.reason or "").strip():
        raise ApiError(
            400,
            "reason_required",
            "A count below what was ordered needs a reason before it can be sent.",
            {"orderIds": sorted(short)},
        )

    at = _recorded_at(body.device_time, day.service_date, now)
    reason = (body.reason or "").strip() or None
    for line in body.lines:
        db.merge(
            field_models.Receipt(
                order_id=line.order_id,
                units_received=line.received,
                shortfall_reason=reason if line.order_id in short else None,
                confirmed_at=repo.aware(at),
                confirmed_by=user.display_name,
            )
        )
        audit.record(
            db,
            actor=user.email,
            entity_type="order",
            entity_id=line.order_id,
            type=AuditType.RECEIPT_CONFIRMED,
            payload={
                "event": "confirm_receipt",
                "outletId": day.outlet.id,
                "serviceDate": day.service_date.isoformat(),
                "received": line.received,
                "ordered": named[line.order_id].units,
                "reason": reason,
                "deviceTime": body.device_time,
            },
            at=repo.aware(at),
        )
    db.flush()
    _apply_shortfalls(db, user, day, short)
    _report_to_review(db, day, short, named, actor=user.display_name, at=at)
    db.add(_receipt_notice(day, short, reason, at))
    db.commit()
    return store_deliveries.day_or_404(db, user, day.service_date)


def _recorded_at(device_time: str | None, service_date: date, now: datetime) -> datetime:
    """The time the receipt is recorded under.

    A confirmation saved offline carries the phone's own ``HH:MM`` and is preferred, because that is when the
    store counted (A52). One that does not parse, or that claims a time the scenario has not reached, falls
    back to the clock rather than being trusted.
    """
    if not device_time:
        return now
    try:
        hour, minute = (int(part) for part in device_time.split(":", 1))
        stamp = datetime.combine(service_date, time(hour, minute))
    except ValueError:
        return now
    return stamp if stamp <= now else now


def _apply_shortfalls(db: Session, user: CurrentUser, day: DeliveryDay, short: dict[str, int]) -> None:
    """A count below what was ordered makes a delivered order Partial (PRD §4b).

    An order still under review is left alone: D7.4 B settles it as Partial from the store's report, which
    ``_report_to_review`` has just put on the review.
    """
    for order_id in short:
        facts = day.order(order_id)
        if facts is None or facts.status is not OrderStatus.DELIVERED:
            continue
        row = store_repo.order(db, order_id)
        if row is not None:
            order_service.apply(
                db,
                row,
                OrderEvent.SHORTFALL,
                actor=user.email,
                commit=False,
                payload={"received": facts.units - short[order_id], "ordered": facts.units},
            )


def _report_to_review(
    db: Session,
    day: DeliveryDay,
    short: dict[str, int],
    named: dict[str, OrderFacts],
    *,
    actor: str,
    at: datetime,
) -> None:
    """A shortfall counted while a review is open is the store's report on it (D7.3).

    ``conflict_views.short_units`` reads this shape, and ``reconcile_store_answer`` turns it into the
    Keep as partial recommendation. The recommendation stays the dispatcher's to confirm.
    """
    if not short or day.conflict is None or day.conflict.status is ConflictStatus.RESOLVED:
        return
    conflict = store_repo.conflict(db, day.conflict.id)
    if conflict is None:
        return
    order_id = next(oid for oid in short if oid in (conflict.order_ids or ()))
    ordered = named[order_id].units
    conflict.server_snapshot = {
        **(conflict.server_snapshot or {}),
        "storeReport": {
            "orderId": order_id,
            "unitsReceived": ordered - short[order_id],
            "unitsOrdered": ordered,
            "by": actor,
            "at": repo.aware(at).isoformat(),
        },
    }


def _receipt_notice(day: DeliveryDay, short: dict[str, int], reason: str | None, at: datetime) -> Notice:
    """Dispatch is told what the store counted, so D6 shows the receipt (D6.6)."""
    if short:
        parts = [f"{oid} short {units}" for oid, units in sorted(short.items())]
        body = f"{day.outlet.id} confirmed {day_label(day.service_date)} with a shortfall: {', '.join(parts)}."
        if reason:
            body = f"{body} Reason: {reason}."
    else:
        ids = " + ".join(o.id for o in day.orders)
        body = f"{day.outlet.id} confirmed receipt of {ids} for {day_label(day.service_date)}."
    return Notice(
        audience="dispatch",
        tag=NoticeTag.DELIVERY,
        title=f"{day.outlet.id}: receipt confirmed",
        body=body,
        link={"screen": "live", "outletId": day.outlet.id},
        refs={"orderIds": [o.id for o in day.orders], "outletId": day.outlet.id},
        created_at=repo.aware(at),
    )


# ---- S3.3: report a problem -------------------------------------------------


def report_issue(db: Session, user: CurrentUser, body: ReportIssueIn) -> IssueOut:
    """A problem tied to the delivery. Dispatch is told at once; the orders it names move to Issue."""
    day, now = _day(db, user, body.date)
    if body.type not in ISSUE_TYPES:
        raise ApiError(
            400,
            "unknown_issue_type",
            f"{body.type!r} is not a problem the store can report.",
            {"type": body.type, "allowed": list(ISSUE_TYPES)},
        )
    named = _named_orders(day, [line.order_id for line in body.lines])
    units: dict[str, int] = {}
    for line in body.lines:
        ordered = named[line.order_id].units
        if line.units > ordered:
            raise ApiError(
                400,
                "more_than_ordered",
                f"{line.order_id} has {ordered} units, so {line.units} cannot be affected.",
                {"orderId": line.order_id, "ordered": ordered, "units": line.units},
            )
        units[line.order_id] = line.units

    note = (body.note or "").strip() or None
    row = field_models.FieldException(
        kind=ExceptionKind.STORE_ISSUE,
        type=body.type,
        vehicle_id=day.vehicle,
        trip_id=None,
        order_ids=list(units),
        units_short=units,
        detail=note,
        raised_by=user.display_name,
        raised_at=repo.aware(now),
        device_time=None,
        status=ExceptionStatus.OPEN,
    )
    db.add(row)
    db.flush()
    audit.record(
        db,
        actor=user.email,
        entity_type="exception",
        entity_id=str(row.id),
        type=AuditType.ISSUE_REPORTED,
        payload={
            "event": "report_issue",
            "outletId": day.outlet.id,
            "serviceDate": day.service_date.isoformat(),
            "type": body.type,
            "orderIds": list(units),
            "units": units,
            # There is no column for the photo flag; this row is its record (see ``store_repo.issue_photos``).
            "photo": body.photo,
            "note": note,
        },
        at=repo.aware(now),
    )
    _flag_orders(db, user, day, units)
    _report_to_review(db, day, units, named, actor=user.display_name, at=now)
    db.add(_issue_notice(day, body.type, units, note, now))
    db.commit()

    photos = store_repo.issue_photos(db, [row.id])
    sizes = store_repo.order_sizes(db, units)
    return store_views.issue_out(
        store_repo.issue_fact(row, photo=row.id in photos), day.outlet.id, day.service_date, sizes
    )


def _flag_orders(db: Session, user: CurrentUser, day: DeliveryDay, units: dict[str, int]) -> None:
    """A reported problem makes a delivered order Issue. An order still under review is D7's to settle."""
    for order_id in units:
        facts = day.order(order_id)
        if facts is None or facts.status not in (OrderStatus.DELIVERED, OrderStatus.DEPARTED):
            continue
        row = store_repo.order(db, order_id)
        if row is not None:
            order_service.apply(
                db,
                row,
                OrderEvent.FAIL,
                actor=user.email,
                audit_type=AuditType.ISSUE_REPORTED,
                commit=False,
                payload={"reportedBy": user.display_name, "units": units[order_id]},
            )


def _issue_notice(day: DeliveryDay, kind: str, units: dict[str, int], note: str | None, at: datetime) -> Notice:
    """The D8 inbox row: what the store says went wrong, on which orders."""
    parts = [f"{oid} ({_affected(kind, units[oid])})" for oid in sorted(units)]
    body = f"{day.outlet.id} reported {kind.lower()} on {', '.join(parts)} for {day_label(day.service_date)}."
    return Notice(
        audience="dispatch",
        tag=NoticeTag.CHANGE,
        title=f"{day.outlet.id}: {kind.lower()} reported by the store",
        body=f"{body} {note}" if note else body,
        link={"screen": "live", "outletId": day.outlet.id},
        refs={"orderIds": sorted(units), "outletId": day.outlet.id, "type": kind},
        created_at=repo.aware(at),
    )


def _affected(kind: str, units: int) -> str:
    count = f"{units} unit" if units == 1 else f"{units} units"
    return "late" if kind == "Late" else f"{count} {kind.lower()}"


# ---- S2.6: Got it on a deferral ---------------------------------------------


def acknowledge_deferral(db: Session, user: CurrentUser, deferral_id: int) -> None:
    """The store read the deferral notice. The dispatcher's D4 sent / seen column reads this stamp.

    A deferral row belongs to one order, but the store is told once for the day: deferring ORD2001 and
    ORD2002 together is one notice and one Got it (H11). So every row the same notice covered is stamped,
    or D4 would show one of the two orders as still unread.
    """
    row = store_repo.deferral(db, deferral_id)
    order = store_repo.order(db, row.order_id) if row is not None else None
    if row is None or order is None:
        raise not_found(f"Deferral {deferral_id}")
    require_outlet(user, order.outlet_id)

    now = clock.now(db)
    group = store_repo.deferral_group(db, row, order.outlet_id)
    unseen = [d for d in group if d.notice_seen_at is None]
    if not unseen:
        return  # tapping Got it twice changes nothing
    for d in unseen:
        d.notice_seen_at = now
        audit.record(
            db,
            actor=user.email,
            entity_type="deferral",
            entity_id=str(d.id),
            type=AuditType.NOTICE_SEEN,
            payload={"event": "acknowledge", "orderId": d.order_id, "outletId": order.outlet_id},
            at=now,
        )
    db.commit()


# ---- S2.7 and S3.5: the answer to "Did you receive this delivery?" ----------


def answer_received(db: Session, user: CurrentUser, conflict_id: int, body: AnswerReceivedIn) -> None:
    """Record the store's answer on an open review (A47).

    It does not settle the review and does not change the recommendation: everything received leaves it at
    Keep delivery, which is what ``waypoint_rules.reconcile_store_answer`` says. Only D7.4 closes it.
    """
    conflict = store_repo.conflict(db, conflict_id)
    if conflict is None:
        raise not_found(f"Review {conflict_id}")
    orders = [o for o in (store_repo.order(db, oid) for oid in conflict.order_ids or ()) if o is not None]
    if not orders:
        raise not_found(f"Review {conflict_id}")
    require_outlet(user, orders[0].outlet_id)
    if conflict.status is not ConflictStatus.AWAITING_STORE:
        raise ApiError(
            409,
            "not_awaiting_store",
            "Dispatch is not waiting for your answer on this delivery.",
            {"conflictId": conflict_id, "status": conflict.status.value},
        )

    now = clock.now(db).replace(tzinfo=None)
    first = orders[0]
    conflict.server_snapshot = {
        **(conflict.server_snapshot or {}),
        "storeReport": {
            "orderId": first.id,
            "unitsReceived": first.units,
            "unitsOrdered": first.units,
            "by": user.display_name,
            "at": repo.aware(now).isoformat(),
        },
    }
    ids = " + ".join(o.id for o in orders)
    db.add(
        Notice(
            audience="dispatch",
            tag=NoticeTag.REVIEW,
            title=f"{first.outlet_id}: the store confirms it received the delivery",
            body=f"{user.display_name} answered yes for {ids}. Nothing is short.",
            link={"screen": "conflict", "conflictId": conflict.id},
            refs={"conflictId": conflict.id, "orderIds": [o.id for o in orders]},
            created_at=repo.aware(now),
        )
    )
    audit.record(
        db,
        actor=user.email,
        entity_type="conflict",
        entity_id=str(conflict.id),
        type=AuditType.CONFLICT_OPENED,
        payload={"event": "store_answer", "answer": body.answer, "orderIds": [o.id for o in orders]},
        at=repo.aware(now),
    )
    db.commit()
