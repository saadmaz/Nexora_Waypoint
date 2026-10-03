import { statusFromApi, temperatureFromApi } from "../../../api/vocab";
import type { components } from "../../../api/schema";
import type { Brand, DepotId, OrderTag, PlannedOrder } from "../../../domain/field";
import { formatTime } from "../../../field/clock/clock";
import type { ConflictDetail, DriverNotice, DriverNoticeKind, DriverRun, DriverStop } from "../types";
import type { LocalRunState } from "./deviceDriverApi";

type RunOut = components["schemas"]["RunOut"];
type NoticeOut = components["schemas"]["NoticeOut"];

/**
 * Maps the backend's route package (`RunOut`) onto the driver's `DriverRun`, then lays the phone's own record of the day on top
 * (arrivals, outcomes, departure, the plan the driver acknowledged, any conflict). The server's run is per order; the driver's
 * screens are per stop, so orders at one outlet are grouped.
 *
 * CONTRACT GAPS. `RunOut` does not carry everything `DriverRun` needs. What is missing is listed in `RUN_GAPS` and each
 * is filled with a visibly neutral value, never a plausible-looking one, until the backend sends it:
 *   - the vehicle's kind, capacities and tags (the driver screens read only its id). Its temperature class is inferred: a run
 *     with a chilled order is on a reefer, since nothing else may carry one
 *   - each stop's brand, district, dock type, parking note and unloading minutes
 *   - each order's weight and volume
 *   - when the plan version was released, and its one-line note
 *   - who confirmed the load, when, and any shortfall (only "every order is loaded" can be read, from the order statuses)
 *   - the depot (read from `GET /me`, which does carry it)
 * The brand is read from the outlet's name when it contains one, since outlets are named for their brand ("Waypoint Fresh").
 * That is an inference from naming, not from the contract.
 */
export const RUN_GAPS = [
  "vehicle: kind, capacities, kmPerL, tags (temperature is inferred from the orders)",
  "stop: brand (read from the outlet name), district, dock, parkingNote, unloadMinutes",
  "order: weightKg, volumeM3",
  "plan version: releasedAt, note",
  "loader confirmation: by, at, shortfalls",
] as const;

const BRANDS: readonly Brand[] = ["Fresh", "Style", "Tech"];

const ORDER_TAGS: Record<OrderTag, true> = {
  Chilled: true,
  Ambient: true,
  "Carry-over": true,
  Protected: true,
  "After cutoff": true,
  "No legal vehicle": true,
  "At risk": true,
  Waiting: true,
  Late: true,
  "Deferral withdrawn": true,
  "Receipt confirmed": true,
  "Follow-up created": true,
};

/** The statuses an order has once the loader has confirmed it onto the vehicle. */
const LOADED_OR_LATER = new Set(["Loaded", "Departed", "Delivered", "Partial", "Issue", "Conflict"]);

function brandOf(outletName: string): Brand {
  return BRANDS.find((brand) => outletName.includes(brand)) ?? "Fresh";
}

/** A run package that is a run: `state` "run" with its run fields present. */
type ServerRun = RunOut & { vehicleId: string; tripNo: number; planVersion: number; stops: RunStop[] };
type RunStop = NonNullable<RunOut["stops"]>[number];

/** The server has no run for this driver that day (Sunday, holiday, plan not released, no trip). PRD v3 section 15. */
export class NoRunError extends Error {
  readonly reason: string;
  readonly nextPlanAt: string | null;

  constructor(reason: string, nextPlanAt: string | null) {
    super(`No run: ${reason}`);
    this.name = "NoRunError";
    this.reason = reason;
    this.nextPlanAt = nextPlanAt;
  }
}

/** The package as a run, or a `NoRunError` for a day without one. */
export function requireRun(out: RunOut): ServerRun {
  const { vehicleId, tripNo, planVersion } = out;
  if (out.state === "no_run" || vehicleId == null || tripNo == null || planVersion == null) {
    throw new NoRunError(out.noRun?.reason ?? "no_trip", out.noRun?.nextPlanAt ?? null);
  }
  return { ...out, vehicleId, tripNo, planVersion, stops: out.stops ?? [] };
}

function hhmm(iso: string | null | undefined): string {
  return iso ? formatTime(Date.parse(iso)) : "";
}

function mapOrder(stop: RunStop): PlannedOrder {
  return {
    id: stop.orderId,
    outletId: stop.outletId,
    units: stop.units,
    weightKg: 0,
    volumeM3: 0,
    temperature: temperatureFromApi(stop.temp),
    status: statusFromApi(stop.status),
    tags: (stop.tags ?? []).filter((tag): tag is OrderTag => tag in ORDER_TAGS),
  };
}

