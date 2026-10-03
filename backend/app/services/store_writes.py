"""The store manager's writes (PRD §19 StoreApi): place, edit and cancel orders, confirm receipt, report a problem, answer.

Each change goes through ``waypoint_rules.transition`` where it is a status change and writes an audit row in the same
transaction (PRD §9 principle 3). Callers commit.
"""

from __future__ import annotations

import re
from datetime import date, datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules import OrderEvent, OrderStatus
from waypoint_rules.schedule import service_day_for
from waypoint_rules.vocab import Temp

from .. import clock
from ..config import COLOMBO
from ..deps import CurrentUser, require_outlet
from ..errors import ApiError, not_found
from ..models import field as f
from ..models import orders as om
from ..models.comms import Notice
from ..models.enums import AuditType, ConflictStatus, ExceptionKind, ExceptionStatus, NoticeTag, ServerStatus
from ..schemas import store as s
from . import audit
from . import orders as order_service
from . import planning_repo as repo
from . import store_views as views
from .dispatcher_views import day_label

#: The ids the scenario reserves for the next two orders from the hero outlet (seed/fixtures/pinned_orders.yaml).
_RESERVED = {Temp.CHILLED: "ORD2001", Temp.AMBIENT: "ORD2002"}
_ID = re.compile(r"^ORD(\d+)$")

#: What a store may report (``frontend/src/domain/issue.ts``); "Short" is a tag the server derives, never chosen.
REPORTABLE = {"Missing", "Damaged", "Wrong item", "Arrived warm", "Late", "Other"}


def _order(db: Session, user: CurrentUser, order_id: str) -> om.Order:
    order = db.get(om.Order, order_id)
    if order is None or order.cancelled_at is not None:
        raise not_found(f"Order {order_id}")
    require_outlet(user, order.outlet_id)
    return order


def _next_id(db: Session, temp: Temp, taken: set[str]) -> str:
    reserved = _RESERVED[temp]
    if reserved not in taken and db.get(om.Order, reserved) is None:
        return reserved
    numbers = [int(m.group(1)) for oid in [*db.scalars(select(om.Order.id)), *taken] if (m := _ID.match(oid))]
    return f"ORD{max(numbers, default=3000) + 1}"


def _notice(db: Session, outlet_id: str, tag: NoticeTag, title: str, body: str, *, link: dict[str, str], order_ids: list[str], at: datetime) -> None:
    db.add(Notice(audience=f"store:{outlet_id}", tag=tag, title=title, body=body, link=link, refs={"orderIds": order_ids}, created_at=at))


def _out(db: Session, user: CurrentUser, orders: list[om.Order]) -> list[s.OrderOut]:
    outlet = views.outlet_of(db, user)
    db.flush()
    facts = views.load_facts(db, outlet, orders)
    return [views.order_out(o, facts) for o in orders]


# ---- orders ---------------------------------------------------------------------------


