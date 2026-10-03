import { oneOf } from "../../api/vocab";
import type { components } from "../../api/schema";
import type { Brand, DepotId, Vehicle, VehicleTag } from "../../domain/field";
import { formatTime } from "../../field/clock/clock";
import type { OutboxRecord } from "../../field/offline";
import { EXCEPTION_TYPES, type DockAcknowledgement, type DockVehicleSummary, type DockView, type ExceptionView, type LoadPlanOrderRow, type LoadPlanView, type PlanDiffView, type VehicleLoadStatus } from "./types";

type Schemas = components["schemas"];

/**
 * Maps the backend's loader replies onto the loader's own types, then lays the tablet's unsent work on top: a count the loader
 * just recorded, a plan just acknowledged, a load just confirmed all show at once, before they reach the server (field
 * conventions section 11).
 *
 * CONTRACT GAPS. The loader's replies do not carry everything the screens show. `LOADER_GAPS` lists what is missing and each
 * is filled with a visibly neutral value, never a plausible-looking one:
 *   - a vehicle's kind, temperature class, capacities and kmPerL (so the capacity bar reads 0 of 0)
 *   - when the plan was released, who acknowledged it and when (the tablet's own record of the acknowledgement is used when it has one)
 *   - how far each vehicle's loading has got, and why a vehicle is held
 *   - each load line's brand, temperature, dock type, weight and volume, and its stop number (derived: the reverse of the load order)
 *   - who confirmed a load
 *   - what a plan diff removed (the outlet, the deferral type, shown as policy, and the next run) and the new totals
 */
export const LOADER_GAPS = [
  "vehicle: kind, temperature, capacities, kmPerL",
  "dock: planReleasedAt, who acknowledged and when",
  "vehicle card: loading progress, held reason",
  "load line: brand (read from the outlet name), temperature, dock, weightKg, volumeM3",
  "load: confirmedBy",
  "plan diff: outlet, deferral type (shown as policy) and next run of a removed order; new totals",
] as const;

const BRANDS: readonly Brand[] = ["Fresh", "Style", "Tech"];
const VEHICLE_TAGS: Record<VehicleTag, true> = { Available: true, "In workshop": true, Held: true, Replaced: true };

const hhmm = (iso: string | null | undefined): string => (iso ? formatTime(Date.parse(iso)) : "");
const brandOf = (name: string | null | undefined): Brand => BRANDS.find((brand) => (name ?? "").includes(brand)) ?? "Fresh";

function vehicle(id: string, depot: DepotId, tags: readonly string[]): Vehicle {
  return {
    id,
    depot,
    kind: "truck",
    temperature: "ambient",
    weightCapKg: 0,
    volumeCapM3: 0,
    kmPerL: 0,
    tags: tags.filter((tag): tag is VehicleTag => tag in VEHICLE_TAGS),
  };
}

/** What the tablet holds that the server may not have yet, read from the outbox. The latest record wins. */
export type LocalLoaderState = {
  /** Units recorded per `vehicleId·trip`, then per order. */
  checks: Map<string, Map<string, number>>;
  confirmed: Map<string, { at: string; by: string }>;
  acknowledgement: Map<string, DockAcknowledgement>;
};

export function readLocalState(records: readonly OutboxRecord[]): LocalLoaderState {
  const state: LocalLoaderState = { checks: new Map(), confirmed: new Map(), acknowledgement: new Map() };
  for (const record of records) {
    const p = (record.payload ?? {}) as Record<string, unknown>;
    if (record.type === "loader.check" && typeof p.vehicleId === "string" && typeof p.orderId === "string" && typeof p.unitsLoaded === "number") {
      const key = `${p.vehicleId}·${String(p.trip)}`;
      const byOrder = state.checks.get(key) ?? new Map<string, number>();
      byOrder.set(p.orderId, p.unitsLoaded);
      state.checks.set(key, byOrder);
    } else if (record.type === "loader.confirmLoaded" && typeof p.vehicleId === "string") {
      state.confirmed.set(`${p.vehicleId}·${String(p.trip)}`, { at: formatTime(record.createdAt), by: typeof p.personName === "string" ? p.personName : "" });
    } else if (record.type === "loader.ack" && typeof p.dockId === "string" && typeof p.version === "number") {
      state.acknowledgement.set(p.dockId, { version: p.version, personId: String(p.personId ?? ""), personName: typeof p.personName === "string" ? p.personName : "", at: formatTime(record.createdAt) });
    }
  }
  return state;
}

