import type { ConnectivitySnapshot } from "../../../field/offline";

/**
 * Builds a `ConnectivitySnapshot` for one gallery frame. `connectivity` is one real store shared by
 * the whole page, so a frame that needs its own moment passes this to `DriverShell` /
 * `RunScreen`'s `connectivityOverride` instead of reading the live singleton (see their doc
 * comments; the `?frame=` single view the compare script shoots is unaffected either way).
 */
export function fakeConnectivity(partial: Partial<ConnectivitySnapshot> & { status: ConnectivitySnapshot["status"] }): ConnectivitySnapshot {
  return {
    lastSyncAt: null,
    lastFailureAt: null,
    waitingCount: 0,
    simulatedOffline: partial.status === "offline",
    connected: partial.status !== "offline",
    ...partial,
  };
}
