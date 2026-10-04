"""StoreApi schemas (PRD §19). Field names mirror ``frontend/src/domain`` so the real client is a swap."""

from __future__ import annotations

from datetime import date

from pydantic import Field

from waypoint_rules.vocab import DeferralType, OrderStatus, Temp

from .base import ApiModel
from .common import Window


class OrderLineOut(ApiModel):
    id: str
    kind: Temp
    units: int
    estimated_kg: float
    estimated_m3: float


class DeferralNoticeOut(ApiModel):
    type: DeferralType
    reason: str
    decided_by: str
    next_run: str | None = None


class OrderOut(ApiModel):
    id: str
    outlet_id: str
    outlet_name: str
    district: str
    delivery_date: date
    dock: str
    window: Window
    line: OrderLineOut
    status: OrderStatus
    received_at: str
    updated_at: str | None = None
    after_cutoff: bool
    arrival: Window | None = None
    deferral: DeferralNoticeOut | None = None


class UnitFactor(ApiModel):
    kg: float
    m3: float


class OrderDraftOut(ApiModel):
    outlet_id: str
    delivery_date: date
    after_cutoff: bool
    window: Window
    dock: str
    unit_factors: dict[Temp, UnitFactor]
    default_units: dict[Temp, int]
    orders: list[OrderOut]


class NewOrderLine(ApiModel):
    kind: Temp
    units: int = Field(gt=0)
    estimated_kg: float
    estimated_m3: float


class NewOrderIn(ApiModel):
    outlet_id: str
    delivery_date: date
    line: NewOrderLine


class PlaceOrdersIn(ApiModel):
    """Chilled and dry are placed together: all are received or none is."""

    orders: list[NewOrderIn] = Field(min_length=1)


class EditOrderIn(ApiModel):
    units: int = Field(gt=0)
    estimated_kg: float
    estimated_m3: float


class DeliveryOrderOut(ApiModel):
    id: str
    kind: Temp
    units: int
    status: OrderStatus
    issue: str | None = None
    received: int | None = None


class ArrivalRange(ApiModel):
    from_: str = Field(alias="from")
    may_arrive_at: str | None = None


class JourneyStepOut(ApiModel):
    step: str
    actor: str
    at: str | None = None
    state: str = Field(description="done, current or pending")


class DeliveryDeferralOut(ApiModel):
    id: int
    type: DeferralType
    headline: str
    subline: str | None = None
    explanation: str | None = None
    reason: str
    decided_by: str
    decided_at: str
    next_run_label: str
    next_run: str
    next_run_short: str
    acknowledged: bool


class ReviewOut(ApiModel):
    """Why the store sees "Under review" (S2.7, S3.1). Stores never see the word "Conflict"."""

    asked_at: str
    delivered_at: str
    received_by: str
    conflict_id: str
    #: A51: true only once Dispatch has asked ("Review with store first", D7.2). The explanation shows
    #: either way; the question "Did you receive this delivery?" waits for this.
    asked: bool = False


class ProofOfDeliveryOut(ApiModel):
    received_by: str
    at: str
    driver: str
    vehicle: str
    units: list[int]


class IssueLineOut(ApiModel):
    order_id: str
    kind: Temp
    units: int
    order_units: int


class IssueOut(ApiModel):
    id: str
    outlet_id: str
    date: date
    type: str
    lines: list[IssueLineOut]
    note: str | None = None
    photo: bool
    reported_at: str
    resolved: bool


class DeliveryOut(ApiModel):
    date: date
    outlet_id: str
    outlet_name: str
    district: str
    window: Window
    dock: str
    vehicle: str | None = None
    orders: list[DeliveryOrderOut]
    status: OrderStatus
    journey: list[JourneyStepOut]
    arrival: ArrivalRange | None = None
    plan_pending: bool
    loaded: dict[str, str] | None = None
    on_the_way: dict[str, str] | None = None
    last_update: str | None = None
    receivers_cue: bool
    deferral: DeliveryDeferralOut | None = None
    review: ReviewOut | None = None
    proof: ProofOfDeliveryOut | None = None
    tags: list[str] = Field(default_factory=list)
    withdrawn_note: str | None = None
    receipt_confirmed_at: str | None = None
    receipt_by: str | None = None
    shortfall_reason: str | None = None
    issues: list[IssueOut] = Field(default_factory=list)
    received_answered: bool = False


class RecentOrderDayOut(ApiModel):
    date: date
    order_count: int
    status: OrderStatus
    deferral: dict[str, str] | None = None
    delivered_at: str | None = None
    short_units: int | None = None
    served_next_day: bool | None = None
    order_ids: list[str] | None = None
    deferral_withdrawn: bool | None = None
    receipt_confirmed_at: str | None = None
    current: bool | None = None


class ReceiptLine(ApiModel):
    order_id: str
    received: int = Field(ge=0)


class ConfirmReceiptIn(ApiModel):
    date: date
    lines: list[ReceiptLine] = Field(min_length=1)
    #: Asked for when any count is below what was expected.
    reason: str | None = None
    #: ``HH:MM`` on the phone when the button was pressed, for a confirmation saved offline.
    device_time: str | None = None


class IssueLineIn(ApiModel):
    order_id: str
    units: int = Field(gt=0)


class ReportIssueIn(ApiModel):
    date: date
    type: str
    lines: list[IssueLineIn] = Field(min_length=1)
    note: str | None = None
    photo: bool = False


class AnswerReceivedIn(ApiModel):
    answer: str = Field(pattern="^received$")


class StoreUpdateOut(ApiModel):
    id: str
    tag: str
    date: date
    time: str
    title: str
    body: str
    view_label: str | None = None
    target: dict[str, str]
    unread: bool
    resolved_at: str | None = None


class UpdatesFeedOut(ApiModel):
    updates: list[StoreUpdateOut]
    unread: int
