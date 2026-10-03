/**
 * The field scenario clock (field conventions section 10, PRD v3 section 13). Every "now" in the
 * loader and driver apps comes from here, never from `new Date()` in a component, and every time
 * is read and written in Asia/Colombo (UTC+05:30, no daylight saving), never in the browser's own
 * time zone.
 */

export const TIME_ZONE = "Asia/Colombo";
const OFFSET = "+05:30";

/** The hero day (Tue 29 Sep 2026), the date used when `?date=` is absent. */
export const HERO_DATE = "2026-09-29";
/** The evening before it, when plan v3 is drafted and released. */
export const HERO_EVENING_DATE = "2026-09-28";

export type FieldClock = {
  /** Epoch milliseconds of the scenario "now". */
  nowMs: () => number;
  /** The delivery run (YYYY-MM-DD) the app is working on. The server says on the real API; the URL's `?date=` in mock mode. */
  runDate: () => string;
  /** Jumps forward to `to` (epoch ms). It never goes backwards. Absent on a fixed clock. */
  advanceTo?: (to: number) => void;
  /** A fixed clock does not tick: used by the state gallery so a frame stays at its own moment. */
  fixed: boolean;
};

/** Epoch ms for a date (YYYY-MM-DD) and a time (HH:MM or HH:MM:SS) in Asia/Colombo. */
export function colomboMs(date: string, time: string): number {
  const hhmmss = /^\d{1,2}:\d{2}$/.test(time) ? `${time}:00` : time;
  const padded = hhmmss.replace(/^(\d):/, "0$1:");
  return Date.parse(`${date}T${padded}${OFFSET}`);
}

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

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// en-US spells the month "Sep"; en-GB now spells it "Sept". The frames read "Tue 29 Sep".
const dateParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const isoParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "05:42": 24-hour time in Asia/Colombo. */
export function formatTime(ms: number): string {
  return timeFormat.format(ms);
}

/** "Tue 29 Sep": weekday, day and month in Asia/Colombo. */
export function formatDate(ms: number): string {
  const parts = Object.fromEntries(dateParts.formatToParts(ms).map((p) => [p.type, p.value]));
  return `${parts.weekday} ${parts.day} ${parts.month}`;
}

/** "2026-09-29": the operating date in Asia/Colombo. */
export function isoDate(ms: number): string {
  return isoParts.format(ms);
}

/** Whole minutes from `now` until `target`, rounded up so "in 56 min" never reads 0 early. Negative once past. */
export function minutesUntil(target: number, now: number): number {
  return Math.ceil((target - now) / 60_000);
}
