import type {
  EditOrderInput,
  NewOrderInput,
  Order,
  OrderDraft,
  RecentOrderDay,
  UnitFactors,
} from "../domain/order";
import { isAfterCutoff, isPastCutoff, operatingDayFor } from "../domain/schedule";
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

/**
 * Recent delivery days for OUT084, as S1.6 lists them (Sunday 27 Sep is skipped: Waypoint
 * operates Monday to Saturday). Follows PRD v3 A35 and DP-05: Fri 25 Sep was deferred by
 * policy and Thu 24 Sep delivered. The Figma S1.6 frame draws these two the other way
 * round; the spec wins. Order counts are the frame's, moved with their rows.
 */
function recentFixture(): RecentOrderDay[] {
  return [
    { date: "2026-09-26", orderCount: 2, status: "Delivered" },
    { date: "2026-09-25", orderCount: 1, status: "Deferred", deferral: { type: "policy" } },
    { date: "2026-09-24", orderCount: 2, status: "Delivered" },
    { date: "2026-09-23", orderCount: 2, status: "Delivered" },
    { date: "2026-09-22", orderCount: 2, status: "Delivered" },
  ];
}

/**
 * Estimated kg and m3 per unit for OUT084 (PRD v3 A14, A42): the ORD2001 and ORD2002
 * figures spread evenly over their units, chilled 70 kg / 0.7 m3 per 12 units and dry
 * 45 kg / 0.6 m3 per 8. This reproduces S1.3 B (10 chilled units, about 58 kg / 0.6 m3).
 */
const UNIT_FACTORS: UnitFactors = {
  chilled: { kg: 70 / 12, m3: 0.7 / 12 },
  dry: { kg: 45 / 8, m3: 0.6 / 8 },
};

/** The quantities S1.1 opens with: the hero orders. */
const DEFAULT_UNITS = { chilled: 12, dry: 8 } as const;

/** The hero orders keep their fixture IDs when they are placed fresh (H1: ORD2001 chilled, ORD2002 dry). */
const HERO_IDS = { chilled: "ORD2001", dry: "ORD2002" } as const;

let nextOrderSeq = 3;

export type MockStoreApiOptions = {
  /**
   * "placed" (default): the hero orders already exist, received Mon 28 Sep 15:40.
   * "empty": nothing is placed yet, so S1.1 can be walked through from the start.
   */
  seed?: "placed" | "empty";
};

/**
 * In-memory StoreApi mock, seeded with the hero fixture. Takes `now` as a
 * function rather than a fixed value so callers can advance or freeze time
 * without recreating the mock; the scenario clock (?at=HH:MM) will supply
 * that function from phase 7 onward. Defaults to real time.
 */
export function createMockStoreApi(
  now: () => Date = () => new Date(),
  { seed = "placed" }: MockStoreApiOptions = {},
): StoreApi {
  const orders = new Map((seed === "placed" ? heroFixture() : []).map((order) => [order.id, order]));
  const issues = new Map<string, Issue>();

  function placeOne(input: NewOrderInput): Order {
    const heroId = HERO_IDS[input.line.kind];
    const id =
      input.outletId === HERO_OUTLET.id && !orders.has(heroId) ? heroId : `ORD${9000 + nextOrderSeq++}`;
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
      receivedAt: now().toISOString(),
      afterCutoff: isAfterCutoff(now()),
    };
    orders.set(id, order);
    return order;
  }

  function requireOrder(orderId: string): Order {
    const order = orders.get(orderId);
    if (!order) throw new NotFoundError(orderId);
    return order;
  }

  return {
    async getOrderDraft(outletId, date) {
      const deliveryDate = date ?? operatingDayFor(now());
      const draft: OrderDraft = {
        outletId,
        deliveryDate,
        afterCutoff: isAfterCutoff(now()),
        window: { start: "05:30", end: "08:00" },
        dock: "Rear dock",
        unitFactors: UNIT_FACTORS,
        defaultUnits: { ...DEFAULT_UNITS },
        orders: [...orders.values()]
          .filter((order) => order.outletId === outletId && order.deliveryDate === deliveryDate)
          .sort((a, b) => (a.line.kind === b.line.kind ? 0 : a.line.kind === "chilled" ? -1 : 1)),
      };
      return draft;
    },

    async placeOrders(inputs) {
      return inputs.map(placeOne);
    },

    async editOrder(orderId, input: EditOrderInput) {
      const order = requireOrder(orderId);
      if (isPastCutoff(order.deliveryDate, now())) throw new CutoffError(orderId);
      const updated: Order = {
        ...order,
        line: { ...order.line, units: input.units, estimatedKg: input.estimatedKg, estimatedM3: input.estimatedM3 },
        updatedAt: now().toISOString(),
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

    async listRecent(outletId, limit = 5) {
      if (outletId !== HERO_OUTLET.id) return [];
      return recentFixture()
        .filter((day) => new Date(`${day.date}T00:00:00`).getDay() !== 0)
        .slice(0, limit);
    },
  };
}
