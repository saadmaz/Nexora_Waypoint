import { connectivity, registerSendNow } from "./connectivity";
import { db, type BlobRecord, type OutboxRecord } from "./db";
import { refreshWaitingCount, setEnqueueListener } from "./outbox";
import { nowMs } from "./time";
import { NetworkError } from "./transport";

/** What a handler answers for one record (field conventions section 11). `duplicate` counts as accepted. */
export type SyncOutcome = {
  result: "accepted" | "duplicate" | "conflict" | "error";
  /** Anything the server sent back, kept on the record for screens (for example conflict details). */
  serverPayload?: unknown;
  reason?: string;
  /** Records with the same key are summarised together, for example the stop "OUT084 (2 orders)". */
  groupKey?: string;
};

/** Sends one record. Throw a NetworkError if the device cannot reach the server. */
export type SyncHandler = (record: OutboxRecord) => Promise<SyncOutcome>;

/** Uploads one photo or signature. Throw a NetworkError if offline; any other error is a failed upload. */
export type BlobUploader = (blob: BlobRecord, record: OutboxRecord | undefined) => Promise<"uploaded" | "duplicate">;

export type SyncItem = {
  clientId: string;
  type: string;
  result: SyncOutcome["result"];
  groupKey?: string;
};

export type SyncGroup = { accepted: number; conflicts: number; errors: number };

/** Summary of one sync run. The driver's R5 screen reads this. */
export type SyncResult = {
  startedAt: number;
  finishedAt: number;
  /** Accepted and duplicate records. */
  accepted: number;
  conflicts: number;
  errors: number;
  items: SyncItem[];
  groups: Record<string, SyncGroup>;
  /** Photos and signatures that failed to upload. Their records are still accepted. */
  blobFailures: { id: string; recordClientId?: string; reason: string }[];
  /** The run stopped because the connection dropped. */
  interrupted: boolean;
};

export const RETRY_AFTER_MS = 30_000;
export const SYNC_INTERVAL_MS = 30_000;

const handlers = new Map<string, SyncHandler>();
let blobUploader: BlobUploader | undefined;
const resultListeners = new Set<(result: SyncResult) => void>();
let lastResult: SyncResult | undefined;
let running: Promise<SyncResult | undefined> | undefined;
/** A call that arrived while a run was in flight: the run goes round again once it is done. */
let rerun: RunOptions | undefined;

/** A role registers how each of its record types is sent, for example `registerSyncHandler("driver.arrival", …)`. */
export function registerSyncHandler(type: string, handler: SyncHandler): void {
  handlers.set(type, handler);
}

export function registerBlobUploader(uploader: BlobUploader): void {
  blobUploader = uploader;
}

export function clearSyncHandlers(): void {
  handlers.clear();
  blobUploader = undefined;
}

/** Listen for finished runs. Returns the unsubscribe function. */
export function onSyncResult(listener: (result: SyncResult) => void): () => void {
  resultListeners.add(listener);
  return () => resultListeners.delete(listener);
}

export function getLastSyncResult(): SyncResult | undefined {
  return lastResult;
}

type RunOptions = {
  /** Send and retry everything now, ignoring the 30 s wait (Send now, Retry now). */
  force?: boolean;
};

function dueNow(record: OutboxRecord, force: boolean): boolean {
  if (record.status === "waiting") return true;
  if (record.status === "error") return force || (record.nextAttemptAt ?? 0) <= nowMs();
  return false;
}

function blobDue(blob: BlobRecord, force: boolean): boolean {
  if (blob.uploadStatus === "pending") return true;
  if (blob.uploadStatus === "failed") return force || (blob.nextAttemptAt ?? 0) <= nowMs();
  return false;
}

/** A photo uploads once the record it belongs to has reached the server. A conflict record counts: Dispatch needs its proof to decide. */
function ownerSynced(blob: BlobRecord, owners: Map<string, OutboxRecord>): boolean {
  if (!blob.recordClientId) return true;
  const status = owners.get(blob.recordClientId)?.status;
  return status === "accepted" || status === "conflict";
}

