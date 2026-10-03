"""``POST /sync``: device records from the outbox (PRD §15 Offline, §19 Sync and the reconciliation rule).

Records are applied in the order the device sent them, each in its own savepoint, so one bad record is answered ``error``
and the rest of the batch goes on. ``client_id`` is the idempotency key: a record the server already took is answered
``duplicate`` and changes nothing; a record that failed before is processed again, because the device retries errors.

Every record is kept in ``device_records``. What a record changes follows ``waypoint_rules.reconcile``; the rows it writes
are the ones the live board and the reconciliation screen read (``live_repo``, ``conflict_views``):

- one ``conflicts`` row per stop: two orders delivered at OUT084 after a deferral the phone never saw are
  "1 conflict (2 orders)", with the snapshots ``conflict_views`` documents;
- ``runs.last_heard_at`` equals the batch's ``device_records.received_at``, so the board can say what that sync did.

Callers commit.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules import DeviceRecord as RuleRecord
from waypoint_rules import OrderEvent, OrderStatus, Outcome, RecordType, ServerOrderState, SyncResult, reconcile
from waypoint_rules.vocab import Role

from .. import clock
from ..config import COLOMBO
from ..deps import CurrentUser, require_vehicle
from ..errors import ApiError, forbidden
from ..models import field as f
from ..models import orders as order_models
from ..models import plans
from ..models.comms import Notice
from ..models.enums import (
    ActorKind,
    AuditType,
    ConflictRecommendation,
    ConflictStatus,
    DeviceRecordType,
    ExceptionKind,
    ExceptionStatus,
    NoticeTag,
    PlanState,
    SyncResultKind,
)
from ..models.people import PinPerson
from ..schemas.sync import SyncIn, SyncOut, SyncRecordIn, SyncResultOut
from . import audit
from . import orders as order_service
from . import planning_repo as repo

log = logging.getLogger(__name__)

#: The driver app sends the outcome as the screen shows it (``DriverOutcome``); the rules speak snake_case.
OUTCOME_OF: dict[str, Outcome] = {
    "delivered": Outcome.DELIVERED,
    "damaged": Outcome.DAMAGED,
    "refused": Outcome.REFUSED,
    "store closed": Outcome.STORE_CLOSED,
    "store_closed": Outcome.STORE_CLOSED,
    "other": Outcome.OTHER,
}

OPEN_CONFLICT = (ConflictStatus.OPEN, ConflictStatus.AWAITING_STORE)


class Refused(Exception):
    """A record the server can't take as sent. Answered ``error`` with this message; the device retries it."""


@dataclass(slots=True)
class Batch:
    """One ``POST /sync``: who sent it, when it arrived, and what it touched."""

    user: CurrentUser
    device_id: str
    #: Scenario time, aware. Every record of the batch is received at this instant.
    now: datetime
    #: Runs a driver record reached, as (service date, vehicle, trip_no): their last-heard becomes ``now``.
    heard: set[tuple[date, str, int]] = field(default_factory=set)
    #: The newest plan version number a driver record said the phone holds.
    seen_version: int | None = None


@dataclass(slots=True)
class Answer:
    result: SyncResultKind
    reason: str | None = None
    conflict_id: int | None = None
    server_payload: dict[str, Any] | None = None


# ---- lookups ----------------------------------------------------------------------------------------------------


def _service_date(db: Session, b: Batch, payload: dict[str, Any]) -> date:
    """The run a record belongs to: the day the device names, else the scenario's active service date."""
    raw = payload.get("date")
    if isinstance(raw, str):
        try:
            return date.fromisoformat(raw)
        except ValueError:
            raise Refused(f"{raw} is not a date") from None
    return repo.active_service_date(b.now.replace(tzinfo=None), repo.operating_days(db))


def _version(db: Session, service_date: date, number: int | None) -> plans.PlanVersion | None:
    if number is None:
        return None
    return db.scalar(select(plans.PlanVersion).where(plans.PlanVersion.service_date == service_date, plans.PlanVersion.number == number))


def _latest_released(db: Session, service_date: date) -> plans.PlanVersion | None:
    return db.scalars(
        select(plans.PlanVersion)
        .where(plans.PlanVersion.service_date == service_date, plans.PlanVersion.state == PlanState.RELEASED)
        .order_by(plans.PlanVersion.number.desc())
        .limit(1)
    ).first()