/** Groups the server's per-order rows into the driver's per-outlet stops, in the order the truck visits them. */
export function mapStops(out: ServerRun): DriverStop[] {
  const rows = [...out.stops].sort((a, b) => a.seq - b.seq);
  const byOutlet = new Map<string, RunStop[]>();
  for (const row of rows) byOutlet.set(row.outletId, [...(byOutlet.get(row.outletId) ?? []), row]);

  return [...byOutlet.values()].map((group, index): DriverStop => {
    const first = group[0];
    const name = first.outletName ?? first.outletId;
    return {
      number: index + 1,
      outletId: first.outletId,
      outletName: name,
      brand: brandOf(name),
      district: "",
      dock: "rear_dock",
      window: { open: first.window.start, close: first.window.end },
      plannedArrival: hhmm(first.plannedArrival),
      orders: group.map(mapOrder),
      outcomes: {},
    };
  });
}

/** `true` once every order that is still on the run has been loaded: the one thing about the loader's confirmation the run carries. */
function allLoaded(stops: DriverStop[]): boolean {
  const live = stops.flatMap((stop) => stop.orders).filter((order) => order.status !== "Deferred");
  return live.length > 0 && live.every((order) => LOADED_OR_LATER.has(order.status));
}

export function mapRun(pkg: RunOut, depot: DepotId, local: LocalRunState): DriverRun {
  const out = requireRun(pkg);
  const serverStops = mapStops(out);
  const stops = serverStops.map((stop): DriverStop => {
    const state = local.stops[stop.outletId];
    const resolution = local.resolutions[stop.outletId];
    const conflict = resolution ? undefined : local.conflicts[stop.outletId];
    return { ...stop, arrivalAt: state?.arrivalAt, outcomes: state?.outcomes ?? {}, conflict, resolution };
  });

  return {
    runNo: out.tripNo,
    vehicle: { id: out.vehicleId, depot, kind: "truck", temperature: stops.some((s) => s.orders.some((o) => o.temperature === "chilled")) ? "reefer" : "ambient", weightCapKg: 0, volumeCapM3: 0, kmPerL: 0, tags: [] },
    depot,
    date: out.date,
    currentVersion: { v: out.planVersion, releasedAt: "", note: "" },
    nextPlanReleaseAt: "",
    downloadedVersion: local.downloadedVersion,
    acknowledgedVersion: local.acknowledgedVersion ?? (out.acknowledged ? out.planVersion : null),
    loaderConfirmation: allLoaded(serverStops) ? { by: "", at: "", shortfalls: [] } : null,
    departedAt: local.departedAt,
    stops,
  };
}

const NOTICE_KINDS: Record<DriverNoticeKind, true> = {
  resolved: true,
  sent_for_review: true,
  synced: true,
  photo_failed: true,
  plan_received: true,
  went_offline: true,
  orders_on_board: true,
  plan_released: true,
};

/** Server notice ids are numbers; the phone's own are uuids. The prefix keeps the two from ever colliding. */
export const SERVER_NOTICE_PREFIX = "server-";

/**
 * A notice the server sent. Its `tag` is the kind. A tag this app has no screen for is dropped rather than shown as a blank
 * row: the bell and the list are secondary, and a new tag from the backend must not break them.
 */
export function mapNotice(out: NoticeOut, readIds: ReadonlySet<string>): DriverNotice | undefined {
  if (!(out.tag in NOTICE_KINDS)) return undefined;
  const id = `${SERVER_NOTICE_PREFIX}${out.id}`;
  const outletId = typeof out.link?.outletId === "string" ? out.link.outletId : undefined;
  return {
    id,
    kind: out.tag as DriverNoticeKind,
    title: out.title,
    body: out.body,
    at: hhmm(out.createdAt),
    read: out.read || readIds.has(id),
    ...(outletId ? { outletId } : {}),
  };
}

/** What a conflict looks like on the phone, from what the server said when it refused the record. Keys the backend does not send read as blank. */
export function conflictFromServer(payload: unknown, nowMs: number): ConflictDetail {
  const data = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;
  const text = (key: string, fallback: string) => (typeof data[key] === "string" ? (data[key] as string) : fallback);
  return {
    conflictId: String(data.conflictId ?? ""),
    serverVersion: typeof data.serverVersion === "number" ? data.serverVersion : 0,
    change: text("change", "Changed by Dispatch"),
    changedAt: text("changedAt", ""),
    changedBy: text("changedBy", "Dispatch"),
    at: formatTime(nowMs),
  };
}