async function runOnce(options: RunOptions): Promise<SyncResult | undefined> {
  const force = options.force ?? false;
  if (force) connectivity.clearNetworkFailure();
  if (!connectivity.isConnected()) return undefined;

  const all = await db.outbox.orderBy("seq").toArray();
  const toSend = all.filter((r) => dueNow(r, force));
  const owners = new Map(all.map((r) => [r.clientId, r]));
  // One at a time, in the order the photos were taken (the table is keyed by a random id).
  const blobs = (await db.blobs.toArray()).sort((a, b) => a.createdAt - b.createdAt).filter((b) => blobDue(b, force));
  if (toSend.length === 0 && !blobs.some((b) => ownerSynced(b, owners))) return undefined;

  connectivity.setSyncing(true);
  const startedAt = nowMs();
  const items: SyncItem[] = [];
  const groups: Record<string, SyncGroup> = {};
  const blobFailures: SyncResult["blobFailures"] = [];
  let accepted = 0;
  let conflicts = 0;
  let errors = 0;
  let interrupted = false;

  const tally = (item: SyncItem) => {
    items.push(item);
    if (item.result === "accepted" || item.result === "duplicate") accepted += 1;
    else if (item.result === "conflict") conflicts += 1;
    else errors += 1;
    if (item.groupKey) {
      const group = (groups[item.groupKey] ??= { accepted: 0, conflicts: 0, errors: 0 });
      if (item.result === "accepted" || item.result === "duplicate") group.accepted += 1;
      else if (item.result === "conflict") group.conflicts += 1;
      else group.errors += 1;
    }
  };

  try {
    for (const record of toSend) {
      const handler = handlers.get(record.type);
      if (!handler) {
        await db.outbox.where("clientId").equals(record.clientId).modify({
          status: "error",
          lastError: `No handler for ${record.type}`,
          nextAttemptAt: nowMs() + RETRY_AFTER_MS,
        });
        tally({ clientId: record.clientId, type: record.type, result: "error", groupKey: record.groupKey });
        continue;
      }

      await db.outbox
        .where("clientId")
        .equals(record.clientId)
        .modify({ status: "sending", attempts: record.attempts + 1 });
      await refreshWaitingCount();

      let outcome: SyncOutcome;
      try {
        outcome = await handler(record);
      } catch (error) {
        if (error instanceof NetworkError) {
          // The connection dropped: put the record back and stop. Nothing is lost or counted twice.
          await db.outbox.where("clientId").equals(record.clientId).modify({
            status: "waiting",
            attempts: record.attempts,
          });
          connectivity.markNetworkFailure();
          interrupted = true;
          break;
        }
        outcome = { result: "error", reason: error instanceof Error ? error.message : "Send failed" };
      }

      const groupKey = outcome.groupKey ?? record.groupKey;
      const final = outcome.result;
      await db.outbox
        .where("clientId")
        .equals(record.clientId)
        .modify({
          status: final === "duplicate" ? "accepted" : final,
          serverPayload: outcome.serverPayload,
          lastError: final === "error" ? (outcome.reason ?? "Send failed") : undefined,
          nextAttemptAt: final === "error" ? nowMs() + RETRY_AFTER_MS : undefined,
          groupKey,
          syncedAt: final === "error" ? undefined : nowMs(),
        });
      tally({ clientId: record.clientId, type: record.type, result: final, groupKey });
    }

    // Photos and signatures upload after their records, one at a time. A failure never fails the record.
    if (!interrupted && blobUploader) {
      const fresh = new Map((await db.outbox.toArray()).map((r) => [r.clientId, r]));
      for (const blob of blobs) {
        const owner = blob.recordClientId ? fresh.get(blob.recordClientId) : undefined;
        // The record may have been answered during this run; check again before uploading.
        if (!ownerSynced(blob, fresh)) continue;
        try {
          await blobUploader(blob, owner);
          await db.blobs.update(blob.id, { uploadStatus: "uploaded", lastError: undefined, nextAttemptAt: undefined });
        } catch (error) {
          if (error instanceof NetworkError) {
            connectivity.markNetworkFailure();
            interrupted = true;
            break;
          }
          const reason = error instanceof Error ? error.message : "Upload failed";
          await db.blobs.update(blob.id, {
            uploadStatus: "failed",
            attempts: blob.attempts + 1,
            lastError: reason,
            lastAttemptAt: nowMs(),
            nextAttemptAt: nowMs() + RETRY_AFTER_MS,
          });
          blobFailures.push({ id: blob.id, recordClientId: blob.recordClientId, reason });
        }
      }
    }
  } finally {
    connectivity.setSyncing(false);
    await refreshWaitingCount();
  }

  const result: SyncResult = {
    startedAt,
    finishedAt: nowMs(),
    accepted,
    conflicts,
    errors,
    items,
    groups,
    blobFailures,
    interrupted,
  };

  if (!interrupted) connectivity.recordSyncRun(errors === 0 && blobFailures.length === 0);
  if (items.length > 0 || blobFailures.length > 0) {
    lastResult = result;
    resultListeners.forEach((fn) => fn(result));
  }
  return result;
}

