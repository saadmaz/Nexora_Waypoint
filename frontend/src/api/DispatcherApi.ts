import type { OrderStatus } from "../domain/status";

/**
 * The dispatcher's view of the plan (PRD v3 section 3 D1 to D9), as one interface for the mock
 * and the real client. Operation names are PRD v3 section 19, so wiring the backend is a swap one
 * operation at a time. Screens call only this interface: never `fetch`, never fixtures.
 *
 * Times are "HH:MM" on the scenario clock (Asia/Colombo) and dates are ISO "YYYY-MM-DD", as the
 * StoreApi does. Rules (trip minutes, refusals, legal vehicles) are computed by the server through
 * `waypoint_rules`; the screens only show what comes back.
 */

export type DepotId = "peliyagoda" | "kandy";

export const DEPOT_NAME: Record<DepotId, string> = { peliyagoda: "Peliyagoda", kandy: "Kandy" };

export type Brand = "Fresh" | "Style" | "Tech";
export type OrderTemp = "chilled" | "ambient";
export type TimeRange = { start: string; end: string };

/** The three deferral types (PRD v3 section 4b). */
export type DeferralKind = "capacity" | "policy" | "store request";

export type PlanState = "draft" | "released";

// ---- D1 · Order queue -------------------------------------------------------

/** Tags on a queue row. None of them is a status (PRD v3 section 4b). */
export type QueueTag = "Carry-over" | "Protected" | "After cutoff" | "No legal vehicle";

export type QueueOrder = {
  id: string;
  outletId: string;
  brand: Brand;
  district: string;
  temp: OrderTemp;
  /** Dock and access tags: "Rear dock", "Street", "Van only", "Mall bay", "Mall dock". */
  access: string[];
  window: TimeRange;
  /** The window is a mall slot ("Mall 09:00-11:00"), drawn as a tag. */
  mallWindow: boolean;
  units: number;
  kg: number;
  m3: number;
  status: OrderStatus;
  tags: QueueTag[];
  /** When the store sent it, "13:41". */
  receivedAt: string;
  /** One line under the status tags: why it is flagged. */
  note?: string;
  /** Carry-overs show their age in the Received cell. */
  daysSinceServed?: number;
  /** Arrived in the last few minutes before the cutoff (D1.1 "Just in"). */
  justIn?: boolean;
};

export type QueueGroup = {
  key: string;
  /** "Carry-overs · 2", "Other orders", "OUT084 · Waypoint Fresh · Kandy". */
  title: string;
  kind: "carry" | "other" | "outlet";
  /** Outlet groups (Kandy): what the outlet is and how many records it has. */
  outlet?: { id: string; brand?: Brand; dock?: string; window?: TimeRange; note?: string };
  orders: QueueOrder[];
};

export type QueueFilterTag = QueueTag | "Van only" | "Mall dock";

export type QueueFilters = {
  brand: Brand[];
  temp: OrderTemp[];
  status: OrderStatus[];
  /** "early" (starts before 05:00), "mid" (05:00 to 06:00), "late" (after 06:00). */
  window: ("early" | "mid" | "late")[];
  tags: QueueFilterTag[];
  district: string[];
};

export const NO_FILTERS: QueueFilters = { brand: [], temp: [], status: [], window: [], tags: [], district: [] };

export type QueueView = {
  depot: DepotId;
  serviceDate: string;
  /** Before 16:00 the queue fills live and Capacity is locked. */
  cutoff: { closed: boolean; at: string; minutesLeft: number };
  /** Orders in each depot's queue. */
  counts: Record<DepotId, number>;
  carryOvers: number;
  /** Orders flagged "No legal vehicle" at this depot. */
  atRisk: number;
  groups: QueueGroup[];
  /** Rows on screen, and orders in the whole queue. */
  shown: number;
  total: number;
  /** Orders matching the filters, when any are on. */
  matching?: number;
  /** Carry-overs a filter hides, so the screen can say so. */
  hiddenCarryOvers: number;
  /** When the newest row arrived: "Received = order arrival time". */
  lastReceived?: string;
};

export type OrderHistoryRun = { date: string; outcome: "served" | "deferred" | "pending"; label: string };

export type OrderJourneyStep = {
  step: "Ordered" | "Confirmed" | "Planned" | "Loaded" | "Departed" | "Delivered" | "Receipt confirmed";
  /** "Store · 15:12" once it happened. */
  by?: string;
  state: "done" | "current" | "pending";
};

