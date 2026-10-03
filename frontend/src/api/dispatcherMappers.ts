import type { OrderStatus } from "../domain/status";
import type {
  ConflictResolution,
  ConflictView,
  AcknowledgementsView,
  CapacityView,
  DecideExceptionRequest,
  DeferralCard,
  DeferralKind,
  DeferralsView,
  DeferStopResult,
  ExceptionView,
  ForecastView,
  InboxView,
  LiveBoardView,
  MoveRequest,
  MoveResult,
  MoveTarget,
  OrderHistory,
  PlanView,
  QueueFilters,
  QueueOrder,
  QueueView,
} from "./DispatcherApi";
import type { components } from "./schema";
import { deferralTypeFromApi, statusFromApi, unexpectedReply } from "./vocab";

/**
 * The one place the dispatcher's wire values become the screens' values and back (`dispatcherContract.ts` checks that
 * the field names agree; this file handles what that check leaves out). Three things differ:
 *
 *  1. Enum values. The backend sends machine values (`store_request`, `keep_delivery`, `ordered`); the screens use display
 *     text (`"store request"`, `"keep delivery"`, `"Ordered"`). Both directions are full `Record`s over the generated
 *     unions, so a value the backend adds fails the build here rather than showing blank on a screen.
 *  2. Ids. A conflict or exception id is a `string` in the views and an `int` in the URL and the database.
 *  3. The move target. The screens use `{ vehicleId, trip } | "deferred"`; the wire `MoveTarget` is
 *     `{ vehicleId?, trip?, deferred }`.
 *  4. Absent versus null. The server sends every empty optional field as `null`; the views declare them optional and the
 *     screens test `!== undefined` (`newInVersion`, `daysSinceServed`, `matching`). `compact` turns those nulls into
 *     absent keys. Five fields are null on purpose and stay: `binding`, `plan` (capacity), `banner`, `kgCap`, `m3Cap`.
 *
 * Fields the backend already sends as display text (the order-history `step`, a live stop's `status`) are not touched.
 */

type Schemas = components["schemas"];

// ---- 1. Enum values ---------------------------------------------------------

const STATUS_TO_API: Record<OrderStatus, Schemas["OrderStatus"]> = {
  Ordered: "ordered",
  Confirmed: "confirmed",
  Planned: "planned",
  Deferred: "deferred",
  Loaded: "loaded",
  Departed: "departed",
  Delivered: "delivered",
  Partial: "partial",
  Issue: "issue",
  Conflict: "conflict",
  "Pending sync": "pending_sync",
};

const DEFERRAL_TO_API: Record<DeferralKind, Schemas["DeferralType"]> = {
  capacity: "capacity",
  policy: "policy",
  "store request": "store_request",
};

/** Both directions of the conflict choice. The wire also has `keep_deferral`, which no screen offers or can draw. */
const RESOLUTION_TO_API: Record<ConflictResolution, Schemas["ConflictRecommendation"]> = {
  "keep delivery": "keep_delivery",
  "keep as partial": "keep_partial",
};
const RESOLUTION_FROM_API: Partial<Record<Schemas["ConflictRecommendation"], ConflictResolution>> = {
  keep_delivery: "keep delivery",
  keep_partial: "keep as partial",
};

const DECISION_TO_API: Record<DecideExceptionRequest["decision"], Schemas["DecideExceptionIn"]["decision"]> = {
  "swap vehicle": "swap_vehicle",
};

export const statusToApi = (status: OrderStatus): Schemas["OrderStatus"] => STATUS_TO_API[status];
export const deferralKindToApi = (kind: DeferralKind): Schemas["DeferralType"] => DEFERRAL_TO_API[kind];
export const resolutionToApi = (resolution: ConflictResolution): Schemas["ConflictRecommendation"] => RESOLUTION_TO_API[resolution];
export const decisionToApi = (decision: DecideExceptionRequest["decision"]): Schemas["DecideExceptionIn"]["decision"] => DECISION_TO_API[decision];

export function resolutionFromApi(value: string): ConflictResolution {
  const mapped = (RESOLUTION_FROM_API as Record<string, ConflictResolution | undefined>)[value];
  if (mapped === undefined) throw unexpectedReply(`conflict recommendation "${value}"`);
  return mapped;
}

// ---- 2. Ids -----------------------------------------------------------------

/** A conflict or exception id as the URL wants it. A non-numeric id never reaches the server. */
export function numericId(id: string, what: string): number {
  const value = Number(id);
  if (id.trim() === "" || !Number.isInteger(value)) throw unexpectedReply(`${what} id "${id}" is not a number`);
  return value;
}

// ---- 3. The move target -----------------------------------------------------

export function moveTargetToApi(to: MoveTarget): Schemas["MoveTarget"] {
  return to === "deferred" ? { deferred: true } : { vehicleId: to.vehicleId, trip: to.trip, deferred: false };
}

export function moveTargetFromApi(to: Schemas["MoveTarget"]): MoveTarget {
  if (to.deferred) return "deferred";
  if (to.vehicleId == null || to.trip == null) throw unexpectedReply("move target with no vehicle and no trip, and not deferred");
  return { vehicleId: to.vehicleId, trip: to.trip };
}

