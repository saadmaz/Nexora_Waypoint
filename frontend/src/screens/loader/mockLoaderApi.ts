import type { DepotId, Trip, Vehicle, VehicleTag } from "../../domain/field";
import { colomboMs, formatTime } from "../../field/clock/clock";
import { HERO_DATE } from "../../field/clock/mockClock";
import { OTHER_PERSON_ID } from "../../field/components";
import { connectivity, enqueue, NetworkError, registerSyncHandler } from "../../field/offline";
import { DECISION_AT, GUEST_PIN, peopleFor, pinFor, tripsV3, tripsV4, VEH036_AVAILABLE_AT, VEHICLES } from "./fixtures";
import type {
  AcknowledgePlanInput,
  ConfirmLoadedInput,
  FlagExceptionInput,
  LoaderApi,
  RecordCheckInput,
} from "./LoaderApi";
import type {
  DockAcknowledgement,
  DockVehicleSummary,
  DockView,
  ExceptionView,
  LoadPlanOrderRow,
  LoadPlanView,
  PlanDiffView,
  VehicleLoadStatus,
} from "./types";

/** L1.4, L2.5: the vehicle-check-failed reason, copied verbatim from the frame. */
export const HELD_REASON = "Held: reefer unit failed pre-departure check at 02:55";

const PELIYAGODA_VEHICLES = ["VEH003", "VEH035", "VEH011"];
const PELIYAGODA_VEHICLES_V4 = ["VEH036", "VEH035", "VEH011"];
const KANDY_VEHICLES = ["VEH039"];

type Exception = ExceptionView;

/** Latency and offline behaviour the mock applies to every call (field conventions section 10). */
async function simulateNetwork(): Promise<void> {
  if (!connectivity.isConnected()) throw new NetworkError();
  const ms = 300 + Math.random() * 300;
  await new Promise((resolve) => setTimeout(resolve, ms));
  if (!connectivity.isConnected()) throw new NetworkError();
}

/**
 * The loader's mock API and mock server (field conventions section 10, loader prompt section 5).
 * One in-memory store per instance, seeded from `fixtures.ts`, standing in for Dispatch until the
 * real backend exists: v3 released Mon 23:40; VEH036 available 02:45; a "Vehicle check failed"
 * flag on VEH003 is decided at 03:00 (or sooner with `devResolveExceptionNow`), moving its trips to
 * VEH036 and deferring ORD1002.
 */
/** Record types PRD v3.1 section 9 lists: every loader write goes through the outbox under one of these. */
for (const type of ["loader.ack", "loader.check", "loader.confirmLoaded", "loader.exception"]) {
  registerSyncHandler(type, async () => {
    await simulateNetwork();
    return { result: "accepted" };
  });
}