def place(db: Session, user: CurrentUser, body: s.PlaceOrdersIn) -> list[s.OrderOut]:
    """Chilled and dry together: every line is accepted or none is. The day an order counts for is the server's (R-CUTOFF)."""
    outlet = views.outlet_of(db, user)
    now = clock.now(db)
    ops = repo.operating_days(db)
    service = service_day_for(now.replace(tzinfo=None), ops)
    placed: list[om.Order] = []
    taken: set[str] = set()
    kinds: set[Temp] = set()
    for line in body.orders:
        require_outlet(user, line.outlet_id)
        if line.line.kind in kinds:
            raise ApiError(409, "duplicate_kind", f"One {line.line.kind.value} order per day. Put the units on a single line.")
        kinds.add(line.line.kind)
        # An order can be placed for a later operating day than the next one; never for one that has already closed.
        day = line.delivery_date if line.delivery_date in ops and line.delivery_date >= service.service_date else service.service_date
        existing = db.scalar(
            select(om.Order.id).where(om.Order.outlet_id == outlet.id, om.Order.service_date == day, om.Order.temp == line.line.kind, om.Order.cancelled_at.is_(None))
        )
        if existing is not None:
            raise ApiError(409, "already_ordered", f"{existing} already covers {line.line.kind.value} for {day_label(day)}. Edit it instead.")
        after = service.after_cutoff and day == service.service_date
        order_id = _next_id(db, line.line.kind, taken)
        taken.add(order_id)
        order = om.Order(
            id=order_id, outlet_id=outlet.id, service_date=day, temp=line.line.kind, units=line.line.units,
            weight_kg=line.line.estimated_kg, volume_m3=line.line.estimated_m3, status=ServerStatus.ORDERED,
            tags=["After cutoff"] if after else [], received_at=now, placed_by=user.display_name, after_cutoff=after, row_version=1,
        )
        db.add(order)
        db.flush()
        audit.record(
            db, actor=user.display_name, entity_type="order", entity_id=order.id, type=AuditType.ORDER_PLACED,
            payload={"units": order.units, "temp": order.temp.value, "serviceDate": day.isoformat(), "afterCutoff": after}, at=now,
        )
        placed.append(order)
    by_day: dict[date, list[om.Order]] = {}
    for o in placed:
        by_day.setdefault(o.service_date, []).append(o)
    for day, rows in by_day.items():
        phrase = " and ".join(f"{o.id} ({'chilled' if o.temp is Temp.CHILLED else 'dry'}, {o.units} units)" for o in sorted(rows, key=views.kind_order))
        closes = repo.cutoff_at(day, ops)
        editable = f" You can edit until {closes:%H:%M}." if now.replace(tzinfo=None) < closes else ""
        _notice(db, outlet.id, NoticeTag.ORDER, "Order received", f"{phrase} count for {day_label(day)}.{editable}", link={"screen": "orders"}, order_ids=[o.id for o in rows], at=now)
    db.flush()
    return _out(db, user, sorted(placed, key=views.kind_order))


def _require_editable(db: Session, order: om.Order) -> datetime:
    now = clock.now(db)
    closes = repo.cutoff_at(order.service_date, repo.operating_days(db))
    if views.status_of(order) is not OrderStatus.ORDERED or now.replace(tzinfo=None) >= closes:
        raise ApiError(409, "past_cutoff", f"{order.id} is past the {closes:%H:%M} cutoff and can no longer be edited or cancelled.", {"rule": "R-EDIT"})
    return now


def edit(db: Session, user: CurrentUser, order_id: str, body: s.EditOrderIn) -> s.OrderOut:
    order = _order(db, user, order_id)
    now = _require_editable(db, order)
    before = {"units": order.units, "kg": order.weight_kg, "m3": order.volume_m3}
    order.units, order.weight_kg, order.volume_m3 = body.units, body.estimated_kg, body.estimated_m3
    audit.record(
        db, actor=user.display_name, entity_type="order", entity_id=order.id, type=AuditType.ORDER_EDITED,
        payload={"before": before, "after": {"units": order.units, "kg": order.weight_kg, "m3": order.volume_m3}}, at=now,
    )
    return _out(db, user, [order])[0]


def cancel(db: Session, user: CurrentUser, order_id: str) -> None:
    order = _order(db, user, order_id)
    _require_editable(db, order)
    order_service.apply(db, order, OrderEvent.CANCEL, actor=user.display_name, commit=False)


# ---- deferral, review, receipt --------------------------------------------------------


def _read(db: Session, outlet_id: str, now: datetime, *, tag: NoticeTag | None = None, order_ids: list[str] | None = None, conflict_id: int | None = None) -> None:
    """Mark the store's matching notices read: acting on a notice is reading it."""
    for n in db.scalars(select(Notice).where(Notice.audience == f"store:{outlet_id}", Notice.read_at.is_(None))):
        refs = n.refs or {}
        if tag is not None and n.tag is not tag:
            continue
        if order_ids is not None and not set(order_ids) & set(refs.get("orderIds", [])):
            continue
        if conflict_id is not None and refs.get("conflictId") != conflict_id:
            continue
        n.read_at = now


