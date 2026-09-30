/** The hero evening: Mon 28 Sep 2026 (PRD v2.1 H1). The scenario clock counts from a time on this date. */
const HERO_EVENING = { year: 2026, month: 8, day: 28 };

/**
 * A clock that starts at `at` ("HH:MM") on the hero evening and keeps ticking
 * from there, so the 16:00 cutoff countdown moves. Without a valid `at` it is
 * real time. Interim: phase 7 owns the scenario clock and will replace this.
 */
export function scenarioNow(at: string | null): () => Date {
  const match = at ? /^(\d{1,2}):(\d{2})$/.exec(at) : null;
  if (!match) return () => new Date();
  const start = new Date(HERO_EVENING.year, HERO_EVENING.month, HERO_EVENING.day, Number(match[1]), Number(match[2]));
  const loadedAt = Date.now();
  return () => new Date(start.getTime() + (Date.now() - loadedAt));
}
