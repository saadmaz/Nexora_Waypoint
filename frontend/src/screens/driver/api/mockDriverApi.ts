import { formatTime, isoDate } from "../../../field/clock/clock";
import {
  NetworkError,
  registerBlobUploader,
  registerMockHandler,
  registerSyncHandler,
  request,
  connectivity,
} from "../../../field/offline";
import {
  DEFAULT_RESOLUTION_AT,
  DEFAULT_RESOLUTION_BY,
  DRIVER_ACTOR_ID,
  LOADER_CONFIRMATION,
  PLAN_V5,
  PLAN_VERSIONS,
  V5_DEFERRAL,
  V5_DEFERRED_ORDERS,
  EARLIER_RUNS,
  RUN_DATE,
  HERO_GPS_LEGS_KM,
  HERO_PLANNED_KM,
  VEHICLE,
  baseStops,
} from "../fixtures";
import type {
  ConflictDetail,
  DriverNotice,
  DriverRun,
  DriverStop,
  HistoryDay,
  LoaderConfirmation,
  Resolution,
} from "../types";
import type { DriverApi } from "./DriverApi";
import {
  applyConflict,
  buildNotice,
  consumeFailNextUpload,
  createDeviceOps,
  readDeviceState,
  registerDeviceNoticeSync as registerDeviceNoticeSyncWith,
  sortNotices,
  writeDeviceState,
  type LocalRunState,
} from "./deviceDriverApi";

// The device engine lives in deviceDriverApi.ts, which the real client uses too. These stay importable from here.
export {
  PHOTO_FAILURE_REFERENCE,
  applyConflict,
  buildNotice,
  consumeFailNextUpload,
  defaultLocalState,
  readDeviceState,
  setFailNextUpload,
  sortNotices,
  writeDeviceState,
  type LocalRunState,
  type LocalStopState,
} from "./deviceDriverApi";