def acknowledge_deferral(db: Session, user: CurrentUser, deferral_id: int) -> None:
    deferral = db.get(om.Deferral, deferral_id)
    order = db.get(om.Order, deferral.order_id) if deferral else None
    if deferral is None or order is None:
        raise not_found(f"Deferral {deferral_id}")
    require_outlet(user, order.outlet_id)
    now = clock.now(db)
    # Got it is for the delivery day: every order of the stop that was deferred is read together.
    day = views.orders_of(db, order.outlet_id, on=order.service_date)
    ids = [o.id for o in day]
    for row in db.scalars(select(om.Deferral).where(om.Deferral.order_id.in_(ids), om.Deferral.withdrawn_at.is_(None))):
        if row.notice_seen_at is None:
            row.notice_seen_at = now
            audit.record(db, actor=user.display_name, entity_type="order", entity_id=row.order_id, type=AuditType.NOTICE_SEEN, payload={"deferral": row.id}, at=now)
    _read(db, order.outlet_id, now, tag=NoticeTag.DEFERRAL, order_ids=ids)


def answer_received(db: Session, user: CurrentUser, conflict_id: int) -> None:
    """The store says it received the delivery. Dispatch still decides; the answer is recorded for it to see (D7)."""
    conflict = db.get(f.Conflict, conflict_id)
    first = db.get(om.Order, conflict.order_ids[0]) if conflict and conflict.order_ids else None
    if conflict is None or first is None:
        raise not_found(f"Review {conflict_id}")
    require_outlet(user, first.outlet_id)
    if conflict.status is ConflictStatus.RESOLVED:
        return  # Dispatch settled it first: the answer changes nothing
    now = clock.now(db)
    conflict.server_snapshot = {
        **(conflict.server_snapshot or {}),
        "storeReport": {"orderId": first.id, "unitsReceived": first.units, "unitsOrdered": first.units, "by": user.display_name, "at": now.isoformat()},
    }
    audit.record(
        db, actor=user.display_name, entity_type="conflict", entity_id=str(conflict.id), type=AuditType.CONFLICT_OPENED,
        payload={"event": "store_answer", "answer": "received", "orderIds": list(conflict.order_ids)}, at=now,
    )
    _read(db, first.outlet_id, now, tag=NoticeTag.REVIEW, conflict_id=conflict.id)


def _device_time(now: datetime, text: str | None) -> datetime:
    """``HH:MM`` on the phone when the button was pressed (a receipt saved offline), else now."""
    if not text:
        return now
    try:
        hh, mm = (int(x) for x in text.split(":"))
        return datetime.combine(now.date(), time(hh, mm), tzinfo=COLOMBO)
    except ValueError:
        return now


