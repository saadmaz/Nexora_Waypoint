import type {
  Brand,
  DeferredCard,
  DepotId,
  MoveRequest,
  MoveResult,
  MoveTarget,
  PlanLane,
  PlanStop,
  PlanTrip,
  PlanView,
  RuleCheck,
} from "../../../api/DispatcherApi";
import { EXTRA_POLICY_IDS, LANE_METERS, NAMED_DEFERRALS, ORDERS, OUTLETS, TRIPS_V3, TRIPS_V4, VEHICLES, type FxTrip } from "./fixtures";
import { type Milestones, type World, versionsAt } from "./world";

/**
 * The current plan as the mock serves it: plan v3 until the VEH003 swap, v4 until the store request,
 * v5 after, with the dispatcher's accepted moves applied to an open draft. The refusals the design
 * draws (D3.3 to D3.6) are scripted; every other move goes through a small stand-in for the rules the
 * server owns in `waypoint_rules` (reefer, brand, district, depot, window, capacity, Fresh budget).
 */

const FRESH_BUDGET = 270;
/** One more stop costs about an inter-stop leg plus the handling allowance, in minutes. */
const STOP_COST = 24;

const clone = <T,>(value: T): T => structuredClone(value);

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function hhmmOf(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** The trips of the plan at this moment, before any open-draft edits. */
function baseTrips(m: Milestones): FxTrip[] {
  const trips = clone(m.swapAt ? TRIPS_V4 : TRIPS_V3);
  if (m.swapAt) {
    // ORD1002 is deferred by the swap; it is not on any trip.
    return trips.map((t) => ({ ...t, stops: t.stops.filter((s) => !s.orderIds.includes("ORD1002")) }));
  }
  return trips;
}

/** The trips after the store request: OUT084's two orders leave VEH039 Trip 1 (plan v5). */
function afterStoreRequest(trips: FxTrip[]): FxTrip[] {
  return trips.map((t) =>
    t.vehicleId === "VEH039" ? { ...t, minutes: 73, stops: t.stops.filter((s) => s.outletId !== "OUT084") } : t,
  );
}

export function tripsNow(w: World, m: Milestones): FxTrip[] {
  let trips = baseTrips(m);
  if (m.storeRequestAt) trips = afterStoreRequest(trips);
  // Accepted moves edit the open draft only; a released plan is read-only.
  if (!m.releasedAt) for (const move of w.moves) trips = applyMove(trips, move);
  return trips;
}

function orderKg(ids: string[]): { kg: number; m3: number } {
  return ids.reduce((acc, id) => ({ kg: acc.kg + (ORDERS[id]?.kg ?? 0), m3: acc.m3 + (ORDERS[id]?.m3 ?? 0) }), { kg: 0, m3: 0 });
}

function tripLoad(trip: FxTrip) {
  return orderKg(trip.stops.flatMap((s) => s.orderIds));
}

/** Applies one accepted move to a copy of the trips. Arrival times move by one stop's cost. */
export function applyMove(trips: FxTrip[], move: MoveRequest): FxTrip[] {
  const next = clone(trips);
  for (const trip of next) {
    const index = trip.stops.findIndex((s) => s.orderIds.includes(move.orderId));
    if (index < 0) continue;
    const [stop] = trip.stops.splice(index, 1);
    if (!stop) continue;
    // Stops after the lifted one come 24 minutes earlier, and the trip is shorter.
    for (const later of trip.stops.slice(index)) later.arrival = hhmmOf(minutesOf(later.arrival) - STOP_COST);
    trip.minutes -= STOP_COST;
    const to = move.to;
    if (to !== "deferred") {
      const target = next.find((t) => t.vehicleId === to.vehicleId && t.trip === to.trip);
      if (target) {
        const last = target.stops.at(-1);
        stop.arrival = hhmmOf((last ? minutesOf(last.arrival) : minutesOf(target.departs)) + STOP_COST);
        delete stop.note;
        target.stops.push(stop);
        target.minutes += STOP_COST;
      }
    }
    break;
  }
  return next;
}

// ---- Deferrals --------------------------------------------------------------

export type DeferralSets = { capacity: string[]; policy: string[]; storeRequest: string[] };

/** The deferred orders at a depot, by type, in the order the screens list them. */
export function deferralSets(w: World, m: Milestones, depot: DepotId): DeferralSets {
  if (depot === "kandy") {
    return { capacity: [], policy: [], storeRequest: m.storeRequestAt ? ["ORD2001", "ORD2002"] : [] };
  }
  const moved = new Set<string>();
  for (const move of w.moves) if (!m.releasedAt && move.to === "deferred") moved.add(move.orderId);
  const policy = ["ORD1009", "ORD1017", "ORD1006", ...EXTRA_POLICY_IDS];
  if (m.swapAt) policy.unshift(...(w.swapDeferred.length > 0 ? w.swapDeferred : ["ORD1002"]));
  for (const id of moved) if (!policy.includes(id)) policy.unshift(id);
  return { capacity: ["ORD1020"], policy, storeRequest: [] };
}

export function deferralCountAt(w: World, m: Milestones, depot: DepotId): number {
  const sets = deferralSets(w, m, depot);
  return sets.capacity.length + sets.policy.length + sets.storeRequest.length;
}

// ---- The plan view ----------------------------------------------------------

function stopsOf(trip: FxTrip, protectedIds: Set<string>): PlanStop[] {
  return trip.stops.map((s, i) => {
    const load = orderKg(s.orderIds);
    const stop: PlanStop = {
      orderId: s.orderIds.join(" + "),
      orderIds: s.orderIds,
      outletId: s.outletId,
      seq: i + 1,
      arrival: s.arrival,
      protected: s.orderIds.some((id) => protectedIds.has(id)),
      kg: load.kg,
      m3: load.m3,
    };
    if (s.note) stop.note = s.note;
    return stop;
  });
}

function planTrip(trip: FxTrip, protectedIds: Set<string>): PlanTrip {
  const vehicle = VEHICLES[trip.vehicleId];
  const load = tripLoad(trip);
  const budget = trip.brand === "Fresh" ? FRESH_BUDGET : 480;
  return {
    vehicleId: trip.vehicleId,
    trip: trip.trip,
    departs: trip.departs,
    brand: trip.brand,
    district: trip.district,
    stops: stopsOf(trip, protectedIds),
    kg: load.kg,
    kgCap: vehicle?.kgCap ?? null,
    m3: Math.round(load.m3 * 10) / 10,
    m3Cap: vehicle?.m3Cap ?? null,
    minutes: trip.minutes,
    fill: {
      kg: vehicle ? load.kg / vehicle.kgCap : 0,
      m3: vehicle ? load.m3 / vehicle.m3Cap : 0,
      minutes: trip.minutes / budget,
    },
  };
}

const PROTECTED = new Set(["ORD1001", "ORD1005"]);

function lanesFor(w: World, m: Milestones, depot: DepotId): PlanLane[] {
  const trips = tripsNow(w, m);
  const lanes: PlanLane[] = [];
  const ids = depot === "kandy" ? ["VEH039"] : m.swapAt ? ["VEH036", "VEH035", "VEH011", "VEH003"] : ["VEH003", "VEH035", "VEH011", "VEH036"];
  for (const id of ids) {
    const vehicle = VEHICLES[id];
    if (!vehicle) continue;
    const vTrips = trips.filter((t) => t.vehicleId === id);
    const lane: PlanLane = {
      vehicleId: id,
      kind: vehicle.kind,
      reefer: vehicle.reefer,
      status: "active",
      meters: LANE_METERS[id] ?? [],
      trips: vTrips.map((t) => planTrip(t, PROTECTED)),
    };
    if (id === "VEH036" && vTrips.length === 0) {
      lane.status = m.spareAvailable ? "spare" : "workshop";
      lane.workshopUntil = "02:45";
    }
    if (id === "VEH003" && m.swapAt) lane.status = "replaced";
    lanes.push(lane);
  }
  return lanes;
}

function deferredCard(id: string, kind: "capacity" | "policy" | "store request", binding: string): DeferredCard {
  const order = ORDERS[id];
  const outlet = order ? OUTLETS[order.outletId] : undefined;
  return {
    orderId: id,
    outletId: order?.outletId ?? "OUT000",
    brand: (outlet?.brand ?? "Fresh") as Brand,
    temp: order?.temp ?? "chilled",
    kind,
    binding,
    nextRun: "Wed",
    kg: order?.kg ?? 0,
    m3: order?.m3 ?? 0,
    window: { start: order?.window?.[0] ?? outlet?.window[0] ?? "05:00", end: order?.window?.[1] ?? outlet?.window[1] ?? "08:00" },
    dock: outlet?.dock ?? "Rear dock",
    district: outlet?.district ?? "Colombo",
  };
}

const BINDING_OF: Record<string, string> = Object.fromEntries(NAMED_DEFERRALS.map((d) => [d.orderId, d.binding]));

export function deferredCards(sets: DeferralSets): DeferredCard[] {
  return [
    ...sets.capacity.map((id) => deferredCard(id, "capacity", BINDING_OF[id] ?? "van access")),
    ...sets.policy
      .filter((id) => ORDERS[id])
      .map((id) => deferredCard(id, "policy", id === "ORD1002" ? "weight / volume" : (BINDING_OF[id] ?? "window"))),
    ...sets.storeRequest.map((id) => deferredCard(id, "store request", "none: store asked")),
  ];
}

function buildChecks(w: World, m: Milestones, depot: DepotId): { text: string; ok: boolean }[] {
  const sets = deferralSets(w, m, depot);
  const total = sets.capacity.length + sets.policy.length + sets.storeRequest.length;
  return [
    { text: "All trips pass every rule", ok: true },
    { text: `${total} deferral notices ready`, ok: true },
    { text: "0 unplaced orders without a reason", ok: true },
    { text: "Every vehicle has a driver and dock assigned", ok: true },
  ];
}

export function planView(w: World, m: Milestones, depot: DepotId, versionNumber?: number): PlanView {
  const versions = versionsAt(m).map((v) => ({ ...v, current: false }));
  const latest = versions.at(-1);
  const chosen = versionNumber ? versions.find((v) => v.number === versionNumber) : undefined;
  const current = chosen ?? latest ?? { number: 0, state: "draft" as const, at: "", note: "No plan yet", current: true };
  const listed = versions.map((v) => ({ ...v, current: v.number === current.number }));
  const sets = deferralSets(w, m, depot);
  const deferredTotal = sets.capacity.length + sets.policy.length + sets.storeRequest.length;
  const shownDeferred = deferredCards({
    capacity: sets.capacity,
    policy: sets.policy.slice(0, Math.min(sets.policy.length, m.swapAt ? 4 : 3)),
    storeRequest: sets.storeRequest,
  });
  // The pool shows four named cards and "+N more" (D3.1); v4's ORD1002 is listed first.
  const pool = shownDeferred.slice(0, 4);
  const released = current.state === "released";

  const peliyagoda = deferralCountAt(w, m, "peliyagoda");
  const kandy = deferralCountAt(w, m, "kandy");
  const orders = 276;
  const deferredAll = peliyagoda + kandy;
  return {
    depot,
    version: { number: current.number, state: current.state, at: current.at, note: current.note, current: true, ...(current.scope ? { scope: current.scope } : {}) },
    versions: listed,
    readOnly: released,
    lanes: lanesFor(w, m, depot),
    deferred: pool,
    deferredTotal,
    summary: {
      orders,
      served: orders - deferredAll,
      deferred: deferredAll,
      capacityDeferred: 1,
      policyDeferred: peliyagoda - 1 + (depot === "kandy" ? 0 : 0),
      trips: 36,
      receivers: { docks: 2, drivers: 11 },
      byDepot: [
        { depot: "peliyagoda", orders: 212, served: 212 - peliyagoda, deferred: peliyagoda, receivers: "Priya · 8 drivers" },
        { depot: "kandy", orders: 64, served: 64 - kandy, deferred: kandy, receivers: "Ruwan · 3 drivers" },
      ],
    },
    checks: buildChecks(w, m, depot),
    readyToRelease: m.v3Draft && !m.releasedAt,
  };
}

// ---- Moves ------------------------------------------------------------------

function findTrip(trips: FxTrip[], target: MoveTarget): FxTrip | undefined {
  if (target === "deferred") return undefined;
  return trips.find((t) => t.vehicleId === target.vehicleId && t.trip === target.trip);
}

function currentTripOf(trips: FxTrip[], orderId: string): FxTrip | undefined {
  return trips.find((t) => t.stops.some((s) => s.orderIds.includes(orderId)));
}

const money = (n: number) => n.toLocaleString("en-US");

function ruleChecks(order: string, trip: FxTrip, options: { added: boolean; fail?: Set<string>; arrival?: string }): RuleCheck[] {
  const o = ORDERS[order];
  const outlet = o ? OUTLETS[o.outletId] : undefined;
  const vehicle = VEHICLES[trip.vehicleId];
  const load = tripLoad(trip);
  const extra = options.added ? orderKg([order]) : { kg: 0, m3: 0 };
  const kg = load.kg + extra.kg;
  const m3 = load.m3 + extra.m3;
  const sibling = trip.stops.length > 0 ? trip : undefined;
  const fresh = (LANE_METERS[trip.vehicleId]?.[0]?.used ?? 0) + (options.added ? STOP_COST : 0);
  const fail = options.fail ?? new Set<string>();
  const arrival = options.arrival ?? trip.stops.find((s) => s.orderIds.includes(order))?.arrival ?? trip.departs;
  return [
    {
      rule: "Reefer",
      ok: !fail.has("Reefer"),
      detail: vehicle?.reefer
        ? `${trip.vehicleId} is a reefer ${vehicle.van ? "van" : "truck"}; ${order} is ${o?.temp ?? "chilled"}`
        : `${trip.vehicleId} is ambient`,
    },
    { rule: "Capacity", ok: !fail.has("Capacity"), detail: `${money(kg)} / ${money(vehicle?.kgCap ?? 0)} kg · ${(Math.round(m3 * 10) / 10).toFixed(1)} / ${(vehicle?.m3Cap ?? 0).toFixed(1)} m³` },
    { rule: "Depot", ok: !fail.has("Depot"), detail: `${vehicle?.depot === "kandy" ? "Kandy" : "Peliyagoda"} = ${outlet?.depot === "kandy" ? "Kandy" : "Peliyagoda"}` },
    { rule: "Access", ok: !fail.has("Access"), detail: `${outlet?.dock ?? "Rear dock"} · ${outlet?.vanOnly ? "van only" : "normal access"}` },
    { rule: "Window", ok: !fail.has("Window"), detail: `Arrives ${arrival} · window ${outlet?.window[0] ?? "03:00"}–${outlet?.window[1] ?? "08:00"}` },
    { rule: "Fuel", ok: !fail.has("Fuel"), detail: `${LANE_METERS[trip.vehicleId]?.[1]?.used ?? 0} / ${LANE_METERS[trip.vehicleId]?.[1]?.limit ?? 0} L this week incl. tonight` },
    { rule: "One brand + district", ok: !fail.has("One brand"), detail: `${sibling ? `${trip.brand} · ${trip.district}` : `${outlet?.brand ?? "Fresh"} · ${outlet?.district ?? "Colombo"}`}` },
    { rule: "Trips", ok: !fail.has("Trips"), detail: `Trip ${trip.trip} of ${VEHICLES[trip.vehicleId]?.van ? 2 : 2} · Fresh ${fresh} / ${FRESH_BUDGET} min` },
  ];
}

function refuse(orderId: string, to: MoveTarget, violations: { rule: string; text: string }[], checks: RuleCheck[], summary: string): MoveResult {
  return { ok: false, orderId, to, violations, checks, summary };
}

/** Would this move be legal? The documented cases are scripted; the rest use the stand-in rules. */
export function validate(w: World, m: Milestones, request: MoveRequest): MoveResult {
  const trips = tripsNow(w, m);
  const { orderId, to } = request;
  const order = ORDERS[orderId];
  const outlet = order ? OUTLETS[order.outletId] : undefined;
  const here = currentTripOf(trips, orderId);

  // The order is deferred (not on a trip) or on a trip: moving to "deferred" is the defer action.
  if (to === "deferred") {
    if (order?.deferredYesterday && here) {
      const guard = `${outlet?.id ?? "The outlet"} was deferred yesterday and a legal vehicle exists today (${here.vehicleId} · Trip ${here.trip}). The continuity guard protects outlets from being skipped twice.`;
      return {
        ok: false,
        orderId,
        to,
        violations: [{ rule: "R-CONT", text: guard }],
        checks: ruleChecks(orderId, here, { added: false }),
        protectedReason: guard,
        summary: `Can't defer ${orderId}`,
      };
    }
    return {
      ok: true,
      orderId,
      to,
      violations: [],
      checks: here ? ruleChecks(orderId, here, { added: false }) : [],
      summary: `Defer ${orderId}`,
      preview: {
        headline: `If you defer ${orderId}`,
        rows: [],
        note: "Policy deferral, next run Wed 30 Sep",
        verdict: "Drop to defer",
      },
    };
  }

  const target = findTrip(trips, to);
  if (!target || !order || !outlet) {
    return refuse(orderId, to, [{ rule: "R-NOTRIP", text: "That trip is not in this plan" }], [], `Can't move ${orderId}`);
  }
  const key = `${orderId}->${target.vehicleId}-${target.trip}`;
  const head = `Can't move ${orderId} to ${target.vehicleId} · Trip ${target.trip}`;

  if (here && here.vehicleId === target.vehicleId && here.trip === target.trip) {
    // "Why this vehicle": the order is already here; every rule is shown with its figures.
    return { ok: true, orderId, to, violations: [], checks: ruleChecks(orderId, target, { added: false }), summary: `${orderId} is on ${target.vehicleId} · Trip ${target.trip}` };
  }

  // The moves the design draws (D3.2 to D3.6), then the general rules.
  if (key === "ORD1003->VEH035-1") {
    const before = tripLoad(target);
    const add = orderKg([orderId]);
    const other = here ? tripLoad(here) : { kg: 0, m3: 0 };
    return {
      ok: true,
      orderId,
      to,
      violations: [],
      checks: ruleChecks(orderId, target, { added: true }),
      summary: "All rules pass: drop to accept",
      preview: {
        headline: `If you move ${orderId} here`,
        rows: [
          { label: "Weight", text: `${money(before.kg)} → ${money(before.kg + add.kg)} / ${money(VEHICLES[target.vehicleId]?.kgCap ?? 0)} kg`, before: before.kg, after: before.kg + add.kg, limit: VEHICLES[target.vehicleId]?.kgCap ?? 0, ok: true },
          { label: "Volume", text: `${before.m3.toFixed(1)} → ${(before.m3 + add.m3).toFixed(1)} / ${(VEHICLES[target.vehicleId]?.m3Cap ?? 0).toFixed(1)} m³`, before: before.m3, after: before.m3 + add.m3, limit: VEHICLES[target.vehicleId]?.m3Cap ?? 0, ok: true },
          { label: "Window", text: "Window: last arrival within 07:30", ok: true },
          { label: "Fresh minutes", text: "Fresh minutes 226 → 226 / 270 · Stop moved, not added", ok: true },
        ],
        source: {
          title: `${here?.vehicleId ?? "VEH035"} · Trip ${here?.trip ?? 2}`,
          frees: `Frees ${money(other.kg >= 0 ? add.kg : 0)} kg / ${add.m3.toFixed(1)} m³`,
        },
        note: "New stop added at the end",
        verdict: "All rules pass: drop to accept",
      },
    };
  }

  if (key === "ORD1009->VEH003-2" || key === "ORD1017->VEH003-2") {
    const checks = ruleChecks(orderId, target, { added: true, fail: new Set(["Window"]), arrival: "08:06" });
    return refuse(
      orderId,
      to,
      [{ rule: "R-WINDOW", text: `Window: planned arrival 08:06 is after ${outlet.id}'s window closes at 08:00.` }],
      checks,
      head,
    );
  }
  if (key === "ORD1017->VEH035-2") {
    const checks = ruleChecks(orderId, target, { added: true, fail: new Set(["One brand"]) });
    return refuse(orderId, to, [{ rule: "R-DISTRICT", text: "Different district (Gampaha)" }], checks, head);
  }
  if (key === "ORD1017->VEH003-1") {
    const checks = ruleChecks(orderId, target, { added: true, fail: new Set(["Trips"]) });
    return refuse(orderId, to, [{ rule: "R-BUDGET-F", text: "Fresh minutes over 270" }], checks, head);
  }
  if (key === "ORD1017->VEH011-1" || key === "ORD1002->VEH011-1") {
    const checks = ruleChecks(orderId, target, { added: true, fail: new Set(["Reefer", "One brand"]) });
    return refuse(
      orderId,
      to,
      [
        { rule: "R-TEMP", text: `Needs a reefer: ${target.vehicleId} is ambient` },
        { rule: "R-BRAND", text: `Trip would carry two brands (${target.brand}, ${outlet.brand})` },
      ],
      checks,
      head,
    );
  }

  // The general rules, for any move the design does not draw.
  const fail = new Set<string>();
  const violations: { rule: string; text: string }[] = [];
  const vehicle = VEHICLES[target.vehicleId];
  if (order.temp === "chilled" && vehicle && !vehicle.reefer) {
    fail.add("Reefer");
    violations.push({ rule: "R-TEMP", text: `Needs a reefer: ${target.vehicleId} is ambient` });
  }
  if (target.brand !== outlet.brand) {
    fail.add("One brand");
    violations.push({ rule: "R-BRAND", text: `Trip would carry two brands (${target.brand}, ${outlet.brand})` });
  } else if (target.district !== outlet.district) {
    fail.add("One brand");
    violations.push({ rule: "R-DISTRICT", text: `Different district (${target.district})` });
  }
  if (vehicle && vehicle.depot !== outlet.depot) {
    fail.add("Depot");
    violations.push({ rule: "R-DEPOT", text: `${target.vehicleId} is at ${vehicle.depot === "kandy" ? "Kandy" : "Peliyagoda"}` });
  }
  const load = tripLoad(target);
  const add = orderKg([orderId]);
  if (vehicle && (load.kg + add.kg > vehicle.kgCap || load.m3 + add.m3 > vehicle.m3Cap)) {
    fail.add("Capacity");
    violations.push({ rule: "R-KG", text: `Over capacity: ${money(load.kg + add.kg)} kg on ${money(vehicle.kgCap)} kg` });
  }
  const last = target.stops.at(-1);
  const arrival = hhmmOf((last ? minutesOf(last.arrival) : minutesOf(target.departs)) + STOP_COST);
  if (minutesOf(arrival) > minutesOf(outlet.window[1])) {
    fail.add("Window");
    violations.push({ rule: "R-WINDOW", text: `Window: planned arrival ${arrival} is after ${outlet.id}'s window closes at ${outlet.window[1]}.` });
  }
  const checks = ruleChecks(orderId, target, { added: true, fail, arrival });
  if (violations.length > 0) return refuse(orderId, to, violations, checks, head);

  const cap = vehicle ?? { kgCap: 0, m3Cap: 0 };
  return {
    ok: true,
    orderId,
    to,
    violations: [],
    checks,
    summary: "All rules pass: drop to accept",
    preview: {
      headline: `If you move ${orderId} here`,
      rows: [
        { label: "Weight", text: `${money(load.kg)} → ${money(load.kg + add.kg)} / ${money(cap.kgCap)} kg`, before: load.kg, after: load.kg + add.kg, limit: cap.kgCap, ok: true },
        { label: "Volume", text: `${load.m3.toFixed(1)} → ${(load.m3 + add.m3).toFixed(1)} / ${cap.m3Cap.toFixed(1)} m³`, before: load.m3, after: load.m3 + add.m3, limit: cap.m3Cap, ok: true },
        { label: "Window", text: `Window: arrives ${arrival}, inside ${outlet.window[1]}`, ok: true },
      ],
      note: "New stop added at the end",
      verdict: "All rules pass: drop to accept",
    },
  };
}
