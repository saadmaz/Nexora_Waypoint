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
  /** True once edits are no longer allowed (cutoff has passed for this order's date). */
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
