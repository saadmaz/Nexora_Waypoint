"""Reads for the store's own orders and delivery days: database rows in, plain values out.

A store sees far less than the dispatcher does, so this stays apart from ``planning_repo``: one outlet, that
outlet's orders for one day, the quantities it ordered last, and which ids in the store-placed range are taken.
Times come back naive Asia/Colombo, which is what the rest of the backend works in.

The second half builds :mod:`store_model` values: one delivery day (S2, S3), the past days (S4.2 and S2.10),
the problems the store reported (S3.7) and its updates feed (S4.1). Nothing here decides wording; that is
``store_views``, which never sees a :class:`Session`.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from datetime import date, datetime, time

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from waypoint_rules.calc import planned_clock
from waypoint_rules.model import Trip
from waypoint_rules.schedule import next_operating_day
from waypoint_rules.vocab import DockType, OrderStatus, Temp

from ..models import comms, field, people, plans, reference
from ..models import orders as order_models
from ..models.enums import (
    AuditType,
    DeviceRecordType,
    ExceptionKind,
    HistoryOutcome,
    PlanState,
)
from . import planning_repo as repo
from .dispatcher_views import DOCK_LABEL
from .store_model import (
    ConflictFacts,
    DeferralFacts,
    DeliveryDay,
    HistoryDay,
    IssueFacts,
    NoticeFacts,
    OrderFacts,
    OutletFacts,
    ProofFacts,
    ReceiptFacts,
)

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


# ---- the window the store is told to expect ---------------------------------


def window_of(outlet: reference.Outlet) -> tuple[time, time]:
    """A mall bay keeps the mall's hours, not the outlet's own. The one store-facing definition (S1, S2)."""
    if outlet.dock_type is DockType.MALL_BAY and outlet.mall_window_open is not None and outlet.mall_window_close is not None:
        return outlet.mall_window_open, outlet.mall_window_close
    return outlet.window_open, outlet.window_close


def outlet_facts(outlet: reference.Outlet, service_date: date) -> OutletFacts:
    """The outlet as its own screens name it, with the window as times on ``service_date``."""
    opens, closes = window_of(outlet)
    return OutletFacts(
        id=outlet.id,
        name=outlet.name or outlet.id,
        district=outlet.district,
        dock=DOCK_LABEL[outlet.dock_type],
        window_open=datetime.combine(service_date, opens),
        window_close=datetime.combine(service_date, closes),
    )


# ---- one delivery day (S2, S3) ----------------------------------------------


def service_dates(db: Session, outlet_id: str, *, since: date | None = None, until: date | None = None) -> list[date]:
    """The service dates the outlet has orders for, earliest first. A cancelled order is not a delivery day."""
    query = select(order_models.Order.service_date).where(
        order_models.Order.outlet_id == outlet_id, order_models.Order.cancelled_at.is_(None)
    )
    if since is not None:
        query = query.where(order_models.Order.service_date >= since)
    if until is not None:
        query = query.where(order_models.Order.service_date <= until)
    return sorted(set(db.scalars(query.distinct())))


def released_versions(db: Session, service_date: date, now: datetime) -> list[plans.PlanVersion]:
    """The plan versions the store may know about: released, and released by ``now``. Oldest first."""
    rows = [v for v in repo.versions_of(db, service_date) if v.state is PlanState.RELEASED]
    return [v for v in rows if v.released_at is None or (repo.naive(v.released_at) or now) <= now]


def _trip_of(db: Session, version_id: int, order_ids: set[str]) -> plans.Trip | None:
    """The trip in ``version_id`` that carries any of these orders."""
    trip_id = db.scalars(
        select(plans.TripOrder.trip_id)
        .join(plans.Trip, plans.Trip.id == plans.TripOrder.trip_id)
        .where(plans.Trip.plan_version_id == version_id, plans.TripOrder.order_id.in_(order_ids or {""}))
        .limit(1)
    ).first()
    return db.get(plans.Trip, trip_id) if trip_id is not None else None


def _trip_carrying(db: Session, versions: list[plans.PlanVersion], order_ids: set[str]) -> plans.Trip | None:
    """The trip these orders are on, looking back through the released versions.

    A deferral drops the stop from the plan, but it does not undo the morning: the truck was still loaded
    at 04:50 and still left at 05:10, and S2.6 keeps showing that. So the newest version that carries the
    orders wins, and an older one answers for a day a later version dropped.
    """
    for version in reversed(versions):
        trip = _trip_of(db, version.id, order_ids)
        if trip is not None:
            return trip
    return None


def _deferral_facts(db: Session, order_ids: set[str]) -> DeferralFacts | None:
    """The deferral the store is told about: the standing one, else the most recent withdrawn one.

    A withdrawn deferral is still read, because S2.8 shows the "Deferral withdrawn" tag once the
    dispatcher has kept the delivery (H16).
    """
    rows = list(
        db.scalars(
            select(order_models.Deferral)
            .where(order_models.Deferral.order_id.in_(order_ids or {""}))
            .order_by(order_models.Deferral.id)
        )
    )
    if not rows:
        return None
    standing = [d for d in rows if d.withdrawn_at is None]
    d = standing[-1] if standing else rows[-1]
    return DeferralFacts(
        id=d.id,
        type=d.type,
        reason=d.reason_text,
        # The dispatcher stores "Kumari - plan v5"; the store is told the person who decided.
        decided_by=(d.decided_by or "Dispatch").split(" · ")[0],
        decided_at=repo.naive(d.decided_at),
        next_run_date=d.next_run_date,
        seen_at=repo.naive(d.notice_seen_at),
        withdrawn_at=repo.naive(d.withdrawn_at),
        withdrawn_reason=d.withdrawn_reason,
    )


def _conflict_row(db: Session, order_ids: set[str]) -> field.Conflict | None:
    for c in db.scalars(select(field.Conflict).order_by(field.Conflict.id)):
        if set(c.order_ids or ()) & order_ids:
            return c
    return None


def _snapshot_time(value: object) -> datetime | None:
    """A time out of a conflict snapshot's JSON, as naive Asia/Colombo."""
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed.replace(tzinfo=None) if parsed.tzinfo is None else repo.naive(parsed)


