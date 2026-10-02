import { useSyncExternalStore } from "react";
import { getSetting, setSetting } from "./db";
import { nowMs } from "./time";

/** What the chip and banner show (field conventions section 11). */
export type ConnectivityStatus = "online" | "offline" | "syncing" | "failed";

export type ConnectivitySnapshot = {
  status: ConnectivityStatus;
  /** Epoch ms of the last successful sync. "Last sync 05:17" always means this. */
  lastSyncAt: number | null;
  /** Epoch ms of the last sync that ended with errors. */
  lastFailureAt: number | null;
  /** Records on the phone that have not reached the server yet. */
  waitingCount: number;
  /** The judge's "Simulate offline" switch (R4). */
  simulatedOffline: boolean;
  /** The network is reachable: browser online, not simulated, no external gate closed, no network failure. */
  connected: boolean;
};

type Internal = {
  browserOnline: boolean;
  simulatedOffline: boolean;
  /** Set when a request fails with a NetworkError; cleared by the next success or the `online` event. */
  networkFailed: boolean;
  syncing: boolean;
  lastSyncFailed: boolean;
  lastSyncAt: number | null;
  lastFailureAt: number | null;
  waitingCount: number;
  /** Extra conditions that must hold for the device to count as online, such as the Kandy coverage gap. */
  gates: Map<string, boolean>;
};

const state: Internal = {
  browserOnline: typeof navigator === "undefined" ? true : navigator.onLine !== false,
  simulatedOffline: false,
  networkFailed: false,
  syncing: false,
  lastSyncFailed: false,
  lastSyncAt: null,
  lastFailureAt: null,
  waitingCount: 0,
  gates: new Map(),
};

const listeners = new Set<() => void>();
let snapshot = compute();

function isConnected(): boolean {
  if (!state.browserOnline || state.simulatedOffline || state.networkFailed) return false;
  for (const open of state.gates.values()) if (!open) return false;
  return true;
}

function compute(): ConnectivitySnapshot {
  const connected = isConnected();
  const status: ConnectivityStatus = !connected
    ? "offline"
    : state.syncing
      ? "syncing"
      : state.lastSyncFailed
        ? "failed"
        : "online";
  return {
    status,
    lastSyncAt: state.lastSyncAt,
    lastFailureAt: state.lastFailureAt,
    waitingCount: state.waitingCount,
    simulatedOffline: state.simulatedOffline,
    connected,
  };
}

function publish(): void {
  const next = compute();
  const same = (Object.keys(next) as (keyof ConnectivitySnapshot)[]).every((k) => next[k] === snapshot[k]);
  if (same) return;
  snapshot = next;
  listeners.forEach((fn) => fn());
}

export const connectivity = {
  getSnapshot: (): ConnectivitySnapshot => snapshot,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isConnected,

  /** The "Simulate offline" switch. Persisted, so a reload keeps it. */
  async setSimulatedOffline(value: boolean): Promise<void> {
    state.simulatedOffline = value;
    publish();
    await setSetting("simulatedOffline", value);
  },

  /** Press "Send now" or "Retry now". The sync engine registers what this runs. */
  async sendNow(): Promise<void> {
    await sendNowImpl();
  },

  // The rest is for the offline core and the app shell, not for screens.

  setBrowserOnline(value: boolean): void {
    state.browserOnline = value;
    // A fresh `online` event means the network may be back: forget an old failure.
    if (value) state.networkFailed = false;
    publish();
  },

  /** A request failed with a NetworkError. */
  markNetworkFailure(): void {
    state.networkFailed = true;
    publish();
  },

  /** A request reached the server. */
  markNetworkSuccess(): void {
    if (!state.networkFailed) return;
    state.networkFailed = false;
    publish();
  },

  /** Forget a past network failure before trying again (Send now, Retry now). */
  clearNetworkFailure(): void {
    state.networkFailed = false;
    publish();
  },

  setSyncing(value: boolean): void {
    state.syncing = value;
    publish();
  },

  /** A sync run finished: `ok` when no record ended in error. */
  recordSyncRun(ok: boolean): void {
    state.lastSyncFailed = !ok;
    if (ok) {
      state.lastSyncAt = nowMs();
      void setSetting("lastSyncAt", state.lastSyncAt);
    } else {
      state.lastFailureAt = nowMs();
    }
    publish();
  },

  setWaitingCount(count: number): void {
    state.waitingCount = count;
    publish();
  },

  /**
   * An extra online condition, for example the driver's "Kandy corridor coverage gap" between
   * 05:17 and 06:40. The device is online only while every gate is open.
   */
  setGate(name: string, open: boolean): void {
    state.gates.set(name, open);
    publish();
  },

  /** Loads what survives a reload: Simulate offline and the last sync time. */
  async restore(): Promise<void> {
    state.simulatedOffline = await getSetting("simulatedOffline", false);
    state.lastSyncAt = await getSetting<number | null>("lastSyncAt", null);
    publish();
  },

  /** Tests only. */
  reset(): void {
    state.browserOnline = true;
    state.simulatedOffline = false;
    state.networkFailed = false;
    state.syncing = false;
    state.lastSyncFailed = false;
    state.lastSyncAt = null;
    state.lastFailureAt = null;
    state.waitingCount = 0;
    state.gates.clear();
    publish();
  },
};

let sendNowImpl: () => Promise<void> = async () => undefined;

/** The sync engine registers itself here, so `connectivity.sendNow()` needs no import cycle. */
export function registerSendNow(fn: () => Promise<void>): void {
  sendNowImpl = fn;
}

/** The connectivity store as a hook. Re-renders when the status, last sync or waiting count changes. */
export function useConnectivity(): ConnectivitySnapshot {
  return useSyncExternalStore(connectivity.subscribe, connectivity.getSnapshot, connectivity.getSnapshot);
}