def _trip_in(
    db: Session, version: plans.PlanVersion, vehicle_id: str, *, order_ids: list[str] | None, outlet_id: str | None, trip_no: int | None
) -> plans.Trip | None:
    query = select(plans.Trip).where(plans.Trip.plan_version_id == version.id, plans.Trip.vehicle_id == vehicle_id)
    if trip_no is not None:
        query = query.where(plans.Trip.trip_no == trip_no)
    if order_ids:
        query = query.join(plans.TripOrder, plans.TripOrder.trip_id == plans.Trip.id).where(plans.TripOrder.order_id.in_(order_ids))
    elif outlet_id is not None:
        query = (
            query.join(plans.TripOrder, plans.TripOrder.trip_id == plans.Trip.id)
            .join(order_models.Order, order_models.Order.id == plans.TripOrder.order_id)
            .where(order_models.Order.outlet_id == outlet_id)
        )
    return db.scalars(query.order_by(plans.Trip.trip_no).limit(1)).first()


def _trip(
    db: Session,
    service_date: date,
    vehicle_id: str,
    *,
    on_device: int | None,
    order_ids: list[str] | None = None,
    outlet_id: str | None = None,
    trip_no: int | None = None,
) -> plans.Trip | None:
    """The trip a record is about, in the plan version the device was on.

    A later version may have taken the stop off the trip (the 05:21 deferral removes ORD2001 + ORD2002 from v5), and the
    phone recorded it against the version it held. Only when that version has no such trip is the latest released one used.
    """
    tried: set[int] = set()
    for version in (_version(db, service_date, on_device), _latest_released(db, service_date)):
        if version is None or version.id in tried:
            continue
        tried.add(version.id)
        trip = _trip_in(db, version, vehicle_id, order_ids=order_ids, outlet_id=outlet_id, trip_no=trip_no)
        if trip is not None:
            return trip
    return None


def _run(db: Session, service_date: date, vehicle_id: str, trip_no: int) -> f.Run | None:
    """The run of one vehicle trip, whichever plan version's trip row it was started on."""
    return db.scalars(
        select(f.Run)
        .join(plans.Trip, plans.Trip.id == f.Run.trip_id)
        .join(plans.PlanVersion, plans.PlanVersion.id == plans.Trip.plan_version_id)
        .where(plans.Trip.vehicle_id == vehicle_id, plans.Trip.trip_no == trip_no, plans.PlanVersion.service_date == service_date)
        .order_by(f.Run.id.desc())
        .limit(1)
    ).first()


def _order(db: Session, order_id: object) -> order_models.Order:
    if not isinstance(order_id, str) or not order_id:
        raise Refused("The record names no order")
    order = db.get(order_models.Order, order_id)
    if order is None:
        raise Refused(f"Order {order_id} was not found")
    return order


def _pin(db: Session, person_id: object) -> int | None:
    """Resolve the tablet's numeric id or seeded name to a real PIN person."""
    try:
        key = int(str(person_id))
    except ValueError:
        return db.scalar(select(PinPerson.id).where(PinPerson.name == str(person_id)))
    person = db.get(PinPerson, key)
    return person.id if person is not None else None


def _status(order: order_models.Order) -> OrderStatus:
    return OrderStatus(order.status.value)


def _device_time(rec: SyncRecordIn) -> datetime:
    return rec.device_time if rec.device_time.tzinfo is not None else rec.device_time.replace(tzinfo=COLOMBO)


def _hm(value: datetime | None) -> str:
    return value.astimezone(COLOMBO).strftime("%H:%M") if value else ""


# ---- what each record does ---------------------------------------------------------------------------------------


def _driver_vehicle(b: Batch, payload: dict[str, Any]) -> str:
    if b.user.role is not Role.DRIVER:
        raise Refused("Driver records come from a driver's phone")
    vehicle = b.user.vehicle_id
    named = payload.get("vehicleId")
    if isinstance(named, str):
        require_vehicle(b.user, named)
        vehicle = vehicle or named
    if vehicle is None:
        raise Refused("This account has no vehicle")
    return vehicle


def _place(row: f.DeviceRecord, *, vehicle_id: str | None, trip: plans.Trip | None, outlet_id: str | None = None, order_ids: list[str] | None = None) -> None:
    row.vehicle_id = vehicle_id
    row.trip_id = trip.id if trip is not None else None
    row.outlet_id = outlet_id
    row.order_ids = list(order_ids or [])


def _heard(b: Batch, service_date: date, vehicle_id: str, trip: plans.Trip | None, on_device: int | None) -> None:
    if trip is not None:
        b.heard.add((service_date, vehicle_id, trip.trip_no))
    if on_device is not None:
        b.seen_version = max(b.seen_version or 0, on_device)


