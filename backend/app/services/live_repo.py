"""Reads for the live board and the reconciliation screen: database rows in, plain values out."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules.vocab import OrderStatus

from ..models import comms, field, plans
from ..models import orders as order_models
from ..models.enums import AuditType, DeviceRecordType, PlanState, SyncResultKind
from . import planning_repo as repo
from .exceptions import row_of
from .live_model import ConflictRow, LiveDay, RunRow


def conflict_row(c: field.Conflict) -> ConflictRow:
    return ConflictRow(
        c.id,
        tuple(c.order_ids or ()),
        dict(c.server_snapshot or {}),
        dict(c.device_snapshot or {}),
        c.recommendation,
        tuple(c.reasons or ()),
        c.status,
        c.resolution,
        c.resolved_by,
        repo.naive(c.resolved_at),
    )


def _sync_note(db: Session, vehicle_id: str, heard: datetime | None) -> str | None:
    """"5 synced · 1 conflict": what the sync that last spoke to this vehicle did."""
    if heard is None:
        return None
    records = list(
        db.scalars(
            select(field.DeviceRecord).where(field.DeviceRecord.vehicle_id == vehicle_id, field.DeviceRecord.received_at == repo.aware(heard))
        )
    )
    if not records:
        return None
    synced = sum(1 for r in records if r.result in (SyncResultKind.ACCEPTED, SyncResultKind.DUPLICATE))
    # Two records for one stop are one conflict: count the conflicts, not the records that carry them.
    conflicts = len({r.conflict_id if r.conflict_id is not None else r.client_id for r in records if r.result is SyncResultKind.CONFLICT})
    parts = [f"{synced} synced"] + ([f"{conflicts} conflict" + ("s" if conflicts != 1 else "")] if conflicts else [])
    return " · ".join(parts)


def load_live(db: Session, service_date: date, now: datetime) -> LiveDay:
    """The run as the live board sees it: the latest plan, each order's status, the runs, the open flags and conflicts."""
    day = repo.load_day(db, service_date, now)
    versions = repo.versions_of(db, service_date)
    number_of = {v.id: v.number for v in versions}
    live = LiveDay(day=day)
    live.trips_by_version = {v.number: repo.trips_of(db, v.id) for v in versions}
    released = [v.number for v in versions if v.state is PlanState.RELEASED]
    live.released_number = max(released) if released else None

    order_ids = set(day.orders)
    for o in db.scalars(select(order_models.Order).where(order_models.Order.service_date == service_date, order_models.Order.cancelled_at.is_(None))):
        live.status[o.id] = OrderStatus(o.status.value)

    for a in db.scalars(
        select(comms.AuditEvent)
        .where(comms.AuditEvent.type == AuditType.OUTCOME_RECORDED, comms.AuditEvent.order_id.in_(order_ids or {""}))
        .order_by(comms.AuditEvent.at, comms.AuditEvent.id)
    ):
        live.outcome_at[a.entity_id] = repo.naive(a.at) or a.at
    for r in db.scalars(select(field.Receipt).where(field.Receipt.order_id.in_(order_ids or {""}))):
        live.receipt_at[r.order_id] = repo.naive(r.confirmed_at) or r.confirmed_at

    for rec in db.scalars(select(field.DeviceRecord).where(field.DeviceRecord.type == DeviceRecordType.DRIVER_ARRIVAL)):
        if rec.vehicle_id and rec.outlet_id and rec.device_time:
            live.arrivals[(rec.vehicle_id, rec.outlet_id)] = repo.naive(rec.device_time) or rec.device_time

    trip_no_of = {t.id: t.trip_no for t in db.scalars(select(plans.Trip).where(plans.Trip.plan_version_id.in_(list(number_of) or [0])))}
    for run in db.scalars(select(field.Run).where(field.Run.trip_id.in_(list(trip_no_of) or [0])).order_by(field.Run.id)):
        heard = repo.naive(run.last_heard_at)
        live.runs[(run.vehicle_id, trip_no_of[run.trip_id])] = RunRow(
            run.vehicle_id,
            trip_no_of[run.trip_id],
            repo.naive(run.departed_at),
            repo.naive(run.finished_at),
            heard,
            number_of.get(run.plan_version_seen) if run.plan_version_seen is not None else None,
            _sync_note(db, run.vehicle_id, heard),
        )

    for a in db.scalars(select(plans.Acknowledgement).where(plans.Acknowledgement.plan_version_id.in_(list(number_of) or [0]))):
        if a.driver_vehicle_id:
            live.acknowledged[a.driver_vehicle_id] = max(live.acknowledged.get(a.driver_vehicle_id, 0), number_of[a.plan_version_id])

    for check, trip in db.execute(
        select(plans.LoadCheck, plans.Trip)
        .join(plans.Trip, plans.Trip.id == plans.LoadCheck.trip_id)
        .where(plans.Trip.plan_version_id.in_(list(number_of) or [0]))
        .order_by(plans.LoadCheck.checked_at)
    ):
        short = max(check.units_expected - check.units_loaded, 0)
        counts = live.short_loaded.setdefault((trip.vehicle_id, trip.trip_no), {})
        if short > 0:
            counts[check.order_id] = short
        else:
            counts.pop(check.order_id, None)  # a recount that came out right clears the earlier one

    for e in db.scalars(select(field.FieldException).order_by(field.FieldException.id)):
        live.exceptions.append(row_of(e))
    for c in db.scalars(select(field.Conflict).order_by(field.Conflict.id)):
        if set(c.order_ids or ()) & order_ids:
            live.conflicts.append(conflict_row(c))

    return live
