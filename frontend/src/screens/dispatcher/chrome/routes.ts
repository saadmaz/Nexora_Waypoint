import type { DepotId } from "../../../api/DispatcherApi";

/** The dispatcher's routes (PRD v3 section 15). */
export const ROUTES = {
  queue: "/dispatcher/queue",
  capacity: "/dispatcher/capacity",
  trips: "/dispatcher/trips",
  deferrals: "/dispatcher/deferrals",
  release: "/dispatcher/release",
  live: "/dispatcher/live",
  conflict: (id: string) => `/dispatcher/conflicts/${id}`,
  exception: (id: string) => `/dispatcher/exceptions/${id}`,
  forecast: "/dispatcher/forecast",
  gallery: "/dispatcher/_states",
} as const;

/** A link that keeps the depot switch (`?depot=kandy`); Peliyagoda is the default and stays out of the address. */
export function withDepot(path: string, depot: DepotId): string {
  if (depot === "peliyagoda") return path;
  return path.includes("?") ? `${path}&depot=${depot}` : `${path}?depot=${depot}`;
}

/** The planning stepper's five steps (PRD v3 section 3). */
export const STEPS = [
  { n: 1, label: "Queue", to: ROUTES.queue },
  { n: 2, label: "Capacity", to: ROUTES.capacity },
  { n: 3, label: "Trips", to: ROUTES.trips },
  { n: 4, label: "Deferrals", to: ROUTES.deferrals },
  { n: 5, label: "Release", to: ROUTES.release },
] as const;