/**
 * Sends what is waiting, in the order it was saved. One run at a time: a second call while a run
 * is in flight joins it, so pressing "Send now" repeatedly sends nothing twice. A call that joins a
 * run may have been made because a record was just saved, which that run never saw, so the run
 * goes round once more when it finishes. Resolves to the run's summary, or undefined when there
 * was nothing to do or the device is offline.
 */
export function runSync(options: RunOptions = {}): Promise<SyncResult | undefined> {
  if (running) {
    rerun = { force: (rerun?.force ?? false) || (options.force ?? false) };
    return running;
  }
  running = (async () => {
    try {
      let result = await runOnce(options);
      while (rerun) {
        const next = rerun;
        rerun = undefined;
        result = (await runOnce(next)) ?? result;
      }
      return result;
    } finally {
      running = undefined;
    }
  })();
  return running;
}

/** Waiting records, error records past their 30 s wait and failed uploads: is there anything to send? */
export async function hasWork(): Promise<boolean> {
  const records = await db.outbox.toArray();
  if (records.some((r) => dueNow(r, false))) return true;
  const owners = new Map(records.map((r) => [r.clientId, r]));
  const blobs = await db.blobs.toArray();
  return blobs.some((b) => blobDue(b, false) && ownerSynced(b, owners));
}

/**
 * A record is `sending` only while a run is answering it. If the page was reloaded or killed in
 * that moment the record is stranded: nothing is sending it and nothing would ever retry it. Put
 * those back to `waiting`; the server answers `duplicate` if it did get the first send.
 */
export async function requeueInterrupted(): Promise<number> {
  if (running) return 0;
  const stranded = (await db.outbox.toArray()).filter((r) => r.status === "sending");
  for (const record of stranded) {
    await db.outbox.where("clientId").equals(record.clientId).modify({ status: "waiting", attempts: Math.max(0, record.attempts - 1) });
  }
  if (stranded.length > 0) await refreshWaitingCount();
  return stranded.length;
}

let interval: ReturnType<typeof setInterval> | undefined;
let removeOnlineListener: (() => void) | undefined;

/**
 * Starts the triggers: the `online` event, every 30 s while anything waits, and a send as soon as
 * a record is saved. There is no Background Sync API here on purpose: iOS Safari lacks it, so
 * sync only runs while the app is open. Returns a stop function.
 */
export function startSyncEngine(options: { syncOnEnqueue?: boolean } = {}): () => void {
  registerSendNow(async () => {
    await runSync({ force: true });
  });

  const onOnline = () => {
    connectivity.setBrowserOnline(true);
    void runSync();
  };
  const onOffline = () => connectivity.setBrowserOnline(false);
  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    removeOnlineListener = () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }

  // Whatever a previous page left half-sent goes back in the queue, then a run picks it up.
  void requeueInterrupted().then((count) => {
    if (count > 0) void runSync();
  });

  interval = setInterval(() => {
    void hasWork().then((work) => {
      if (work) void runSync();
    });
  }, SYNC_INTERVAL_MS);

  if (options.syncOnEnqueue ?? true) setEnqueueListener(() => void runSync());

  return stopSyncEngine;
}

export function stopSyncEngine(): void {
  if (interval) clearInterval(interval);
  interval = undefined;
  removeOnlineListener?.();
  removeOnlineListener = undefined;
  setEnqueueListener(undefined);
}
