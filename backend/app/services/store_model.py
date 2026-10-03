"""Plain data for the store's delivery days (S2, S3, S4). No database, no FastAPI.

``store_repo`` fills these from the tables, ``store_views`` turns them into the schemas the S2 to S4
screens read. The split is the one ``live_model`` / ``live_repo`` / ``live_views`` uses, and it is what
makes the wording testable without a session.

Every time here is **naive Asia/Colombo**, converted once at the repository boundary, because that is
what the store's screens format with the browser's own date functions (Contributing §19 Time).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

from waypoint_rules.vocab import DeferralType, OrderStatus, Temp

from ..models.enums import ConflictStatus, ExceptionStatus


@dataclass(frozen=True, slots=True)
class OutletFacts:
    """The outlet behind the token, as the store's own screens name it."""

    id: str
    name: str
    district: str
    #: The human label, "Rear dock", never ``rear_dock``.
    dock: str
    #: The window the store is told to expect, a mall bay's being the mall's.
    window_open: datetime
    window_close: datetime


@dataclass(frozen=True, slots=True)
class OrderFacts:
    id: str
    temp: Temp
    units: int
    status: OrderStatus
    received_at: datetime | None
    #: Units the driver recorded as delivered, when an outcome has landed.
    delivered_units: int | None = None


@dataclass(frozen=True, slots=True)
class DeferralFacts:
    id: int
    type: DeferralType
    reason: str
    decided_by: str
    decided_at: datetime | None
    next_run_date: date | None
    seen_at: datetime | None
    withdrawn_at: datetime | None
    withdrawn_reason: str | None


@dataclass(frozen=True, slots=True)
class ReceiptFacts:
    order_id: str
    units_received: int
    shortfall_reason: str | None
    confirmed_at: datetime
    confirmed_by: str | None


@dataclass(frozen=True, slots=True)
class IssueFacts:
    id: int
    type: str
    #: Units affected per order, in the order the report named them.
    units: dict[str, int]
    order_ids: tuple[str, ...]
    note: str | None
    photo: bool
    raised_at: datetime
    status: ExceptionStatus


@dataclass(frozen=True, slots=True)
class ConflictFacts:
    """A review the store is shown (S2.7). The store never reads the word "conflict"."""

    id: int
    status: ConflictStatus
    asked_at: datetime | None
    delivered_at: datetime | None
    received_by: str | None
    #: The store has already answered "Did you receive this delivery?", either way.
    answered: bool
    #: The answer was a shortage report, so the delivery is not settled: D7.4 B makes it Partial.
    reported_short: bool
    resolved_at: datetime | None


@dataclass(frozen=True, slots=True)
class ProofFacts:
    """What the driver recorded at the stop (A13)."""

    at: datetime
    received_by: str
    driver: str
    vehicle: str


@dataclass(slots=True)
class DeliveryDay:
    """One service date for one outlet: everything S2 and S3 show about it."""

    outlet: OutletFacts
    service_date: date
    #: Scenario time, naive Asia/Colombo.
    now: datetime
    orders: list[OrderFacts] = field(default_factory=list)

    #: 16:00 on the last operating day before this one: when the queue closed (R-CUTOFF).
    cutoff_at: datetime | None = None
    #: The plan has been released, so an arrival time exists (23:40 the evening before).
    released: bool = False
    released_at: datetime | None = None
    #: The vehicle the orders are on in the released plan.
    vehicle: str | None = None
    #: Predicted arrival at this outlet from the planned clock.
    predicted_arrival: datetime | None = None

    loaded_at: datetime | None = None
    #: "Kandy dock".
    loaded_place: str | None = None
    departed_at: datetime | None = None
    finished_at: datetime | None = None
    #: The last time the driver's phone was heard from, when it has gone quiet since.
    last_heard_at: datetime | None = None

    deferral: DeferralFacts | None = None
    conflict: ConflictFacts | None = None
    proof: ProofFacts | None = None
    receipts: list[ReceiptFacts] = field(default_factory=list)
    issues: list[IssueFacts] = field(default_factory=list)
    #: The next operating day after this one, for a deferral's labels.
    next_run: date | None = None

    def order(self, order_id: str) -> OrderFacts | None:
        return next((o for o in self.orders if o.id == order_id), None)

    @property
    def receipt_of(self) -> dict[str, ReceiptFacts]:
        return {r.order_id: r for r in self.receipts}


@dataclass(frozen=True, slots=True)
class HistoryDay:
    """One past delivery day for the S4.2 and S2.10 lists."""

    service_date: date
    order_count: int
    status: OrderStatus
    order_ids: tuple[str, ...]
    delivered_at: datetime | None
    short_units: int
    deferral_type: DeferralType | None
    next_run_date: date | None
    served_next_day: bool
    deferral_withdrawn: bool
    receipt_confirmed_at: datetime | None
    #: The current run, the only row whose delivery can still be opened (PRD §3 S4).
    current: bool


@dataclass(frozen=True, slots=True)
class NoticeFacts:
    """One row of the S4 feed, as the order record sent it (handoff 14)."""

    id: int
    tag: str
    title: str
    body: str
    link: dict[str, object]
    refs: dict[str, object]
    created_at: datetime
    read_at: datetime | None
    #: Set on a review row once Dispatch has settled it.
    resolved_at: datetime | None = None
    #: The delivery day a "View" on this row opens.
    service_date: date | None = None
