import type { DriverRun, FinishedRun, HistoryDay } from "../types";

/** "1 h 35 min" between two "HH:MM" times on the same day. */
export function durationBetween(start: string, end: string): string {
  const minutes = toMinutes(end) - toMinutes(start);
  if (minutes < 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * R7.1 today's row, from the run on the phone: started, stops with an outcome, and once finished the end, distance and time.
 * Before departure there is nothing to show yet, so today is left out.
 */
export function todayRow(run: DriverRun, finished: FinishedRun | null, synced: boolean): HistoryDay | null {
  if (!run.departedAt) return null;
  const stopsDone = run.stops.filter((stop) => stop.orders.every((order) => stop.outcomes[order.id])).length;
  return {
    date: run.date,
    label: "Today",
    run: {
      kind: "run",
      start: run.departedAt,
      end: finished?.at ?? null,
      km: finished?.distance.totalKm ?? null,
      duration: finished ? durationBetween(run.departedAt, finished.at) : null,
      stopsDone,
      stopsTotal: run.stops.length,
      synced,
    },
  };
}
