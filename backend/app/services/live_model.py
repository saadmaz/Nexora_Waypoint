"""Plain data for the live board (D6), the inbox and the reconciliation screen (D7). No database, no FastAPI."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from waypoint_rules.reconcile import Recommendation
from waypoint_rules.vocab import OrderStatus

from ..models.enums import ConflictStatus
from .dispatch_model import DispatchDay, TripRow
from .exception_logic import ExceptionRow


@dataclass(frozen=True, slots=True)
class RunRow:
    """One run of one trip: when it left, and the last time the phone was heard from."""

    vehicle_id: str
    trip_no: int
    #: Naive Asia/Colombo.
    departed_at: datetime | None
    finished_at: datetime | None
    last_heard_at: datetime | None
    #: The plan version number the phone says it holds.
    plan_version_seen: int | None
    #: What the sync that last spoke to this run did: "5 synced · 1 conflict".
    sync_note: str | None = None


@dataclass(frozen=True, slots=True)
class ConflictRow:
    """Two true records for one stop (D7). Written by ``/sync`` when the device and the server disagree."""

    id: int
    order_ids: tuple[str, ...]
    server_snapshot: dict[str, object]
    device_snapshot: dict[str, object]
    recommendation: Recommendation
    reasons: tuple[str, ...]
    status: ConflictStatus
    resolution: str | None
    resolved_by: str | None
    resolved_at: datetime | None


@dataclass(slots=True)
class LiveDay:
    """Everything the live board needs for the run: the plan, how far the orders have got, and who is out of touch."""

    day: DispatchDay
    #: Trips by plan version number, so a stop the phone still has (a later deferral it has not received) can be shown.
    trips_by_version: dict[int, list[TripRow]] = field(default_factory=dict)
    #: Every order of the run and its status now (deferred orders included).
    status: dict[str, OrderStatus] = field(default_factory=dict)
    #: When an order's outcome was recorded, and when the store confirmed receipt.
    outcome_at: dict[str, datetime] = field(default_factory=dict)
    receipt_at: dict[str, datetime] = field(default_factory=dict)
    #: (vehicle, outlet) -> when the driver arrived.
    arrivals: dict[tuple[str, str], datetime] = field(default_factory=dict)
    runs: dict[tuple[str, int], RunRow] = field(default_factory=dict)
    #: The latest plan version number each driver acknowledged (stands in for "what the phone holds" before a run exists).
    acknowledged: dict[str, int] = field(default_factory=dict)
    exceptions: list[ExceptionRow] = field(default_factory=list)
    conflicts: list[ConflictRow] = field(default_factory=list)
    #: (vehicle, trip) -> what the dock counted short, by order id. A short load is Dispatch's to know about.
    short_loaded: dict[tuple[str, int], dict[str, int]] = field(default_factory=dict)
    #: The latest released plan version number.
    released_number: int | None = None
