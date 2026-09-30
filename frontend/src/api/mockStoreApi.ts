import type { EditOrderInput, NewOrderInput, Order } from "../domain/order";
import { isPastCutoff } from "../domain/schedule";
import {
  CutoffError,
  NotFoundError,
  type ConfirmReceiptInput,
  type Issue,
  type StoreApi,
} from "./StoreApi";

/**
 * The hero fixture (PRD v2 section 4c/H1): Anusha at OUT084, Waypoint Fresh
 * Kandy, orders ORD2001 (chilled, 12 units) and ORD2002 (dry, 8 units) for
 * Tue 29 Sep 2026, both received Mon 28 Sep 15:40, window 05:30 to 08:00.
 */
const HERO_OUTLET = { id: "OUT084", name: "Waypoint Fresh", district: "Kandy" };
const HERO_DELIVERY_DATE = "2026-09-29";
const HERO_RECEIVED_AT = "2026-09-28T15:40:00";

function heroFixture(): Order[] {
  return [
    {
      id: "ORD2001",
      outletId: HERO_OUTLET.id,
      outletName: HERO_OUTLET.name,
      district: HERO_OUTLET.district,
      deliveryDate: HERO_DELIVERY_DATE,
      dock: "rear_dock",
      window: { start: "05:30", end: "08:00" },
      line: { id: "ORD2001-L1", kind: "chilled", units: 12, estimatedKg: 70, estimatedM3: 0.7 },
      status: "Ordered",
      receivedAt: HERO_RECEIVED_AT,
      afterCutoff: false,
    },
    {
      id: "ORD2002",
      outletId: HERO_OUTLET.id,
      outletName: HERO_OUTLET.name,
      district: HERO_OUTLET.district,
      deliveryDate: HERO_DELIVERY_DATE,
      dock: "rear_dock",
      window: { start: "05:30", end: "08:00" },
      line: { id: "ORD2002-L1", kind: "dry", units: 8, estimatedKg: 45, estimatedM3: 0.6 },
      status: "Ordered",
      receivedAt: HERO_RECEIVED_AT,
      afterCutoff: false,
    },
  ];
}

let nextOrderSeq = 3;

/**
 * In-memory StoreApi mock, seeded with the hero fixture. Takes `now` as a
 * function rather than a fixed value so callers can advance or freeze time
 * without recreating the mock; the scenario clock (?at=HH:MM) will supply
 * that function from phase 7 onward. Defaults to real time.
 */
export function createMockStoreApi(now: () => Date = () => new Date()): StoreApi {
  const orders = new Map(heroFixture().map((order) => [order.id, order]));
  const issues = new Map<string, Issue>();

  function requireOrder(orderId: string): Order {
    const order = orders.get(orderId);
    if (!order) throw new NotFoundError(orderId);
    return order;
  }

  return {
    async listOrders(outletId) {
      return [...orders.values()]
        .filter((order) => order.outletId === outletId)
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    },

    async getOrder(orderId) {
      return orders.get(orderId);
    },

    async placeOrder(input: NewOrderInput) {
      const id = `ORD${9000 + nextOrderSeq++}`;
      const receivedAt = now().toISOString();
      const afterCutoff = isPastCutoff(input.deliveryDate, now());
      const order: Order = {
        id,
        outletId: input.outletId,
        outletName: HERO_OUTLET.name,
        district: HERO_OUTLET.district,
        deliveryDate: input.deliveryDate,
        dock: "rear_dock",
        window: { start: "05:30", end: "08:00" },
        line: { id: `${id}-L1`, ...input.line },
        status: "Ordered",
        receivedAt,
        afterCutoff,
      };
      orders.set(id, order);
      return order;
    },

    async editOrder(orderId, input: EditOrderInput) {
      const order = requireOrder(orderId);
      if (isPastCutoff(order.deliveryDate, now())) throw new CutoffError(orderId);
      const updated: Order = {
        ...order,
        line: { ...order.line, units: input.units, estimatedKg: input.estimatedKg, estimatedM3: input.estimatedM3 },
      };
      orders.set(orderId, updated);
      return updated;
    },

    async cancelOrder(orderId) {
      const order = requireOrder(orderId);
      if (isPastCutoff(order.deliveryDate, now())) throw new CutoffError(orderId);
      orders.delete(orderId);
    },

    async confirmReceipt(input: ConfirmReceiptInput) {
      const order = requireOrder(input.orderId);
      const updated: Order = {
        ...order,
        status: input.received ? "Delivered" : "Partial",
      };
      orders.set(input.orderId, updated);
      return updated;
    },

    async reportIssue(issue) {
      const id = `ISS${issues.size + 1}`;
      const record: Issue = { ...issue, id, reportedAt: now().toISOString(), resolved: false };
      issues.set(id, record);
      const order = orders.get(issue.orderId);
      if (order) orders.set(order.id, { ...order, status: "Issue" });
      return record;
    },

    async listIssues(outletId) {
      return [...issues.values()].filter((issue) => {
        const order = orders.get(issue.orderId);
        return order?.outletId === outletId;
      });
    },
  };
}
