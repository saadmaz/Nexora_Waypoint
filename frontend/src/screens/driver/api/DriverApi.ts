import type { DriverNotice, OutcomeInput, DriverRun } from "../types";

/**
 * The driver's typed API (field conventions section 10). A screen calls only this; the mock
 * (`mockDriverApi.ts`) is the only thing that reads fixtures or the offline core directly. The
 * real backend replaces the mock behind the same shape once it exists.
 */
export type DriverApi = {
  /** Today's run: plan state, loader confirmation, departure and every stop's progress. Reads the
   * phone's own cache, so it never throws offline. */
  getRun(date: string): Promise<DriverRun>;
  /** Caches the route for offline use. Throws NetworkError if the device cannot reach the server;
   * `onProgress(done, total)` drives R1.2 A's bar. */
  downloadRun(date: string, version: number, onProgress?: (done: number, total: number) => void): Promise<void>;
  /** Records that Nimal has acknowledged a plan version, already downloaded. */
  acknowledgePlan(date: string, version: number): Promise<void>;
  /** Records departure. Works offline (field conventions section 11: the outbox never blocks on a connection). */
  startRoute(date: string): Promise<void>;
  recordArrival(date: string, outletId: string): Promise<void>;
  /** One record per order, even when "same outcome" produced every row. */
  recordOutcome(date: string, outletId: string, perOrder: OutcomeInput[]): Promise<void>;
  /** Server notices affecting this driver's own run (field conventions section 15, R8.1): a
   * resolution, a review request. Device-made sync notices ("3 records synced") never come from
   * here; they are generated locally when a sync run finishes. `sinceIso` is a hint only, like a
   * real `getNotices(since)` would take; the mock just returns everything so far. */
  getNotices(date: string, sinceIso?: string): Promise<DriverNotice[]>;
};
