"""The notices a store is sent as its orders move: plan released, loaded, on the way, delivered (S4 "Order", "Plan", "Delivery").

Written at the moment each thing happens, in the same transaction as the change, so the updates feed is the record of what
the store was told and when. Callers commit.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import orders as om
from ..models import plans, reference
from ..models.comms import Notice
from ..models.enums import NoticeTag
from . import planning_repo as repo


def tell(db: Session, outlet_id: str, tag: NoticeTag, title: str, body: str, *, day: date, order_ids: list[str], at: datetime) -> None:
    db.add(
        Notice(
            audience=f"store:{outlet_id}", tag=tag, title=title, body=body,
            link={"screen": "delivery", "date": day.isoformat()}, refs={"orderIds": order_ids}, created_at=at,
        )
    )


def _by_outlet(orders: list[om.Order]) -> dict[str, list[om.Order]]:
    grouped: dict[str, list[om.Order]] = defaultdict(list)
    for o in sorted(orders, key=lambda o: o.id):
        grouped[o.outlet_id].append(o)
    return grouped


def arrival_set(db: Session, version: plans.PlanVersion, at: datetime) -> None:
    """The plan is out: each store with orders on a trip is told when to expect the truck."""
    rows = db.execute(
        select(plans.TripOrder, om.Order, reference.Outlet)
        .join(plans.Trip, plans.Trip.id == plans.TripOrder.trip_id)
        .join(om.Order, om.Order.id == plans.TripOrder.order_id)
        .join(reference.Outlet, reference.Outlet.id == om.Order.outlet_id)
        .where(plans.Trip.plan_version_id == version.id)
    ).all()
    seen: dict[str, tuple[reference.Outlet, list[str], datetime | None]] = {}
    for to, order, outlet in rows:
        _, ids, first = seen.get(outlet.id, (outlet, [], None))
        arrives = repo.naive(to.planned_arrival)
        seen[outlet.id] = (outlet, [*ids, order.id], min(x for x in (first, arrives) if x is not None) if (first or arrives) else None)
    for outlet_id, (outlet, ids, arrives) in sorted(seen.items()):
        opens = f"{outlet.window_open:%H:%M}"
        shown = f"{arrives:%H:%M}" if arrives else opens
        body = (
            f"Arrival from {opens} (truck may arrive {shown} and wait). Have receivers ready by {opens}."
            if shown < opens
            else f"Arrival about {shown}. Have receivers ready by {shown}."
        )
        tell(db, outlet_id, NoticeTag.PLAN, "Arrival time set", body, day=version.service_date, order_ids=sorted(ids), at=at)


def loaded(db: Session, orders: list[om.Order], vehicle_id: str, place: str, at: datetime) -> None:
    for outlet_id, rows in _by_outlet(orders).items():
        tell(db, outlet_id, NoticeTag.DELIVERY, "Loaded", f"Your orders are loaded on {vehicle_id} at {place}.", day=rows[0].service_date, order_ids=[o.id for o in rows], at=at)


def departed(db: Session, orders: list[om.Order], vehicle_id: str, left_at: datetime, at: datetime) -> None:
    for outlet_id, rows in _by_outlet(orders).items():
        outlet = db.get(reference.Outlet, outlet_id)
        opens = f", unloading from {outlet.window_open:%H:%M}" if outlet else ""
        tell(db, outlet_id, NoticeTag.DELIVERY, "On the way", f"{vehicle_id} left at {repo.naive(left_at):%H:%M}{opens}.", day=rows[0].service_date, order_ids=[o.id for o in rows], at=at)


def delivered(db: Session, order: om.Order, at: datetime, when: datetime | None) -> None:
    stamp = f" at {repo.naive(when):%H:%M}" if when else ""
    tell(db, order.outlet_id, NoticeTag.DELIVERY, "Delivered", f"{order.id} was delivered{stamp}. Please confirm what arrived.", day=order.service_date, order_ids=[order.id], at=at)
