/**
 * The one place the offline core reads "now". It defaults to the wall clock and is pointed at the
 * scenario clock (`field/clock.ts`) when the app starts, so a record's device time, "Last sync
 * 05:17" and the 30 s retry all follow the scenario, never the browser's own time zone (field
 * conventions section 8). Tests set their own source.
 */
let source: () => number = () => Date.now();

export function nowMs(): number {
  return source();
}

export function setTimeSource(next: () => number): void {
  source = next;
}

export function resetTimeSource(): void {
  source = () => Date.now();
}
