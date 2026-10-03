"""D7: ask the store, and settle a conflict (PRD v3 §16 steps 14 to 16, assumption A16).

Settling is a decision on the order records, not a new plan version. It never overwrites either record: both stay in the audit.
Replaying the same decision changes nothing. Callers commit.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from waypoint_rules import OrderEvent
from waypoint_rules.schedule import next_operating_day
from waypoint_rules.vocab import OrderStatus

from .. import clock
from ..errors import ApiError, not_found
from ..models import field
from ..models import orders as order_models
from ..models.comms import Notice
from ..models.enums import AuditType, ConflictRecommendation, ConflictStatus, HistoryOutcome, NoticeTag, ServerStatus
from ..schemas import dispatcher as s
from . import audit, planning
from . import orders as order_service
from . import planning_repo as repo
from .conflict_views import conflict_view, effective_recommendation, short_units
from .live_repo import conflict_row, load_live

_RESOLUTION_WORD = {"keep_delivery": "delivered", "keep_partial": "kept as partial", "keep_deferral": "deferred"}


def _load(db: Session, conflict_id: int) -> field.Conflict:
    c = db.get(field.Conflict, conflict_id)
    if c is None:
        raise not_found(f"Conflict {conflict_id}")
    return c


def _service_date(db: Session, c: field.Conflict) -> date:
    first = db.get(order_models.Order, c.order_ids[0]) if c.order_ids else None
    return first.service_date if first else repo.active_service_date(clock.now(db).replace(tzinfo=None), repo.operating_days(db))


def review(db: Session, conflict_id: int) -> s.ConflictView:
    c = _load(db, conflict_id)
    now = clock.now(db).replace(tzinfo=None)
    return conflict_view(load_live(db, _service_date(db, c), now), conflict_row(c))


def ask_store(db: Session, conflict_id: int, *, actor: str) -> s.ConflictView:
    """D7.2: ask the store "Did you receive this delivery?". The recommendation waits for the answer."""
    c = _load(db, conflict_id)
    if c.status is ConflictStatus.RESOLVED:
        raise ApiError(409, "not_open", "This conflict is not waiting for a decision.")
    if c.status is ConflictStatus.AWAITING_STORE:
        return review(db, conflict_id)  # already asked: asking twice changes nothing
    now = clock.now(db).replace(tzinfo=None)
    first = db.get(order_models.Order, c.order_ids[0])
    c.status = ConflictStatus.AWAITING_STORE
    c.server_snapshot = {**(c.server_snapshot or {}), "askedAt": repo.aware(now).isoformat()}
    if first is not None:
        db.add(
            Notice(
                audience_kind="store", outlet_id=first.outlet_id, tag=NoticeTag.REVIEW, title="Did you receive this delivery?",
                body=f"Dispatch is checking {' + '.join(c.order_ids)}. Did {first.outlet_id} receive it?",
                link={"screen": "review", "conflictId": c.id}, refs={"orderIds": list(c.order_ids), "conflictId": c.id}, created_at=repo.aware(now),
            )
        )
    audit.record(
        db, actor=actor, entity_type="conflict", entity_id=str(c.id), type=AuditType.CONFLICT_OPENED,
        payload={"event": "ask_store", "orderIds": list(c.order_ids)}, at=repo.aware(now),
    )
    db.flush()
    return review(db, conflict_id)


def _withdraw_deferrals(db: Session, service_date: date, order_ids: list[str], reason: str, now: datetime) -> None:
    """The deferral no longer stands: mark it withdrawn, drop the next-run copy, and the outlet was served after all."""
    rows = list(
        db.scalars(select(order_models.Deferral).where(order_models.Deferral.order_id.in_(order_ids), order_models.Deferral.withdrawn_at.is_(None)))
    )
    for d in rows:
        d.withdrawn_at = repo.aware(now)
        d.withdrawn_reason = reason
    db.flush()
    still: dict[str, date | None] = {}
    latest = repo.latest_version(db, service_date)
    if latest is not None:
        for d in repo.deferrals_of(db, latest.id):
            still[d.order_id] = d.next_run_date
    planning.sync_rerun_copies(db, service_date, still, now=now)


def resolve(db: Session, conflict_id: int, resolution: ConflictRecommendation, *, actor: str, actor_name: str) -> s.ConflictView:
    """D7.4: keep the delivery, keep it as partial, or keep the deferral. Driver, store and dock are told."""
    c = _load(db, conflict_id)
    if c.status is ConflictStatus.RESOLVED:
        if c.resolution == resolution.value:
            return review(db, conflict_id)  # the same decision again: nothing more to do
        raise ApiError(409, "already_resolved", f"This conflict was already settled: {_RESOLUTION_WORD.get(c.resolution or '', 'decided')}.")
    row = conflict_row(c)
    order_id, received, ordered = short_units(row)
    if resolution is ConflictRecommendation.KEEP_PARTIAL and not (order_id and ordered and received < ordered):
        raise ApiError(409, "no_shortage", "Partial needs the store's shortage report first.")

    now = clock.now(db).replace(tzinfo=None)
    service_date = _service_date(db, c)
    orders = {o.id: o for o in db.scalars(select(order_models.Order).where(order_models.Order.id.in_(list(c.order_ids))))}
    first = orders[c.order_ids[0]]
    ops = repo.operating_days(db)
    next_run = next_operating_day(service_date, ops) if ops else None

    for oid in c.order_ids:
        o = orders[oid]
        if OrderStatus(o.status.value) is not OrderStatus.CONFLICT:
            continue  # already moved on: the record is kept, the status is not touched twice
        if resolution is ConflictRecommendation.KEEP_DELIVERY or (resolution is ConflictRecommendation.KEEP_PARTIAL and oid != order_id):
            event = OrderEvent.RESOLVE_DELIVERED
        elif resolution is ConflictRecommendation.KEEP_PARTIAL:
            event = OrderEvent.RESOLVE_PARTIAL
        else:
            event = OrderEvent.RESOLVE_DEFERRED
        order_service.apply(db, o, event, actor=actor, commit=False, payload={"conflict": c.id, "resolution": resolution.value, "by": actor_name})

    if resolution is not ConflictRecommendation.KEEP_DEFERRAL:
        _withdraw_deferrals(db, service_date, list(c.order_ids), f"Kept the delivery (conflict {c.id})", now)
        db.merge(order_models.OutletServiceHistory(outlet_id=first.outlet_id, service_date=service_date, outcome=HistoryOutcome.SERVED))
    if resolution is ConflictRecommendation.KEEP_PARTIAL and order_id and next_run is not None:
        src = orders[order_id]
        short = ordered - received
        ratio = short / src.units if src.units else 0
        db.add(
            order_models.Order(
                id=f"{order_id}-F", outlet_id=src.outlet_id, service_date=next_run, temp=src.temp, units=short,
                weight_kg=round(src.weight_kg * ratio, 1), volume_m3=round(src.volume_m3 * ratio, 2), status=ServerStatus.CONFIRMED,
                tags=["Follow-up created"], received_at=repo.aware(now), placed_by="system", after_cutoff=False, row_version=1,
            )
        )

    c.status = ConflictStatus.RESOLVED
    c.resolution = resolution.value
    c.resolved_by = actor_name
    c.resolved_by_user_id = audit.user_id_for(db, actor)
    c.resolved_at = repo.aware(now)

    stamp = repo.aware(now)
    word = _RESOLUTION_WORD[resolution.value]
    vehicle = str((c.device_snapshot or {}).get("vehicleId") or "")
    if vehicle:
        db.add(
            Notice(
                audience_kind="driver", vehicle_id=vehicle, tag=NoticeTag.REVIEW, title=f"{first.outlet_id}: resolved: {word}",
                body=f"{' + '.join(c.order_ids)}: {actor_name} settled it. Both records are kept.", link={"screen": "run"},
                refs={"conflictId": c.id}, created_at=stamp,
            )
        )
    label = f"{next_run:%a} {next_run.day} {next_run:%b}" if next_run else "the next run"
    db.add(
        Notice(
            audience_kind="store", outlet_id=first.outlet_id, tag=NoticeTag.DELIVERY, title="Deliveries updated",
            body=(
                f"{' + '.join(c.order_ids)}: Partial ({received} / {ordered}). A follow-up is created for {ordered - received} units."
                if resolution is ConflictRecommendation.KEEP_PARTIAL
                else f"{' + '.join(c.order_ids)}: deferred to {label}." if resolution is ConflictRecommendation.KEEP_DEFERRAL
                else f"{' + '.join(c.order_ids)}: delivered. The deferral is withdrawn."
            ),
            link={"screen": "deliveries"}, refs={"conflictId": c.id}, created_at=stamp,
        )
    )
    if resolution is not ConflictRecommendation.KEEP_DEFERRAL:
        db.add(
            Notice(
                audience_kind="dock", depot_id=repo.load_ref(db).outlets[first.outlet_id].depot, tag=NoticeTag.PLAN,
                title="Re-run removed", body=f"{' + '.join(c.order_ids)}: the {label} re-run is removed from tomorrow's queue.",
                link={"screen": "plan"}, refs={"conflictId": c.id}, created_at=stamp,
            )
        )
    audit.record(
        db, actor=actor, entity_type="conflict", entity_id=str(c.id), type=AuditType.CONFLICT_RESOLVED,
        payload={"resolution": resolution.value, "orderIds": list(c.order_ids), "by": actor_name, "recommended": effective_recommendation(row)[0].value},
        at=stamp,
    )
    db.flush()
    return review(db, conflict_id)
