import { clockTime } from "../../../domain/format";

/** The hero evening (Mon 28 Sep) and the hero morning (Tue 29 Sep), PRD v3 section 2. */
export const EVENING = "2026-09-28";
export const MORNING = "2026-09-29";
export const NEXT_RUN = "2026-09-30";

/** A time on the hero evening ("16:05") or, from `morning`, on the hero morning ("02:45"). */
export function at(hhmm: string, morning = false): Date {
  return new Date(`${morning ? MORNING : EVENING}T${hhmm}:00+05:30`);
}

/** "HH:MM" from a Date. */
export function hm(date: Date): string {
  return clockTime(date);
}

/** Whole minutes from `a` to `b`. */
export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

/** "in 5 h 29 min", "in 60 min", "in 14 min": how long until `to`, for the departs-in column. */
export function untilLabel(now: Date, to: Date): string {
  const total = minutesBetween(now, to);
  if (total <= 0) return "now";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `in ${h} h ${m} min` : `in ${m} min`;
}

/** "3 min", "1 min", "now": how long ago, for the last-heard column. */
export function agoLabel(now: Date, then: Date): string {
  const total = minutesBetween(then, now);
  if (total <= 0) return "now";
  if (total >= 60) return `${Math.floor(total / 60)} h ${total % 60} min`;
  return `${total} min`;
}

/** The clock time of a "HH:MM" on the morning when it is before 08:00 or exactly noon onwards is the evening before. */
export function scenarioTime(hhmm: string): Date {
  const hour = Number(hhmm.slice(0, 2));
  return at(hhmm, hour < 12);
}
