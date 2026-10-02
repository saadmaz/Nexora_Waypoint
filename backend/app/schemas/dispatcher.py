"""DispatcherApi schemas (PRD §19: operation names are the proposal, open decision O-6)."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from pydantic import Field

from waypoint_rules.vocab import Binding, Brand, DeferralType, OrderStatus, Temp

from ..models.enums import ConflictRecommendation, ConflictStatus, ExceptionStatus, PlanState
from .base import ApiModel
from .common import Violation, Window

# ---- D1 queue ---------------------------------------------------------------


class QueueOrderOut(ApiModel):
    id: str
    outlet_id: str
    outlet_name: str | None = None
    brand: Brand
    district: str
    temp: Temp
    units: int
    weight_kg: float
    volume_m3: float
    status: OrderStatus
    tags: list[str]
    window: Window
    received_at: datetime | None = None
    after_cutoff: bool


class QueueOut(ApiModel):
    depot: str
    service_date: date
    orders: list[QueueOrderOut]
    counts: dict[str, int] = Field(description="Orders per status")


class HistoryEventOut(ApiModel):
    at: datetime
    actor: str
    type: str
    payload: dict


# ---- D2 capacity ------------------------------------------------------------


class BindingOut(ApiModel):
    resource: Binding
    demand: float
    supply: float
    percent: float
    over_by: float


class VehicleCapacityOut(ApiModel):
    vehicle_id: str
    type: str
    temp: str
    availability: str
    available_from: datetime | None = None
    weight_cap_kg: float
    volume_cap_m3: float


class CapacityOut(ApiModel):
    depot: str
    service_date: date
    headline: str
    binding: BindingOut
    vehicles_available: int
    vehicles_total: int
    reefers_available: int
    reefers_total: int
    vehicles: list[VehicleCapacityOut]


# ---- D3 plan ----------------------------------------------------------------


class StopOut(ApiModel):
    order_id: str
    outlet_id: str
    seq: int
    load_no: int
    planned_arrival: datetime | None = None
    handling_start: datetime | None = None
    handling_end: datetime | None = None
    kg: float
    m3: float


class TripOut(ApiModel):
    id: int
    vehicle_id: str
    trip_no: int
    brand: Brand
    district: str
    depart_at: datetime
    minutes: int
    kg: float
    m3: float
    planned_km: float
    planned_fuel_l: float
    stops: list[StopOut]


class PlanVersionOut(ApiModel):
    id: int
    number: int
    state: PlanState
    note: str | None = None
    created_by: str | None = None
    created_at: datetime
    released_at: datetime | None = None


class DeferralOut(ApiModel):
    id: int
    order_id: str
    outlet_id: str
    type: DeferralType
    binding: Binding | None = None
    reason_text: str
    impact: dict
    frees: dict
    next_run_date: date | None = None
    decided_by: str | None = None
    notice_sent_at: datetime | None = None
    notice_seen_at: datetime | None = None
    withdrawn_at: datetime | None = None


class PlanOut(ApiModel):
    version: PlanVersionOut
    versions: list[PlanVersionOut]
    trips: list[TripOut]
    deferrals: list[DeferralOut]


class MoveAction(StrEnum):
    MOVE = "move"
    DEFER = "defer"
    SERVE = "serve"


class MoveIn(ApiModel):
    action: MoveAction = MoveAction.MOVE
    order_id: str
    to_vehicle_id: str | None = None
    to_trip_no: int | None = None
    #: Position in the target trip (1 = first stop). Omit to append.
    to_seq: int | None = None


class TripSummaryOut(ApiModel):
    vehicle_id: str
    trip_no: int
    minutes: int
    kg: float
    m3: float
    stops: int


class ConsequenceOut(ApiModel):
    source_before: TripSummaryOut | None = None
    source_after: TripSummaryOut | None = None
    target_before: TripSummaryOut | None = None
    target_after: TripSummaryOut | None = None
    deferral_changes: list[str] = Field(default_factory=list)


class MoveResultOut(ApiModel):
    ok: bool
    #: Every violation, not just the first (D3.4 shows two).
    violations: list[Violation]
    consequence: ConsequenceOut | None = None


class SaveMovesIn(ApiModel):
    moves: list[MoveIn] = Field(min_length=1)
    note: str | None = None


class ReleasePlanIn(ApiModel):
    #: The draft to release. Omit for the current draft.
    version: int | None = None


class DeferralsOut(ApiModel):
    depot: str
    headline: str
    capacity_count: int
    policy_count: int
    deferrals: list[DeferralOut]


class NotifyDeferralsIn(ApiModel):
    deferral_ids: list[int] = Field(min_length=1)


class NotifyDeferralsOut(ApiModel):
    sent: int


class AcknowledgementOut(ApiModel):
    actor_kind: str
    actor_id: str
    dock: str | None = None
    vehicle_id: str | None = None
    acknowledged_at: datetime | None = None
    pending: bool


# ---- D6 live board, D7 conflicts, D8 exceptions -----------------------------


class LiveRowOut(ApiModel):
    vehicle_id: str
    trip_no: int
    driver: str | None = None
    plan_version: int
    next_stop: str | None = None
    stops_done: int
    stops_total: int
    last_heard_at: datetime | None = None
    status: OrderStatus
    lateness: str | None = None
    tags: list[str] = Field(default_factory=list)


class LiveBoardOut(ApiModel):
    depot: str
    as_of: datetime
    rows: list[LiveRowOut]


class DeferStopIn(ApiModel):
    order_ids: list[str] = Field(min_length=1)
    type: DeferralType
    reason: str


class InboxItemOut(ApiModel):
    kind: str = Field(description="conflict, exception or notice")
    id: str
    title: str
    body: str
    at: datetime
    link: dict


class InboxOut(ApiModel):
    items: list[InboxItemOut]


class ConflictOut(ApiModel):
    id: int
    order_ids: list[str]
    server_snapshot: dict
    device_snapshot: dict
    recommendation: ConflictRecommendation
    reasons: list[str]
    status: ConflictStatus
    resolution: str | None = None
    resolved_by: str | None = None
    resolved_at: datetime | None = None


class ResolveConflictIn(ApiModel):
    resolution: ConflictRecommendation
    note: str | None = None


class ExceptionOut(ApiModel):
    id: int
    kind: str
    type: str
    vehicle_id: str | None = None
    trip_id: int | None = None
    order_ids: list[str]
    units_short: dict
    detail: str | None = None
    raised_by: str | None = None
    raised_at: datetime
    status: ExceptionStatus
    decision: dict | None = None
    #: The recommended deferral set for a vehicle swap (D8).
    recommendation: dict | None = None


class DecideExceptionIn(ApiModel):
    #: ``swap_vehicle``, ``defer_orders`` or ``proceed``.
    decision: str
    replacement_vehicle_id: str | None = None
    defer_order_ids: list[str] = Field(default_factory=list)
    note: str | None = None


# ---- D9 forecast ------------------------------------------------------------


class ForecastWeekOut(ApiModel):
    iso_year: int
    iso_week: int
    demand_minutes: float
    capacity_minutes: float


class ForecastOut(ApiModel):
    label: str = "Baseline forecast: Datathon Task 2A model not wired in"
    weeks: list[ForecastWeekOut]