export function createMockLoaderApi(nowMs: () => number): LoaderApi {
  const acknowledgements = new Map<DepotId, DockAcknowledgement>();
  const tags = new Map<string, VehicleTag[]>(Object.entries(VEHICLES).map(([id, v]) => [id, [...v.tags]]));
  const checks = new Map<string, Map<string, number>>();
  const confirmed = new Map<string, { at: string; by: string }>();
  const exceptions = new Map<string, Exception>();
  let exceptionSeq = 1;
  let manualResolve = false;

  const decisionAtMs = colomboMs(HERO_DATE, DECISION_AT);
  const workshopDoneMs = colomboMs(HERO_DATE, VEH036_AVAILABLE_AT);

  function veh003Exception(): Exception | undefined {
    return [...exceptions.values()]
      .filter((e) => e.vehicleId === "VEH003" && e.type === "Vehicle check failed")
      .sort((a, b) => a.id.localeCompare(b.id))
      .at(-1);
  }

  /**
   * Resolves the VEH003 exception into plan v4 once the clock (or the dev control) says it is time.
   * Every other flag only gets marked seen at that moment (PRD v3.1 G-14): no decision, no new version.
   */
  function settle(): void {
    const due = manualResolve || nowMs() >= decisionAtMs;
    if (!due) return;
    const stamp = formatTime(Math.max(nowMs(), decisionAtMs));
    for (const other of exceptions.values()) {
      const isVehicleCheck = other.vehicleId === "VEH003" && other.type === "Vehicle check failed";
      if (!isVehicleCheck && !other.seenAt) other.seenAt = stamp;
    }
    const ex = veh003Exception();
    if (!ex || ex.status === "decided") return;
    ex.status = "decided";
    ex.decidedVersion = 4;
    ex.decidedBy = "Kumari";
    ex.decidedAt = stamp;
    tags.set("VEH003", ["Replaced"]);
    tags.set("VEH036", ["Available"]);
  }

  function currentVersion(): number {
    settle();
    return veh003Exception()?.status === "decided" ? 4 : 3;
  }

  function trips(): Record<string, Trip> {
    return currentVersion() >= 4 ? tripsV4() : tripsV3();
  }

  function vehicleTags(id: string): VehicleTag[] {
    if (id === "VEH036" && nowMs() < workshopDoneMs && currentVersion() < 4) return ["In workshop"];
    return tags.get(id) ?? ["Available"];
  }

  function dockVehicleIds(dockId: DepotId): string[] {
    if (dockId === "kandy") return KANDY_VEHICLES;
    const ack = acknowledgements.get("peliyagoda");
    const ackedV4 = currentVersion() >= 4 && (ack?.version ?? 0) >= 4;
    return ackedV4 ? PELIYAGODA_VEHICLES_V4 : PELIYAGODA_VEHICLES;
  }

  function vehicleTrips(vehicleId: string): Trip[] {
    const all = trips();
    return Object.values(all)
      .filter((t) => t.vehicleId === vehicleId)
      .sort((a, b) => a.tripNo - b.tripNo);
  }

  function tripOrderCount(trip: Trip): number {
    return trip.stops.reduce((sum, s) => sum + s.orders.length, 0);
  }

  function tripChecked(vehicleId: string, tripNo: number): { done: number; total: number } {
    const trip = vehicleTrips(vehicleId).find((t) => t.tripNo === tripNo);
    if (!trip) return { done: 0, total: 0 };
    const key = `${vehicleId}·${tripNo}`;
    const recorded = checks.get(key);
    const total = tripOrderCount(trip);
    if (!recorded) return { done: 0, total };
    let done = 0;
    for (const stop of trip.stops) for (const order of stop.orders) if ((recorded.get(order.id) ?? 0) >= order.units) done += 1;
    return { done, total };
  }

  function activeTripNo(vehicleId: string): 1 | 2 {
    const ts = vehicleTrips(vehicleId);
    for (const t of ts) if (!confirmed.has(`${vehicleId}·${t.tripNo}`)) return t.tripNo as 1 | 2;
    return (ts.at(-1)?.tripNo ?? 1) as 1 | 2;
  }

  function vehicleStatus(vehicleId: string): VehicleLoadStatus {
    if (vehicleId === "VEH003" && veh003Exception()?.status === "reviewing") return "held";
    if (vehicleId === "VEH003" && veh003Exception()?.status === "decided") return "replaced";
    const ts = vehicleTrips(vehicleId);
    if (ts.length > 0 && ts.every((t) => confirmed.has(`${vehicleId}·${t.tripNo}`))) return "loaded";
    const active = activeTripNo(vehicleId);
    const { done } = tripChecked(vehicleId, active);
    return done > 0 ? "loading" : "to_load";
  }

  /** Once VEH003 is decided, VEH036 stands in for it: the same two ends the real API names. */
  function swapLinks(vehicleId: string): { replaces?: string; replacedBy?: string } {
    if (veh003Exception()?.status !== "decided") return {};
    if (vehicleId === "VEH036") return { replaces: "VEH003" };
    if (vehicleId === "VEH003") return { replacedBy: "VEH036" };
    return {};
  }

  function buildSummary(vehicleId: string): DockVehicleSummary {
    const vehicle: Vehicle = { ...VEHICLES[vehicleId], tags: vehicleTags(vehicleId) };
    const ts = vehicleTrips(vehicleId);
    const orderCount = ts.reduce((sum, t) => sum + tripOrderCount(t), 0);
    const active = activeTripNo(vehicleId);
    const activeTrip = ts.find((t) => t.tripNo === active);
    const status = vehicleStatus(vehicleId);
    return {
      vehicle,
      trips: ts.length,
      orderCount,
      activeTrip: active,
      departsAt: activeTrip?.departsAt ?? ts[0]?.departsAt ?? "",
      orderIds: activeTrip ? activeTrip.stops.flatMap((stop) => stop.orders.map((o) => o.id)).sort() : undefined,
      status,
      checked: status === "to_load" || status === "held" ? undefined : tripChecked(vehicleId, active),
      heldReason: status === "held" ? HELD_REASON : undefined,
      ...swapLinks(vehicleId),
    };
  }

  function dockOrderCount(dockId: DepotId): number {
    return dockVehicleIds(dockId).reduce((sum, id) => sum + vehicleTrips(id).reduce((s, t) => s + tripOrderCount(t), 0), 0);
  }

  function dockFirstDeparture(dockId: DepotId): string {
    const all = dockVehicleIds(dockId)
      .flatMap((id) => vehicleTrips(id))
      .map((t) => t.departsAt)
      .sort();
    return all[0] ?? "";
  }

  function buildLoadPlanOrders(vehicleId: string, trip: Trip): LoadPlanOrderRow[] {
    const key = `${vehicleId}·${trip.tripNo}`;
    const recorded = checks.get(key);
    const rows: LoadPlanOrderRow[] = [];
    for (const stop of trip.stops) {
      for (const order of stop.orders) {
        rows.push({
          orderId: order.id,
          outletId: stop.outletId,
          loadNumber: 0,
          stopNumber: stop.number,
          brand: stop.brand,
          temperature: order.temperature,
          dock: stop.dock,
          unitsExpected: order.units,
          unitsLoaded: recorded?.get(order.id) ?? 0,
          weightKg: order.weightKg,
          volumeM3: order.volumeM3,
          protectedOrder: order.tags.includes("Protected"),
          state: (recorded?.get(order.id) ?? 0) >= order.units ? "checked" : (recorded?.get(order.id) ?? 0) > 0 ? "short" : "todo",
        });
      }
    }
    // Reverse stop order: the last stop is loaded first.
    rows.reverse();
    rows.forEach((row, i) => (row.loadNumber = i + 1));
    return rows;
  }

  return {
    async getDock(dockId) {
      await simulateNetwork();
      const ids = dockVehicleIds(dockId);
      const ack = acknowledgements.get(dockId);
      const version = currentVersion();
      return {
        dockId,
        planVersion: version,
        planReleasedAt: version >= 4 ? veh003Exception()?.decidedAt ?? "" : "23:40",
        vehicleCount: ids.length,
        orderCount: dockOrderCount(dockId),
        firstDeparture: dockFirstDeparture(dockId),
        acknowledgement: ack,
        newerVersionExists: ack !== undefined && ack.version < version,
        vehicles: ids.map(buildSummary),
      } satisfies DockView;
    },

    async getPeople(dockId) {
      return peopleFor(dockId);
    },

    async verifyPin(personId, pin, otherName) {
      // PRD v3.1: the tablet caches salted hashes for every PIN person and the guest PIN, so PIN
      // checks work offline; the server only re-verifies on sync. "Other…" takes the guest PIN,
      // the same at both docks (A55).
      if (personId === OTHER_PERSON_ID) return pin === GUEST_PIN && !!otherName?.trim();
      return pinFor(personId) === pin;
    },

    async acknowledgePlan({ dockId, version, personId, personName }: AcknowledgePlanInput) {
      if (version < currentVersion()) return "conflict";
      acknowledgements.set(dockId, { version, personId, personName, at: formatTime(nowMs()) });
      await enqueue({ type: "loader.ack", payload: { dockId, version, personId, personName }, actor: personId, planVersionOnDevice: version });
      return "accepted";
    },

    async getLoadPlan(vehicleId, trip) {
      await simulateNetwork();
      const t = vehicleTrips(vehicleId).find((tr) => tr.tripNo === trip);
      if (!t) throw new Error(`No trip ${trip} for ${vehicleId}`);
      const key = `${vehicleId}·${trip}`;
      const confirmedInfo = confirmed.get(key);
      return {
        vehicle: { ...VEHICLES[vehicleId], tags: vehicleTags(vehicleId) },
        trip,
        departsAt: t.departsAt,
        planVersion: currentVersion(),
        status: vehicleStatus(vehicleId),
        heldReason: vehicleStatus(vehicleId) === "held" ? HELD_REASON : undefined,
        orders: buildLoadPlanOrders(vehicleId, t),
        ...swapLinks(vehicleId),
        confirmedAt: confirmedInfo?.at,
        confirmedBy: confirmedInfo?.by,
      } satisfies LoadPlanView;
    },

    async recordCheck(input: RecordCheckInput) {
      const { vehicleId, trip, orderId, unitsLoaded, personId } = input;
      const key = `${vehicleId}·${trip}`;
      const map = checks.get(key) ?? new Map<string, number>();
      map.set(orderId, unitsLoaded);
      checks.set(key, map);
      await enqueue({ type: "loader.check", payload: input, actor: personId, planVersionOnDevice: currentVersion() });
    },

    async confirmLoaded(input: ConfirmLoadedInput) {
      const { vehicleId, trip, personId, personName } = input;
      confirmed.set(`${vehicleId}·${trip}`, { at: formatTime(nowMs()), by: personName });
      await enqueue({ type: "loader.confirmLoaded", payload: input, actor: personId, planVersionOnDevice: currentVersion() });
    },

    async flagException(input: FlagExceptionInput) {
      const { type, vehicleId, trip, orderIds, unitsShort, note, reason, personId, personName, blobIds } = input;
      const id = `EXC${exceptionSeq++}`;
      exceptions.set(id, {
        id,
        type,
        vehicleId,
        trip,
        orderIds,
        unitsShort,
        note,
        reason,
        raisedBy: personName,
        raisedAt: formatTime(nowMs()),
        status: "reviewing",
      });
      if (type === "Vehicle check failed") tags.set(vehicleId, ["Held"]);
      await enqueue({
        type: "loader.exception",
        payload: { ...input, id },
        actor: personId,
        planVersionOnDevice: currentVersion(),
        blobIds,
      });
      return id;
    },

    async getException(id) {
      await simulateNetwork();
      settle();
      const ex = exceptions.get(id);
      if (!ex) throw new Error(`No exception ${id}`);
      return { ...ex } satisfies ExceptionView;
    },

    async getPlanDiff(dockId, from, to) {
      await simulateNetwork();
      if (dockId !== "peliyagoda" || to < 4) {
        return {
          from,
          to,
          removed: [],
          changed: [],
          noChangeVehicleIds: dockVehicleIds(dockId),
        } satisfies PlanDiffView;
      }
      return {
        from,
        to,
        removed: [{ orderId: "ORD1002", outletId: "OUT009", deferralType: "policy", nextRunShort: "Wed" }],
        changed: [{ fromVehicleId: "VEH003", toVehicleId: "VEH036", vehicleLabel: "VEH036 (reefer van)", trips: "Trips 1 and 2" }],
        noChangeVehicleIds: ["VEH035", "VEH011"],
        newTotals: { weightKg: 950, weightCapKg: 1040, volumeM3: 6.3, volumeCapM3: 7.0 },
      } satisfies PlanDiffView;
    },

    async getCurrentVersion() {
      await simulateNetwork();
      return currentVersion();
    },

    async devResolveExceptionNow() {
      manualResolve = true;
      settle();
    },
  };
}
