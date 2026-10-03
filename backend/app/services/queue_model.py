"""Plain data for the order queue (D1) and the order history drawer (D1.5). No database, no FastAPI."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

from waypoint_rules import OutletHistory, RefData, VehicleDay
from waypoint_rules.vocab import Brand, OrderStatus, Temp

from .dispatch_model import DeferralRow, OutletRow


@dataclass(frozen=True, slots=True)
class QueueOrderRow:
    id: str
    outlet_id: str
    temp: Temp
    units: int
    weight_kg: float
    volume_m3: float
    status: OrderStatus
    #: Naive Asia/Colombo.
    received_at: datetime | None
    #: Placed after 16:00: it belongs to the following run, and the queue shows it with a tag.
    after_cutoff: bool
    service_date: date


@dataclass(frozen=True, slots=True)
class QueueFilter:
    """What the filter panel and the search box send. An empty list means "any"."""

    brand: tuple[Brand, ...] = ()
    temp: tuple[Temp, ...] = ()
    status: tuple[OrderStatus, ...] = ()
    #: "early" (opens before 05:00), "mid" (05:00 to 06:00), "late" (after 06:00).
    window: tuple[str, ...] = ()
    #: Queue tags ("Carry-over", "Protected", "After cutoff", "No legal vehicle") and access tags ("Van only", "Mall dock").
    tags: tuple[str, ...] = ()
    district: tuple[str, ...] = ()
    search: str = ""

    @property
    def active(self) -> bool:
        return bool(self.brand or self.temp or self.status or self.window or self.tags or self.district or self.search.strip())


@dataclass(slots=True)
class QueueDay:
    """Everything the queue view needs for one service date."""

    service_date: date
    #: Naive Asia/Colombo scenario time.
    now: datetime
    #: 16:00 on the last operating day before ``service_date``.
    cutoff: datetime
    #: The run an after-cutoff order moves to.
    following_run: date
    ref: RefData
    outlets: dict[str, OutletRow]
    rows: list[QueueOrderRow]
    history: dict[str, OutletHistory]
    vehicle_days: dict[str, VehicleDay]


@dataclass(frozen=True, slots=True)
class AuditRow:
    """One audit event about an order, oldest first when listed."""

    at: datetime
    actor: str
    #: The order event it recorded ("cutoff", "plan", "defer", "load", "depart", "deliver"...), or the audit type.
    event: str


@dataclass(frozen=True, slots=True)
class HistoryRun:
    """An outlet's outcome on one earlier run."""

    day: date
    outcome: str


@dataclass(slots=True)
class HistoryInput:
    """What the history drawer needs beyond the queue itself."""

    order_id: str
    audit: list[AuditRow] = field(default_factory=list)
    runs: list[HistoryRun] = field(default_factory=list)
    deferral: DeferralRow | None = None
