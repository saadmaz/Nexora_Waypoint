import type { StoreOutlet } from "../domain/outlet";

/** The outlet the mock store manager runs (PRD v3 section 4c): the design's cast, for development only. */
export const MOCK_OUTLET: StoreOutlet = {
  id: "OUT084",
  name: "Waypoint Fresh",
  brand: "Waypoint Fresh",
  district: "Kandy",
  dock: "Rear dock",
  window: { start: "05:30", end: "08:00" },
};
