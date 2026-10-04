import { formatTime } from "../../../field/clock/clock";
import {
  attachBlob,
  connectivity,
  enqueue,
  getBlob,
  getCache,
  getRecord,
  onSyncResult,
  putCache,
} from "../../../field/offline";
import { runDistance } from "../finish/runDistance";
import { todayRow } from "../history/historyView";
import { problemThreads } from "../issues/problemThreads";
import { outboxRows } from "../outbox/outboxModel";
import type {
  ConflictDetail,
  DriverNotice,
  DriverRun,
  FinishedRun,
  HistoryDay,
  OutcomeInput,
  ProblemInput,
  ProblemRecord,
  ProblemThread,
  RecordedOutcome,
  Resolution,
  RunDistance,
} from "../types";
import { problemPhotoIds } from "../types";
import type { DriverApi } from "./DriverApi";

/**
 * What the phone itself does for the driver, whatever serves the route: it keeps the run's state in its own IndexedDB
 * cache, queues every record in the outbox for the sync engine, and makes the notices only the device can make. The real
 * API client and the development mock both build on this; nothing here reads a fixture, a date or a name.
 */

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

/** Reads the phone's real IndexedDB cache directly, for callers outside a `createDeviceOps` instance (the sync
 * handlers and the device-notice subscriber are registered once, globally). */
export async function readDeviceState(date: string): Promise<LocalRunState> {
  const entry = await getCache<LocalRunState>(cacheKey(date));
  return entry?.value ?? defaultLocalState();
}

export async function writeDeviceState(date: string, state: LocalRunState, nowMs: number): Promise<void> {
  await putCache(cacheKey(date), state, nowMs);
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
  "call_request",
];

export function sortNotices(notices: readonly DriverNotice[]): DriverNotice[] {
  return [...notices].sort((a, b) => b.at.localeCompare(a.at) || SAME_MINUTE_ORDER.indexOf(a.kind) - SAME_MINUTE_ORDER.indexOf(b.kind));
}

export function buildNotice(partial: Omit<DriverNotice, "id" | "read">): DriverNotice {
  return { id: crypto.randomUUID(), read: false, ...partial };
}

/** Writes the conflict once per stop (an outlet's orders share it), and queues the "Delivery sent for review" notice the first time. */
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

/** The reference a failed upload quotes on R8.3. Every failed send has one. */
export const PHOTO_FAILURE_REFERENCE = "WP-SYNC-409";

let deviceNoticeSyncRegistered = false;

/** Device-made sync notices (field conventions section 15): "N records synced" and the photo
 * upload failure. Never from the server; held only on the phone. Safe to call more than once.
 * `stopNumber` says which stop of the run an outlet is, for the photo notice's wording. */
export function registerDeviceNoticeSync(
  date: string,
  now: () => number,
  stopNumber?: (outletId: string | undefined) => number | undefined | Promise<number | undefined>,
): void {
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
            body: `Couldn't send photo of stop ${(await stopNumber?.(outletId)) ?? 1}. Kept on phone. Retrying.`,
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

/** What the run's distance is worked out from: the planned kilometres, the vehicle's economy and, when tracked, the legs. */
export type DistanceBasis = { trackedLegsKm: number[] | null; plannedKm: number; kmPerL: number };

export type DeviceOpsOptions = {
  /** The state gallery and tests only: seeds an in-memory local state instead of the phone's real IndexedDB
   * cache, so every frame can show its own moment independently, and writes there never touch the real outbox. */
  seed?: Partial<LocalRunState>;
  /** The day's run as the caller serves it, for the history row. */
  getRun: (date: string) => Promise<DriverRun>;
  /** The figures behind the finish screen's distance and fuel. */
  distanceBasis: (date: string) => Promise<DistanceBasis>;
  /** Who the records are from. Empty lets the server use the signed-in driver's name. */
  actor?: string;
};

export type DeviceOps = Pick<
  DriverApi,
  | "acknowledgePlan"
  | "startRoute"
  | "recordArrival"
  | "recordOutcome"
  | "markNoticesRead"
  | "noteWentOffline"
  | "recordProblem"
  | "listProblems"
  | "getRunDistance"
  | "getFinishedRun"
  | "finishRun"
> & {
  /** Today's row in the history, from the phone's own run. */
  getTodayHistory: (date: string) => Promise<HistoryDay[]>;
  readState: (date: string) => Promise<LocalRunState>;
  writeState: (date: string, state: LocalRunState) => Promise<void>;
  /** True for a seeded in-memory instance, which never touches the real outbox. */
  isolated: boolean;
};

/**
 * The driver's own writes, as the phone does them (field conventions section 10). Writes save to the local cache at once
 * (so the screen reflects them immediately, even offline) and queue an outbox record for the sync engine to send when it can.
 */
export function createDeviceOps(now: () => number, options: DeviceOpsOptions): DeviceOps {
  const actor = options.actor ?? "";
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

  async function acknowledgePlan(date: string, version: number): Promise<void> {
    const local = await readState(date);
    local.acknowledgedVersion = version;
    await writeState(date, local);
    if (!isolated) {
      await enqueue({ type: "driver.ack", payload: { date, version }, actor, planVersionOnDevice: version });
    }
  }

  async function startRoute(date: string): Promise<void> {
    const local = await readState(date);
    const at = formatTime(now());
    local.departedAt = at;
    await writeState(date, local);
    if (!isolated) {
      await enqueue({ type: "driver.startRoute", payload: { date, at }, actor, planVersionOnDevice: local.acknowledgedVersion });
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
        actor,
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
          actor,
          planVersionOnDevice: local.acknowledgedVersion,
          blobIds: blobIds.length > 0 ? blobIds : undefined,
          groupKey: outletId,
        });
      }
    }
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
      const blobIds = problemPhotoIds(input);
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
        actor,
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

  async function getTodayHistory(date: string): Promise<HistoryDay[]> {
    const [run, local] = await Promise.all([options.getRun(date), readState(date)]);
    const today = todayRow(run, local.finished ?? null, connectivity.getSnapshot().waitingCount === 0);
    return today ? [today] : [];
  }

  async function plannedDistance(date: string): Promise<RunDistance> {
    const basis = await options.distanceBasis(date);
    return runDistance(basis);
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
    const finished: FinishedRun = { at: formatTime(now()), distance: await plannedDistance(date) };
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
        actor,
        planVersionOnDevice: local.acknowledgedVersion,
      });
    }
    return finished;
  }

  return {
    acknowledgePlan,
    startRoute,
    recordArrival,
    recordOutcome,
    markNoticesRead,
    noteWentOffline,
    recordProblem,
    listProblems,
    getTodayHistory,
    getRunDistance,
    getFinishedRun,
    finishRun,
    readState,
    writeState,
    isolated,
  };
}
