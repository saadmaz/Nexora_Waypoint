"""DispatcherApi schemas (PRD §19).

These mirror the view types the dispatcher screens already use (``frontend/src/api/DispatcherApi.ts``) field for
field, so the real client can swap in for the mock one operation at a time. The server computes everything a screen
shows: rules and figures come from ``waypoint_rules``, and the wording (headlines, banners, ETA lines) is built here
from those figures. The screens never re-implement a rule (Contributing §19).

Three conventions, each decided with the screens' owner:

* Times are ``"HH:MM"`` strings on the scenario clock (Asia/Colombo). Dates are ISO ``YYYY-MM-DD``.
* Enum fields carry the system's machine values (``store_request``, ``keep_delivery``, ``ordered``). The web client
  maps them to display text, in one place.
* Conflict and exception ids are integers in the database and in URLs, and strings in the views (``"7"``).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import Field

from waypoint_rules.vocab import Brand, DeferralType, OrderStatus, Temp

from ..models.enums import ConflictRecommendation, PlanState
from .base import ApiModel

DepotId = Literal["peliyagoda", "kandy"]


class TimeRange(ApiModel):
    start: str = Field(examples=["05:30"])
    end: str = Field(examples=["08:00"])


class LabelledMeter(ApiModel):
    label: str
    used: float
    limit: float
    unit: str


class DepotCounts(ApiModel):
    peliyagoda: int
    kandy: int


# ---- D1 · Order queue -------------------------------------------------------

QueueTag = Literal["Carry-over", "Protected", "After cutoff", "No legal vehicle"]


class QueueOrder(ApiModel):
    id: str
    outlet_id: str
    brand: Brand
    district: str
    temp: Temp
    #: Dock and access tags: "Rear dock", "Street", "Van only", "Mall bay", "Mall dock".
    access: list[str]
    window: TimeRange
    #: The window is a mall slot, drawn as a tag.
    mall_window: bool
    units: int
    kg: float
    m3: float
    status: OrderStatus
    tags: list[QueueTag]
    #: When the store sent it, "13:41".
    received_at: str
    #: One line under the status tags: why it is flagged.
    note: str | None = None
    #: Carry-overs show their age in the Received cell.
    days_since_served: int | None = None
    #: Arrived in the last few minutes before the cutoff.
    just_in: bool | None = None


class OutletInfo(ApiModel):
    id: str
    brand: Brand | None = None
    dock: str | None = None
    window: TimeRange | None = None
    note: str | None = None


class QueueGroup(ApiModel):
    key: str
    #: "Carry-overs · 2", "Other orders", "OUT084 · Waypoint Fresh · Kandy".
    title: str
    kind: Literal["carry", "other", "outlet"]
    outlet: OutletInfo | None = None
    orders: list[QueueOrder]


class QueueCutoff(ApiModel):
    closed: bool
    at: str
    minutes_left: int


class DayFlag(ApiModel):
    """One thing about the service day that changes demand or travel (calendar.csv)."""

    kind: Literal["payday", "festival", "weekend", "monsoon", "holiday"]
    label: str
    #: What it means for tonight's plan, in a few words.
    detail: str


class ServiceDayInfo(ApiModel):
    """The service day as the calendar sees it, shown above the queue and the capacity board."""

    #: "Tue 29 Sep".
    label: str
    flags: list[DayFlag]
    #: Where a deferral goes: the next operating day, "Wed 30 Sep". Null when the calendar has none.
    next_run: str | None = None


class QueueView(ApiModel):
    depot: DepotId
    service_date: date
    #: Before 16:00 the queue fills live and Capacity is locked.
    cutoff: QueueCutoff
    counts: DepotCounts
    carry_overs: int
    #: Orders flagged "No legal vehicle" at this depot.
    at_risk: int
    groups: list[QueueGroup]
    #: Payday, festival, weekend, monsoon and the next run, for the service day.
    day: ServiceDayInfo | None = None
    #: Rows on screen, and orders in the whole queue.
    shown: int
    total: int
    #: Orders matching the filters, when any are on.
    matching: int | None = None
    #: Carry-overs a filter hides, so the screen can say so.
    hidden_carry_overs: int
    #: When the newest row arrived.
    last_received: str | None = None


class OrderHistoryRun(ApiModel):
    date: str
    outcome: Literal["served", "deferred", "pending"]
    label: str


class OrderJourneyStep(ApiModel):
    step: Literal["Ordered", "Confirmed", "Planned", "Loaded", "Departed", "Delivered", "Receipt confirmed"]
    #: "Store · 15:12" once it happened.
    by: str | None = None
    state: Literal["done", "current", "pending"]


class Continuity(ApiModel):
    protected: bool
    text: str


class OrderHistory(ApiModel):
    order: QueueOrder
    outlet_name: str
    #: "Fresh · Colombo · chilled · rear dock".
    summary: str
    continuity: Continuity
    last_runs: list[OrderHistoryRun]
    journey: list[OrderJourneyStep]
    notes: list[str]


# ---- D2 · Capacity ----------------------------------------------------------


class PlanSummaryRef(ApiModel):
    number: int
    state: PlanState
    at: str
    released_at: str | None = None


class DeferralTotals(ApiModel):
    total: int
    capacity: int
    policy: int


class CapacityBinding(ApiModel):
    resource: str
    demand: float
    supply: float
    available: float
    per_vehicle: float
    percent: float
    over_by: float


class ReeferCounts(ApiModel):
    available: int
    total: int
    note: str


class VehicleCounts(ApiModel):
    available: int
    total: int
    in_workshop: int


class VehicleCard(ApiModel):
    label: str
    vehicle_id: str
    used: float
    limit: float
    unit: str
    note: str


class ClosestCard(VehicleCard):
    caption: str


class PoolInfo(ApiModel):
    depot: DepotId
    orders: int
    deferred: int
    enough: bool


class SpareVehicle(ApiModel):
    vehicle_id: str
    label: str
    kg: float
    m3: float
    since: str


class FleetClass(ApiModel):
    label: str
    count: int
    chilled: bool
    kind: Literal["reefer-truck", "dry-truck", "reefer-van", "ambient-van"]


class Fleet(ApiModel):
    total: int
    classes: list[FleetClass]


class CapacityLane(ApiModel):
    vehicle_id: str
    title: str
    summary: str
    meters: list[LabelledMeter]


class ReleasedTotals(ApiModel):
    orders: int
    served: int
    deferred: int
    at: str


class CapacityView(ApiModel):
    depot: DepotId
    service_date: date
    #: Orders in this depot's queue.
    orders: int
    #: Null until the 16:05 draft exists.
    plan: PlanSummaryRef | None
    #: Payday, festival, weekend, monsoon and the next run, for the service day.
    day: ServiceDayInfo | None = None
    deferrals: DeferralTotals
    #: The binding resource. Null when the depot has enough capacity.
    binding: CapacityBinding | None
    reefers: ReeferCounts
    vehicles: VehicleCounts
    #: Two sample cards: the worst case, not the fleet total.
    busiest: VehicleCard
    closest: ClosestCard
    #: The other depot's pool, never pooled with this one.
    pool: PoolInfo
    #: A vehicle that became available after the draft.
    spare: SpareVehicle | None = None
    fleet: Fleet | None = None
    lane: CapacityLane | None = None
    released: ReleasedTotals | None = None
    #: Kandy: how full the Fresh minutes are, 0 to 1.
    fresh_use: float | None = None


# ---- D3 · Trip board --------------------------------------------------------


class PlanVersionInfo(ApiModel):
    number: int
    state: PlanState
    #: "Mon 16:05".
    at: str
    note: str
    #: Which depots it covers.
    scope: str | None = None
    current: bool


class PlanStop(ApiModel):
    #: "ORD2001 + ORD2002" for a stop with several order records.
    order_id: str
    order_ids: list[str]
    outlet_id: str
    seq: int
    #: Planned arrival, "03:54".
    arrival: str
    note: str | None = None
    protected: bool
    kg: float
    m3: float
    #: The window the rules hold this stop to: the outlet's, narrowed by the mall's access hours for a mall bay.
    window: TimeRange | None = None
    #: Dock and access: "Rear dock", "Street", "Mall bay", "Van only", "Mall 06:00–09:30".
    access: list[str] = []


class Fill(ApiModel):
    kg: float
    m3: float
    minutes: float


class PlanTrip(ApiModel):
    vehicle_id: str
    trip: int
    departs: str
    brand: Brand
    district: str
    stops: list[PlanStop]
    kg: float
    kg_cap: float | None
    m3: float
    m3_cap: float | None
    minutes: int
    #: Bar fill for each figure, 0 to 1.
    fill: Fill


class PlanLane(ApiModel):
    vehicle_id: str
    kind: str
    reefer: bool
    #: ``idle``: available all morning with no trip yet, so the dispatcher can start one on it.
    status: Literal["active", "idle", "workshop", "spare", "replaced"]
    workshop_until: str | None = None
    #: The vehicle's driver. Each vehicle has one, so a run on this vehicle is that driver's run.
    driver: str | None = None
    #: The trip number a move would start on this vehicle, or null when it cannot take another (two trips, held, replaced).
    next_trip: int | None = None
    meters: list[LabelledMeter]
    trips: list[PlanTrip]


class DeferredCard(ApiModel):
    order_id: str
    outlet_id: str
    brand: Brand
    temp: Temp
    kind: DeferralType
    #: "van access", "window": the binding resource tag.
    binding: str
    next_run: str
    kg: float
    m3: float
    window: TimeRange
    dock: str
    district: str


class DepotReceivers(ApiModel):
    depot: DepotId
    orders: int
    served: int
    deferred: int
    receivers: str


class Receivers(ApiModel):
    docks: int
    drivers: int


class PlanReleaseSummary(ApiModel):
    orders: int
    served: int
    deferred: int
    capacity_deferred: int
    policy_deferred: int
    trips: int
    receivers: Receivers
    by_depot: list[DepotReceivers]


class PlanCheck(ApiModel):
    text: str
    ok: bool


class PlanView(ApiModel):
    depot: DepotId
    version: PlanVersionInfo
    versions: list[PlanVersionInfo]
    #: Released versions are read-only.
    read_only: bool
    lanes: list[PlanLane]
    deferred: list[DeferredCard]
    #: Deferred orders at this depot; the pool shows a few and "+N more".
    deferred_total: int
    #: What Release shows (D5).
    summary: PlanReleaseSummary
    checks: list[PlanCheck]
    #: Two docks and every driver must have this version.
    ready_to_release: bool


class MoveTarget(ApiModel):
    #: ``null`` with ``deferred`` true means "leave this order out of the plan".
    vehicle_id: str | None = None
    trip: int | None = None
    deferred: bool = False


class MoveRequest(ApiModel):
    order_id: str
    #: A trip the plan does not have yet is started by the move, if it is that vehicle's ``next_trip`` (see ``PlanLane``).
    to: MoveTarget
    #: Why the dispatcher defers it. Required when ``to.deferred`` is true on save; ignored otherwise.
    reason: str | None = Field(default=None, max_length=200)


class RuleCheck(ApiModel):
    rule: str
    detail: str
    ok: bool


class MoveViolation(ApiModel):
    rule: str
    text: str


class PreviewRow(ApiModel):
    label: str
    text: str
    before: float | None = None
    after: float | None = None
    limit: float | None = None
    ok: bool


class PreviewSource(ApiModel):
    title: str
    frees: str


class MovePreview(ApiModel):
    headline: str
    rows: list[PreviewRow]
    source: PreviewSource | None = None
    note: str
    verdict: str


class MoveResult(ApiModel):
    ok: bool
    order_id: str
    to: MoveTarget
    #: Every broken rule, not just the first (D3.4 shows two).
    violations: list[MoveViolation]
    #: What the target would carry and which rules pass, for "Why this vehicle".
    checks: list[RuleCheck]
    #: The consequence preview shown while the order is over a legal target (D3.2).
    preview: MovePreview | None = None
    #: Protected stop: why it can't be deferred (D3.5).
    protected_reason: str | None = None
    #: Short line under the refusal heading.
    summary: str
    #: Set when the move starts a new trip: when it would leave ("03:30").
    opens_trip: str | None = None


class SaveMovesIn(ApiModel):
    moves: list[MoveRequest] = Field(min_length=1)
    note: str | None = None


class ReleasePlanIn(ApiModel):
    #: Post the store, dock and driver notices as part of the release.
    send_notices: bool = True


# ---- D4 · Deferrals ---------------------------------------------------------


class StoreNotice(ApiModel):
    state: Literal["not sent", "sent", "seen"]
    at: str | None = None
    note: str | None = None


class DeferralReason(ApiModel):
    headline: str
    detail: str


class Footnote(ApiModel):
    tone: Literal["info", "warn"]
    text: str


class WhyNotOther(ApiModel):
    outlet_id: str
    order_id: str
    text: str
    protected: bool


class DeferralDetail(ApiModel):
    type: str
    binding_text: str
    freed: str
    next_run: str
    decided_line: str
    why_not_others: list[WhyNotOther]
    window: TimeRange
    kg: float
    m3: float
    dock: str


class DeferralCard(ApiModel):
    order_id: str
    outlet_id: str
    outlet_name: str
    brand: Brand
    temp: Temp
    #: Dock and access tags: "Van only", "Street", "Rear dock".
    access: list[str]
    kind: DeferralType
    #: The one-line summary a collapsed card shows.
    line: str
    #: "OUT009: chilled order".
    title: str
    reason: DeferralReason
    decided_by: str
    store_told: StoreNotice
    impact: str
    frees: str
    next_run: str
    binding: str
    #: Plan version this deferral first appeared in, when it is new ("New in v4").
    new_in_version: int | None = None
    #: An order also listed on the card ("ORD2002" for the store-request pair).
    paired_order_ids: list[str] | None = None
    footnote: Footnote | None = None
    #: Detail drawer (D4.2).
    detail: DeferralDetail


class DeferralCounts(ApiModel):
    total: int
    capacity: int
    policy: int
    store_request: int


class Banner(ApiModel):
    tone: Literal["warning", "info", "success"]
    title: str
    text: str


class ProtectedOutlet(ApiModel):
    outlet_id: str
    order_id: str
    text: str


class NoticeCounts(ApiModel):
    sent: int
    total: int
    seen: int
    note: str


class SidePool(ApiModel):
    title: str
    orders: int
    deferred: int
    label: str
    used: float
    limit: float
    vehicle_id: str


class DriverChip(ApiModel):
    label: str
    tone: Literal["live", "warn"]


class SideDriver(ApiModel):
    heading: str
    chips: list[DriverChip]
    note: str


class DeferralsSide(ApiModel):
    pool: SidePool
    driver: SideDriver


class DeferralsPlanRef(ApiModel):
    number: int
    state: PlanState
    at: str


class DeferralsView(ApiModel):
    depot: DepotId
    plan: DeferralsPlanRef
    #: "19 orders wait for Wed 30 Sep".
    headline: str
    counts: DeferralCounts
    banner: Banner
    capacity: list[DeferralCard]
    policy: list[DeferralCard]
    #: Confirmed orders at this depot and how many the plan serves.
    orders: int
    served: int
    #: Policy deferrals beyond the listed ones ("+15 more").
    policy_more: int
    store_request: list[DeferralCard]
    protected: list[ProtectedOutlet]
    notices: NoticeCounts
    #: Kandy after the store request: where the pool and the driver stand.
    side: DeferralsSide | None = None
    #: Before anything is released the dispatcher can release from here.
    can_release: bool


class NotifyDeferralsIn(ApiModel):
    depot: DepotId
    #: Resend one order's notice (D4.2 "Resend notice"), even if it has gone out before. Without it, every deferral
    #: at the depot that has not been told yet.
    order_id: str | None = None


class NotifyDeferralsOut(ApiModel):
    sent: int


# ---- D5 · Release -----------------------------------------------------------


class AcknowledgementRow(ApiModel):
    person: str
    role: Literal["Loader", "Driver"]
    #: "Peliyagoda dock", "VEH039".
    place: str
    #: The plan version the person has.
    has: int
    state: Literal["pending", "acknowledged", "not received", "no change"]
    #: "03:05": when they acknowledged.
    at: str | None = None
    note: str | None = None
    #: "in 5 h 29 min", "n/a", "Departed 03:30".
    departs_in: str


class AcknowledgementsBanner(ApiModel):
    tone: Literal["warning", "success", "offline"]
    title: str
    text: str
    action: Literal["call-kandy", "open-live"] | None = None


class AcknowledgementsView(ApiModel):
    version: int
    acknowledged: int
    total: int
    rows: list[AcknowledgementRow]
    #: A warning the release screen raises, or a success line once everyone has it.
    banner: AcknowledgementsBanner | None


# ---- D6 · Live operations ---------------------------------------------------


class LiveOrder(ApiModel):
    id: str
    temp: Temp
    units: int


class LiveStop(ApiModel):
    outlet_id: str
    outlet_name: str
    brand: Brand
    orders: list[LiveOrder]
    #: "ETA 05:26 · window 05:30-08:00".
    eta: str
    window: TimeRange
    status: Literal["Departed", "Delivered", "Deferred", "Conflict", "Change pending", "Planned", "Loaded"]
    #: "Delivered 05:58", "Receipt confirmed 07:30".
    status_note: str | None = None
    #: A change waiting for the driver.
    change: str | None = None
    #: Hover text on the status pill.
    tooltip: str | None = None
    can_defer: bool


class StopProgress(ApiModel):
    done: int
    total: int


class LastHeard(ApiModel):
    time: str | None = None
    age: str | None = None
    note: str | None = None
    synced: bool | None = None


class LiveRow(ApiModel):
    vehicle_id: str
    trip: int
    driver: str
    plan_on_device: int
    change_pending: bool
    next_stop: str
    risk: Literal["On time", "At risk", "Unknown · offline", "Late"]
    stops: StopProgress
    last_heard: LastHeard
    status: Literal["Departed", "Planned", "Delivered", "Loading"]
    held: bool
    stops_detail: list[LiveStop]
    expanded: bool
    #: Hover explanation for an offline vehicle.
    offline_note: str | None = None


class DecisionAction(ApiModel):
    label: str
    to: str


class Decision(ApiModel):
    id: str
    kind: Literal["conflict", "held", "info"]
    title: str
    text: str
    at: str | None = None
    chip: str | None = None
    action: DecisionAction | None = None
    #: Info rows say "Info only".
    info_only: bool | None = None
    countdown: str | None = None


class StatCard(ApiModel):
    value: int
    foot: str


class IssuesStat(StatCard):
    bad: bool


class LiveStats(ApiModel):
    departed: StatCard
    loading: StatCard
    delivered: StatCard
    issues: IssuesStat


class LiveBoardView(ApiModel):
    as_of: str
    date: str
    #: "Plan v5".
    plan: str | None = None
    decisions: list[Decision]
    stats: LiveStats
    #: "4 of 14 departed shown · needing attention first".
    caption: str
    rows: list[LiveRow]
    depot: Literal["peliyagoda", "kandy", "both"]


class DeferStopIn(ApiModel):
    order_ids: list[str] = Field(min_length=1)
    kind: DeferralType
    reason: str


class DeferStopResult(ApiModel):
    plan: int
    deferred: list[str]


class InboxView(ApiModel):
    items: list[Decision]


# ---- D7 · Reconciliation ----------------------------------------------------


class ConflictOrder(ApiModel):
    id: str
    temp: Temp
    units: int


class TimelineEntry(ApiModel):
    time: str
    title: str
    detail: str
    kind: Literal["offline", "deferred", "arrived", "delivered", "synced"]


class DriverRecord(ApiModel):
    heading: str
    status: str
    received_by: str
    units: str
    device_time: str
    photo: str


class DispatchRecord(ApiModel):
    heading: str
    status: str
    decided: str
    reason: str
    reached: str


class StoreReport(ApiModel):
    heading: str
    tags: list[str]
    text: str
    at: str


class AskedStore(ApiModel):
    at: str
    minutes: int
    text: str


class ConflictRecommendationView(ApiModel):
    choice: ConflictRecommendation
    title: str
    reasons: list[str]
    outcome: str
    chip: str | None = None
    paused_note: str | None = None


class WhoKnows(ApiModel):
    who: str
    what: str


class ConflictResolved(ApiModel):
    by: str
    at: str
    title: str
    text: str
    who_knows: list[WhoKnows]
    toast: str


class ConflictView(ApiModel):
    #: The database id, as a string.
    id: str
    outlet_id: str
    outlet_name: str
    district: str
    orders: list[ConflictOrder]
    state: Literal["needs decision", "awaiting store", "store reported an issue", "resolved"]
    #: "Delivered" or "Partial" once resolved.
    outcome: Literal["Delivered", "Partial"] | None = None
    timeline: list[TimelineEntry]
    driver_record: DriverRecord
    dispatch_record: DispatchRecord
    store_report: StoreReport | None = None
    asked: AskedStore | None = None
    recommendation: ConflictRecommendationView
    resolved: ConflictResolved | None = None


class ResolveConflictIn(ApiModel):
    resolution: ConflictRecommendation


# ---- D8 · Loading exception -------------------------------------------------


class ExceptionCandidate(ApiModel):
    outlet_id: str
    order_id: str
    impact: str
    kg: float
    m3: float
    protected: bool
    least_surplus: bool


class FailedVehicle(ApiModel):
    vehicle_id: str
    spec: str
    reason: str
    tag: Literal["Held", "Replaced"]


class ReplacementVehicle(ApiModel):
    vehicle_id: str
    spec: str
    since: str


class OverMeter(ApiModel):
    used: float
    limit: float
    over: str


class ExceptionBefore(ApiModel):
    weight: OverMeter
    volume: OverMeter
    trip2: str


class ExceptionRecommendation(ApiModel):
    order_id: str
    #: Every order to defer so the replacement fits. ``order_id`` is the first.
    order_ids: list[str]
    outlet_id: str
    title: str
    kind: DeferralType
    type_note: str
    reason: str
    decided_by: str
    impact: str
    frees: str
    next_run: str
    protected: list[ProtectedOutlet]


class WarnMeter(ApiModel):
    used: float
    limit: float
    warn: str


class Need(ApiModel):
    kg: float
    m3: float


class ExceptionAfter(ApiModel):
    weight: WarnMeter
    volume: WarnMeter
    trip1_minutes: int
    trip2: str
    fresh: str
    fuel: str
    stops: list[str]
    stops_note: str


class ExceptionConfirmed(ApiModel):
    plan: int
    at: str
    text: str
    who_knows: list[WhoKnows]
    toast: str


class ExceptionView(ApiModel):
    #: The database id, as a string.
    id: str
    state: Literal["working", "recommendation", "confirmed"]
    title: str
    flagged_by: str
    flagged_at: str
    reason: str
    orders_text: str
    minutes_to_departure: int
    failed: FailedVehicle
    replacement: ReplacementVehicle | None = None
    before: ExceptionBefore | None = None
    recommendation: ExceptionRecommendation | None = None
    candidates: list[ExceptionCandidate]
    need: Need
    after: ExceptionAfter | None = None
    confirmed: ExceptionConfirmed | None = None


class DecideExceptionIn(ApiModel):
    #: The only decision the screens offer: swap to the spare vehicle and defer the listed orders.
    decision: Literal["swap_vehicle"]
    defer_order_ids: list[str] = Field(default_factory=list)


# ---- D9 · Forecast ----------------------------------------------------------


class ForecastDay(ApiModel):
    day: str
    flag: str | None = None


class ForecastGap(ApiModel):
    minutes: float


class ForecastWeek(ApiModel):
    #: "Mon 5 Oct": the ISO week's Monday.
    monday: str
    percent: float
    status: Literal["Short", "Tight", "OK"]
    flags: list[str]
    lever: str
    gap: ForecastGap | None = None
    days: list[ForecastDay] | None = None
    #: Notes only: nothing on this screen changes the plan.
    levers: list[str] | None = None


class ForecastView(ApiModel):
    as_of: str
    depot: DepotId
    label: str = "Baseline forecast: Datathon Task 2A model not wired in"
    weeks: list[ForecastWeek]


# ---- Contact (D5, D7 "Call") ---------------------------------------------------


class ContactIn(ApiModel):
    """Ask someone to call Dispatch back. The dataset has no phone numbers and none is invented (Contributing §29)."""

    to: Literal["store", "driver", "dock"]
    #: For ``store``.
    outlet_id: str | None = None
    #: For ``driver``: the vehicle the driver is on.
    vehicle_id: str | None = None
    #: For ``dock``.
    depot: DepotId | None = None
    #: What it is about, in the dispatcher's words: "the delivery under review", "plan v4".
    about: str | None = Field(default=None, max_length=200)


class ContactOut(ApiModel):
    to: Literal["store", "driver", "dock"]
    #: "OUT084", "VEH039", "Kandy dock".
    recipient: str
    at: datetime