def _conflict_facts(c: field.Conflict) -> ConflictFacts:
    server = dict(c.server_snapshot or {})
    device = dict(c.device_snapshot or {})
    report = server.get("storeReport")
    report = report if isinstance(report, dict) else None
    return ConflictFacts(
        id=c.id,
        status=c.status,
        asked_at=_snapshot_time(server.get("askedAt")),
        delivered_at=_snapshot_time(device.get("deviceTime")),
        received_by=str(device["receivedBy"]) if device.get("receivedBy") else None,
        answered=report is not None,
        reported_short=_is_short(report),
        resolved_at=repo.naive(c.resolved_at),
    )


def _is_short(report: dict[str, object] | None) -> bool:
    """Whether the store's answer was a shortage. ``conflict_views.short_units`` reads the same shape."""
    if report is None:
        return False
    try:
        return int(str(report.get("unitsReceived") or 0)) < int(str(report.get("unitsOrdered") or 0))
    except ValueError:
        return False


def _outcomes(db: Session, order_ids: set[str]) -> tuple[dict[str, datetime], dict[str, int], str | None, str | None]:
    """Per order: when the driver's outcome was recorded and how many units; plus the receiver and the vehicle."""
    at: dict[str, datetime] = {}
    for row in db.scalars(
        select(comms.AuditEvent)
        .where(
            comms.AuditEvent.entity_type == "order",
            comms.AuditEvent.entity_id.in_(order_ids or {""}),
            comms.AuditEvent.type == AuditType.OUTCOME_RECORDED,
        )
        .order_by(comms.AuditEvent.at, comms.AuditEvent.id)
    ):
        stamp = repo.naive(row.at)
        if stamp is not None:
            at[row.entity_id] = stamp

    units: dict[str, int] = {}
    receiver: str | None = None
    vehicle: str | None = None
    for rec in db.scalars(
        select(field.DeviceRecord)
        .where(field.DeviceRecord.type == DeviceRecordType.DRIVER_OUTCOME)
        .order_by(field.DeviceRecord.received_at)
    ):
        mine = set(rec.order_ids or ()) & order_ids
        if not mine:
            continue
        count = rec.payload.get("unitsDelivered")
        for oid in mine:
            if isinstance(count, int):
                units[oid] = count
        receiver = receiver or (str(rec.payload.get("receiverName")) if rec.payload.get("receiverName") else None)
        vehicle = vehicle or rec.vehicle_id
        # A device time stands in when the outcome is held in a conflict and no audit row carries it.
        stamp = _device_stamp(rec)
        if stamp is not None:
            for oid in mine:
                at.setdefault(oid, stamp)
    return at, units, receiver, vehicle