def _driver_ack(db: Session, b: Batch, rec: SyncRecordIn, row: f.DeviceRecord) -> Answer:
    vehicle = _driver_vehicle(b, rec.payload)
    service_date = _service_date(db, b, rec.payload)
    number = rec.payload.get("version", rec.plan_version_on_device)
    version = _version(db, service_date, number if isinstance(number, int) else None)
    if version is None:
        raise Refused(f"Plan v{number} was not found for {service_date}")
    trip = _trip(db, service_date, vehicle, on_device=version.number)
    _place(row, vehicle_id=vehicle, trip=trip)
    db.add(
        plans.Acknowledgement(
            plan_version_id=version.id, actor_kind=ActorKind.DRIVER, driver_vehicle_id=vehicle, acknowledged_at=_device_time(rec)
        )
    )
    audit.record(
        db, actor_user_id=b.user.id, actor=rec.actor or b.user.display_name, entity_type="plan", entity_id=str(version.id), type=AuditType.PLAN_ACKNOWLEDGED,
        payload={"number": version.number, "vehicleId": vehicle, "clientId": str(rec.client_id)}, at=b.now,
    )
    _heard(b, service_date, vehicle, trip, version.number)
    return Answer(SyncResultKind.ACCEPTED)


def _start_route(db: Session, b: Batch, rec: SyncRecordIn, row: f.DeviceRecord) -> Answer:
    vehicle = _driver_vehicle(b, rec.payload)
    service_date = _service_date(db, b, rec.payload)
    trip_no = rec.payload.get("trip")
    trip = _trip(db, service_date, vehicle, on_device=rec.plan_version_on_device, trip_no=trip_no if isinstance(trip_no, int) else None)
    if trip is None:
        raise Refused(f"{vehicle} has no trip on {service_date}")
    _place(row, vehicle_id=vehicle, trip=trip)
    run = _run(db, service_date, vehicle, trip.trip_no)
    if run is None:
        run = f.Run(trip_id=trip.id)
        db.add(run)
    run.departed_at = run.departed_at or _device_time(rec)
    db.flush()
    actor = rec.actor or b.user.display_name
    order_ids = [to.order_id for to in db.scalars(select(plans.TripOrder).where(plans.TripOrder.trip_id == trip.id))]
    for order in db.scalars(select(order_models.Order).where(order_models.Order.id.in_(order_ids or [""])).order_by(order_models.Order.id)):
        if _status(order) is OrderStatus.LOADED:
            order_service.apply(db, order, OrderEvent.DEPART, actor=actor, commit=False, payload={"vehicleId": vehicle, "clientId": str(rec.client_id)})
    audit.record(
        db, actor_user_id=b.user.id, actor=actor, entity_type="run", entity_id=str(run.id), type=AuditType.RUN_STARTED,
        payload={"vehicleId": vehicle, "trip": trip.trip_no, "departedAt": _device_time(rec).isoformat()}, at=b.now,
    )
    _heard(b, service_date, vehicle, trip, rec.plan_version_on_device)
    return Answer(SyncResultKind.ACCEPTED)


def _arrival(db: Session, b: Batch, rec: SyncRecordIn, row: f.DeviceRecord) -> Answer:
    """A fact: always accepted (reconciliation rule 1)."""
    vehicle = _driver_vehicle(b, rec.payload)
    service_date = _service_date(db, b, rec.payload)
    outlet = rec.payload.get("outletId")
    if not isinstance(outlet, str) or not outlet:
        raise Refused("An arrival names its outlet")
    trip = _trip(db, service_date, vehicle, on_device=rec.plan_version_on_device, outlet_id=outlet)
    _place(row, vehicle_id=vehicle, trip=trip, outlet_id=outlet)
    audit.record(
        db, actor_user_id=b.user.id, actor=rec.actor or b.user.display_name, entity_type="stop", entity_id=outlet, type=AuditType.ARRIVED,
        payload={"vehicleId": vehicle, "arrivedAt": _device_time(rec).isoformat(), "clientId": str(rec.client_id)}, at=b.now,
    )
    _heard(b, service_date, vehicle, trip, rec.plan_version_on_device)
    return Answer(SyncResultKind.ACCEPTED)


def _deferral_of(db: Session, order_id: str) -> tuple[order_models.Deferral, plans.PlanVersion] | None:
    """The order's newest deferral that still stands, with the plan version that made it."""
    found = db.execute(
        select(order_models.Deferral, plans.PlanVersion)
        .join(plans.PlanVersion, plans.PlanVersion.id == order_models.Deferral.plan_version_id)
        .where(order_models.Deferral.order_id == order_id, order_models.Deferral.withdrawn_at.is_(None))
        .order_by(plans.PlanVersion.number.desc())
        .limit(1)
    ).first()
    return (found[0], found[1]) if found else None


def _stop_conflict(db: Session, outlet_id: str, service_date: date) -> f.Conflict | None:
    """The open conflict for this stop, if one of its orders is already in one: one stop, one conflict."""
    for c in db.scalars(select(f.Conflict).where(f.Conflict.status.in_(OPEN_CONFLICT)).order_by(f.Conflict.id)):
        first = db.get(order_models.Order, c.order_ids[0]) if c.order_ids else None
        if first is not None and first.outlet_id == outlet_id and first.service_date == service_date:
            return c
    return None


