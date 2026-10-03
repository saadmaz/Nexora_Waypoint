import { colomboMs, type FieldClock } from "./clock";

// Development only (reached through devMocks/registry): the clocks the URL and the state gallery build, and the hero days
// the mocks run on. A production build never imports this file, so it carries none of these dates.

/** The hero day (Tue 29 Sep 2026), the date used when `?date=` is absent. */
export const HERO_DATE = "2026-09-29";
/** The evening before it, when plan v3 is drafted and released. */
export const HERO_EVENING_DATE = "2026-09-28";

/** A clock frozen at one moment. */
export function createFixedClock(date: string, time: string): FieldClock {
  const at = colomboMs(date, time);
  return { nowMs: () => at, runDate: () => HERO_DATE, fixed: true };
}

/** A clock that starts at one moment and then keeps ticking in real time. `advanceTo` jumps it forward. */
export function createRunningClock(startMs: number, runDate: string = HERO_DATE): FieldClock {
  const loadedAt = Date.now();
  let jumped = 0;
  const nowMs = () => startMs + (Date.now() - loadedAt) + jumped;
  return {
    nowMs,
    runDate: () => runDate,
    fixed: false,
    advanceTo(to) {
      const gap = to - nowMs();
      if (gap > 0) jumped += gap;
    },
  };
}

export type ClockOptions = {
  /** `?at=HH:MM`. */
  at?: string | null;
  /** `?date=YYYY-MM-DD`. Defaults to the hero day. */
  date?: string | null;
  /** Where the clock starts when `?at=` is absent: the role's first frame time. Real time when absent too. */
  start?: { date: string; time: string };
};

/**
 * Builds the clock from the URL parameters. `?at=05:26` starts the clock there and lets it tick;
 * `?date=2026-09-28` picks the day (default 2026-09-29, so Monday evening times need it). With
 * no `?at=`, it starts at the role's first frame time, or runs in real time if none is given.
 */
export function createFieldClock(options: ClockOptions = {}): FieldClock {
  const at = options.at && /^\d{1,2}:\d{2}$/.test(options.at) ? options.at : null;
  const date = options.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date) ? options.date : HERO_DATE;
  if (at) return createRunningClock(colomboMs(date, at), date);
  if (options.start) return createRunningClock(colomboMs(options.start.date, options.start.time), date);
  return { nowMs: () => Date.now(), runDate: () => date, fixed: false };
}

/** Reads `?at=` and `?date=` from a query string. */
export function clockOptionsFromSearch(search: string, start?: ClockOptions["start"]): ClockOptions {
  const params = new URLSearchParams(search);
  return { at: params.get("at"), date: params.get("date"), start };
}


/** Where the driver and loader mocks start the clock when the URL has no `?at=`. */
export const DRIVER_START = { date: HERO_DATE, time: "04:45" };
export const LOADER_START = { date: HERO_EVENING_DATE, time: "23:45" };
