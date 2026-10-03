import type { RunDistance } from "../types";

/**
 * R9: the distance a run is closed with (PRD v3 section 15 GPS, A24, DP-14). The scenario uses the hero run's tracked legs;
 * with no tracked legs (permission refused, or no fixes) the planned distance stands in. Fuel is distance over the vehicle's
 * km per litre, to one decimal (19.4 km at 5.0 km/l is 3.9 L).
 */
export function runDistance(input: { trackedLegsKm: readonly number[] | null; plannedKm: number; kmPerL: number; gapFilledKm?: number }): RunDistance {
  const tracked = input.trackedLegsKm && input.trackedLegsKm.length > 0 ? [...input.trackedLegsKm] : null;
  const legsKm = tracked ?? [input.plannedKm];
  const totalKm = round1(legsKm.reduce((sum, km) => sum + km, 0));
  return {
    source: tracked ? "gps" : "planned",
    legsKm,
    totalKm,
    gapFilledKm: tracked ? round1(input.gapFilledKm ?? 0) : totalKm,
    plannedKm: input.plannedKm,
    kmPerL: input.kmPerL,
    fuelL: input.kmPerL > 0 ? round1(totalKm / input.kmPerL) : 0,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