export const moveRequestToApi = (move: MoveRequest): Schemas["MoveRequest"] => ({ orderId: move.orderId, to: moveTargetToApi(move.to) });

// ---- Requests: query shapes -------------------------------------------------

/** `getQueue`'s filters as repeated query params (`?brand=Fresh&brand=Style`). An empty filter sends nothing. */
export function queueQuery(query: { depot: "peliyagoda" | "kandy"; date?: string; filters?: QueueFilters; search?: string }) {
  const f = query.filters;
  const search = query.search?.trim();
  return {
    depot: query.depot,
    ...(query.date ? { date: query.date } : {}),
    ...(f && f.brand.length > 0 ? { brand: f.brand } : {}),
    ...(f && f.temp.length > 0 ? { temp: f.temp } : {}),
    ...(f && f.status.length > 0 ? { status: f.status.map(statusToApi) } : {}),
    ...(f && f.window.length > 0 ? { window: f.window } : {}),
    ...(f && f.tags.length > 0 ? { tags: f.tags } : {}),
    ...(f && f.district.length > 0 ? { district: f.district } : {}),
    ...(search ? { search } : {}),
  };
}

// ---- 4. Absent versus null --------------------------------------------------

/** The fields the views type as `X | null` (not optional): a null here is the answer, not a gap. */
type KeepNull = "binding" | "kgCap" | "m3Cap" | "banner";

/** `T` with every null removed from optional fields, deeply. */
type Compact<T> = T extends readonly (infer U)[]
  ? Compact<U>[]
  : T extends object
    ? { [K in keyof T]: K extends KeepNull ? Compact<T[K]> : Compact<Exclude<T[K], null>> }
    : T;

const KEEP_NULL: ReadonlySet<string> = new Set<KeepNull>(["binding", "kgCap", "m3Cap", "banner"]);

/** Drops keys whose value is null, except the ones in `KEEP_NULL`. Arrays and nested records are walked. */
export function compact<T>(value: T): Compact<T> {
  if (Array.isArray(value)) return value.map(compact) as Compact<T>;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === null && !KEEP_NULL.has(key)) continue;
      out[key] = compact(item);
    }
    return out as Compact<T>;
  }
  return value as Compact<T>;
}

// ---- Responses --------------------------------------------------------------
// Each takes the wire reply and returns the screen's view: nulls compacted, then the fields that carry an enum or an id rebuilt.

type CompactOrder = Compact<Schemas["QueueOrder"]>;

const queueOrder = (order: CompactOrder): QueueOrder => ({ ...order, status: statusFromApi(order.status) });

export function queueViewFromApi(wire: Schemas["QueueView"]): QueueView {
  const view = compact(wire);
  return { ...view, groups: view.groups.map((group) => ({ ...group, orders: group.orders.map(queueOrder) })) };
}

export function orderHistoryFromApi(wire: Schemas["OrderHistory"]): OrderHistory {
  const history = compact(wire);
  return { ...history, order: queueOrder(history.order) };
}

export function capacityViewFromApi(wire: Schemas["CapacityView"]): CapacityView {
  // `plan` is null until the first draft exists, so it keeps its null while the rest is compacted.
  return { ...compact(wire), plan: wire.plan ? compact(wire.plan) : null };
}

export function planViewFromApi(wire: Schemas["PlanView"]): PlanView {
  const view = compact(wire);
  return { ...view, deferred: view.deferred.map((card) => ({ ...card, kind: deferralTypeFromApi(card.kind) })) };
}

export function moveResultFromApi(wire: Schemas["MoveResult"]): MoveResult {
  const result = compact(wire);
  return { ...result, to: moveTargetFromApi(wire.to) };
}

export function deferralsViewFromApi(wire: Schemas["DeferralsView"]): DeferralsView {
  const view = compact(wire);
  const card = (c: (typeof view.capacity)[number]): DeferralCard => ({ ...c, kind: deferralTypeFromApi(c.kind) });
  return { ...view, capacity: view.capacity.map(card), policy: view.policy.map(card), storeRequest: view.storeRequest.map(card) };
}

export function conflictViewFromApi(wire: Schemas["ConflictView"]): ConflictView {
  const view = compact(wire);
  return { ...view, recommendation: { ...view.recommendation, choice: resolutionFromApi(view.recommendation.choice) } };
}

export function exceptionViewFromApi(wire: Schemas["ExceptionView"]): ExceptionView {
  const { recommendation, ...rest } = compact(wire);
  return { ...rest, ...(recommendation ? { recommendation: { ...recommendation, kind: deferralTypeFromApi(recommendation.kind) } } : {}) };
}

/** Replies that carry no enum and no id still go through `compact`, so no `null` reaches a screen. */
export const acknowledgementsFromApi = (wire: Schemas["AcknowledgementsView"]): AcknowledgementsView => compact(wire);
export const liveBoardFromApi = (wire: Schemas["LiveBoardView"]): LiveBoardView => compact(wire);
export const inboxFromApi = (wire: Schemas["InboxView"]): InboxView => compact(wire);
export const forecastFromApi = (wire: Schemas["ForecastView"]): ForecastView => compact(wire);
export const deferStopResultFromApi = (wire: Schemas["DeferStopResult"]): DeferStopResult => compact(wire);
