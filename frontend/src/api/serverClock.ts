import { isoDate } from "../field/clock/clock";
import type { Role } from "../domain/status";
import { apiClient } from "./http/config";
import { WRITE_EVENT } from "./http/events";

/**
 * The scenario clock in API mode (PRD v3 section 13, DP-26). The server owns time and it ticks, so the page asks
 * `GET /clock` and extrapolates between answers: `scenarioNow + (Date.now() - fetchedAt) * rate`. This module is the only
 * place the frontend reads the wall clock for business time. It re-syncs every 15 s, after every write and when the tab
 * gets focus, and keeps the last answer on the device so a reload while offline still starts from the right time.
 */

export const RESYNC_MS = 15_000;
const WRITE_DEBOUNCE_MS = 250;

export type ClockReading = {
  /** Scenario time at the moment of the answer, epoch ms. */
  scenarioMs: number;
  /** Scenario seconds per wall second: 1 is real time, 0 is paused. */
  rate: number;
  /** The wall clock when the answer arrived, epoch ms. */
  fetchedAt: number;
  /** The delivery run the apps are working on (today's until midday, then the next operating day), when the server said. */
  runDate?: string;
};

export type ClockAnswer = { now: string; rate: number; runDate?: string };

export type ServerClock = {
  /** The scenario "now", epoch ms. Before the first answer it is the wall clock, so gate on `ready()`. */
  nowMs(): number;
  rate(): number;
  paused(): boolean;
  /** The delivery run the apps are working on, as the server says. Before the first answer it is today in Colombo. */
  runDate(): string;
  /** True once an answer (or a saved one) is in hand, or the first request has failed (then the wall clock stands in). */
  ready(): boolean;
  /** Asks the server again. Never rejects: offline keeps the last reading. */
  sync(): Promise<void>;
  /** Starts the 15 s timer and the focus and write listeners; returns the stop function. Also syncs now. */
  start(): () => void;
  /** Called after every new reading. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
};

export type ServerClockOptions = {
  fetchClock?: () => Promise<ClockAnswer>;
  /** The wall clock, epoch ms. Defaults to `Date.now`. */
  wall?: () => number;
  /** Where the last answer is kept. Defaults to `localStorage` when it works. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
};

/** Where the scenario clock stands `wallMs` after a reading. */
export function extrapolate(reading: ClockReading, wallMs: number): number {
  return reading.scenarioMs + (wallMs - reading.fetchedAt) * reading.rate;
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function loadReading(storage: ServerClockOptions["storage"], key: string): ClockReading | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ClockReading>;
    if (typeof value.scenarioMs !== "number" || typeof value.rate !== "number" || typeof value.fetchedAt !== "number") return null;
    return {
      scenarioMs: value.scenarioMs,
      rate: value.rate,
      fetchedAt: value.fetchedAt,
      ...(typeof value.runDate === "string" ? { runDate: value.runDate } : {}),
    };
  } catch {
    return null;
  }
}

export function createServerClock(role: Role, options: ServerClockOptions = {}): ServerClock {
  const wall = options.wall ?? (() => Date.now());
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const key = `waypoint.clock.${role}`;
  const fetchClock = options.fetchClock ?? (() => apiClient(role).get("/api/v1/clock"));
  const listeners = new Set<() => void>();
  let reading = loadReading(storage, key);
  // True after the first attempt, answered or not: a device that starts offline with nothing saved must not stay blank.
  let attempted = false;

  const nowMs = () => (reading ? extrapolate(reading, wall()) : wall());

  async function sync(): Promise<void> {
    const sent = wall();
    try {
      const answer = await fetchClock();
      const received = wall();
      reading = {
        scenarioMs: Date.parse(answer.now),
        rate: answer.rate,
        fetchedAt: (sent + received) / 2,
        ...(answer.runDate ? { runDate: answer.runDate } : {}),
      };
      try {
        storage?.setItem(key, JSON.stringify(reading));
      } catch {
        // Storage can be full or blocked: the clock still works from memory.
      }
      for (const listener of listeners) listener();
    } catch {
      // Offline or signed out: keep the last reading and extrapolate from it.
    } finally {
      const first = !attempted;
      attempted = true;
      if (first) for (const listener of listeners) listener();
    }
  }

  function start(): () => void {
    void sync();
    const timer = window.setInterval(() => void sync(), RESYNC_MS);
    let pending: number | undefined;
    const soon = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => void sync(), WRITE_DEBOUNCE_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    window.addEventListener(WRITE_EVENT, soon);
    window.addEventListener("focus", soon);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(pending);
      window.removeEventListener(WRITE_EVENT, soon);
      window.removeEventListener("focus", soon);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }

  return {
    nowMs,
    rate: () => reading?.rate ?? 1,
    paused: () => reading?.rate === 0,
    runDate: () => reading?.runDate ?? isoDate(nowMs()),
    ready: () => reading !== null || attempted,
    sync,
    start,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
