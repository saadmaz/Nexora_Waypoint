import type { Brand, DepotId, DockType, Temperature, Vehicle } from "../../domain/field";
import type { DeferralType } from "../../domain/status";

/** What a vehicle card on L1 shows (field conventions section 9, L1.1 to L1.6). */
export type VehicleLoadStatus = "to_load" | "loading" | "loaded" | "held" | "replaced";

export type DockVehicleSummary = {
  vehicle: Vehicle;
  trips: number;
  orderCount: number;
  /** The trip a tap on this card opens: the first trip that is not yet loaded. */
  activeTrip: 1 | 2;
  /** Departure of the active trip. */
  departsAt: string;
  status: VehicleLoadStatus;
  checked?: { done: number; total: number };
  /** Set once a newer version exists than the dock's acknowledgement, for L1.5 and L1.6's tags. */
  changeTag?: "Changed" | "No change";
  heldReason?: string;
};

export type DockAcknowledgement = { version: number; personId: string; personName: string; at: string };

export type DockView = {
  dockId: DepotId;
  planVersion: number;
  planReleasedAt: string;
  vehicleCount: number;
  orderCount: number;
  firstDeparture: string;
  acknowledgement?: DockAcknowledgement;
  /** A version newer than `acknowledgement.version` has been released. */
  newerVersionExists: boolean;
  vehicles: DockVehicleSummary[];
};

export type LoadCheckState = "todo" | "checked" | "short";

export type LoadPlanOrderRow = {
  orderId: string;
  outletId: string;
  /** 1-based reverse-stop load position: "Load 1st" is the last stop on the trip. */
  loadNumber: number;
  stopNumber: number;
  brand: Brand;
  temperature: Temperature;
  dock: DockType;
  unitsExpected: number;
  unitsLoaded: number;
  state: LoadCheckState;
};

export type LoadPlanView = {
  vehicle: Vehicle;
  trip: 1 | 2;
  departsAt: string;
  planVersion: number;
  status: VehicleLoadStatus;
  heldReason?: string;
  /** Already in reverse stop order: load 1st is first in this array. */
  orders: LoadPlanOrderRow[];
  confirmedAt?: string;
  confirmedBy?: string;
};

export const EXCEPTION_TYPES = [
  "Missing item",
  "Damaged item",
  "Wrong item",
  "Warehouse shortage",
  "Vehicle check failed",
  "Other",
] as const;
export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

export type ExceptionStatus = "reviewing" | "decided";

export type ExceptionView = {
  id: string;
  type: ExceptionType;
  vehicleId: string;
  trip: 1 | 2;
  orderIds: string[];
  unitsShort?: number;
  note?: string;
  status: ExceptionStatus;
  decidedVersion?: number;
  decidedBy?: string;
  decidedAt?: string;
};

export type PlanDiffRemoved = { orderId: string; outletId: string; deferralType: DeferralType; nextRunShort: string };
export type PlanDiffChanged = { fromVehicleId: string; toVehicleId: string; vehicleLabel: string; trips: string };

export type PlanDiffView = {
  from: number;
  to: number;
  removed: PlanDiffRemoved[];
  changed: PlanDiffChanged[];
  /** Vehicles on this dock with no change at all: "VEH035, VEH011: no change" (L4.3). */
  noChangeVehicleIds: string[];
  newTotals?: { weightKg: number; weightCapKg: number; volumeM3: number; volumeCapM3: number };
};
