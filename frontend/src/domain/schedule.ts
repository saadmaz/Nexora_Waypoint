/**
 * Cutoff and arrival-range rules (PRD v2 section 4b/S1/S2, row 553).
 *
 * - Orders close at 16:00 on the day before the operating day; before that
 *   they are Ordered and editable, at 16:00 they flip to Confirmed and lock.
 * - An order placed after 16:00 rolls to the following operating day and is
 *   tagged "After cutoff".
 * - The plan (and with it, the window-aware arrival range) is not released
 *   until 23:40 the day before the operating day. Before release, S2 shows
 *   "Plan not released yet, arrival time follows" instead of a time.
 */

export const CUTOFF_HOUR = 16;
export const CUTOFF_MINUTE = 0;

export const RELEASE_HOUR = 23;
export const RELEASE_MINUTE = 40;

function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = dateOnly(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The cutoff instant (16:00) for orders counting toward the given operating day. */
export function cutoffFor(operatingDate: string): Date {
  const eve = addDays(new Date(`${operatingDate}T00:00:00`), -1);
  eve.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
  return eve;
}

/** The plan-release instant (23:40) for the given operating day. */
export function releaseFor(operatingDate: string): Date {
  const eve = addDays(new Date(`${operatingDate}T00:00:00`), -1);
  eve.setHours(RELEASE_HOUR, RELEASE_MINUTE, 0, 0);
  return eve;
}

/** True once `now` is at or past the 16:00 cutoff for orders on `operatingDate`. */
export function isPastCutoff(operatingDate: string, now: Date): boolean {
  return now.getTime() >= cutoffFor(operatingDate).getTime();
}

/** True once `now` is at or past the 23:40 plan release for `operatingDate`. */
export function isPlanReleased(operatingDate: string, now: Date): boolean {
  return now.getTime() >= releaseFor(operatingDate).getTime();
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
  while (isPastCutoff(toIsoDate(candidate), now) || candidate.getDay() === 0) {
    candidate = addDays(candidate, 1);
  }
  return toIsoDate(candidate);
}

/** Minutes remaining until the 16:00 cutoff for `operatingDate`, or 0 if already past. */
export function minutesUntilCutoff(operatingDate: string, now: Date): number {
  const ms = cutoffFor(operatingDate).getTime() - now.getTime();
  return Math.max(0, Math.round(ms / 60_000));
}
