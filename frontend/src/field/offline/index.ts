import { connectivity } from "./connectivity";
import { installFieldTransport } from "./fetchTransport";
import { refreshWaitingCount } from "./outbox";
import { startSyncEngine, stopSyncEngine } from "./sync";

export * from "./apiSync";
export * from "./blobs";
export * from "./connectivity";
export * from "./db";
export * from "./fetchTransport";
export * from "./outbox";
export * from "./query";
export * from "./sync";
export * from "./time";
export * from "./transport";

/**
 * Starts the offline core: restores Simulate offline and the last sync time, counts what is
 * waiting, installs the real transport when a field role is on the API (`VITE_DRIVER_API`,
 * `VITE_LOADER_API`), then starts the sync triggers. Call it once from a field role's entry; it
 * returns the function that stops it.
 */
export async function startFieldRuntime(): Promise<() => void> {
  installFieldTransport();
  await connectivity.restore();
  await refreshWaitingCount();
  startSyncEngine();
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    // Ask the browser not to evict the outbox and photos under storage pressure.
    void navigator.storage.persist();
  }
  return stopSyncEngine;
}
