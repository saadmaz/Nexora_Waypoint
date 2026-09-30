/**
 * The outlet Anusha manages (PRD v2.1 section 4c, ORD2001 and ORD2002): OUT084,
 * Waypoint Fresh, Kandy, rear dock, window 05:30 to 08:00.
 */
export const OUTLET = {
  id: "OUT084",
  brand: "Waypoint Fresh",
  district: "Kandy",
  dock: "Rear dock",
  window: { start: "05:30", end: "08:00" },
} as const;

/** "05:30–08:00" */
export const WINDOW_LABEL = `${OUTLET.window.start}–${OUTLET.window.end}`;
