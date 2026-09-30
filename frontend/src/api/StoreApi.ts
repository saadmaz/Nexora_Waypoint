import type { Delivery } from "../domain/delivery";
import type { EditOrderInput, NewOrderInput, Order, OrderDraft, RecentOrderDay } from "../domain/order";

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
  /**
   * The order form for one day: window, dock, unit factors, starting quantities and the
   * orders already placed. `date` defaults to the day an order placed now counts for.
   */
  getOrderDraft(outletId: string, date?: string): Promise<OrderDraft>;
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
   * The outlet's delivery days (S2). With `date`, that day only (an empty list when the
   * outlet has no orders for it). Without it, every day from today on, earliest first.
   * Each day's status, arrival range and journey come from the order record and the clock,
   * never from a separate source (handoff 14).
   */
  listDeliveries(outletId: string, date?: string): Promise<Delivery[]>;
  /** The store tapped Got it on a deferral notice (S2.6, S2.9). Dispatch then sees it was read. */
  acknowledgeDeferral(input: { outletId: string; date: string }): Promise<void>;
  /**
   * The store's answer to "Did you receive this delivery?" while Dispatch is reviewing
   * (S2.7, S3.5). "received" settles the delivery for the store: Delivered, deferral withdrawn.
   */
  answerReceivedQuestion(input: { outletId: string; date: string; answer: "received" }): Promise<void>;
  /**
   * Past delivery days for the outlet, newest first, Sundays skipped. Feeds S1.6's
   * "Recent orders" table, S2.10's Recent list and S4's History tab. `before` keeps only
   * days earlier than that date; `limit` caps the count (default 5).
   */
  listRecent(outletId: string, options?: { limit?: number; before?: string }): Promise<RecentOrderDay[]>;
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
