"""Reads for the order queue and the history drawer: database rows in, plain values out."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from waypoint_rules.schedule import next_operating_day
from waypoint_rules.vocab import OrderStatus

from ..models import comms
from ..models import orders as order_models
from ..models.enums import AuditType
from . import planning_repo as repo
from .queue_model import AuditRow, HistoryInput, HistoryRun, QueueDay, QueueOrderRow

#: How many earlier runs the history drawer reads.
HISTORY_RUNS = 6


def _row(o: order_models.Order) -> QueueOrderRow:
    return QueueOrderRow(
        o.id, o.outlet_id, o.temp, o.units, o.weight_kg, o.volume_m3, OrderStatus(o.status.value),
        repo.naive(o.received_at), o.after_cutoff, o.service_date,
    )


def following_run(service_date: date, ops: list[date]) -> date:
    return next_operating_day(service_date, ops) if ops else service_date + timedelta(days=1)


def load_queue(db: Session, service_date: date, now: datetime, *, only: str | None = None) -> QueueDay:
    """The run's orders, plus the orders placed after the cutoff that move to the following run (shown with a tag).

    ``only`` loads a single order instead, for the history drawer.
    """
    ops = repo.operating_days(db)
    following = following_run(service_date, ops)
    query = select(order_models.Order).where(order_models.Order.cancelled_at.is_(None))
    if only is not None:
        query = query.where(order_models.Order.id == only)
    else:
        query = query.where(
            or_(
                order_models.Order.service_date == service_date,
                (order_models.Order.after_cutoff.is_(True)) & (order_models.Order.service_date == following),
            )
        )
    rows = [_row(o) for o in db.scalars(query.order_by(order_models.Order.id))]
    days, _ = repo.vehicle_days(db, service_date)
    return QueueDay(
        service_date=service_date,
        now=now,
        cutoff=repo.cutoff_at(service_date, ops),
        following_run=following,
        ref=repo.load_ref(db),
        outlets=repo.outlet_rows(db),
        rows=rows,
        history=repo.outlet_history(db, service_date, ops),
        vehicle_days=days,
    )


def _event_of(a: comms.AuditEvent) -> str:
    if a.type is AuditType.RECEIPT_CONFIRMED:
        return "receipt"
    return str((a.payload or {}).get("event") or a.type.value.lower())


def load_history(db: Session, order_id: str) -> HistoryInput:
    """What the drawer adds to the queue row: the audit trail, the outlet's earlier runs and the order's deferral."""
    order = db.get(order_models.Order, order_id)
    if order is None:
        return HistoryInput(order_id)
    audit = [
        AuditRow(repo.naive(a.at) or a.at, a.actor, _event_of(a))
        for a in db.scalars(
            select(comms.AuditEvent)
            .where(comms.AuditEvent.order_id == order_id)
            .order_by(comms.AuditEvent.at, comms.AuditEvent.id)
        )
    ]
    runs = [
        HistoryRun(h.service_date, h.outcome.value)
        for h in db.scalars(
            select(order_models.OutletServiceHistory)
            .where(
                order_models.OutletServiceHistory.outlet_id == order.outlet_id,
                order_models.OutletServiceHistory.service_date < order.service_date,
            )
            .order_by(order_models.OutletServiceHistory.service_date.desc())
            .limit(HISTORY_RUNS)
        )
    ]
    deferral_row = db.scalars(
        select(order_models.Deferral)
        .where(order_models.Deferral.order_id == order_id, order_models.Deferral.withdrawn_at.is_(None))
        .order_by(order_models.Deferral.id.desc())
        .limit(1)
    ).first()
    deferral = None
    if deferral_row is not None and deferral_row.plan_version_id is not None:
        deferral = next((d for d in repo.deferrals_of(db, deferral_row.plan_version_id) if d.order_id == order_id), None)
    return HistoryInput(order_id, audit, runs, deferral)
