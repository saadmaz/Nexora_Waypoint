import { HERO_DATE } from "../../field/clock/clock";
import type { Person, Vehicle } from "../../domain/field";
import type { DriverStop, LoaderConfirmation } from "./types";

/**
 * The driver's seed data (field conventions section 9, PRD v3 section 4c and H1 to H16). Every
 * visible value is taken from the R1 to R3 Figma frames, cross-checked with the PRD. ORD2003's
 * weight and volume are not drawn anywhere (only its unit count is): estimated A-DR1, see the
 * README departures table.
 */

export const RUN_DATE = HERO_DATE;
export const RUN_NO = 1;

export const DRIVER: Person = { id: "nimal", name: "Nimal", role: "driver" };
export const DRIVER_ACTOR_ID = DRIVER.id;

/** PRD v3 section 4c vehicle table. */
export const VEHICLE: Vehicle = {
  id: "VEH039",
  depot: "kandy",
  kind: "truck",
  temperature: "reefer",
  weightCapKg: 6180,
  volumeCapM3: 29.9,
  kmPerL: 5.0,
  tags: ["Available"],
};

/** Mon 28 Sep 23:40 and Tue 29 Sep 03:00 (PRD H3, H5; field conventions section 9). */
export const PLAN_VERSIONS = [
  { v: 3, releasedAt: "2026-09-28T23:40:00+05:30", note: "First release." },
  { v: 4, releasedAt: "2026-09-29T03:00:00+05:30", note: "Route unchanged since v3." },
] as const;

/** PRD H6: Ruwan confirms VEH039 loaded at the Kandy gate, 04:50, no shortfall. */
export const LOADER_CONFIRMATION: LoaderConfirmation = { by: "Ruwan", at: "04:50", shortfalls: [] };

/** A loader shortfall on OUT087, for the R2.3 B state-gallery frame only: never reached on the hero run. */
export const GALLERY_SHORTFALL: LoaderConfirmation = {
  by: "Ruwan",
  at: "04:50",
  shortfalls: [{ orderId: "ORD2003", shortBy: 1 }],
};

/** Recent receiver names offered on the receiver-name screen (R3.3), per outlet. */
export const RECENT_RECEIVERS: Record<string, string[]> = {
  OUT084: ["S. Fernando", "Anusha"],
  OUT087: ["Anusha"],
};

export function baseStops(): DriverStop[] {
  return [
    {
      number: 1,
      outletId: "OUT084",
      outletName: "Waypoint Fresh",
      brand: "Fresh",
      district: "Kandy",
      dock: "rear_dock",
      window: { open: "05:30", close: "08:00" },
      plannedArrival: "05:26",
      parkingNote: "normal parking",
      unloadMinutes: 15,
      outcomes: {},
      orders: [
        {
          id: "ORD2001",
          outletId: "OUT084",
          units: 12,
          weightKg: 70,
          volumeM3: 0.7,
          temperature: "chilled",
          status: "Planned",
          tags: ["Chilled"],
        },
        {
          id: "ORD2002",
          outletId: "OUT084",
          units: 8,
          weightKg: 45,
          volumeM3: 0.6,
          temperature: "ambient",
          status: "Planned",
          tags: ["Ambient"],
        },
      ],
    },
    {
      number: 2,
      outletId: "OUT087",
      outletName: "Waypoint Fresh",
      brand: "Fresh",
      district: "Kandy",
      dock: "rear_dock",
      window: { open: "03:00", close: "08:00" },
      plannedArrival: "06:06",
      parkingNote: "normal parking",
      unloadMinutes: 15,
      outcomes: {},
      orders: [
        {
          id: "ORD2003",
          outletId: "OUT087",
          // Not drawn in any frame (only the unit count is); estimated from ORD2002's per-unit rate. A-DR1.
          units: 9,
          weightKg: 51,
          volumeM3: 0.68,
          temperature: "ambient",
          status: "Planned",
          tags: ["Ambient"],
        },
      ],
    },
  ];
}