def _offline_since(db: Session, b: Batch, service_date: date, vehicle: str, trip: plans.Trip | None) -> datetime | None:
    """The last time the phone was heard before this sync: when it went quiet."""
    run = _run(db, service_date, vehicle, trip.trip_no) if trip is not None else None
    if run is None or run.last_heard_at is None or run.last_heard_at >= b.now:
        return None
    return run.last_heard_at


def _arrived_at(db: Session, vehicle: str, outlet_id: str) -> datetime | None:
    return db.scalar(
        select(f.DeviceRecord.device_time)
        .where(f.DeviceRecord.type == DeviceRecordType.DRIVER_ARRIVAL, f.DeviceRecord.vehicle_id == vehicle, f.DeviceRecord.outlet_id == outlet_id)
        .order_by(f.DeviceRecord.device_time.desc())
        .limit(1)
    )


def conflict_payload(c: f.Conflict) -> dict[str, Any]:
    """What the phone keeps for R1.7 (``conflictFromServer`` in the driver app)."""
    srv = c.server_snapshot or {}
    decided = srv.get("decidedAt")
    at = datetime.fromisoformat(decided) if isinstance(decided, str) else None
    kind = str(srv.get("type") or "store_request").replace("_", " ")
    return {
        "conflictId": c.id,
        "serverVersion": srv.get("planVersion"),
        "change": f"{' + '.join(c.order_ids)} deferred ({kind}) in plan v{srv.get('planVersion')}",
        "changedAt": _hm(at),
        "changedBy": srv.get("decidedBy") or "Dispatch",
    }


def _open_conflict(
    db: Session,
    b: Batch,
    rec: SyncRecordIn,
    order: order_models.Order,
    vehicle: str,
    trip: plans.Trip | None,
    deferral: tuple[order_models.Deferral, plans.PlanVersion],
    ruling_rec: ConflictRecommendation,
    reasons: list[str],
    outcome: Outcome,
) -> f.Conflict:
    """Adds the order to its stop's conflict, or opens the conflict. The store hears "under review", never "conflict"."""
    d, version = deferral
    units = rec.payload.get("unitsDelivered")
    c = _stop_conflict(db, order.outlet_id, order.service_date)
    created = c is None
    if c is None:
        arrived = _arrived_at(db, vehicle, order.outlet_id)
        offline = _offline_since(db, b, order.service_date, vehicle, trip)
        c = f.Conflict(
            order_ids=[],
            server_snapshot={
                "status": "deferred",
                "planVersion": version.number,
                "type": d.type.value,
                "decidedAt": d.decided_at.isoformat() if d.decided_at else None,
                "decidedBy": (d.decided_by or "Dispatch").split(" · ")[0],
                "reason": d.reason_text,
                "reachedDriver": (rec.plan_version_on_device or 0) >= version.number,
            },
            device_snapshot={
                "vehicleId": vehicle,
                "outcome": outcome.value,
                "deviceTime": _device_time(rec).isoformat(),
                "receivedBy": rec.payload.get("receiverName"),
                "photo": bool(rec.payload.get("photoBlobId")),
                "planVersionOnDevice": rec.plan_version_on_device,
                "arrivedAt": arrived.isoformat() if arrived else None,
                "offlineSince": offline.isoformat() if offline else None,
                "syncedAt": b.now.isoformat(),
                "unitsByOrder": {},
            },
            recommendation=ruling_rec,
            reasons=reasons,
            status=ConflictStatus.OPEN,
        )
        db.add(c)
    dev = dict(c.device_snapshot or {})
    by_order = dict(dev.get("unitsByOrder") or {})
    by_order[order.id] = units if isinstance(units, int) else order.units
    order_ids = [*c.order_ids, order.id] if order.id not in c.order_ids else list(c.order_ids)
    dev["unitsByOrder"] = by_order
    dev["units"] = " + ".join(str(by_order.get(o, "")) for o in order_ids)
    dev["photo"] = bool(dev.get("photo")) or bool(rec.payload.get("photoBlobId"))
    dev["receivedBy"] = dev.get("receivedBy") or rec.payload.get("receiverName")
    c.device_snapshot = dev
    c.order_ids = order_ids
    db.flush()

    actor = rec.actor or b.user.display_name
    order_service.apply(db, order, OrderEvent.CONFLICT, actor=actor, commit=False, payload={"conflict": c.id, "clientId": str(rec.client_id)})
    if created:
        db.add(
            Notice(
                audience_kind="store", outlet_id=order.outlet_id, tag=NoticeTag.REVIEW, title="Your delivery is under review",
                body="The driver's delivery record reached us after the deferral. Dispatch is checking it; nothing is needed from you yet.",
                link={"screen": "deliveries", "conflictId": c.id}, refs={"conflictId": c.id, "orderIds": list(c.order_ids)}, created_at=b.now,
            )
        )
        db.add(
            Notice(
                audience_kind="dispatcher", tag=NoticeTag.REVIEW, title=f"{order.outlet_id}: delivery and deferral disagree",
                body=f"{vehicle} synced a delivery made on plan v{rec.plan_version_on_device}; the stop is deferred in v{version.number}.",
                link={"screen": "conflict", "conflictId": c.id}, refs={"conflictId": c.id}, created_at=b.now,
            )
        )
    else:
        notice = db.scalars(
            select(Notice).where(Notice.outlet_id == order.outlet_id, Notice.tag == NoticeTag.REVIEW).order_by(Notice.id.desc()).limit(1)
        ).first()
        if notice is not None and (notice.refs or {}).get("conflictId") == c.id:
            notice.refs = {**notice.refs, "orderIds": list(c.order_ids)}
    return c