def _device_stamp(rec: field.DeviceRecord) -> datetime | None:
    return repo.naive(rec.device_time) or repo.naive(rec.received_at)


def issue_fact(e: field.FieldException, *, photo: bool) -> IssueFacts:
    """One stored report as plain data. ``photo`` comes from :func:`issue_photos`."""
    short = dict(e.units_short or {})
    return IssueFacts(
        id=e.id,
        type=e.type,
        units={str(k): int(v) for k, v in short.items() if isinstance(v, int)},
        order_ids=tuple(e.order_ids or ()),
        note=e.detail,
        photo=photo,
        raised_at=repo.naive(e.raised_at) or e.raised_at,
        status=e.status,
    )


def issue_photos(db: Session, exception_ids: Iterable[int]) -> set[int]:
    """Which reports came with a photo. There is no column for it, so the report's own audit row is the record.

    The same precedent as ``edited_at``: ``exceptions.decision`` belongs to the dispatcher's answer, not to
    what the store sent, so the flag is not stored there.
    """
    ids = [str(i) for i in exception_ids]
    if not ids:
        return set()
    out: set[int] = set()
    for row in db.scalars(
        select(comms.AuditEvent).where(
            comms.AuditEvent.entity_type == "exception",
            comms.AuditEvent.entity_id.in_(ids),
            comms.AuditEvent.type == AuditType.ISSUE_REPORTED,
        )
    ):
        if row.payload.get("photo"):
            out.add(int(row.entity_id))
    return out


def _belongs_to(db: Session, e: field.FieldException, outlet_id: str) -> bool:
    """A store issue names its orders, and an order names its outlet: that is what scopes the list."""
    for oid in e.order_ids or ():
        row = db.get(order_models.Order, oid)
        if row is not None:
            return row.outlet_id == outlet_id
    return False


def issues(db: Session, outlet_id: str, *, order_ids: Iterable[str] | None = None) -> list[field.FieldException]:
    """The problems this store reported, newest first. ``order_ids`` narrows it to one delivery day."""
    rows = [
        e
        for e in db.scalars(
            select(field.FieldException)
            .where(field.FieldException.kind == ExceptionKind.STORE_ISSUE)
            .order_by(field.FieldException.id.desc())
        )
        if _belongs_to(db, e, outlet_id)
    ]
    if order_ids is not None:
        wanted = set(order_ids)
        rows = [e for e in rows if set(e.order_ids or ()) & wanted]
    return rows


def issue_facts(db: Session, outlet_id: str, *, order_ids: Iterable[str] | None = None) -> list[IssueFacts]:
    rows = issues(db, outlet_id, order_ids=order_ids)
    photos = issue_photos(db, [e.id for e in rows])
    return [issue_fact(e, photo=e.id in photos) for e in rows]


def service_date_of(db: Session, issue: field.FieldException) -> date | None:
    """The delivery day an issue belongs to, read from the orders it names."""
    for oid in issue.order_ids or ():
        row = db.get(order_models.Order, oid)
        if row is not None:
            return row.service_date
    return None


def order_sizes(db: Session, order_ids: Iterable[str]) -> dict[str, tuple[Temp, int]]:
    """Each order's kind and size, for an issue line whose delivery day is not in hand."""
    ids = list(order_ids)
    if not ids:
        return {}
    return {r.id: (r.temp, r.units) for r in db.scalars(select(order_models.Order).where(order_models.Order.id.in_(ids)))}


