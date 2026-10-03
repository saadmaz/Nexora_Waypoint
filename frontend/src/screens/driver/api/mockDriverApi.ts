import { formatTime, isoDate } from "../../../field/clock/clock";
import {
  getCache,
  NetworkError,
  onSyncResult,
  putCache,
  registerBlobUploader,
  registerMockHandler,
  registerSyncHandler,
  request,
  connectivity,
  enqueue,
  attachBlob,
  getBlob,
  getRecord,
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
import { runDistance } from "../finish/runDistance";
import { todayRow } from "../history/historyView";
import { problemThreads } from "../issues/problemThreads";
import { outboxRows } from "../outbox/outboxModel";
import type {
  ConflictDetail,
  DriverNotice,
  DriverRun,
  DriverStop,
  FinishedRun,
  HistoryDay,
  LoaderConfirmation,
  OutcomeInput,
  ProblemInput,
  ProblemRecord,
  ProblemThread,
  RecordedOutcome,
  Resolution,
  RunDistance,
} from "../types";
import type { DriverApi } from "./DriverApi";

export type LocalStopState = { arrivalAt?: string; outcomes: Record<string, RecordedOutcome> };
export type LocalRunState = {
  downloadedVersion: number | null;
  acknowledgedVersion: number | null;
  departedAt: string | null;
  stops: Record<string, LocalStopState>;
  /** By outlet id. Written by the driver.outcome sync handler when a record disagrees with a plan
   * version the phone has not seen, or seeded directly for an isolated (gallery) instance. */
  conflicts: Record<string, ConflictDetail>;
  /** By outlet id. Written once Dispatch's decision reaches the phone (`getNotices`, or a dev
   * control resolving a conflict immediately for a demo). */
  resolutions: Record<string, Resolution>;
  /** Server notices and device-made sync notices together (R8.1), newest first. */
  notices: DriverNotice[];
  /** Set once a sync has reached the server after v5's release, so `getRun` can show it (field
   * conventions handoff 7: the phone never shows a plan change it did not receive). */
  knownServerVersion: number | null;
  /** R6: problems recorded on the road, oldest first. Optional, so a run saved before R6 existed still reads. */
  problems?: ProblemRecord[];
  /** R9: the run once it is closed. */
  finished?: FinishedRun | null;
};

export function defaultLocalState(): LocalRunState {
  return {
    downloadedVersion: null,
    acknowledgedVersion: null,
    departedAt: null,
    stops: {},
    conflicts: {},
    resolutions: {},
    notices: [],
    knownServerVersion: null,
  };
}

function cacheKey(date: string): string {
  return `driver:run:${date}`;
}

/** Reads the phone's real IndexedDB cache directly, for callers outside a `createMockDriverApi`
 * instance (the sync handlers and the device-notice subscriber are registered once, globally). */
export async function readDeviceState(date: string): Promise<LocalRunState> {
  const entry = await getCache<LocalRunState>(cacheKey(date));
  return entry?.value ?? defaultLocalState();
}

export async function writeDeviceState(date: string, state: LocalRunState, nowMs: number): Promise<void> {
  await putCache(cacheKey(date), state, nowMs);
}

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

/** Newest first. Notices from the same minute keep the order the driver would read them in. */
const SAME_MINUTE_ORDER: DriverNotice["kind"][] = [
  "resolved",
  "photo_failed",
  "sent_for_review",
  "synced",
  "plan_received",
  "went_offline",
  "orders_on_board",
  "plan_released",
];

export function sortNotices(notices: readonly DriverNotice[]): DriverNotice[] {
  return [...notices].sort((a, b) => b.at.localeCompare(a.at) || SAME_MINUTE_ORDER.indexOf(a.kind) - SAME_MINUTE_ORDER.indexOf(b.kind));
}

export function buildNotice(partial: Omit<DriverNotice, "id" | "read">): DriverNotice {
  return { id: crypto.randomUUID(), read: false, ...partial };
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

/** Writes the conflict once per stop (both ORD2001 and ORD2002 share OUT084's), and queues the
 * "Delivery sent for review" notice the first time. */
export async function applyConflict(date: string, outletId: string, conflict: ConflictDetail, nowMs: number): Promise<void> {
  const local = await readDeviceState(date);
  const isNew = !local.conflicts[outletId];
  local.conflicts[outletId] = conflict;
  if (isNew) {
    local.notices.unshift(
      buildNotice({
        kind: "sent_for_review",
        title: "Delivery sent for review",
        body: `Dispatch deferred ${outletId} at ${conflict.changedAt} at the store's request, while you were offline. Your record is safe.`,
        at: conflict.at,
        outletId,
      }),
    );
  }
  await writeDeviceState(date, local, nowMs);
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

/** The reference a failed upload quotes on R8.3. The mock has one for every failed send. */
export const PHOTO_FAILURE_REFERENCE = "WP-SYNC-409";

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

let deviceNoticeSyncRegistered = false;

/** Device-made sync notices (field conventions section 15): "N records synced" and the photo
 * upload failure. Never from the server; held only on the phone. Safe to call more than once. */
export function registerDeviceNoticeSync(date: string, now: () => number): void {
  if (deviceNoticeSyncRegistered) return;
  deviceNoticeSyncRegistered = true;
  onSyncResult(async (result) => {
    if (result.interrupted) return;
    const nowMs = now();
    const local = await readDeviceState(date);
    if (result.blobFailures.length > 0) {
      for (const failure of result.blobFailures) {
        const blob = await getBlob(failure.id);
        const owner = blob?.recordClientId ? await getRecord(blob.recordClientId) : undefined;
        const outletId = (owner?.payload as { outletId?: string } | undefined)?.outletId;
        const stop = baseStops().find((s) => s.outletId === outletId);
        const existing = local.notices.find((n) => n.kind === "photo_failed" && n.blobId === failure.id);
        // The phone retries every 30 s; one notice per photo, with the time of the latest try.
        if (existing) {
          existing.at = formatTime(nowMs);
          existing.read = false;
          continue;
        }
        local.notices.unshift(
          buildNotice({
            kind: "photo_failed",
            title: "Sync failed",
            body: `Couldn't send photo of stop ${stop?.number ?? 1}. Kept on phone. Retrying.`,
            at: formatTime(nowMs),
            reference: PHOTO_FAILURE_REFERENCE,
            outletId,
            blobId: failure.id,
          }),
        );
      }
    }
    // A batch going out is worth a line; one record sent from the road a moment after it was saved is not.
    {
      const sent = new Set(result.items.filter((item) => item.result === "accepted" || item.result === "duplicate").map((item) => item.clientId));
      const records = (await Promise.all([...sent].map((id) => getRecord(id)))).filter((r): r is NonNullable<typeof r> => r !== undefined);
      const labels = outboxRows(records)
        .filter((row) => row.kind !== "departed")
        .map((row) => (row.kind === "arrival" ? `Arrival ${row.subject}` : `${row.outcomeWord} ${row.subject}`));
      if (labels.length >= 2) {
        local.notices.unshift(
          buildNotice({ kind: "synced", title: `${labels.length} records synced`, body: `${labels.join(", ")}.`, at: formatTime(nowMs) }),
        );
      }
    }
    await writeDeviceState(date, local, nowMs);
  });
}

// ---- Dev controls (driver prompt 4 section 4): mock/demo tooling, not part of DriverApi -----

let failNextUploadArmed = false;

/** "Fail next photo upload" (PRD §13): a transport setting, shown in the outbox sheet only under
 * `?presenter=1`. Fires once, then disarms itself. */
export function setFailNextUpload(armed: boolean): void {
  failNextUploadArmed = armed;
}

export function consumeFailNextUpload(): boolean {
  if (!failNextUploadArmed) return false;
  failNextUploadArmed = false;
  return true;
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
 * The driver's mock API (field conventions section 10). `getRun` reads the phone's own cache, so
 * it never throws offline: the route is already on the phone by the time it matters. Writes save
 * to that same cache at once (so the screen reflects them immediately, even offline) and queue an
 * outbox record for the sync engine to send when it can.
 */
export function createMockDriverApi(now: () => number, options: MockDriverApiOptions = {}): DriverApi {
  const confirmation = options.confirmation ?? LOADER_CONFIRMATION;
  let memory: LocalRunState | undefined = options.seed
    ? { ...defaultLocalState(), ...options.seed, conflicts: { ...options.seed.conflicts }, resolutions: { ...options.seed.resolutions } }
    : undefined;
  const isolated = memory !== undefined;

  async function readState(date: string): Promise<LocalRunState> {
    if (memory) return memory;
    return readDeviceState(date);
  }

  async function writeState(date: string, state: LocalRunState): Promise<void> {
    if (isolated) {
      memory = state;
      return;
    }
    await writeDeviceState(date, state, now());
  }

  async function getRun(date: string): Promise<DriverRun> {
    if (options.stuckLoading) await new Promise<never>(() => undefined);
    const local = await readState(date);
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

  async function downloadRun(date: string, version: number, onProgress?: (done: number, total: number) => void): Promise<void> {
    if (!connectivity.isConnected()) throw new NetworkError();
    const total = baseStops().length + 1;
    const stepMs = import.meta.env.MODE === "test" ? 0 : 550;
    for (let step = 1; step <= total; step += 1) {
      await wait(stepMs);
      if (!connectivity.isConnected()) throw new NetworkError();
      onProgress?.(step, total);
    }
    if (!isolated) await request("driver.downloadRoute", { date, version });
    const local = await readState(date);
    local.downloadedVersion = version;
    await writeState(date, local);
  }

  async function acknowledgePlan(date: string, version: number): Promise<void> {
    const local = await readState(date);
    local.acknowledgedVersion = version;
    await writeState(date, local);
    if (!isolated) {
      await enqueue({
        type: "driver.ack",
        payload: { date, version },
        actor: DRIVER_ACTOR_ID,
        planVersionOnDevice: version,
      });
    }
  }

  async function startRoute(date: string): Promise<void> {
    const local = await readState(date);
    const at = formatTime(now());
    local.departedAt = at;
    await writeState(date, local);
    if (!isolated) {
      await enqueue({
        type: "driver.startRoute",
        payload: { date, at },
        actor: DRIVER_ACTOR_ID,
        planVersionOnDevice: local.acknowledgedVersion,
      });
    }
  }

  async function recordArrival(date: string, outletId: string): Promise<void> {
    const local = await readState(date);
    const at = formatTime(now());
    local.stops[outletId] = { ...(local.stops[outletId] ?? { outcomes: {} }), arrivalAt: at };
    await writeState(date, local);
    if (!isolated) {
      await enqueue({
        type: "driver.arrival",
        payload: { date, outletId, at },
        actor: DRIVER_ACTOR_ID,
        planVersionOnDevice: local.acknowledgedVersion,
        groupKey: outletId,
      });
    }
  }

  async function recordOutcome(date: string, outletId: string, perOrder: OutcomeInput[]): Promise<void> {
    const local = await readState(date);
    const at = formatTime(now());
    const stopState = local.stops[outletId] ?? { outcomes: {} };
    const outcomes = { ...stopState.outcomes };
    for (const input of perOrder) {
      outcomes[input.orderId] = { ...input, savedAt: at };
    }
    local.stops[outletId] = { ...stopState, outcomes };
    await writeState(date, local);

    if (!isolated) {
      // A stop's one photo and signature belong to its first record and upload only after that record
      // has reached the server. They are tied to it before it is queued: queueing starts a sync at once,
      // and a photo with no owner would be sent ahead of the delivery it proves.
      const clientIds = perOrder.map(() => crypto.randomUUID());
      const stopBlobIds = [...new Set(perOrder.flatMap((input) => [input.photoBlobId, input.signatureBlobId]).filter((id): id is string => Boolean(id)))];
      await Promise.all(stopBlobIds.map((id) => attachBlob(id, clientIds[0])));
      for (const [index, input] of perOrder.entries()) {
        const blobIds = [input.photoBlobId, input.signatureBlobId].filter((id): id is string => Boolean(id));
        await enqueue({
          clientId: clientIds[index],
          type: "driver.outcome",
          payload: { date, outletId, ...input, at },
          actor: DRIVER_ACTOR_ID,
          planVersionOnDevice: local.acknowledgedVersion,
          blobIds: blobIds.length > 0 ? blobIds : undefined,
          groupKey: outletId,
        });
      }
    }
  }

  async function getNotices(date: string, _sinceIso?: string): Promise<DriverNotice[]> {
    // Applies the default 06:44 resolution to any conflict still open once it is due; a dev
    // control (resolveConflictNow) may already have resolved it sooner.
    const local = await readState(date);
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

    if (changed) await writeState(date, local);
    return sortNotices(local.notices);
  }

  async function markNoticesRead(date: string, ids?: string[]): Promise<void> {
    const local = await readState(date);
    let changed = false;
    for (const notice of local.notices) {
      if (!notice.read && (ids === undefined || ids.includes(notice.id))) {
        notice.read = true;
        changed = true;
      }
    }
    if (changed) await writeState(date, local);
  }

  async function noteWentOffline(date: string, spellKey: number): Promise<void> {
    const local = await readState(date);
    const id = `offline-${spellKey}`;
    if (local.notices.some((n) => n.id === id)) return;
    local.notices.unshift({
      id,
      kind: "went_offline",
      title: "You went offline",
      body: "Records now save on this phone and sync later.",
      at: formatTime(now()),
      read: true,
    });
    await writeState(date, local);
  }

  async function recordProblem(date: string, input: ProblemInput): Promise<ProblemRecord> {
    const local = await readState(date);
    const record: ProblemRecord = { ...input, clientId: crypto.randomUUID(), savedAt: formatTime(now()) };
    local.problems = [...(local.problems ?? []), record];
    await writeState(date, local);
    if (!isolated) {
      const blobIds = input.photoBlobId ? [input.photoBlobId] : [];
      // The photo is tied to its record before the record is queued, so it never uploads ahead of it.
      await Promise.all(blobIds.map((id) => attachBlob(id, record.clientId)));
      await enqueue({
        clientId: record.clientId,
        type: "driver.problem",
        payload: {
          date,
          type: input.type,
          ...(input.stopId ? { stopId: input.stopId, outletId: input.stopId } : {}),
          orderIds: input.orderIds,
          note: input.note,
          blobIds,
          ...(input.updatesClientId ? { updatesClientId: input.updatesClientId } : {}),
        },
        actor: DRIVER_ACTOR_ID,
        planVersionOnDevice: local.acknowledgedVersion,
        blobIds: blobIds.length > 0 ? blobIds : undefined,
        groupKey: input.stopId,
      });
    }
    return record;
  }

  async function listProblems(date: string): Promise<ProblemThread[]> {
    const records = (await readState(date)).problems ?? [];
    const statuses = new Map<string, Awaited<ReturnType<typeof getRecord>>>();
    if (!isolated) for (const r of records) statuses.set(r.clientId, await getRecord(r.clientId));
    return problemThreads(records, (clientId) => statuses.get(clientId)?.status);
  }

  async function getHistory(date: string): Promise<HistoryDay[]> {
    const [run, local] = await Promise.all([getRun(date), readState(date)]);
    const today = todayRow(run, local.finished ?? null, connectivity.getSnapshot().waitingCount === 0);
    // The earlier runs are the hero week's (A34); a phone on another date has only its own run.
    const earlier = date === RUN_DATE ? EARLIER_RUNS : [];
    return [...(today ? [today] : []), ...earlier];
  }

  function plannedDistance(date: string): RunDistance {
    // The scenario's tracked legs (A24) on the hero run; elsewhere the planned distance (DP-14).
    return runDistance({ trackedLegsKm: date === RUN_DATE ? HERO_GPS_LEGS_KM : null, plannedKm: HERO_PLANNED_KM, kmPerL: VEHICLE.kmPerL });
  }

  async function getRunDistance(date: string): Promise<RunDistance> {
    return (await readState(date)).finished?.distance ?? plannedDistance(date);
  }

  async function getFinishedRun(date: string): Promise<FinishedRun | null> {
    return (await readState(date)).finished ?? null;
  }

  async function finishRun(date: string): Promise<FinishedRun> {
    const local = await readState(date);
    if (local.finished) return local.finished;
    const finished: FinishedRun = { at: formatTime(now()), distance: plannedDistance(date) };
    local.finished = finished;
    await writeState(date, local);
    if (!isolated) {
      await enqueue({
        type: "driver.finishRun",
        payload: {
          date,
          at: finished.at,
          gpsKm: finished.distance.totalKm,
          gpsGapFilledKm: finished.distance.gapFilledKm,
          fuelLEst: finished.distance.fuelL,
        },
        actor: DRIVER_ACTOR_ID,
        planVersionOnDevice: local.acknowledgedVersion,
      });
    }
    return finished;
  }

  return {
    getRun,
    downloadRun,
    acknowledgePlan,
    startRoute,
    recordArrival,
    recordOutcome,
    getNotices,
    markNoticesRead,
    noteWentOffline,
    recordProblem,
    listProblems,
    getHistory,
    getRunDistance,
    getFinishedRun,
    finishRun,
  };
}

/** The loader confirms at a fixed scenario time ("04:50"); the device date is only used for the "today" guard. */
function isConfirmedByNow(date: string, confirmation: LoaderConfirmation, nowMs: number): boolean {
  const [hours, minutes] = confirmation.at.split(":").map(Number);
  const at = new Date(`${date}T00:00:00+05:30`).getTime() + (hours * 60 + minutes) * 60_000;
  return nowMs >= at;
}
