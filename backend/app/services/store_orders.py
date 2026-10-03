"""The store's own orders: the S1 form, placing, editing and cancelling (PRD §3 S1, §4b, §19).

Two things are never taken from the request. The outlet comes from the token, because a store account may only
act for its own outlet. The service date comes from the scenario clock through ``waypoint_rules.schedule``,
because a tab left open across the 16:00 cutoff would otherwise book yesterday's run; a body that disagrees
with the server is refused rather than quietly corrected.

The rules themselves (which run an order counts for, when it stops being editable) live in ``waypoint_rules``.
This module reads the day, writes the rows with their audit trail and the store's notice, and projects what
the S1 screens read back.
"""

from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy.orm import Session

from waypoint_rules import OrderEvent
from waypoint_rules.schedule import ServiceDay, service_day_for
from waypoint_rules.vocab import DockType, OrderStatus, Temp

from .. import clock
from ..deps import CurrentUser, require_outlet
from ..errors import ApiError, forbidden, not_found
from ..models import reference
from ..models.comms import Notice
from ..models.enums import AuditType, NoticeTag, ServerStatus
from ..models.orders import Order
from ..schemas.common import Window
from ..schemas.store import (
    EditOrderIn,
    OrderDraftOut,
    OrderLineOut,
    OrderOut,
    PlaceOrdersIn,
    UnitFactor,
)
from . import audit, store_repo
from . import orders as order_service
from . import planning_repo as repo
from .dispatcher_views import DOCK_LABEL, day_label

#: Kg and m3 per unit when the outlet carries no figures of its own (PRD A14, A42): the hero order's
#: 70 kg and 0.7 m3 over 12 chilled units, 45 kg and 0.6 m3 over 8 dry ones. Not rounded: the screens round.
FALLBACK_FACTORS: dict[Temp, tuple[float, float]] = {
    Temp.CHILLED: (70 / 12, 0.7 / 12),
    Temp.AMBIENT: (45 / 8, 0.6 / 8),
}

#: What the form opens with when the outlet has never ordered that temperature.
FALLBACK_UNITS: dict[Temp, int] = {Temp.CHILLED: 12, Temp.AMBIENT: 8}

#: How a store says each temperature. Ambient is "dry" everywhere the store can see (PRD §3 S1).
STORE_TEMP: dict[Temp, str] = {Temp.CHILLED: "chilled", Temp.AMBIENT: "dry"}


# ---- the outlet behind the token --------------------------------------------


def outlet_of(db: Session, user: CurrentUser) -> reference.Outlet:
    """The outlet the signed-in store account acts for. Never the one a request asked for."""
    if user.outlet_id is None:
        raise forbidden("Your account isn't linked to an outlet")
    row = store_repo.outlet(db, user.outlet_id)
    if row is None:
        raise not_found(f"Outlet {user.outlet_id}")
    return row


def _window(outlet: reference.Outlet) -> Window:
    """The window the store is told to expect. A mall bay keeps the mall's hours, not the outlet's own."""
    if outlet.dock_type is DockType.MALL_BAY and outlet.mall_window_open is not None and outlet.mall_window_close is not None:
        return Window(start=_hhmm(outlet.mall_window_open), end=_hhmm(outlet.mall_window_close))
    return Window(start=_hhmm(outlet.window_open), end=_hhmm(outlet.window_close))


def _hhmm(value: time) -> str:
    return f"{value:%H:%M}"


# ---- the projection every one of these routes returns -----------------------


def order_out(order: Order, outlet: reference.Outlet, updated_at: datetime | None = None) -> OrderOut:
    """One order as the store's screens read it.

    ``receivedAt`` and ``updatedAt`` are naive local times with no offset. The screens format them with the
    browser's own date functions, so an offset would show the Colombo delivery morning at a visitor's hour.
    ``arrival`` and ``deferral`` belong to the deliveries view and stay empty here.
    """
    received = repo.naive(order.received_at)
    return OrderOut(
        id=order.id,
        outlet_id=order.outlet_id,
        outlet_name=outlet.name or outlet.id,
        district=outlet.district,
        delivery_date=order.service_date,
        dock=DOCK_LABEL[outlet.dock_type],
        window=_window(outlet),
        line=OrderLineOut(
            id=f"{order.id}-L1",
            kind=order.temp,
            units=order.units,
            estimated_kg=order.weight_kg,
            estimated_m3=order.volume_m3,
        ),
        status=OrderStatus(order.status.value),
        received_at=received.isoformat() if received is not None else "",
        updated_at=updated_at.isoformat() if updated_at is not None else None,
        after_cutoff=order.after_cutoff,
    )


