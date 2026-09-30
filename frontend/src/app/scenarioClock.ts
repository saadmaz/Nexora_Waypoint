/** The hero evening: Mon 28 Sep 2026 (PRD v3 H1). The scenario clock counts from a time on this date unless told another. */
const HERO_EVENING = "2026-09-28";

/**
 * A clock that starts at `at` ("HH:MM") on `date` (default the hero evening, Mon 28 Sep) and
 * keeps ticking from there, so the 16:00 cutoff countdown moves and the delivery statuses
 * follow. Without a valid `at` it is real time. Interim: phase 7 owns the scenario clock.
 */
export function scenarioNow(at: string | null, date: string | null = null): () => Date {
  const match = at ? /^(\d{1,2}):(\d{2})$/.exec(at) : null;
  if (!match) return () => new Date();
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : HERO_EVENING;
  const start = new Date(`${day}T${match[1]!.padStart(2, "0")}:${match[2]}:00`);
  const loadedAt = Date.now();
  return () => new Date(start.getTime() + (Date.now() - loadedAt));
}
