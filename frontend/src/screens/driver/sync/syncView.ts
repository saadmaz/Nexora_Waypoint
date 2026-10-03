import { useSyncExternalStore } from "react";
import { connectivity, getSetting, onSyncResult, setSetting, type SyncResult } from "../../../field/offline";

/** Which R5 frame a finished sync, or a resolution from Dispatch, calls for. */
export type SyncViewKind = "conflict" | "synced" | "resolved";

/** A sync result the driver has not seen yet (driver prompt 4 section 4: shown once, never over R3). */
export type PendingSyncView = {
  kind: SyncViewKind;
  /** The records that went out in the catch-up run, so R5 lists exactly what the Outbox shows. */
  clientIds: string[];
  /** Epoch ms the run finished, or the resolution arrived. */
  at: number;
  /** For `resolved`: the stop Dispatch decided on. */
  outletId?: string;
};

type State = {
  pending: PendingSyncView | null;
  /** Stops whose resolution the driver has already been shown. */
  seenResolved: string[];
  /** The phone has been out of coverage with records waiting since the last run. */
  wasOffline: boolean;
};

const SETTING_KEY = "driver.syncView";
/** Survives a reload, so an app killed while offline still tells the driver what happened once it syncs. */
const OFFLINE_KEY = "driver.syncView.wasOffline";

let state: State = { pending: null, seenResolved: [], wasOffline: false };
let snapshot = state;
const listeners = new Set<() => void>();

function set(next: State): void {
  state = next;
  snapshot = next;
  listeners.forEach((fn) => fn());
  void setSetting(SETTING_KEY, { pending: next.pending, seenResolved: next.seenResolved });
}

/**
 * Whether a finished run is the catch-up the driver should be told about: the phone had been
 * offline with records waiting, the run was not cut short, something went out, and nothing failed.
 * A single record sent from the road a moment after it is saved is not a "sync result".
 */
export function isCatchUp(result: SyncResult, wasOffline: boolean): boolean {
  return wasOffline && !result.interrupted && result.errors === 0 && result.items.length > 0;
}

export function kindOfResult(result: SyncResult): SyncViewKind {
  return result.conflicts > 0 ? "conflict" : "synced";
}

/** Starts watching connectivity and finished runs. Returns the stop function. */
export function startSyncViewTracking(): () => void {
  const stopConnectivity = connectivity.subscribe(() => {
    const { status, waitingCount } = connectivity.getSnapshot();
    if (status === "offline" && waitingCount > 0 && !state.wasOffline) {
      state = { ...state, wasOffline: true };
      void setSetting(OFFLINE_KEY, true);
    }
  });
  const stopResults = onSyncResult((result) => {
    if (result.interrupted) return;
    if (isCatchUp(result, state.wasOffline)) {
      void setSetting(OFFLINE_KEY, false);
      set({
        ...state,
        wasOffline: false,
        pending: { kind: kindOfResult(result), clientIds: result.items.map((item) => item.clientId), at: result.finishedAt },
      });
    } else if (result.items.length > 0 && result.errors === 0) {
      state = { ...state, wasOffline: false };
      void setSetting(OFFLINE_KEY, false);
    }
  });
  return () => {
    stopConnectivity();
    stopResults();
  };
}

/** Loads what survives a reload: an unseen result and the resolutions already shown. */
export async function restoreSyncView(): Promise<void> {
  const saved = await getSetting<{ pending: PendingSyncView | null; seenResolved: string[] } | null>(SETTING_KEY, null);
  const wasOffline = await getSetting(OFFLINE_KEY, false);
  state = { ...state, wasOffline: state.wasOffline || wasOffline };
  if (!saved) {
    snapshot = state;
    return;
  }
  state = { ...state, pending: saved.pending ?? state.pending, seenResolved: saved.seenResolved ?? [] };
  snapshot = state;
  listeners.forEach((fn) => fn());
}

/** Dispatch's decision reached the phone: queue R5.3 once per stop. */
export function queueResolution(outletId: string, at: number): void {
  if (state.seenResolved.includes(outletId)) return;
  if (state.pending?.kind === "resolved" && state.pending.outletId === outletId) return;
  set({ ...state, pending: { kind: "resolved", clientIds: [], at, outletId } });
}

/** The driver is being shown it: clears it, and remembers a resolution so it never shows twice. */
export function consumeSyncView(): PendingSyncView | null {
  const pending = state.pending;
  if (!pending) return null;
  const seenResolved = pending.kind === "resolved" && pending.outletId ? [...state.seenResolved, pending.outletId] : state.seenResolved;
  set({ ...state, pending: null, seenResolved });
  return pending;
}

export function getPendingSyncView(): PendingSyncView | null {
  return state.pending;
}

export function usePendingSyncView(): PendingSyncView | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot.pending,
    () => snapshot.pending,
  );
}

export function hasSeenResolution(outletId: string): boolean {
  return state.seenResolved.includes(outletId);
}

/** Tests only. */
export function resetSyncView(): void {
  state = { pending: null, seenResolved: [], wasOffline: false };
  snapshot = state;
  listeners.forEach((fn) => fn());
}