def delivery_day(db: Session, outlet: reference.Outlet, service_date: date, now: datetime) -> DeliveryDay | None:
    """One service date as the store reads it, or ``None`` when the outlet ordered nothing for it."""
    rows = orders_for_day(db, outlet.id, service_date)
    if not rows:
        return None
    ops = repo.operating_days(db)
    order_ids = {r.id for r in rows}
    outcome_at, delivered_units, receiver, outcome_vehicle = _outcomes(db, order_ids)

    day = DeliveryDay(
        outlet=outlet_facts(outlet, service_date),
        service_date=service_date,
        now=now,
        orders=[
            OrderFacts(
                id=r.id,
                temp=r.temp,
                units=r.units,
                status=OrderStatus(r.status.value),
                received_at=repo.naive(r.received_at),
                delivered_units=delivered_units.get(r.id),
            )
            # Chilled before dry, as every store screen lists them.
            for r in sorted(rows, key=lambda r: (r.temp is not Temp.CHILLED, r.id))
        ],
        next_run=next_operating_day(service_date, ops) if ops else None,
        cutoff_at=repo.cutoff_at(service_date, ops) if ops else None,
    )

    versions = released_versions(db, service_date, now)
    day.released = bool(versions)
    if versions:
        # The step is reached when the first plan went out, not when a later version re-released the day.
        day.released_at = repo.naive(versions[0].released_at)
        trip = _trip_carrying(db, versions, order_ids)
        if trip is not None:
            day.vehicle = trip.vehicle_id
            day.predicted_arrival = _predicted_arrival(db, trip, service_date, outlet.id)
            gate = db.get(plans.LoadGate, trip.id)
            if gate is not None:
                day.loaded_at = repo.naive(gate.confirmed_at)
                day.loaded_place = _dock_label(db, trip.vehicle_id)
            run = db.scalars(
                select(field.Run).where(field.Run.trip_id == trip.id).order_by(field.Run.id.desc()).limit(1)
            ).first()
            if run is not None:
                day.departed_at = repo.naive(run.departed_at)
                day.finished_at = repo.naive(run.finished_at)
                day.last_heard_at = repo.naive(run.last_heard_at)

    day.deferral = _deferral_facts(db, order_ids)
    conflict_row = _conflict_row(db, order_ids)
    if conflict_row is not None:
        day.conflict = _conflict_facts(conflict_row)

    delivered = min(outcome_at.values()) if outcome_at else None
    vehicle = outcome_vehicle or day.vehicle
    if delivered is not None and receiver is not None and vehicle is not None:
        driver = db.get(people.Driver, vehicle)
        day.proof = ProofFacts(at=delivered, received_by=receiver, driver=driver.name if driver else vehicle, vehicle=vehicle)

    day.receipts = [
        ReceiptFacts(
            order_id=r.order_id,
            units_received=r.units_received,
            shortfall_reason=r.shortfall_reason,
            confirmed_at=repo.naive(r.confirmed_at) or r.confirmed_at,
            confirmed_by=r.confirmed_by,
        )
        for r in db.scalars(
            select(field.Receipt).where(field.Receipt.order_id.in_(order_ids)).order_by(field.Receipt.order_id)
        )
    ]
    day.issues = issue_facts(db, outlet.id, order_ids=order_ids)
    return day


def _dock_label(db: Session, vehicle_id: str) -> str | None:
    """"Kandy dock": where the load was confirmed."""
    vehicle = db.get(reference.Vehicle, vehicle_id)
    depot = db.get(reference.Depot, vehicle.depot_id) if vehicle is not None else None
    return f"{depot.name} dock" if depot is not None else None


def _predicted_arrival(db: Session, trip: plans.Trip, service_date: date, outlet_id: str) -> datetime | None:
    """The planned clock's arrival at this outlet: the same calculation the dispatcher's board shows."""
    stops = sorted(
        (to.seq, to.order_id) for to in db.scalars(select(plans.TripOrder).where(plans.TripOrder.trip_id == trip.id))
    )
    if not stops:
        return None
    clock = planned_clock(
        Trip(trip.vehicle_id, trip.trip_no, repo.naive(trip.depart_at) or trip.depart_at, [oid for _, oid in stops]),
        repo.day_orders(db, service_date, repo.operating_days(db)),
        repo.load_ref(db),
    )
    stop = next((st for st in clock.stops if st.outlet_id == outlet_id), None)
    return stop.arrival if stop is not None else None


# ---- the past days (S4.2, S2.10) --------------------------------------------

#: The statuses a delivery day is finished in, so the history may list it (A54).
_SETTLED = (OrderStatus.DELIVERED, OrderStatus.PARTIAL, OrderStatus.ISSUE)

_RECORDED_STATUS = {
    HistoryOutcome.SERVED: OrderStatus.DELIVERED,
    HistoryOutcome.PARTIAL: OrderStatus.PARTIAL,
    HistoryOutcome.DEFERRED: OrderStatus.DEFERRED,
    HistoryOutcome.NO_RUN: OrderStatus.DEFERRED,
}