def _orders_out(db: Session, rows: list[Order], outlet: reference.Outlet) -> list[OrderOut]:
    edits = store_repo.edited_at(db, [r.id for r in rows])
    return [order_out(r, outlet, edits.get(r.id)) for r in rows]


# ---- S1: the order form -----------------------------------------------------


def draft(db: Session, user: CurrentUser, target: date | None) -> OrderDraftOut:
    """The S1 form for one day: the run an order placed now counts for, unless the screen asked for another."""
    outlet = outlet_of(db, user)
    now = clock.now(db).replace(tzinfo=None)
    ops = repo.operating_days(db)
    sd = service_day_for(now, ops)
    day = target or sd.service_date
    last = store_repo.last_units(db, outlet.id)
    return OrderDraftOut(
        outlet_id=outlet.id,
        delivery_date=day,
        after_cutoff=sd.after_cutoff if day == sd.service_date else False,
        window=_window(outlet),
        dock=DOCK_LABEL[outlet.dock_type],
        unit_factors=_unit_factors(outlet),
        default_units={temp: last.get(temp, FALLBACK_UNITS[temp]) for temp in FALLBACK_UNITS},
        orders=_orders_out(db, store_repo.orders_for_day(db, outlet.id, day), outlet),
    )


def _unit_factors(outlet: reference.Outlet) -> dict[Temp, UnitFactor]:
    """Both temperatures, always: the form cannot draw an estimate for a kind it has no factor for."""
    out: dict[Temp, UnitFactor] = {}
    for temp, (kg, m3) in FALLBACK_FACTORS.items():
        out[temp] = UnitFactor(
            kg=outlet.units_to_kg if outlet.units_to_kg is not None else kg,
            m3=outlet.units_to_m3 if outlet.units_to_m3 is not None else m3,
        )
    return out


# ---- S1: placing ------------------------------------------------------------


def place(db: Session, user: CurrentUser, body: PlaceOrdersIn) -> list[OrderOut]:
    """Chilled and dry together: every line is stored or none is, under one notice to the store."""
    outlet = outlet_of(db, user)
    now = clock.now(db).replace(tzinfo=None)
    ops = repo.operating_days(db)
    sd = service_day_for(now, ops)
    for line in body.orders:
        require_outlet(user, line.outlet_id)
        if line.delivery_date != sd.service_date:
            raise ApiError(
                409,
                "service_date_moved",
                f"Orders placed now count for {day_label(sd.service_date)}. Open the form again and place them.",
                {"deliveryDate": line.delivery_date.isoformat(), "serviceDate": sd.service_date.isoformat()},
            )

    store_repo.lock_order_ids(db)
    ids = _free_ids(db, len(body.orders))
    rows: list[Order] = []
    for order_id, line in zip(ids, body.orders, strict=True):
        row = Order(
            id=order_id,
            outlet_id=outlet.id,
            service_date=sd.service_date,
            temp=line.line.kind,
            units=line.line.units,
            weight_kg=line.line.estimated_kg,
            volume_m3=line.line.estimated_m3,
            status=ServerStatus.ORDERED,
            tags=[],
            received_at=repo.aware(now),
            placed_by=user.display_name,
            after_cutoff=sd.after_cutoff,
        )
        db.add(row)
        rows.append(row)
        audit.record(
            db,
            actor=user.email,
            entity_type="order",
            entity_id=order_id,
            type=AuditType.ORDER_PLACED,
            payload={
                "event": "place",
                "outletId": outlet.id,
                "serviceDate": sd.service_date.isoformat(),
                "temp": line.line.kind.value,
                "units": line.line.units,
                "afterCutoff": sd.after_cutoff,
            },
            at=repo.aware(now),
        )
    db.add(_received_notice(outlet.id, rows, sd, now))
    db.commit()
    return [order_out(row, outlet) for row in rows]


