import type { DepotId, ForecastView } from "../../../api/DispatcherApi";

/**
 * D9: the baseline forecast (PRD v3 section 12 "D9 baseline", A15). Reefer demand minutes per ISO week
 * against usable capacity. The Datathon Task 2A model is not wired in, and the screen says so.
 */
export function forecastView(depot: DepotId): ForecastView {
  return {
    asOf: "Mon 28 Sep",
    depot,
    label: "Baseline forecast: Datathon Task 2A model not wired in",
    weeks: [
      { monday: "Mon 5 Oct", percent: 104, status: "Short", flags: ["Payday"], lever: "Move workshop slots · pre-warn stores" },
      { monday: "Mon 12 Oct", percent: 97, status: "Tight", flags: [], lever: "Watch" },
      {
        monday: "Mon 19 Oct",
        percent: 126,
        status: "Short",
        flags: ["Festival ramp", "Payday"],
        lever: "Move workshop slots · pre-warn stores",
        gap: { minutes: 560 },
        levers: ["Move 2 workshop slots out of this week", "Pre-warn Fresh stores of likely deferrals"],
        days: [
          { day: "Mon" },
          { day: "Tue" },
          { day: "Wed" },
          { day: "Thu", flag: "ramp" },
          { day: "Fri", flag: "payday" },
          { day: "Sat" },
          { day: "Sun" },
        ],
      },
      { monday: "Mon 26 Oct", percent: 99, status: "Tight", flags: [], lever: "Watch" },
    ],
  };
}