def _outcome(db: Session, b: Batch, rec: SyncRecordIn, row: f.DeviceRecord) -> Answer:
    vehicle = _driver_vehicle(b, rec.payload)
    order = _order(db, rec.payload.get("orderId"))
    raw = str(rec.payload.get("outcome") or "").strip().lower()
    if raw not in OUTCOME_OF:
        raise Refused(f"{rec.payload.get('outcome')!r} is not an outcome")
    outcome = OUTCOME_OF[raw]
    outlet = rec.payload.get("outletId") or order.outlet_id
    if outlet != order.outlet_id:
        raise Refused(f"{order.id} is for {order.outlet_id}, not {outlet}")
    trip = _trip(db, order.service_date, vehicle, on_device=rec.plan_version_on_device, order_ids=[order.id])
    _place(row, vehicle_id=vehicle, trip=trip, outlet_id=order.outlet_id, order_ids=[order.id])
    _heard(b, order.service_date, vehicle, trip, rec.plan_version_on_device)

    deferral = _deferral_of(db, order.id)
    latest = _latest_released(db, order.service_date)
    changed = deferral[1].number if deferral else (latest.number if latest else 0)
    on_device = rec.plan_version_on_device if rec.plan_version_on_device is not None else changed
    ruling = reconcile(
        ServerOrderState(order.id, _status(order), changed_in_version=changed),
        RuleRecord(
            RecordType.DRIVER_OUTCOME, on_device, outcome,
            has_photo=bool(rec.payload.get("photoBlobId")), has_receiver=bool(rec.payload.get("receiverName")),
        ),
    )
    actor = rec.actor or b.user.display_name
    if ruling.result is SyncResult.CONFLICT and deferral is not None and ruling.recommendation is not None:
        c = _open_conflict(
            db, b, rec, order, vehicle, trip, deferral, ConflictRecommendation(ruling.recommendation.value), list(ruling.reasons), outcome
        )
        return Answer(SyncResultKind.CONFLICT, ruling.reasons[0] if ruling.reasons else None, c.id, conflict_payload(c))

    payload = {"outcome": outcome.value, "units": rec.payload.get("unitsDelivered"), "clientId": str(rec.client_id)}
    if _status(order) is OrderStatus.LOADED:
        # The delivery is the proof the truck left: a start-route record that never arrived doesn't block it.
        order_service.apply(db, order, OrderEvent.DEPART, actor=actor, commit=False, payload={"clientId": str(rec.client_id)})
    if ruling.new_status is OrderStatus.DELIVERED:
        order_service.apply(db, order, OrderEvent.DELIVER, actor=actor, commit=False, payload=payload)
    else:
        order_service.apply(db, order, OrderEvent.FAIL, actor=actor, commit=False, payload=payload)
        if ruling.tag and ruling.tag not in (order.tags or []):
            order.tags = [*(order.tags or []), ruling.tag]
    return Answer(SyncResultKind.ACCEPTED)


