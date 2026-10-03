"""Reads for the store's own orders: database rows in, plain values out.

A store sees far less than the dispatcher does, so this stays apart from ``planning_repo``: one outlet, that
outlet's orders for one day, the quantities it ordered last, and which ids in the store-placed range are taken.
Times come back naive Asia/Colombo, which is what the rest of the backend works in.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from waypoint_rules.vocab import Temp

from ..models import comms, reference
from ..models import orders as order_models
from ..models.enums import AuditType
from . import planning_repo as repo

#: Store-placed orders live in ``ORD2nnn``. The seed holds ORD2001 and ORD2002 open for the judge's own
#: placement and starts its generated orders at ORD3001, but the pinned queue rows take ORD2003 upwards, so
#: the free number is always read from the live table rather than assumed.
ORDER_ID_PREFIX = "ORD2"
FIRST_ORDER_NUMBER = 2001
LAST_ORDER_NUMBER = 2999

#: One advisory lock for the whole range, held until the placing transaction ends. Two tills placing at the
#: same moment would otherwise read the same free id and the second insert would fail on the primary key.
_ID_LOCK_KEY = 2001


def outlet(db: Session, outlet_id: str) -> reference.Outlet | None:
    return db.get(reference.Outlet, outlet_id)


def order(db: Session, order_id: str) -> order_models.Order | None:
    return db.get(order_models.Order, order_id)


def orders_for_day(db: Session, outlet_id: str, service_date: date) -> list[order_models.Order]:
    """The outlet's orders for one run, cancelled ones left out, in id order."""
    return list(
        db.scalars(
            select(order_models.Order)
            .where(
                order_models.Order.outlet_id == outlet_id,
                order_models.Order.service_date == service_date,
                order_models.Order.cancelled_at.is_(None),
            )
            .order_by(order_models.Order.id)
        )
    )


def last_units(db: Session, outlet_id: str) -> dict[Temp, int]:
    """The units on the outlet's most recent order of each temperature, so the form opens where it left off."""
    out: dict[Temp, int] = {}
    for temp in (Temp.CHILLED, Temp.AMBIENT):
        row = db.scalars(
            select(order_models.Order)
            .where(
                order_models.Order.outlet_id == outlet_id,
                order_models.Order.temp == temp,
                order_models.Order.cancelled_at.is_(None),
            )
            .order_by(order_models.Order.received_at.desc().nulls_last(), order_models.Order.id.desc())
            .limit(1)
        ).first()
        if row is not None:
            out[temp] = row.units
    return out


def edited_at(db: Session, order_ids: Sequence[str]) -> dict[str, datetime]:
    """When each order was last edited. There is no column for it, so the audit trail is the record."""
    if not order_ids:
        return {}
    rows = db.scalars(
        select(comms.AuditEvent)
        .where(
            comms.AuditEvent.entity_type == "order",
            comms.AuditEvent.entity_id.in_(list(order_ids)),
            comms.AuditEvent.type == AuditType.ORDER_EDITED,
        )
        .order_by(comms.AuditEvent.at, comms.AuditEvent.id)
    )
    out: dict[str, datetime] = {}
    for row in rows:
        at = repo.naive(row.at)
        if at is not None:
            out[row.entity_id] = at
    return out


def lock_order_ids(db: Session) -> None:
    """Hold the store-placed id range for the rest of this transaction."""
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _ID_LOCK_KEY})


def taken_order_numbers(db: Session) -> set[int]:
    """The numbers already used in the store-placed range, cancelled orders included: an id is never reused."""
    taken: set[int] = set()
    for order_id in db.scalars(select(order_models.Order.id).where(order_models.Order.id.like(f"{ORDER_ID_PREFIX}%"))):
        suffix = order_id[len("ORD") :]
        if suffix.isdigit():
            taken.add(int(suffix))
    return taken
