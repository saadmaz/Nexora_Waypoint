import type { DeferralType, OrderStatus } from "./status";

/**
 * Shared domain types of the field roles, Loader and Driver (field conventions sections 7 and 9,
 * PRD v3 sections 4b and 4c). They sit beside the Store's types in `domain/` and reuse its
 * `OrderStatus` and `DeferralType`, so the 11 statuses and 3 deferral types stay one vocabulary.
 *
 * The Store's `Order` is one chilled or dry line of a store's order. The field roles work with
 * `PlannedOrder`: an order as it sits on a trip, with the weights the load plan needs. IDs match
 * everywhere: ORD2001, OUT084, VEH039.
 *
 * Times: `HH:MM` strings are wall-clock times in Asia/Colombo on the operating day; `releasedAt`
 * and other instants are ISO 8601 with the +05:30 offset.
 */

export type DepotId = "peliyagoda" | "kandy";

export type Depot = {
  id: DepotId;
  /** "Peliyagoda", "Kandy". */
  name: string;
};

export type Temperature = "chilled" | "ambient";

/** The three brands, one per trip (PRD v3 section 4a, R-BRAND). */
export type Brand = "Fresh" | "Style" | "Tech";

export type DockType = "rear_dock" | "street" | "mall_bay";

/** Vehicle tags (PRD v3 section 4b). The loader sets Held; Dispatch sets Replaced. */
export type VehicleTag = "Available" | "In workshop" | "Held" | "Replaced";

export type Vehicle = {
  id: string;
  depot: DepotId;
  kind: "truck" | "van";
  temperature: "reefer" | "ambient";
  weightCapKg: number;
  volumeCapM3: number;
  kmPerL: number;
  tags: VehicleTag[];
};

/** Planning and execution tags that appear on an order (PRD v3 section 4b). Never statuses. */
export type OrderTag =
  | "Chilled"
  | "Ambient"
  | "Carry-over"
  | "Protected"
  | "After cutoff"
  | "No legal vehicle"
  | "At risk"
  | "Waiting"
  | "Late"
  | "Deferral withdrawn"
  | "Receipt confirmed"
  | "Follow-up created";

/** The issue tag a driver outcome carries with status Issue (field conventions section 7). */
export type IssueTag = "Missing" | "Short" | "Damaged" | "Wrong item" | "Refused" | "Store closed" | "Late" | "Arrived warm" | "Other";

/** The five outcomes a driver can record. Partial is not one of them. */
export type DriverOutcome = "Delivered" | "Damaged" | "Refused" | "Store closed" | "Other";

export type PlannedOrder = {
  id: string;
  outletId: string;
  units: number;
  weightKg: number;
  volumeM3: number;
  temperature: Temperature;
  status: OrderStatus;
  tags: OrderTag[];
  deferral?: { type: DeferralType; nextRun?: string };
};

export type Stop = {
  /** 1-based position on the trip. */
  number: number;
  outletId: string;
  /** "Waypoint Fresh". */
  outletName: string;
  brand: Brand;
  district: string;
  dock: DockType;
  /** Delivery window, "HH:MM". */
  window: { open: string; close: string };
  /** Planned arrival, "HH:MM". */
  plannedArrival: string;
  orders: PlannedOrder[];
};

export type Trip = {
  vehicleId: string;
  /** Trip 1 or 2 (R-TRIPS: at most two per vehicle per day). */
  tripNo: 1 | 2;
  /** "HH:MM". */
  departsAt: string;
  stops: Stop[];
};

export type PlanVersion = {
  /** 3 for plan v3. */
  v: number;
  /** ISO 8601 with the +05:30 offset. */
  releasedAt: string;
  /** One line of what changed, for example "VEH003 → VEH036; ORD1002 deferred (policy)". */
  note: string;
};

export type PersonRole = "loader" | "driver";

export type Person = {
  id: string;
  name: string;
  role: PersonRole;
  /** The dock a loader works at. */
  dock?: DepotId;
};