def _problem(db: Session, b: Batch, rec: SyncRecordIn, row: f.DeviceRecord) -> Answer:
    """A fact: always accepted. It reaches Dispatch as a needs-a-decision item (handoff 13)."""
    vehicle = _driver_vehicle(b, rec.payload)
    service_date = _service_date(db, b, rec.payload)
    order_ids = [o for o in rec.payload.get("orderIds") or [] if isinstance(o, str)]
    trip = _trip(db, service_date, vehicle, on_device=rec.plan_version_on_device, order_ids=order_ids or None)
    _place(row, vehicle_id=vehicle, trip=trip, order_ids=order_ids)
    e = f.FieldException(
        kind=ExceptionKind.DRIVER_PROBLEM, type=str(rec.payload.get("type") or "Other"), vehicle_id=vehicle,
        trip_id=trip.id if trip else None, order_ids=order_ids, units_short={}, detail=rec.payload.get("note"),
        raised_by=rec.actor or b.user.display_name, raised_by_user_id=b.user.id, raised_at=b.now, device_time=_device_time(rec), status=ExceptionStatus.OPEN,
    )
    db.add(e)
    db.flush()
    audit.record(
        db, actor_user_id=b.user.id, actor=rec.actor or b.user.display_name, entity_type="exception", entity_id=str(e.id), type=AuditType.ISSUE_REPORTED,
        payload={"vehicleId": vehicle, "type": e.type, "orderIds": order_ids, "clientId": str(rec.client_id)}, at=b.now,
    )
    db.add(
        Notice(
            audience_kind="dispatcher", tag=NoticeTag.CHANGE, title=f"{vehicle}: {e.type}", body=e.detail or "The driver recorded a problem.",
            link={"screen": "exception", "exceptionId": e.id}, refs={"exceptionId": e.id, "orderIds": order_ids}, created_at=b.now,
        )
    )
    _heard(b, service_date, vehicle, trip, rec.plan_version_on_device)
    return Answer(SyncResultKind.ACCEPTED)


def _finish_run(db: Session, b: Batch, rec: SyncRecordIn, row: f.DeviceRecord) -> Answer:
    vehicle = _driver_vehicle(b, rec.payload)
    service_date = _service_date(db, b, rec.payload)
    trip = _trip(db, service_date, vehicle, on_device=rec.plan_version_on_device)
    _place(row, vehicle_id=vehicle, trip=trip)
    run = _run(db, service_date, vehicle, trip.trip_no) if trip else None
    if run is None:
        raise Refused(f"{vehicle} has no run to finish on {service_date}")
    run.finished_at = run.finished_at or _device_time(rec)
    for key in ("gpsKm", "gpsGapFilledKm", "fuelLEst"):
        value = rec.payload.get(key)
        if isinstance(value, int | float):
            setattr(run, {"gpsKm": "gps_km", "gpsGapFilledKm": "gps_gap_filled_km", "fuelLEst": "fuel_l_est"}[key], float(value))
    _heard(b, service_date, vehicle, trip, rec.plan_version_on_device)
    return Answer(SyncResultKind.ACCEPTED)


def _loader_trip(db: Session, rec: SyncRecordIn, b: Batch) -> tuple[str, plans.Trip]:
    vehicle = rec.payload.get("vehicleId")
    trip_no = rec.payload.get("trip")
    if not isinstance(vehicle, str) or not isinstance(trip_no, int):
        raise Refused("A loading record names its vehicle and trip")
    require_vehicle(b.user, vehicle)
    service_date = _service_date(db, b, rec.payload)
    trip = _trip(db, service_date, vehicle, on_device=rec.plan_version_on_device, trip_no=trip_no)
    if trip is None:
        raise Refused(f"{vehicle} has no trip {trip_no} on {service_date}")
    return vehicle, trip


def _loader_ack(db: Session, b: Batch, rec: SyncRecordIn, row: f.DeviceRecord) -> Answer:
    """An acknowledgement of a version older than the current one is a conflict: the dock shows "Plan changed" (L1.5)."""
    service_date = _service_date(db, b, rec.payload)
    number = rec.payload.get("version", rec.plan_version_on_device)
    if not isinstance(number, int):
        raise Refused("An acknowledgement names its plan version")
    latest = _latest_released(db, service_date)
    ruling = reconcile(None, RuleRecord(RecordType.LOADER_ACK, number), current_version=latest.number if latest else None)
    if ruling.result is SyncResult.CONFLICT:
        current = latest.number if latest else number
        return Answer(SyncResultKind.CONFLICT, ruling.reasons[0] if ruling.reasons else None, server_payload={"currentVersion": current})
    version = _version(db, service_date, number)
    if version is None:
        raise Refused(f"Plan v{number} was not found for {service_date}")
    dock = rec.payload.get("dockId")
    person = str(rec.payload.get("personId") or rec.actor or "")
    db.add(
        plans.Acknowledgement(
            plan_version_id=version.id, actor_kind=ActorKind.PIN_PERSON, pin_person_id=_pin(db, person), depot_id=dock if isinstance(dock, str) else None,
            acknowledged_at=_device_time(rec),
        )
    )
    audit.record(
        db, actor_user_id=b.user.id, actor=str(rec.payload.get("personName") or rec.actor or b.user.display_name), entity_type="plan", entity_id=str(version.id),
        type=AuditType.PLAN_ACKNOWLEDGED, payload={"number": version.number, "dock": dock, "clientId": str(rec.client_id)}, at=b.now,
    )
    return Answer(SyncResultKind.ACCEPTED)


