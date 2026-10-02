"""Reconciliation of device records on sync (PRD §19, handoff 7). The system recommends,
a person confirms: a conflict never overwrites either record.

Rules:

1. ``driver.arrival``, ``loader.check`` and ``driver.problem`` are facts: always accepted.
2. A ``driver.outcome`` (Delivered or Damaged) for an order the server changed in a plan
   version newer than ``plan_version_on_device`` in a way that contradicts it (the order is
   Deferred on the server) is a **conflict**. Delivered with photo and receiver →
   recommendation ``keep_delivery``.
3. Otherwise the outcome applies: Delivered → delivered; Damaged, Refused, Store closed,
   Other → issue with the matching tag.
4. A ``loader.ack`` for a version older than the current one is a conflict (the dock shows
   "Plan changed, review change").
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from .vocab import OrderStatus


class RecordType(StrEnum):
    DRIVER_ACK = "driver.ack"
    DRIVER_START_ROUTE = "driver.startRoute"
    DRIVER_ARRIVAL = "driver.arrival"
    DRIVER_OUTCOME = "driver.outcome"
    DRIVER_PROBLEM = "driver.problem"
    DRIVER_FINISH_RUN = "driver.finishRun"
    LOADER_ACK = "loader.ack"
    LOADER_CHECK = "loader.check"
    LOADER_CONFIRM_LOADED = "loader.confirmLoaded"
    LOADER_EXCEPTION = "loader.exception"


class Outcome(StrEnum):
    DELIVERED = "delivered"
    DAMAGED = "damaged"
    REFUSED = "refused"
    STORE_CLOSED = "store_closed"
    OTHER = "other"


class SyncResult(StrEnum):
    ACCEPTED = "accepted"
    DUPLICATE = "duplicate"
    CONFLICT = "conflict"
    ERROR = "error"


class Recommendation(StrEnum):
    KEEP_DELIVERY = "keep_delivery"
    KEEP_PARTIAL = "keep_partial"
    KEEP_DEFERRAL = "keep_deferral"


FACTS = frozenset({RecordType.DRIVER_ARRIVAL, RecordType.LOADER_CHECK, RecordType.DRIVER_PROBLEM})


@dataclass(frozen=True, slots=True)
class ServerOrderState:
    order_id: str
    status: OrderStatus
    #: Plan version in which the server last changed this order's plan state.
    changed_in_version: int


@dataclass(frozen=True, slots=True)
class DeviceRecord:
    type: RecordType
    plan_version_on_device: int
    outcome: Outcome | None = None
    has_photo: bool = False
    has_receiver: bool = False


@dataclass(slots=True)
class Reconciled:
    result: SyncResult
    new_status: OrderStatus | None = None
    tag: str | None = None
    recommendation: Recommendation | None = None
    reasons: list[str] = field(default_factory=list)


_ISSUE_TAG = {
    Outcome.DAMAGED: "Damaged",
    Outcome.REFUSED: "Refused",
    Outcome.STORE_CLOSED: "Store closed",
    Outcome.OTHER: "Other",
}


def reconcile(state: ServerOrderState | None, record: DeviceRecord, *, current_version: int | None = None) -> Reconciled:
    if record.type in FACTS:
        return Reconciled(SyncResult.ACCEPTED)

    if record.type is RecordType.LOADER_ACK:
        if current_version is not None and record.plan_version_on_device < current_version:
            return Reconciled(SyncResult.CONFLICT, reasons=[f"Plan v{current_version} replaced v{record.plan_version_on_device}"])
        return Reconciled(SyncResult.ACCEPTED)

    if record.type is not RecordType.DRIVER_OUTCOME or state is None or record.outcome is None:
        return Reconciled(SyncResult.ACCEPTED)

    contradicted = (
        state.status is OrderStatus.DEFERRED
        and state.changed_in_version > record.plan_version_on_device
        and record.outcome in (Outcome.DELIVERED, Outcome.DAMAGED)
    )
    if contradicted:
        reasons = [
            "The deferral never reached the driver: the phone was on "
            f"v{record.plan_version_on_device}, the deferral is in v{state.changed_in_version}",
        ]
        if record.outcome is Outcome.DELIVERED and record.has_photo and record.has_receiver:
            reasons.insert(0, "The goods are at the store, with photo, receiver and units")
            reasons.append("Reversing means a return trip for goods already received")
            rec = Recommendation.KEEP_DELIVERY
        else:
            rec = Recommendation.KEEP_DEFERRAL
        return Reconciled(SyncResult.CONFLICT, OrderStatus.CONFLICT, recommendation=rec, reasons=reasons)

    if record.outcome is Outcome.DELIVERED:
        return Reconciled(SyncResult.ACCEPTED, OrderStatus.DELIVERED)
    return Reconciled(SyncResult.ACCEPTED, OrderStatus.ISSUE, tag=_ISSUE_TAG[record.outcome])
