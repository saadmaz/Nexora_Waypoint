import { isoDate } from "./clock";

/**
 * The delivery run the field apps are working on (YYYY-MM-DD). On the real API it is the server's (`GET /clock`); in
 * mock mode it is the URL's `?date=`. The role's clock provider points this at its clock, so a screen, a hook or a
 * callback just calls `runDate()` and the date is never written in a component (DP-26).
 */
let source: (() => string) | null = null;

export function setRunDateSource(next: () => string): void {
  source = next;
}

export function runDate(): string {
  return source ? source() : isoDate(Date.now());
}