export type OrderHistory = {
  order: QueueOrder;
  outletName: string;
  /** "Fresh · Colombo · chilled · rear dock". */
  summary: string;
  continuity: { protected: boolean; text: string };
  lastRuns: OrderHistoryRun[];
  journey: OrderJourneyStep[];
  notes: string[];
};

// ---- D2 · Capacity ----------------------------------------------------------

export type Meter = { used: number; limit: number };

export type CapacityView = {
  depot: DepotId;
  serviceDate: string;
  /** Orders in this depot's queue. */
  orders: number;
  /** Null until the 16:05 draft exists. */
  plan: { number: number; state: PlanState; at: string; releasedAt?: string } | null;
  /** Forced deferrals at this depot (PRD v3 section 4b headline). */
  deferrals: { total: number; capacity: number; policy: number };
  /** The binding resource. Null when the depot has enough capacity. */
  binding: null | {
    resource: string;
    demand: number;
    supply: number;
    available: number;
    perVehicle: number;
    percent: number;
    overBy: number;
  };
  reefers: { available: number; total: number; note: string };
  vehicles: { available: number; total: number; inWorkshop: number };
  /** Two sample cards: the worst case, not the fleet total (design fix D-7). */
  busiest: { label: string; vehicleId: string; used: number; limit: number; unit: string; note: string };
  closest: { label: string; vehicleId: string; used: number; limit: number; unit: string; note: string; caption: string };
  /** The other depot's pool, never pooled with this one. */
  pool: { depot: DepotId; orders: number; deferred: number; enough: boolean };
  /** A vehicle that became available after the draft (D2.3). */
  spare?: { vehicleId: string; label: string; kg: number; m3: number; since: string };
  /** Kandy: its own fleet and the hero vehicle's meters. */
  fleet?: { total: number; classes: { label: string; count: number; chilled: boolean; kind: "reefer-truck" | "dry-truck" | "reefer-van" | "ambient-van" }[] };
  lane?: { vehicleId: string; title: string; summary: string; meters: { label: string; used: number; limit: number; unit: string }[] };
  /** Released plans show their totals. */
  released?: { orders: number; served: number; deferred: number; at: string };
  /** Kandy: how full the Fresh minutes are, 0 to 1. */
  freshUse?: number;
};

// ---- D3 · Trip board --------------------------------------------------------

export type PlanVersionInfo = {
  number: number;
  state: PlanState;
  /** "Mon 16:05". */
  at: string;
  note: string;
  /** Which depots it covers. */
  scope?: string;
  current: boolean;
};

export type PlanStop = {
  orderId: string;
  outletId: string;
  seq: number;
  /** Planned arrival, "03:54". */
  arrival: string;
  note?: string;
  protected: boolean;
  kg: number;
  m3: number;
};

export type PlanTrip = {
  vehicleId: string;
  trip: number;
  departs: string;
  brand: Brand;
  district: string;
  stops: PlanStop[];
  kg: number;
  kgCap: number | null;
  m3: number;
  m3Cap: number | null;
  minutes: number;
  /** Bar fill for each figure, 0 to 1. */
  fill: { kg: number; m3: number; minutes: number };
};

export type PlanLane = {
  vehicleId: string;
  kind: string;
  reefer: boolean;
  status: "active" | "workshop" | "spare" | "replaced";
  workshopUntil?: string;
  meters: { label: string; used: number; limit: number; unit: string }[];
  trips: PlanTrip[];
};

export type DeferredCard = {
  orderId: string;
  outletId: string;
  brand: Brand;
  temp: OrderTemp;
  kind: DeferralKind;
  /** "van access", "window": the binding resource tag. */
  binding: string;
  nextRun: string;
  kg: number;
  m3: number;
  window: TimeRange;
  dock: string;
  district: string;
};

export type PlanView = {
  depot: DepotId;
  version: PlanVersionInfo;
  versions: PlanVersionInfo[];
  /** Released versions are read-only. */
  readOnly: boolean;
  lanes: PlanLane[];
  deferred: DeferredCard[];
  /** Deferred orders at this depot; the pool shows a few and "+N more". */
  deferredTotal: number;
  /** What Release shows (D5). */
  summary: {
    orders: number;
    served: number;
    deferred: number;
    capacityDeferred: number;
    policyDeferred: number;
    trips: number;
    receivers: { docks: number; drivers: number };
    byDepot: { depot: DepotId; orders: number; served: number; deferred: number; receivers: string }[];
  };
  checks: { text: string; ok: boolean }[];
  /** Two docks and every driver must have this version. */
  readyToRelease: boolean;
};

export type MoveTarget = { vehicleId: string; trip: number } | "deferred";

