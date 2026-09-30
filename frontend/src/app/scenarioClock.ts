/** The hero evening, Mon 28 Sep 2026, and the hero morning, Tue 29 Sep 2026 (PRD v3 section 2, H1 to H17). */
const HERO_EVENING = "2026-09-28";
const HERO_MORNING = "2026-09-29";

/** The run is over by 08:00: earlier than that is the hero morning, later is the evening before it. */
const MORNING_ENDS_HOUR = 8;

/**
 * The scenario clock, the only place the wall clock is read (PRD v3 section 13). Mock mode reads
 * `?at=HH:MM` and `?date=YYYY-MM-DD`: the clock starts there and keeps ticking, so the cutoff
 * countdown moves and every status follows. Without `?at=` it runs in real time.
 *
 * The hero timeline runs Mon 15:30 to Tue 07:35, so a bare time belongs to exactly one day:
 * before 08:00 is Tue 29 Sep, 08:00 and later is Mon 28 Sep. `?date=` overrides that.
 */
export function scenarioNow(at: string | null, date: string | null = null): () => Date {
  const match = at ? /^(\d{1,2}):(\d{2})$/.exec(at) : null;
  if (!match) return () => new Date();
  const hours = Number(match[1]);
  const day =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : hours < MORNING_ENDS_HOUR ? HERO_MORNING : HERO_EVENING;
  const start = new Date(`${day}T${String(hours).padStart(2, "0")}:${match[2]}:00`);
  const loadedAt = Date.now();
  return () => new Date(start.getTime() + (Date.now() - loadedAt));
}