def _free_ids(db: Session, count: int) -> list[str]:
    """The lowest unused ids in the store-placed range, so the judge's first placement is ORD2001 and ORD2002."""
    taken = store_repo.taken_order_numbers(db)
    out: list[str] = []
    number = store_repo.FIRST_ORDER_NUMBER
    while len(out) < count:
        if number > store_repo.LAST_ORDER_NUMBER:
            raise ApiError(409, "order_ids_exhausted", "The store order range is full. Dispatch has to free one.")
        if number not in taken:
            out.append(f"ORD{number}")
        number += 1
    return out


def _received_notice(outlet_id: str, rows: list[Order], sd: ServiceDay, now: datetime) -> Notice:
    """The S4 feed row the store sees straight after placing (PRD §3 S4)."""
    phrases = [f"{r.id} ({STORE_TEMP[r.temp]}, {_units(r.units)})" for r in rows]
    editable = "" if now >= sd.editable_until else f" You can edit until {sd.editable_until:%H:%M}."
    return Notice(
        audience=f"store:{outlet_id}",
        tag=NoticeTag.ORDER,
        title="Order received",
        body=f"{_join(phrases)} count for {day_label(sd.service_date)}.{editable}",
        link={"screen": "orders"},
        refs={"orderIds": [r.id for r in rows]},
        created_at=repo.aware(now),
    )


def _units(units: int) -> str:
    return f"{units} unit" if units == 1 else f"{units} units"


def _join(parts: list[str]) -> str:
    """"A", "A and B", "A, B and C": how the store's notices list their orders."""
    if len(parts) <= 1:
        return "".join(parts)
    return f"{', '.join(parts[:-1])} and {parts[-1]}"


# ---- S1: editing and cancelling ---------------------------------------------


def _changeable(db: Session, user: CurrentUser, order_id: str) -> tuple[Order, reference.Outlet]:
    """The order the store may still change, or the reason it may not (R-EDIT).

    404 when there is no such order, or it is already cancelled; 403 when it belongs to another outlet;
    409 once the cutoff has passed or the run has moved on. The screens read a 409 on these two routes as
    "past the cutoff", so nothing else here may answer with one.
    """
    outlet = outlet_of(db, user)
    order = store_repo.order(db, order_id)
    if order is None or order.cancelled_at is not None:
        raise not_found(f"Order {order_id}")
    require_outlet(user, order.outlet_id)
    now = clock.now(db).replace(tzinfo=None)
    ops = repo.operating_days(db)
    if order.status is not ServerStatus.ORDERED or now >= repo.cutoff_at(order.service_date, ops):
        raise ApiError(
            409,
            "past_cutoff",
            f"{order_id} can no longer be changed: the {day_label(order.service_date)} run has closed.",
            {"orderId": order_id, "status": order.status.value},
        )
    return order, outlet


def edit(db: Session, user: CurrentUser, order_id: str, body: EditOrderIn) -> OrderOut:
    """A new quantity for an order still inside its cutoff. The audit row is also the ``updatedAt`` the store reads."""
    order, outlet = _changeable(db, user, order_id)
    now = clock.now(db).replace(tzinfo=None)
    before = {"units": order.units, "kg": order.weight_kg, "m3": order.volume_m3}
    order.units = body.units
    order.weight_kg = body.estimated_kg
    order.volume_m3 = body.estimated_m3
    audit.record(
        db,
        actor=user.email,
        entity_type="order",
        entity_id=order.id,
        type=AuditType.ORDER_EDITED,
        payload={
            "event": "edit",
            "from": before,
            "to": {"units": body.units, "kg": body.estimated_kg, "m3": body.estimated_m3},
        },
        at=repo.aware(now),
    )
    db.flush()
    db.commit()
    return order_out(order, outlet, now)


def cancel(db: Session, user: CurrentUser, order_id: str) -> None:
    """The store withdraws an order before the cutoff. ``services.orders`` sets the status and writes the audit row."""
    order, _ = _changeable(db, user, order_id)
    order_service.apply(db, order, OrderEvent.CANCEL, actor=user.email)
