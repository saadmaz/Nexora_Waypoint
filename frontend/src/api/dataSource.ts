/**
 * Where the app's data comes from, set by one env property: `VITE_DATA_SOURCE=live|mock`.
 *
 * - `live`: every role reads and writes the database through the API.
 * - `mock`, unset or anything else: every role runs on the in-browser mocks. Mock is the fallback.
 *
 * `VITE_<ROLE>_API=mock|api` (and `VITE_AUTH_API`) still override one role when set, for working on one role against the
 * API while the rest stay on mocks (PRD v3 section 9 principle 7).
 *
 * `main.tsx` installs the mocks only when this file's rules can pick one. It spells the test out with `import.meta.env`, which
 * Vite replaces at build time, so a live build with no per-role mock override drops the mocks, their fixtures and their
 * persona names from the bundle (`npm run check:bundle`, DP-26). Keep the two in step.
 */
export type DataSource = "live" | "mock";
export type ApiMode = "mock" | "api";

export const DATA_SOURCE: DataSource = import.meta.env.VITE_DATA_SOURCE === "live" ? "live" : "mock";

/** A per-role override when it is set to a known value, otherwise the data source. */
export function modeFor(override: string | undefined): ApiMode {
  if (override === "api" || override === "mock") return override;
  return DATA_SOURCE === "live" ? "api" : "mock";
}