export type MoveRequest = { orderId: string; to: MoveTarget };

export type RuleCheck = { rule: string; detail: string; ok: boolean };

export type MoveResult = {
  ok: boolean;
  orderId: string;
  to: MoveTarget;
  /** Every broken rule, not just the first (D3.4 shows two). */
  violations: { rule: string; text: string }[];
  /** What the target would carry and which rules pass, for "Why this vehicle". */
  checks: RuleCheck[];
  /** The consequence preview shown while the order is over a legal target (D3.2). */
  preview?: {
    headline: string;
    rows: { label: string; text: string; before?: number; after?: number; limit?: number; ok: boolean }[];
    source?: { title: string; frees: string };
    note: string;
    verdict: string;
  };
  /** Protected stop: why it can't be deferred (D3.5). */
  protectedReason?: string;
  /** Short line under the refusal heading. */
  summary: string;
};

// ---- D4 · Deferrals ---------------------------------------------------------

export type StoreNotice = { state: "not sent" | "sent" | "seen"; at?: string; note?: string };

export type DeferralCard = {
  orderId: string;
  outletId: string;
  outletName: string;
  brand: Brand;
  temp: OrderTemp;
  /** Dock and access tags: "Van only", "Street", "Rear dock". */
  access: string[];
  kind: DeferralKind;
  /** The one-line summary a collapsed card shows. */
  line: string;
  /** "OUT009: chilled order" or "OUT084 · Waypoint Fresh: chilled 12 units + dry 8 units". */
  title: string;
  reason: { headline: string; detail: string };
  decidedBy: string;
  storeTold: StoreNotice;
  impact: string;
  frees: string;
  nextRun: string;
  binding: string;
  /** Plan version this deferral first appeared in, when it is new ("New in v4"). */
  newInVersion?: number;
  /** An order also listed on the card ("ORD2002" for the store-request pair). */
  pairedOrderIds?: string[];
  /** Extra line (a failed first send, "VEH039 offline since 05:17..."). */
  footnote?: { tone: "info" | "warn"; text: string };
  /** Detail drawer (D4.2). */
  detail: {
    type: string;
    bindingText: string;
    freed: string;
    nextRun: string;
    decidedLine: string;
    whyNotOthers: { outletId: string; orderId: string; text: string; protected: boolean }[];
    window: TimeRange;
    kg: number;
    m3: number;
    dock: string;
  };
};

export type DeferralsView = {
  depot: DepotId;
  plan: { number: number; state: PlanState; at: string };
  /** "19 orders wait for Wed 30 Sep". */
  headline: string;
  counts: { total: number; capacity: number; policy: number; storeRequest: number };
  banner: { tone: "warning" | "info" | "success"; title: string; text: string };
  capacity: DeferralCard[];
  policy: DeferralCard[];
  /** Policy deferrals beyond the listed ones ("+15 more"). */
  policyMore: number;
  storeRequest: DeferralCard[];
  protected: { outletId: string; orderId: string; text: string }[];
  notices: { sent: number; total: number; seen: number; note: string };
  /** Kandy after the store request: where the pool and the driver stand. */
  side?: {
    pool: { title: string; orders: number; deferred: number; label: string; used: number; limit: number; vehicleId: string };
    driver: { heading: string; chips: { label: string; tone: "live" | "warn" }[]; note: string };
  };
  /** Before anything is released the dispatcher can release from here. */
  canRelease: boolean;
};

// ---- D5 · Release -----------------------------------------------------------

export type AcknowledgementRow = {
  person: string;
  role: "Loader" | "Driver";
  /** "Peliyagoda dock", "VEH039". */
  place: string;
  /** The plan version the person has. */
  has: number;
  state: "pending" | "acknowledged" | "not received" | "no change";
  /** "03:05": when they acknowledged. */
  at?: string;
  note?: string;
  /** "in 5 h 29 min", "n/a", "Departed 03:30". */
  departsIn: string;
};

export type AcknowledgementsView = {
  version: number;
  acknowledged: number;
  total: number;
  rows: AcknowledgementRow[];
  /** A warning the release screen raises, or a success line once everyone has it. */
  banner: null | { tone: "warning" | "success" | "offline"; title: string; text: string; action?: "call-kandy" | "open-live" };
};

// ---- D6 · Live operations ---------------------------------------------------