def history(db: Session, outlet_id: str, *, limit: int, before: date | None, now: datetime) -> list[HistoryDay]:
    """Past delivery days, newest first, Sundays skipped. The current run joins once it is finished."""
    ops = repo.operating_days(db)
    current = repo.active_service_date(now, ops)
    orders_by_day: dict[date, list[order_models.Order]] = {}
    for row in db.scalars(
        select(order_models.Order)
        .where(order_models.Order.outlet_id == outlet_id, order_models.Order.cancelled_at.is_(None))
        .order_by(order_models.Order.id)
    ):
        orders_by_day.setdefault(row.service_date, []).append(row)

    recorded = {
        h.service_date: h
        for h in db.scalars(
            select(order_models.OutletServiceHistory).where(order_models.OutletServiceHistory.outlet_id == outlet_id)
        )
    }
    served_days = {d for d, h in recorded.items() if h.outcome in (HistoryOutcome.SERVED, HistoryOutcome.PARTIAL)}

    out: list[HistoryDay] = []
    for day in sorted(set(recorded) | set(orders_by_day), reverse=True):
        if day > current or day.weekday() == 6:  # Waypoint runs Monday to Saturday
            continue
        if before is not None and day >= before:
            continue
        built = _history_day(
            db, day, orders_by_day.get(day, []), recorded.get(day), ops, served_days, current=day == current
        )
        if built is not None:
            out.append(built)
        if len(out) >= limit:
            break
    return out


def _history_day(
    db: Session,
    day: date,
    rows: list[order_models.Order],
    recorded: order_models.OutletServiceHistory | None,
    ops: list[date],
    served_days: set[date],
    *,
    current: bool,
) -> HistoryDay | None:
    statuses = [OrderStatus(r.status.value) for r in rows]
    order_ids = tuple(r.id for r in rows)
    deferral = _deferral_facts(db, set(order_ids)) if order_ids else None
    receipts = (
        {r.order_id: r for r in db.scalars(select(field.Receipt).where(field.Receipt.order_id.in_(order_ids)))}
        if order_ids
        else {}
    )
    short = sum(max(0, r.units - receipts[r.id].units_received) for r in rows if r.id in receipts)
    delivered_at, status = _history_outcome(db, rows, statuses, recorded, short)
    if status is None:
        # A day still on its way, under review or not yet run is not history (A54).
        if rows:
            return None
        status = _RECORDED_STATUS[recorded.outcome] if recorded is not None else OrderStatus.DELIVERED

    served_next = False
    if status is OrderStatus.DEFERRED and ops:
        following = next((d for d in sorted(ops) if d > day), None)
        served_next = following is not None and following in served_days

    return HistoryDay(
        service_date=day,
        order_count=len(rows) or 1,
        status=status,
        order_ids=order_ids,
        delivered_at=delivered_at,
        short_units=short,
        deferral_type=deferral.type if deferral is not None and status is OrderStatus.DEFERRED else None,
        next_run_date=deferral.next_run_date if deferral is not None else None,
        served_next_day=served_next,
        deferral_withdrawn=deferral is not None and deferral.withdrawn_at is not None,
        receipt_confirmed_at=max(
            (repo.naive(r.confirmed_at) or r.confirmed_at for r in receipts.values()), default=None
        ),
        current=current,
    )


def _history_outcome(
    db: Session,
    rows: list[order_models.Order],
    statuses: list[OrderStatus],
    recorded: order_models.OutletServiceHistory | None,
    short: int,
) -> tuple[datetime | None, OrderStatus | None]:
    """A finished day's time and status, or ``(None, None)`` while the day is not finished."""
    if not rows:
        return None, None
    if all(s is OrderStatus.DEFERRED for s in statuses):
        return None, OrderStatus.DEFERRED
    if not all(s in _SETTLED for s in statuses):
        return None, None
    outcome_at, _, _, _ = _outcomes(db, {r.id for r in rows})
    at = min(outcome_at.values()) if outcome_at else _recorded_time(recorded)
    if OrderStatus.ISSUE in statuses:
        return at, OrderStatus.ISSUE
    if OrderStatus.PARTIAL in statuses or short > 0:
        return at, OrderStatus.PARTIAL
    return at, OrderStatus.DELIVERED


def _recorded_time(recorded: order_models.OutletServiceHistory | None) -> datetime | None:
    """"05:40" on a history row, for a day whose audit trail the seed does not carry."""
    if recorded is None or not recorded.time:
        return None
    try:
        hour, minute = (int(part) for part in recorded.time.split(":", 1))
        return datetime.combine(recorded.service_date, time(hour, minute))
    except ValueError:
        return None