export function mapDock(out: Schemas["DockOut"], dockId: DepotId, local: LocalLoaderState): DockView {
  const ids = [...new Set(out.vehicles.map((v) => v.vehicleId))];
  const summaries = ids.map((id): DockVehicleSummary => {
    const trips = out.vehicles.filter((v) => v.vehicleId === id).sort((a, b) => a.tripNo - b.tripNo);
    const active = trips.find((t) => !local.confirmed.has(`${id}·${t.tripNo}`)) ?? trips[0];
    const tags = trips.flatMap((t) => t.tags ?? []);
    const status: VehicleLoadStatus = tags.includes("Held")
      ? "held"
      : tags.includes("Replaced")
        ? "replaced"
        : trips.every((t) => local.confirmed.has(`${id}·${t.tripNo}`))
          ? "loaded"
          : (local.checks.get(`${id}·${active.tripNo}`)?.size ?? 0) > 0
            ? "loading"
            : "to_load";
    return {
      vehicle: vehicle(id, dockId, tags),
      trips: trips.length,
      orderCount: trips.reduce((sum, t) => sum + t.orders, 0),
      activeTrip: (active.tripNo === 2 ? 2 : 1) as 1 | 2,
      departsAt: hhmm(active.departAt),
      status,
      ...(trips.some((t) => t.replaces) ? { replaces: trips.find((t) => t.replaces)?.replaces ?? "" } : {}),
      ...(trips.some((t) => t.replacedBy) ? { replacedBy: trips.find((t) => t.replacedBy)?.replacedBy ?? "" } : {}),
    };
  });
  // An acknowledgement the tablet has saved but not yet synced counts at once, for the version it was given for: the server
  // answers "not acknowledged" until the outbox record has been sent, and the dock must not stay locked meanwhile.
  const pending = local.acknowledgement.get(dockId);
  const acknowledgement = out.acknowledged
    ? (pending ?? { version: out.planVersion, personId: "", personName: "", at: "" })
    : pending && pending.version >= out.planVersion
      ? pending
      : undefined;
  return {
    dockId,
    planVersion: out.planVersion,
    planReleasedAt: "",
    vehicleCount: ids.length,
    orderCount: out.vehicles.reduce((sum, v) => sum + v.orders, 0),
    firstDeparture: out.vehicles.map((v) => hhmm(v.departAt)).sort()[0] ?? "",
    acknowledgement,
    newerVersionExists: acknowledgement !== undefined && acknowledgement.version < out.planVersion,
    vehicles: summaries,
  };
}

export function mapLoadPlan(out: Schemas["LoadPlanOut"], dockId: DepotId, local: LocalLoaderState): LoadPlanView {
  const key = `${out.vehicleId}·${out.tripNo}`;
  const checks = local.checks.get(key);
  const lines = [...out.lines].sort((a, b) => a.loadNo - b.loadNo);
  // The truck is loaded last stop first, so the stop number counts down as the load number counts up.
  const outletsInLoadOrder = [...new Set(lines.map((l) => l.outletId))];
  const orders = lines.map((line): LoadPlanOrderRow => {
    const loaded = checks?.get(line.orderId) ?? line.unitsLoaded ?? 0;
    return {
      orderId: line.orderId,
      outletId: line.outletId,
      loadNumber: line.loadNo,
      stopNumber: outletsInLoadOrder.length - outletsInLoadOrder.indexOf(line.outletId),
      brand: brandOf(line.outletName),
      temperature: "ambient",
      dock: "rear_dock",
      unitsExpected: line.unitsExpected,
      unitsLoaded: loaded,
      weightKg: 0,
      volumeM3: 0,
      state: loaded >= line.unitsExpected ? "checked" : loaded > 0 ? "short" : "todo",
    };
  });
  const confirmed = local.confirmed.get(key);
  const confirmedAt = confirmed?.at ?? (out.confirmedAt ? hhmm(out.confirmedAt) : undefined);
  const status: VehicleLoadStatus = confirmedAt ? "loaded" : orders.some((o) => o.unitsLoaded > 0) ? "loading" : "to_load";
  return {
    vehicle: vehicle(out.vehicleId, dockId, []),
    trip: out.tripNo === 2 ? 2 : 1,
    departsAt: hhmm(out.departAt),
    planVersion: out.planVersion,
    status,
    orders,
    ...(out.replaces ? { replaces: out.replaces } : {}),
    ...(out.replacedBy ? { replacedBy: out.replacedBy } : {}),
    ...(confirmedAt ? { confirmedAt } : {}),
    ...(confirmed?.by ? { confirmedBy: confirmed.by } : {}),
  };
}

/** The decision a failed vehicle check gets from Dispatch is a loose dict in the contract. Its keys are read by name; absent ones read as undefined. */
export function mapException(out: Schemas["LoaderExceptionOut"]): ExceptionView {
  const short = Object.values(out.unitsShort ?? {}).reduce<number>((sum, v) => sum + (typeof v === "number" ? v : 0), 0);
  const decision = (out.decision ?? {}) as Record<string, unknown>;
  const decided = out.status === "decided";
  const trip = out.tripNo === 2 ? 2 : 1;
  return {
    id: String(out.id),
    type: oneOf(EXCEPTION_TYPES, out.type, "exception type"),
    vehicleId: out.vehicleId ?? "",
    trip,
    orderIds: out.orderIds,
    ...(short > 0 ? { unitsShort: short } : {}),
    ...(out.detail != null ? { note: out.detail } : {}),
    raisedAt: hhmm(out.raisedAt),
    status: decided ? "decided" : "reviewing",
    ...(decided && typeof decision.version === "number" ? { decidedVersion: decision.version } : {}),
    ...(decided && typeof decision.by === "string" ? { decidedBy: decision.by } : {}),
    ...(decided && typeof decision.at === "string" ? { decidedAt: decision.at } : {}),
  };
}

/** The contract's diff is a flat list of changes. Removed orders and changed vehicles are read out of it; the rest of a removed order's story is a gap. */
export function mapPlanDiff(out: Schemas["PlanDiffOut"], dockVehicleIds: readonly string[]): PlanDiffView {
  const removed = out.lines
    .filter((line) => line.change === "removed" && line.orderId)
    .map((line) => ({ orderId: line.orderId as string, outletId: "", deferralType: "policy" as const, nextRunShort: "" }));
  const changed = out.lines
    .filter((line) => line.change === "vehicle")
    .map((line) => ({ fromVehicleId: line.before ?? line.vehicleId, toVehicleId: line.after ?? line.vehicleId, vehicleLabel: line.after ?? line.vehicleId, trips: `Trip ${line.tripNo}` }));
  const touched = new Set(out.lines.map((line) => line.vehicleId));
  return {
    from: out.fromVersion,
    to: out.toVersion,
    removed,
    changed,
    noChangeVehicleIds: dockVehicleIds.filter((id) => !touched.has(id)),
  };
}