export type LiveStop = {
  outletId: string;
  outletName: string;
  brand: Brand;
  orders: { id: string; temp: OrderTemp; units: number }[];
  /** "ETA 05:26 · window 05:30-08:00". */
  eta: string;
  window: TimeRange;
  status: "Departed" | "Delivered" | "Deferred" | "Conflict" | "Change pending" | "Planned" | "Loaded";
  /** "Delivered 05:58", "Receipt confirmed 07:30". */
  statusNote?: string;
  /** A change waiting for the driver ("Deferred · store request → Wed"). */
  change?: string;
  /** Hover text on the status pill ("Resolved by Kumari 06:44, kept delivery"). */
  tooltip?: string;
  canDefer: boolean;
};

export type LiveRow = {
  vehicleId: string;
  trip: number;
  driver: string;
  planOnDevice: number;
  changePending: boolean;
  nextStop: string;
  risk: "On time" | "At risk" | "Unknown · offline" | "Late";
  stops: { done: number; total: number };
  lastHeard: { time?: string; age?: string; note?: string; synced?: boolean };
  status: "Departed" | "Planned" | "Delivered" | "Loading";
  held: boolean;
  stopsDetail: LiveStop[];
  expanded: boolean;
  /** Hover explanation for an offline vehicle. */
  offlineNote?: string;
};

export type Decision = {
  id: string;
  kind: "conflict" | "held" | "info";
  title: string;
  text: string;
  at?: string;
  chip?: string;
  action?: { label: string; to: string };
  /** Info rows say "Info only". */
  infoOnly?: boolean;
  countdown?: string;
};

export type LiveBoardView = {
  asOf: string;
  date: string;
  /** "Plan v5". */
  plan?: string;
  decisions: Decision[];
  stats: {
    departed: { value: number; foot: string };
    loading: { value: number; foot: string };
    delivered: { value: number; foot: string };
    issues: { value: number; foot: string; bad: boolean };
  };
  /** "4 of 14 departed shown · needing attention first". */
  caption: string;
  rows: LiveRow[];
  depot: DepotId | "both";
};

export type DeferStopRequest = { orderIds: string[]; kind: DeferralKind; reason: string };

export type DeferStopResult = { plan: number; deferred: string[] };

export type InboxView = { items: Decision[] };

// ---- D7 · Reconciliation ----------------------------------------------------

export type ConflictResolution = "keep delivery" | "keep as partial";

export type ConflictView = {
  id: string;
  outletId: string;
  outletName: string;
  district: string;
  orders: { id: string; temp: OrderTemp; units: number }[];
  state: "needs decision" | "awaiting store" | "store reported an issue" | "resolved";
  /** "Delivered" or "Partial" once resolved. */
  outcome?: "Delivered" | "Partial";
  timeline: { time: string; title: string; detail: string; kind: "offline" | "deferred" | "arrived" | "delivered" | "synced" }[];
  driverRecord: {
    heading: string;
    status: string;
    receivedBy: string;
    units: string;
    deviceTime: string;
    photo: string;
  };
  dispatchRecord: {
    heading: string;
    status: string;
    decided: string;
    reason: string;
    reached: string;
  };
  storeReport?: { heading: string; tags: string[]; text: string; at: string };
  asked?: { at: string; minutes: number; text: string };
  recommendation: {
    choice: ConflictResolution;
    title: string;
    reasons: string[];
    outcome: string;
    chip?: string;
    pausedNote?: string;
  };
  resolved?: { by: string; at: string; title: string; text: string; whoKnows: { who: string; what: string }[]; toast: string };
};

// ---- D8 · Loading exception -------------------------------------------------

export type ExceptionCandidate = {
  outletId: string;
  orderId: string;
  impact: string;
  kg: number;
  m3: number;
  protected: boolean;
  leastSurplus: boolean;
};

export type ExceptionView = {
  id: string;
  state: "working" | "recommendation" | "confirmed";
  title: string;
  flaggedBy: string;
  flaggedAt: string;
  reason: string;
  ordersText: string;
  minutesToDeparture: number;
  failed: { vehicleId: string; spec: string; reason: string; tag: "Held" | "Replaced" };
  replacement?: { vehicleId: string; spec: string; since: string };
  before?: {
    weight: { used: number; limit: number; over: string };
    volume: { used: number; limit: number; over: string };
    trip2: string;
  };
  recommendation?: {
    orderId: string;
    outletId: string;
    title: string;
    kind: DeferralKind;
    typeNote: string;
    reason: string;
    decidedBy: string;
    impact: string;
    frees: string;
    nextRun: string;
    protected: { outletId: string; orderId: string; text: string }[];
  };
  candidates: ExceptionCandidate[];
  need: { kg: number; m3: number };
  after?: {
    weight: { used: number; limit: number; warn: string };
    volume: { used: number; limit: number; warn: string };
    trip1Minutes: number;
    trip2: string;
    fresh: string;
    fuel: string;
    stops: string[];
    stopsNote: string;
  };
  confirmed?: { plan: number; at: string; text: string; whoKnows: { who: string; what: string }[]; toast: string };
};

