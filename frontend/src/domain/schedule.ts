/**
 * Cutoff and arrival-range rules (PRD v2 section 4b/S1/S2, row 553).
 *
 * - Orders close at 16:00 on the day before the operating day; before that
 *   they are Ordered and editable, at 16:00 they flip to Confirmed and lock.
 * - An order placed after 16:00 rolls to the following operating day and is
 *   tagged "After cutoff".
 * - The plan (and with it, the window-aware arrival range) is released by the
 *   dispatcher, at no fixed time. In api mode nothing here decides that: a
 *   screen asks whether the server sent an arrival, and the order form carries
 *   the server's own `cutoffAt`. `RELEASE_HOUR`, `RELEASE_MINUTE`, `releaseFor`
 *   and `isPlanReleased` exist for the mocks alone, which play a scripted
 *   evening where the release lands at 23:40 (DP-27).
 */

import { colomboMs, formatDate, formatTime, isoDate } from "../field/clock/clock";

export const CUTOFF_HOUR = 16;
export const CUTOFF_MINUTE = 0;

/** Mock only: the scripted evening's release. The server decides when a plan is released. */
export const RELEASE_HOUR = 23;
export const RELEASE_MINUTE = 40;

// Days are read and counted in Asia/Colombo (UTC+05:30, no daylight saving), never in the browser's own time zone.
const DAY_MS = 86_400_000;
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const hhmm = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

/** The ISO date `days` after (or before) another, as a calendar date. */
function isoPlusDays(iso: string, days: number): string {
  return isoDate(colomboMs(iso, "12:00") + days * DAY_MS);
}

/** 0 for Sunday to 6 for Saturday, in Asia/Colombo. */
function weekdayOf(date: Date): number {
  return WEEKDAY_INDEX[formatDate(date.getTime()).split(" ")[0] ?? ""] ?? 0;
}

/** The hour of day (0 to 23) in Asia/Colombo. */
function hourOf(date: Date): number {
  return Number(formatTime(date.getTime()).slice(0, 2));
}

/** Midnight at the start of the Colombo day `date` falls on. */
function dateOnly(date: Date): Date {
  return new Date(colomboMs(toIsoDate(date), "00:00"));
}

export function addDays(date: Date, days: number): Date {
  return new Date(dateOnly(date).getTime() + days * DAY_MS);
}

export function toIsoDate(date: Date): string {
  return isoDate(date.getTime());
}

/** The cutoff instant (16:00) for orders counting toward the given operating day. */
export function cutoffFor(operatingDate: string): Date {
  return new Date(colomboMs(isoPlusDays(operatingDate, -1), hhmm(CUTOFF_HOUR, CUTOFF_MINUTE)));
}

/** Mock only: the scripted release instant (23:40) for the given operating day. */
export function releaseFor(operatingDate: string): Date {
  return new Date(colomboMs(isoPlusDays(operatingDate, -1), hhmm(RELEASE_HOUR, RELEASE_MINUTE)));
}

/** True once `now` is at or past the 16:00 cutoff for orders on `operatingDate`. */
export function isPastCutoff(operatingDate: string, now: Date): boolean {
  return now.getTime() >= cutoffFor(operatingDate).getTime();
}

/**
 * The operating day an order placed at `now` counts for: the next calendar
 * day if `now` is before that day's 16:00 cutoff, otherwise the day after.
 *
 * Waypoint's non-operating day is Sunday (see the store README's assumptions
 * note); a cutoff landing on a non-operating day rolls to the next one.
 */
export function operatingDayFor(now: Date): string {
  let candidate = addDays(now, 1);
  while (isPastCutoff(toIsoDate(candidate), now) || weekdayOf(candidate) === 0) {
    candidate = addDays(candidate, 1);
  }
  return toIsoDate(candidate);
}

/** Minutes remaining until the 16:00 cutoff for `operatingDate`, or 0 if already past. */
export function minutesUntilCutoff(operatingDate: string, now: Date): number {
  const ms = cutoffFor(operatingDate).getTime() - now.getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

/**
 * True once `now` is past the 16:00 cutoff for the next calendar day, so an order
 * placed now rolls to the following run and is tagged "After cutoff" (S1.4).
 */
export function isAfterCutoff(now: Date): boolean {
  return isPastCutoff(toIsoDate(addDays(now, 1)), now);
}

/** The operating day after `operatingDate`, skipping Sunday. "Reconnect before 16:00 or this order moves to Wed." */
export function nextOperatingDayAfter(operatingDate: string): string {
  let candidate = addDays(new Date(colomboMs(operatingDate, "00:00")), 1);
  while (weekdayOf(candidate) === 0) candidate = addDays(candidate, 1);
  return toIsoDate(candidate);
}

/** The hour the day's run is over: after this the next delivery day is the one to look at (windows close at 08:00). */
const RUN_END_HOUR = 8;

/**
 * The delivery day the store is looking at: today until the run is over (08:00), otherwise the
 * next operating day. At Mon 16:01 that is Tue 29 Sep, at Tue 05:20 it is still Tue 29 Sep.
 * Not the same as `operatingDayFor`, which is the day an order placed now counts for.
 */
export function deliveryDayFor(now: Date): string {
  const today = dateOnly(now);
  if (weekdayOf(today) !== 0 && hourOf(now) < RUN_END_HOUR) return toIsoDate(today);
  let candidate = addDays(now, 1);
  while (weekdayOf(candidate) === 0) candidate = addDays(candidate, 1);
  return toIsoDate(candidate);
}
