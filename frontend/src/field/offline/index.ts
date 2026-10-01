import { connectivity } from "./connectivity";
import { refreshWaitingCount } from "./outbox";
import { startSyncEngine, stopSyncEngine } from "./sync";

export * from "./blobs";
export * from "./connectivity";
export * from "./db";
export * from "./outbox";
export * from "./sync";
export * from "./time";
export * from "./transport";

/**
 * Starts the offline core: restores Simulate offline and the last sync time, counts what is
 * waiting, then starts the sync triggers. Call it once from a field role's entry; it returns the
 * function that stops it.
 */
export async function startFieldRuntime(): Promise<() => void> {
  await connectivity.restore();
  await refreshWaitingCount();
  startSyncEngine();
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    // Ask the browser not to evict the outbox and photos under storage pressure.
    void navigator.storage.persist();
  }
  return stopSyncEngine;
}