export type DecideExceptionRequest = { decision: "swap vehicle"; deferOrderIds: string[] };

// ---- D9 · Forecast ----------------------------------------------------------

export type ForecastWeek = {
  /** "Mon 5 Oct": the ISO week's Monday. */
  monday: string;
  percent: number;
  status: "Short" | "Tight";
  flags: string[];
  lever: string;
  gap?: { minutes: number };
  days?: { day: string; flag?: string }[];
};

export type ForecastView = {
  asOf: string;
  depot: DepotId;
  label: string;
  weeks: ForecastWeek[];
};

// ---- The interface ----------------------------------------------------------

export interface DispatcherApi {
  /** D1: the order queue for a depot. `GET /dispatcher/queue?depot=&date=`. */
  getQueue(query: { depot: DepotId; date?: string; filters?: QueueFilters; search?: string }): Promise<QueueView>;
  /** D1.5: one order's history drawer. `GET /dispatcher/orders/{id}/history`. */
  getOrderHistory(orderId: string): Promise<OrderHistory>;
  /** D2: supply against demand. `GET /dispatcher/capacity?depot=`. */
  getCapacity(query: { depot: DepotId }): Promise<CapacityView>;
  /** D3, D5: a plan version with its trips and deferrals. `GET /dispatcher/plan?version=`. */
  getPlan(query: { depot: DepotId; version?: number }): Promise<PlanView>;
  /** Runs the planner again. `POST /dispatcher/plan/redraft`. */
  redraftPlan(): Promise<PlanView>;
  /** D3.2 to D3.6: would this move be legal? `POST /dispatcher/plan/validate-move`. */
  validateMove(request: MoveRequest): Promise<MoveResult>;
  /** Saves accepted moves as the next draft. `POST /dispatcher/plan/moves`. */
  saveMoves(request: { moves: MoveRequest[]; note?: string }): Promise<PlanView>;
  /** D4: every deferral with its reason. `GET /dispatcher/deferrals?depot=`. */
  listDeferrals(query: { depot: DepotId }): Promise<DeferralsView>;
  /** D4: tell the stores now. `POST /dispatcher/deferrals/notify`. */
  notifyDeferrals(request: { depot: DepotId }): Promise<{ sent: number }>;
  /** D5: lock the version. `POST /dispatcher/plan/release`. */
  releasePlan(request: { sendNotices: boolean }): Promise<PlanView>;
  /** D5: who has which version. `GET /dispatcher/acknowledgements?version=`. */
  listAcknowledgements(query: { version?: number }): Promise<AcknowledgementsView>;
  /** D6: the exception-first live board. `GET /dispatcher/live?depot=`. */
  getLiveBoard(query: { depot: DepotId | "both" }): Promise<LiveBoardView>;
  /** D6.3: defer a stop after release. `POST /dispatcher/stops/defer`. */
  deferStop(request: DeferStopRequest): Promise<DeferStopResult>;
  /** What needs a decision. `GET /dispatcher/inbox`. */
  getInbox(): Promise<InboxView>;
  /** D7: two records for one stop. `GET /dispatcher/conflicts/{id}`. */
  getConflict(id: string): Promise<ConflictView>;
  /** D7.2: ask the store. `POST /dispatcher/conflicts/{id}/ask-store`. */
  askStore(id: string): Promise<ConflictView>;
  /** D7.4: settle it. `POST /dispatcher/conflicts/{id}/resolve`. */
  resolveConflict(id: string, resolution: ConflictResolution): Promise<ConflictView>;
  /** D8: a loading exception. `GET /dispatcher/exceptions/{id}`. */
  getExceptionForReview(id: string): Promise<ExceptionView>;
  /** D8.2, D8.3: decide it. `POST /dispatcher/exceptions/{id}/decide`. */
  decideException(id: string, request: DecideExceptionRequest): Promise<ExceptionView>;
  /** D9: the next four ISO weeks. `GET /dispatcher/forecast`. */
  getForecast(query: { depot: DepotId }): Promise<ForecastView>;
}

/** A request that failed with a message the screen can show, as the server's `{code, message}` shape. */
export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

/** Thrown when the dispatcher's connection is down: the screens keep what they have and say so. */
export class NetworkError extends Error {
  constructor() {
    super("No connection");
    this.name = "NetworkError";
  }
}