# ---- the updates feed (S4.1) ------------------------------------------------


def notices(db: Session, outlet_id: str) -> list[comms.Notice]:
    """Every row the order record sent this store, newest first (handoff 14)."""
    return list(
        db.scalars(
            select(comms.Notice)
            .where(comms.Notice.audience == f"store:{outlet_id}")
            .order_by(comms.Notice.created_at.desc(), comms.Notice.id.desc())
        )
    )


def unread_notices(db: Session, outlet_id: str) -> list[comms.Notice]:
    return [n for n in notices(db, outlet_id) if n.read_at is None]


def notice_facts(db: Session, outlet_id: str) -> list[NoticeFacts]:
    rows = notices(db, outlet_id)
    resolved = _resolved_conflicts(db, rows)
    out: list[NoticeFacts] = []
    for n in rows:
        refs = dict(n.refs or {})
        link = dict(n.link or {})
        conflict_id = refs.get("conflictId") or link.get("conflictId")
        out.append(
            NoticeFacts(
                id=n.id,
                tag=n.tag.value,
                title=n.title,
                body=n.body,
                link=link,
                refs=refs,
                created_at=repo.naive(n.created_at) or n.created_at,
                read_at=repo.naive(n.read_at),
                resolved_at=resolved.get(conflict_id) if isinstance(conflict_id, int) else None,
                service_date=_notice_day(db, refs, link),
            )
        )
    return out


def _resolved_conflicts(db: Session, rows: list[comms.Notice]) -> dict[int, datetime]:
    """When each conflict a review row points at was settled, so S4.1 can mark it "Resolved 06:44"."""
    ids = {
        value
        for n in rows
        for value in ((n.refs or {}).get("conflictId"), (n.link or {}).get("conflictId"))
        if isinstance(value, int)
    }
    if not ids:
        return {}
    out: dict[int, datetime] = {}
    for c in db.scalars(select(field.Conflict).where(field.Conflict.id.in_(ids))):
        at = repo.naive(c.resolved_at)
        if at is not None:
            out[c.id] = at
    return out


def _notice_day(db: Session, refs: dict[str, object], link: dict[str, object]) -> date | None:
    """The delivery day a feed row's View opens, taken from the orders or the conflict it names."""
    candidates: list[str] = []
    for source in (refs.get("orderIds"), link.get("orderIds")):
        if isinstance(source, list):
            candidates.extend(str(i) for i in source)
    for single in (link.get("orderId"), refs.get("orderId")):
        if isinstance(single, str):
            candidates.append(single)
    conflict_id = refs.get("conflictId") or link.get("conflictId")
    if isinstance(conflict_id, int):
        c = db.get(field.Conflict, conflict_id)
        candidates.extend(c.order_ids or ()) if c is not None else None
    for oid in candidates:
        row = db.get(order_models.Order, oid)
        if row is not None:
            return row.service_date
    return None


# ---- rows a write has to load ------------------------------------------------


def deferral(db: Session, deferral_id: int) -> order_models.Deferral | None:
    return db.get(order_models.Deferral, deferral_id)


def deferral_group(db: Session, row: order_models.Deferral, outlet_id: str) -> list[order_models.Deferral]:
    """The rows one deferral notice covered: this outlet's standing deferrals of the same kind on the same run.

    The dispatcher defers a stop, not an order, so a two-order stop writes two rows and sends one notice.
    """
    order = db.get(order_models.Order, row.order_id)
    if order is None:
        return [row]
    ids = {
        o.id
        for o in db.scalars(
            select(order_models.Order).where(
                order_models.Order.outlet_id == outlet_id,
                order_models.Order.service_date == order.service_date,
                order_models.Order.cancelled_at.is_(None),
            )
        )
    }
    return list(
        db.scalars(
            select(order_models.Deferral)
            .where(
                order_models.Deferral.order_id.in_(ids or {""}),
                order_models.Deferral.type == row.type,
                order_models.Deferral.withdrawn_at.is_(None),
            )
            .order_by(order_models.Deferral.id)
        )
    ) or [row]


def conflict(db: Session, conflict_id: int) -> field.Conflict | None:
    return db.get(field.Conflict, conflict_id)


def conflict_for_orders(db: Session, order_ids: Iterable[str]) -> field.Conflict | None:
    return _conflict_row(db, set(order_ids))
