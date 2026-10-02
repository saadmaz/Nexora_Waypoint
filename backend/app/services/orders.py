"""Order state changes. Every change goes through ``waypoint_rules.transition`` and writes an audit row in the same transaction."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from waypoint_rules import OrderEvent, OrderStatus, transition

from .. import clock
from ..models.enums import AuditType, ServerStatus
from ..models.orders import Order
from . import audit

#: The audit type each event is recorded under, unless the caller passes one.
_AUDIT_FOR: dict[OrderEvent, AuditType] = {
    OrderEvent.CUTOFF: AuditType.CUTOFF_CLOSED,
    OrderEvent.CANCEL: AuditType.ORDER_CANCELLED,
    OrderEvent.PLAN: AuditType.PLAN_DRAFTED,
    OrderEvent.DEFER: AuditType.ORDER_DEFERRED,
    OrderEvent.WITHDRAW_DEFERRAL: AuditType.ORDER_DEFERRED,
    OrderEvent.LOAD: AuditType.LOAD_CONFIRMED,
    OrderEvent.DEPART: AuditType.RUN_STARTED,
    OrderEvent.DELIVER: AuditType.OUTCOME_RECORDED,
    OrderEvent.FAIL: AuditType.OUTCOME_RECORDED,
    OrderEvent.SHORTFALL: AuditType.RECEIPT_CONFIRMED,
    OrderEvent.CONFLICT: AuditType.CONFLICT_OPENED,
    OrderEvent.RESOLVE_DELIVERED: AuditType.CONFLICT_RESOLVED,
    OrderEvent.RESOLVE_PARTIAL: AuditType.CONFLICT_RESOLVED,
    OrderEvent.RESOLVE_DEFERRED: AuditType.CONFLICT_RESOLVED,
}


def apply(
    db: Session,
    order: Order,
    event: OrderEvent,
    *,
    actor: str,
    audit_type: AuditType | None = None,
    payload: dict[str, Any] | None = None,
    commit: bool = True,
) -> Order:
    """Apply ``event`` to ``order`` and record it.

    An illegal transition raises ``IllegalTransition`` (a 409) before anything is changed. The new status
    and the audit row are flushed together; with ``commit=True`` (the default) they are committed in one
    transaction. Pass ``commit=False`` to batch several orders into one transaction.
    """
    before = OrderStatus(order.status.value)
    after = transition(before, event)  # raises IllegalTransition

    order.status = ServerStatus(after.value)
    now = clock.now(db)
    if event is OrderEvent.CANCEL:
        order.cancelled_at = now
    audit.record(
        db,
        actor=actor,
        entity_type="order",
        entity_id=order.id,
        type=audit_type or _AUDIT_FOR[event],
        payload={"event": event.value, "from": before.value, "to": after.value, **(payload or {})},
        at=now,
    )
    db.flush()
    if commit:
        db.commit()
    return order