def confirm_receipt(db: Session, user: CurrentUser, body: s.ConfirmReceiptIn) -> s.DeliveryOut:
    """S3.1: record what arrived. Fewer units than ordered makes the order Partial. 409 when nothing has been delivered."""
    outlet = views.outlet_of(db, user)
    orders = {o.id: o for o in views.orders_of(db, outlet.id, on=body.date)}
    if not orders:
        raise not_found(f"A delivery on {body.date}")
    now = clock.now(db)
    at = _device_time(now, body.device_time)
    seen: set[str] = set()
    for line in body.lines:
        order = orders.get(line.order_id)
        if order is None:
            raise not_found(f"Order {line.order_id} on {body.date}")
        if line.order_id in seen:
            raise ApiError(422, "duplicate_line", f"{line.order_id} is counted twice.")
        seen.add(line.order_id)
        if line.received > order.units:
            raise ApiError(422, "too_many", f"{order.id} was ordered as {order.units} units, so {line.received} can't have been received.")
        if views.status_of(order) not in views.DELIVERED_LIKE:
            raise ApiError(409, "not_delivered", f"{order.id} has not been delivered yet, so there is nothing to confirm.")

    reason = (body.reason or "").strip() or None
    for line in body.lines:
        order = orders[line.order_id]
        short = line.received < order.units
        receipt = db.get(f.Receipt, order.id)
        if receipt is None:
            db.add(f.Receipt(order_id=order.id, units_received=line.received, shortfall_reason=reason if short else None, confirmed_at=at, confirmed_by=user.display_name))
        else:
            receipt.units_received, receipt.shortfall_reason = line.received, reason if short else None
            receipt.confirmed_at, receipt.confirmed_by = at, user.display_name
        payload = {"unitsReceived": line.received, "unitsOrdered": order.units, "reason": reason if short else None}
        if short and views.status_of(order) is OrderStatus.DELIVERED:
            order_service.apply(db, order, OrderEvent.SHORTFALL, actor=user.display_name, commit=False, payload=payload)
        else:
            audit.record(db, actor=user.display_name, entity_type="order", entity_id=order.id, type=AuditType.RECEIPT_CONFIRMED, payload={"event": "receipt", **payload}, at=now)
    db.flush()
    delivered = views.deliveries(db, user, from_=None, to=None, on=body.date)
    return delivered[0]


def report_issue(db: Session, user: CurrentUser, body: s.ReportIssueIn) -> s.IssueOut:
    """S3.3: a problem tied to the proof of delivery. Dispatch is told at once."""
    outlet = views.outlet_of(db, user)
    if body.type not in REPORTABLE:
        raise ApiError(422, "unknown_issue_type", f"{body.type!r} is not a problem a store can report.", sorted(REPORTABLE))
    orders = {o.id: o for o in views.orders_of(db, outlet.id, on=body.date)}
    now = clock.now(db)
    short: dict[str, int] = {}
    for line in body.lines:
        order = orders.get(line.order_id)
        if order is None:
            raise not_found(f"Order {line.order_id} on {body.date}")
        if line.units > order.units:
            raise ApiError(422, "too_many", f"{order.id} has {order.units} units, so {line.units} can't be affected.")
        if views.status_of(order) not in views.DELIVERED_LIKE:
            raise ApiError(409, "not_delivered", f"{order.id} has not been delivered yet, so there is nothing to report.")
        short[order.id] = line.units
    exception = f.FieldException(
        kind=ExceptionKind.STORE_ISSUE, type=body.type, vehicle_id=None, trip_id=None, order_ids=list(short), units_short=short,
        detail=(body.note or "").strip() or None, raised_by=user.display_name, raised_at=now, device_time=None, status=ExceptionStatus.OPEN,
    )
    db.add(exception)
    db.flush()
    audit.record(
        db, actor=user.display_name, entity_type="exception", entity_id=str(exception.id), type=AuditType.ISSUE_REPORTED,
        payload={"type": body.type, "orderIds": list(short), "photo": body.photo, "outletId": outlet.id, "date": body.date.isoformat()}, at=now,
    )
    for oid in short:
        if views.status_of(orders[oid]) is OrderStatus.DELIVERED:
            order_service.apply(db, orders[oid], OrderEvent.FAIL, actor=user.display_name, commit=False, payload={"issue": body.type, "exception": exception.id})
    db.add(
        Notice(
            audience="dispatch", tag=NoticeTag.CHANGE, title=f"{outlet.id}: {body.type} reported",
            body=exception.detail or f"{outlet.id} reported a problem with {' + '.join(short)}.",
            link={"screen": "exception", "exceptionId": exception.id}, refs={"exceptionId": exception.id, "orderIds": list(short)}, created_at=now,
        )
    )
    db.flush()
    facts = views.load_facts(db, outlet, views.orders_of(db, outlet.id, on=body.date))
    return views.issue_out(exception, facts)


def mark_all_read(db: Session, user: CurrentUser) -> None:
    outlet = views.outlet_of(db, user)
    _read(db, outlet.id, clock.now(db))
