import type { EditOrderInput, NewOrderInput, Order, RecentOrderDay } from "../domain/order";

export type Issue = {
  id: string;
  orderId: string;
  /** One of the fixed problem reasons from R6: road, breakdown, damaged goods, other. */
  reason: "road_blocked" | "breakdown" | "goods_damaged" | "other";
  note: string;
  reportedAt: string;
  resolved: boolean;
};

export type ConfirmReceiptInput = {
  orderId: string;
  /** True if the delivery matched in full; false records a shortfall. */
  received: boolean;
  shortfallUnits?: number;
};

/**
 * The store manager's view of the order/delivery workflow (PRD v2 S1 to S3).
 * One interface for both the mock (phase 3) and a future real client, so
 * screens never talk to fetch or the mock's fixture directly.
 */
export interface StoreApi {
  listOrders(outletId: string): Promise<Order[]>;
  getOrder(orderId: string): Promise<Order | undefined>;
  placeOrder(input: NewOrderInput): Promise<Order>;
  /** Places several orders together (chilled and dry): all are received or none is. */
  placeOrders(inputs: NewOrderInput[]): Promise<Order[]>;
  /** Edits quantities on an order. Rejects once the order is past cutoff. */
  editOrder(orderId: string, input: EditOrderInput): Promise<Order>;
  /** Cancels an order. Rejects once the order is past cutoff. */
  cancelOrder(orderId: string): Promise<void>;
  confirmReceipt(input: ConfirmReceiptInput): Promise<Order>;
  reportIssue(issue: Omit<Issue, "id" | "reportedAt" | "resolved">): Promise<Issue>;
  listIssues(outletId: string): Promise<Issue[]>;
  /**
   * Past delivery days for the outlet, newest first, Sundays skipped. Feeds S1.6's
   * "Recent orders" table and, later, S4's History tab.
   */
  listRecentOrders(outletId: string, limit?: number): Promise<RecentOrderDay[]>;
}

export class CutoffError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} is past the 16:00 cutoff and can no longer be edited or cancelled.`);
    this.name = "CutoffError";
  }
}

export class NotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} was not found.`);
    this.name = "NotFoundError";
  }
}
