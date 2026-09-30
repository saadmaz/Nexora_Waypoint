import type { OrderKind } from "./order";

/**
 * Estimated weight and volume per unit (PRD v2.1 section 4d, A14 and A36).
 * Stores order in units; kg and m3 are estimates that scale linearly with the
 * unit count. The ratios come from the hero orders: ORD2001 is 12 chilled units
 * at 70 kg / 0.7 m3, ORD2002 is 8 dry units at 45 kg / 0.6 m3. They reproduce
 * S1.3 B (10 chilled units is about 58 kg / 0.6 m3).
 */
const PER_UNIT: Record<OrderKind, { kg: number; m3: number }> = {
  chilled: { kg: 70 / 12, m3: 0.7 / 12 },
  dry: { kg: 45 / 8, m3: 0.6 / 8 },
};

/** The quantities S1.1 opens with: the hero orders (ORD2001 and ORD2002). */
export const DEFAULT_UNITS: Record<OrderKind, number> = { chilled: 12, dry: 8 };

export type Estimate = { kg: number; m3: number };

/** kg to the whole number, m3 to one decimal, the precision the frames show. */
export function estimateFor(kind: OrderKind, units: number): Estimate {
  const rate = PER_UNIT[kind];
  return {
    kg: Math.round(units * rate.kg),
    m3: Math.round(units * rate.m3 * 10) / 10,
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