def _loader_check(db: Session, b: Batch, rec: SyncRecordIn, row: f.DeviceRecord) -> Answer:
    """A fact: always accepted."""
    vehicle, trip = _loader_trip(db, rec, b)
    order = _order(db, rec.payload.get("orderId"))
    loaded = rec.payload.get("unitsLoaded")
    if not isinstance(loaded, int):
        raise Refused("A load check says how many units were loaded")
    _place(row, vehicle_id=vehicle, trip=trip, outlet_id=order.outlet_id, order_ids=[order.id])
    db.add(
        plans.LoadCheck(
            trip_id=trip.id, order_id=order.id, units_expected=order.units, units_loaded=loaded,
            checked_by_pin=_pin(db, rec.payload.get("personId")), checked_at=_device_time(rec), client_id=rec.client_id,
        )
    )
    audit.record(
        db, actor_user_id=b.user.id, actor=rec.actor or b.user.display_name, entity_type="order", entity_id=order.id, type=AuditType.LOAD_CHECKED,
        payload={"vehicleId": vehicle, "trip": trip.trip_no, "unitsLoaded": loaded, "unitsExpected": order.units}, at=b.now,
    )
    return Answer(SyncResultKind.ACCEPTED)


def _confirm_loaded(db: Session, b: Batch, rec: SyncRecordIn, row: f.DeviceRecord) -> Answer:
    vehicle, trip = _loader_trip(db, rec, b)
    _place(row, vehicle_id=vehicle, trip=trip)
    if db.get(plans.LoadGate, trip.id) is None:
        db.add(plans.LoadGate(trip_id=trip.id, confirmed_at=_device_time(rec), confirmed_by_pin=_pin(db, rec.payload.get("personId"))))
    actor = str(rec.payload.get("personName") or rec.actor or b.user.display_name)
    order_ids = [to.order_id for to in db.scalars(select(plans.TripOrder).where(plans.TripOrder.trip_id == trip.id))]
    for order in db.scalars(select(order_models.Order).where(order_models.Order.id.in_(order_ids or [""])).order_by(order_models.Order.id)):
        if _status(order) is OrderStatus.PLANNED:
            order_service.apply(db, order, OrderEvent.LOAD, actor=actor, commit=False, payload={"vehicleId": vehicle, "trip": trip.trip_no})
    return Answer(SyncResultKind.ACCEPTED)


def _loader_exception(db: Session, b: Batch, rec: SyncRecordIn, row: f.DeviceRecord) -> Answer:
    """A loader's flag reaches Dispatch as a needs-a-decision item (handoff 5) and D8."""
    vehicle, trip = _loader_trip(db, rec, b)
    order_ids = [o for o in rec.payload.get("orderIds") or [] if isinstance(o, str)]
    _place(row, vehicle_id=vehicle, trip=trip, order_ids=order_ids)
    short = rec.payload.get("unitsShort")
    e = f.FieldException(
        kind=ExceptionKind.LOADER_SHORTFALL, type=str(rec.payload.get("type") or "Other"), vehicle_id=vehicle, trip_id=trip.id,
        order_ids=order_ids, units_short={o: short for o in order_ids} if isinstance(short, int) else {},
        detail=rec.payload.get("note") or rec.payload.get("reason"), raised_by=str(rec.payload.get("personName") or rec.actor or ""),
        raised_by_user_id=b.user.id,
        raised_by_pin_id=_pin(db, rec.payload.get("personId")) if rec.type is DeviceRecordType.LOADER_EXCEPTION else None,
        raised_at=b.now, device_time=_device_time(rec), status=ExceptionStatus.OPEN,
    )
    db.add(e)
    db.flush()
    audit.record(
        db, actor_user_id=b.user.id, actor=e.raised_by or b.user.display_name, entity_type="exception", entity_id=str(e.id), type=AuditType.FLAG_RAISED,
        payload={"vehicleId": vehicle, "trip": trip.trip_no, "type": e.type, "orderIds": order_ids, "clientId": str(rec.client_id)}, at=b.now,
    )
    db.add(
        Notice(
            audience_kind="dispatcher", tag=NoticeTag.CHANGE, title=f"{vehicle}: {e.type}", body=e.detail or "The dock flagged a loading problem.",
            link={"screen": "exception", "exceptionId": e.id}, refs={"exceptionId": e.id, "orderIds": order_ids}, created_at=b.now,
        )
    )
    return Answer(SyncResultKind.ACCEPTED)


HANDLERS = {
    DeviceRecordType.DRIVER_ACK: _driver_ack,
    DeviceRecordType.DRIVER_START_ROUTE: _start_route,
    DeviceRecordType.DRIVER_ARRIVAL: _arrival,
    DeviceRecordType.DRIVER_OUTCOME: _outcome,
    DeviceRecordType.DRIVER_PROBLEM: _problem,
    DeviceRecordType.DRIVER_FINISH_RUN: _finish_run,
    DeviceRecordType.LOADER_ACK: _loader_ack,
    DeviceRecordType.LOADER_CHECK: _loader_check,
    DeviceRecordType.LOADER_CONFIRM_LOADED: _confirm_loaded,
    DeviceRecordType.LOADER_EXCEPTION: _loader_exception,
}


