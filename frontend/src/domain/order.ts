import type { DeferralType, OrderStatus } from "./status";

export type OrderKind = "chilled" | "dry";

/**
 * A single line item on a store order (PRD v2 section 4c: chilled and dry are
 * placed and tracked as two separate orders against the same outlet and date).
 */
export type OrderLine = {
  id: string;
  kind: OrderKind;
  units: number;
  /** Estimated weight in kg for the current unit count. */
  estimatedKg: number;
  /** Estimated volume in m3 for the current unit count. */
  estimatedM3: number;
};

export type DeferralNotice = {
  type: DeferralType;
  /** Short reason shown on the deferral notice, e.g. "Store request: receiving staff unavailable." */
  reason: string;
  /** Who made the deferral decision, e.g. "Dispatch" or "You". */
  decidedBy: string;
  /** Short next-run label, e.g. "Wed 30 Sep". */
  nextRun?: string;
};

/**
 * A store order for one outlet, one delivery date and one line (chilled or dry).
 * Mirrors the 4c shared data reference columns for outlet orders.
 */
export type Order = {
  id: string;
  outletId: string;
  outletName: string;
  district: string;
  /** ISO date (YYYY-MM-DD) the order counts for, e.g. "2026-09-29". */
  deliveryDate: string;
  dock: string;
  /** Delivery window as "HH:MM to HH:MM", from the outlet's fixed window. */
  window: { start: string; end: string };
  line: OrderLine;
  status: OrderStatus;
  /** When the store submitted the order, ISO 8601 with offset or "Z". */
  receivedAt: string;
  /** When the store last edited the order, same format as receivedAt. Absent if never edited. */
  updatedAt?: string;
  /**
   * True when the order was placed after the cutoff for the day it would otherwise
   * have counted for, so it rolled to the following run and is tagged "After cutoff".
   */
  afterCutoff: boolean;
  /** Window-aware arrival range, only present once the plan is released (23:40 the day before). */
  arrival?: { start: string; end: string };
  deferral?: DeferralNotice;
};

export type NewOrderInput = {
  outletId: string;
  deliveryDate: string;
  line: Pick<OrderLine, "kind" | "units" | "estimatedKg" | "estimatedM3">;
};

export type EditOrderInput = {
  units: number;
  estimatedKg: number;
  estimatedM3: number;
};

/**
 * One past delivery day for the outlet: how many orders it had and how it ended.
 * Read by S1.6's "Recent orders" table now, and by S4's History tab later.
 * Sundays never appear (Waypoint operates Monday to Saturday).
 */
export type RecentOrderDay = {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  orderCount: number;
  status: OrderStatus;
  /** Present when status is Deferred. */
  deferral?: { type: DeferralType; nextRunShort?: string };
};

/** Estimated kg and m3 per unit, per order kind: how the store's unit counts become estimates (PRD v3 A14, A42). */
export type UnitFactors = Record<OrderKind, { kg: number; m3: number }>;

/**
 * What S1 needs to draw the order form for one day (PRD v3 StoreApi `getOrderDraft`):
 * the day, its window and dock, the unit factors, the quantities to start from, and
 * the orders already placed for that day.
 */
export type OrderDraft = {
  outletId: string;
  /** ISO date (YYYY-MM-DD) an order placed now counts for. */
  deliveryDate: string;
  /** True when an order placed now rolls to the following run (S1.4). */
  afterCutoff: boolean;
  window: { start: string; end: string };
  dock: string;
  unitFactors: UnitFactors;
  /** The quantities S1.1 opens with. */
  defaultUnits: Record<OrderKind, number>;
  /** Orders already placed for `deliveryDate`, chilled first. */
  orders: Order[];
};
