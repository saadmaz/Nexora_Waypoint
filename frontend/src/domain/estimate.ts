import type { OrderKind, UnitFactors } from "./order";

export type Estimate = { kg: number; m3: number };

/**
 * Estimated weight and volume for a unit count. Stores order in units; kg and m3 are
 * estimates that scale linearly with the count, using the per-unit factors the API
 * supplies (PRD v3 A14, A42). kg to the whole number, m3 to one decimal, the
 * precision the frames show.
 */
export function estimateFor(factors: UnitFactors, kind: OrderKind, units: number): Estimate {
  const factor = factors[kind];
  return {
    kg: Math.round(units * factor.kg),
    m3: Math.round(units * factor.m3 * 10) / 10,
  };
}

/** "≈ 70 kg · 0.7 m³" */
export function formatEstimate({ kg, m3 }: Estimate): string {
  return `≈ ${kg} kg · ${m3.toFixed(1)} m³`;
}

/** "12 units", "1 unit" */
export function unitsLabel(units: number): string {
  return `${units} ${units === 1 ? "unit" : "units"}`;
}