# ---- the batch ---------------------------------------------------------------------------------------------------


def _fill(row: f.DeviceRecord, b: Batch, rec: SyncRecordIn) -> None:
    row.device_id = b.device_id
    row.user_id = b.user.id
    row.actor = rec.actor
    row.type = rec.type
    row.payload = {**rec.payload, "blobIds": [str(x) for x in rec.blob_ids]} if rec.blob_ids else dict(rec.payload)
    row.device_time = _device_time(rec)
    row.plan_version_on_device = rec.plan_version_on_device
    row.received_at = b.now
    # Provisional, so an autoflush inside a handler can write the row; the handler's answer replaces it.
    row.result = SyncResultKind.ERROR
    row.conflict_id = None
    row.result_reason = None


def _link_blobs(db: Session, rec: SyncRecordIn) -> None:
    """Photos that arrived before their record (``/attachments`` keeps them unlinked) are tied to it now."""
    for blob_id in rec.blob_ids:
        attachment = db.get(f.Attachment, blob_id)
        if attachment is not None and attachment.device_record_id is None:
            attachment.device_record_id = rec.client_id


def _duplicate(db: Session, stored: f.DeviceRecord) -> SyncResultOut:
    payload = None
    if stored.conflict_id is not None:
        c = db.get(f.Conflict, stored.conflict_id)
        payload = conflict_payload(c) if c is not None else None
    return SyncResultOut(
        client_id=stored.client_id, result=SyncResultKind.DUPLICATE, reason=stored.result_reason, conflict_id=stored.conflict_id, server_payload=payload
    )


def _reason(exc: Exception) -> str:
    if isinstance(exc, Refused | ApiError):
        return str(exc) if isinstance(exc, Refused) else exc.message
    if isinstance(exc, ValueError):  # IllegalTransition is a ValueError with a readable message
        return str(exc)
    log.exception("sync: a record could not be applied")
    return "The server could not apply this record"


def _one(db: Session, b: Batch, rec: SyncRecordIn) -> SyncResultOut:
    stored = db.get(f.DeviceRecord, rec.client_id)
    if stored is not None and stored.result is not SyncResultKind.ERROR:
        return _duplicate(db, stored)
    try:
        with db.begin_nested():
            row = stored if stored is not None else f.DeviceRecord(client_id=rec.client_id)
            _fill(row, b, rec)
            if stored is None:
                db.add(row)
            db.flush()  # persist the device record before a load check references its client_id
            answer = HANDLERS[rec.type](db, b, rec, row)
            row.result = answer.result
            row.result_reason = answer.reason
            row.conflict_id = answer.conflict_id
            db.flush()  # the record exists before a photo points at it
            _link_blobs(db, rec)
            db.flush()
    except Exception as exc:  # one bad record never fails the batch
        reason = _reason(exc)
        with db.begin_nested():
            row = db.get(f.DeviceRecord, rec.client_id) or f.DeviceRecord(client_id=rec.client_id)
            _fill(row, b, rec)
            row.order_ids = []
            row.result = SyncResultKind.ERROR
            row.result_reason = reason
            db.add(row)
            db.flush()
        return SyncResultOut(client_id=rec.client_id, result=SyncResultKind.ERROR, reason=reason)
    return SyncResultOut(
        client_id=rec.client_id, result=answer.result, reason=answer.reason, conflict_id=answer.conflict_id, server_payload=answer.server_payload
    )


def _hear(db: Session, b: Batch) -> None:
    """The phone was heard now: last-heard and the plan it holds, on every run a driver record reached."""
    for service_date, vehicle, trip_no in sorted(b.heard):
        run = _run(db, service_date, vehicle, trip_no)
        if run is None:
            continue
        run.last_heard_at = b.now
        seen = _version(db, service_date, b.seen_version)
        if seen is not None:
            run.plan_version_seen = seen.id


def sync(db: Session, user: CurrentUser, body: SyncIn) -> SyncOut:
    if user.role is Role.DRIVER and user.vehicle_id is None:
        raise forbidden("This driver account has no vehicle")
    b = Batch(user=user, device_id=body.device_id, now=clock.now(db))
    results = [_one(db, b, rec) for rec in body.records]
    _hear(db, b)
    counts = {k.value: sum(1 for r in results if r.result is k) for k in SyncResultKind}
    audit.record(
        db, actor_user_id=user.id, actor=user.display_name, entity_type="device", entity_id=body.device_id, type=AuditType.SYNCED,
        payload={"records": len(results), **counts}, at=b.now,
    )
    db.flush()
    return SyncOut(results=results)