function currentPlanVersion(nowMs: number): (typeof PLAN_VERSIONS)[number] | null {
  let current: (typeof PLAN_VERSIONS)[number] | null = null;
  for (const version of PLAN_VERSIONS) {
    if (Date.parse(version.releasedAt) <= nowMs) current = version;
  }
  return current;
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/** The exact wording still needs a pass against Figma once the MCP connection is back (O5); these
 * match the prompt's own quoted copy and the R1.8 frame text pulled during driver prompt 3. */
function resolvedNotice(outletId: string, resolution: Resolution): DriverNotice {
  const body =
    resolution.decision === "keep_delivery"
      ? `${resolution.by} kept your delivery at ${outletId}.`
      : `${resolution.by} kept your delivery at ${outletId} as Partial.`;
  return buildNotice({ kind: "resolved", title: `${outletId} resolved`, body, at: resolution.at, outletId });
}

// ---- The conflict rule (driver prompt 4 section 4, PRD §19) --------------------------------

const V5_RELEASED_MS = Date.parse(PLAN_V5.releasedAt);

function defaultResolutionMs(date: string): number {
  return new Date(`${date}T${DEFAULT_RESOLUTION_AT}:00+05:30`).getTime();
}

/** True only inside the window where the order is deferred on the server and not yet resolved. */
function isOrderConflicted(orderId: string, date: string, nowMs: number): boolean {
  if (!V5_DEFERRED_ORDERS.includes(orderId)) return false;
  return nowMs >= V5_RELEASED_MS && nowMs < defaultResolutionMs(date);
}

function buildConflictDetail(nowMs: number): ConflictDetail {
  return {
    conflictId: crypto.randomUUID(),
    serverVersion: PLAN_V5.v,
    change: `Deferred · ${V5_DEFERRAL.type}, ${V5_DEFERRAL.at}, by ${V5_DEFERRAL.by}`,
    changedAt: V5_DEFERRAL.at,
    changedBy: V5_DEFERRAL.by,
    at: formatTime(nowMs),
  };
}

/** Learns the server's plan version once any record reaches it after v5 releases (handoff 7). */
async function noteServerContact(date: string, nowMs: number): Promise<void> {
  if (nowMs < V5_RELEASED_MS) return;
  const local = await readDeviceState(date);
  if (local.knownServerVersion === PLAN_V5.v) return;
  local.knownServerVersion = PLAN_V5.v;
  const changedOutlet = baseStops().find((stop) => stop.orders.some((order) => V5_DEFERRED_ORDERS.includes(order.id)))?.outletId;
  local.notices.unshift(
    buildNotice({
      kind: "plan_received",
      title: `Plan v${PLAN_V5.v} received`,
      body: `${changedOutlet ?? "A stop"} was changed while you were offline.`,
      at: formatTime(nowMs),
      outletId: changedOutlet,
    }),
  );
  await writeDeviceState(date, local, nowMs);
}

const processedClientIds = new Set<string>();

/** Registers the driver's sync handlers and mock server ops once. Safe to call more than once.
 * `now` drives the conflict rule's clock; pass the scenario clock, never `Date.now()`. */
export function registerDriverHandlers(now: () => number): void {
  registerMockHandler("driver.downloadRoute", () => ({ ok: true }));
  registerMockHandler("driver.ack", () => ({ ok: true }));
  registerMockHandler("driver.startRoute", () => ({ ok: true }));
  registerMockHandler("driver.arrival", () => ({ ok: true }));
  registerMockHandler("driver.outcome", () => ({ ok: true }));
  registerMockHandler("driver.uploadBlob", () => ({ ok: true }));

  registerSyncHandler("driver.ack", async (record) => {
    await request("driver.ack", record.payload);
    return { result: "accepted" };
  });
  registerSyncHandler("driver.startRoute", async (record) => {
    await request("driver.startRoute", record.payload);
    return { result: "accepted" };
  });
  registerSyncHandler("driver.arrival", async (record) => {
    // An arrival is a fact: always accepted (driver prompt 4 section 4).
    if (processedClientIds.has(record.clientId)) return { result: "duplicate", groupKey: record.groupKey };
    await request("driver.arrival", record.payload);
    processedClientIds.add(record.clientId);
    const payload = record.payload as { date: string };
    await noteServerContact(payload.date, now());
    return { result: "accepted", groupKey: record.groupKey };
  });
  registerSyncHandler("driver.outcome", async (record) => {
    if (processedClientIds.has(record.clientId)) return { result: "duplicate", groupKey: record.groupKey };
    const payload = record.payload as { date: string; outletId: string; orderId: string };
    await request("driver.outcome", record.payload);
    processedClientIds.add(record.clientId);
    const nowMs = now();
    await noteServerContact(payload.date, nowMs);
    if (isOrderConflicted(payload.orderId, payload.date, nowMs)) {
      const conflict = buildConflictDetail(nowMs);
      await applyConflict(payload.date, payload.outletId, conflict, nowMs);
      return { result: "conflict", groupKey: record.groupKey, serverPayload: conflict };
    }
    return { result: "accepted", groupKey: record.groupKey };
  });

  registerMockHandler("driver.problem", () => ({ ok: true }));
  registerMockHandler("driver.finishRun", () => ({ ok: true }));
  // A problem is a fact (reconciliation rule 1): always accepted. Dispatch decides what happens next (G-14).
  for (const type of ["driver.problem", "driver.finishRun"] as const) {
    registerSyncHandler(type, async (record) => {
      if (processedClientIds.has(record.clientId)) return { result: "duplicate", groupKey: record.groupKey };
      await request(type, record.payload);
      processedClientIds.add(record.clientId);
      const payload = record.payload as { date: string };
      await noteServerContact(payload.date, now());
      return { result: "accepted", groupKey: record.groupKey };
    });
  }

  registerBlobUploader(async (blob) => {
    if (consumeFailNextUpload()) throw new Error("WP-SYNC-409");
    await request("driver.uploadBlob", { id: blob.id, kind: blob.kind, bytes: blob.bytes });
    return "uploaded";
  });
}

/** Device-made sync notices for the mock run: the photo notice names the fixture stop. */
export function registerDeviceNoticeSync(date: string, now: () => number): void {
  registerDeviceNoticeSyncWith(date, now, (outletId) => baseStops().find((s) => s.outletId === outletId)?.number);
}

/** "Dispatch resolves now" (state-gallery dev control): resolves a stop's conflict immediately
 * instead of waiting for the scenario clock to reach 06:44. */
export async function resolveConflictNow(date: string, outletId: string, now: () => number, decision: Resolution["decision"] = "keep_delivery", units?: number): Promise<void> {
  const local = await readDeviceState(date);
  const at = formatTime(now());
  const resolution: Resolution = { decision, by: DEFAULT_RESOLUTION_BY, at, units };
  local.resolutions[outletId] = resolution;
  local.notices.unshift(resolvedNotice(outletId, resolution));
  await writeDeviceState(date, local, now());
}

export type MockDriverApiOptions = {
  /** Overrides the loader's gate confirmation, for the R2.3 B shortfall state-gallery frame. */
  confirmation?: LoaderConfirmation;
  /** The state gallery and tests only: seeds an in-memory local state instead of the phone's real
   * IndexedDB cache, so every frame on `/driver/_states` can show its own moment independently, and
   * writes there never touch the real outbox. */
  seed?: Partial<LocalRunState>;
  /** The state gallery only: `getRun` never resolves, for the R2.S 4 loading frame. */
  stuckLoading?: boolean;
};

/**
 * The driver's mock API (field conventions section 10), development only. The route is the fixture's; the phone's own
 * writes are the device engine's. `getRun` reads the phone's own cache, so it never throws offline: the route is
 * already on the phone by the time it matters.
 */
export function createMockDriverApi(now: () => number, options: MockDriverApiOptions = {}): DriverApi {
  const confirmation = options.confirmation ?? LOADER_CONFIRMATION;

  async function getRun(date: string): Promise<DriverRun> {
    if (options.stuckLoading) await new Promise<never>(() => undefined);
    const local = await device.readState(date);
    const nowMs = now();
    const currentVersion = local.knownServerVersion === PLAN_V5.v ? PLAN_V5 : currentPlanVersion(nowMs);
    const loaderConfirmed = isConfirmedByNow(date, confirmation, nowMs);

    const stops: DriverStop[] = baseStops().map((stop) => {
      const stopState = local.stops[stop.outletId];
      const resolution = local.resolutions[stop.outletId];
      const conflict = resolution ? undefined : local.conflicts[stop.outletId];
      return { ...stop, arrivalAt: stopState?.arrivalAt, outcomes: stopState?.outcomes ?? {}, conflict, resolution };
    });

    return {
      runNo: 1,
      vehicle: VEHICLE,
      depot: VEHICLE.depot,
      date,
      currentVersion,
      nextPlanReleaseAt: PLAN_VERSIONS[0].releasedAt,
      downloadedVersion: local.downloadedVersion,
      acknowledgedVersion: local.acknowledgedVersion,
      loaderConfirmation: loaderConfirmed ? confirmation : null,
      departedAt: local.departedAt,
      stops,
    };
  }

  const device = createDeviceOps(now, {
    ...(options.seed ? { seed: options.seed } : {}),
    getRun,
    // The scenario's tracked legs (A24) on the hero run; elsewhere the planned distance (DP-14).
    distanceBasis: async (date) => ({ trackedLegsKm: date === RUN_DATE ? HERO_GPS_LEGS_KM : null, plannedKm: HERO_PLANNED_KM, kmPerL: VEHICLE.kmPerL }),
    actor: DRIVER_ACTOR_ID,
  });

  async function downloadRun(date: string, version: number, onProgress?: (done: number, total: number) => void): Promise<void> {
    if (!connectivity.isConnected()) throw new NetworkError();
    const total = baseStops().length + 1;
    const stepMs = import.meta.env.MODE === "test" ? 0 : 550;
    for (let step = 1; step <= total; step += 1) {
      await wait(stepMs);
      if (!connectivity.isConnected()) throw new NetworkError();
      onProgress?.(step, total);
    }
    if (!device.isolated) await request("driver.downloadRoute", { date, version });
    const local = await device.readState(date);
    local.downloadedVersion = version;
    await device.writeState(date, local);
  }

  async function getNotices(date: string, _sinceIso?: string): Promise<DriverNotice[]> {
    // Applies the default 06:44 resolution to any conflict still open once it is due; a dev
    // control (resolveConflictNow) may already have resolved it sooner.
    const local = await device.readState(date);
    const nowMs = now();
    let changed = false;
    for (const outletId of Object.keys(local.conflicts)) {
      if (local.resolutions[outletId]) continue;
      if (nowMs >= defaultResolutionMs(date)) {
        const resolution: Resolution = { decision: "keep_delivery", by: DEFAULT_RESOLUTION_BY, at: DEFAULT_RESOLUTION_AT };
        local.resolutions[outletId] = resolution;
        local.notices.unshift(resolvedNotice(outletId, resolution));
        changed = true;
      }
    }

    // What the server told the phone before the day began: the plan that was released, and the load
    // being confirmed. They are informational, so they are born read; the bell counts what needs a look.
    const scheduled: DriverNotice[] = [];
    for (const version of PLAN_VERSIONS) {
      if (isoDate(Date.parse(version.releasedAt)) === date && Date.parse(version.releasedAt) <= nowMs) {
        scheduled.push({
          id: `plan-v${version.v}`,
          kind: "plan_released",
          title: `Plan v${version.v} released`,
          body: `${version.note} Acknowledge it before you start.`,
          at: formatTime(Date.parse(version.releasedAt)),
          read: true,
        });
      }
    }
    if (isConfirmedByNow(date, confirmation, nowMs)) {
      const orderCount = baseStops().reduce((sum, stop) => sum + stop.orders.length, 0);
      scheduled.push({
        id: "on-board",
        kind: "orders_on_board",
        title: `${orderCount} orders on board`,
        body: `Confirmed by ${confirmation.by} at ${confirmation.at}.`,
        at: confirmation.at,
        read: true,
      });
    }
    for (const notice of scheduled) {
      if (!local.notices.some((n) => n.id === notice.id)) {
        local.notices.push(notice);
        changed = true;
      }
    }

    if (changed) await device.writeState(date, local);
    return sortNotices(local.notices);
  }

  async function getHistory(date: string): Promise<HistoryDay[]> {
    // The earlier runs are the hero week's (A34); a phone on another date has only its own run.
    const earlier = date === RUN_DATE ? EARLIER_RUNS : [];
    return [...(await device.getTodayHistory(date)), ...earlier];
  }

  return {
    getRun,
    // The mock's run is built from the clock on every read; there is nothing newer to fetch.
    refreshRun: async () => undefined,
    downloadRun,
    acknowledgePlan: device.acknowledgePlan,
    startRoute: device.startRoute,
    recordArrival: device.recordArrival,
    recordOutcome: device.recordOutcome,
    getNotices,
    markNoticesRead: device.markNoticesRead,
    noteWentOffline: device.noteWentOffline,
    recordProblem: device.recordProblem,
    listProblems: device.listProblems,
    getHistory,
    getRunDistance: device.getRunDistance,
    getFinishedRun: device.getFinishedRun,
    finishRun: device.finishRun,
  };
}

/** The loader confirms at a fixed scenario time ("04:50"); the device date is only used for the "today" guard. */
function isConfirmedByNow(date: string, confirmation: LoaderConfirmation, nowMs: number): boolean {
  const [hours, minutes] = confirmation.at.split(":").map(Number);
  const at = new Date(`${date}T00:00:00+05:30`).getTime() + (hours * 60 + minutes) * 60_000;
  return nowMs >= at;
}
