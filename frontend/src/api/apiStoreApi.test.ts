import { describe, expect, it } from "vitest";
import type { Role } from "../domain/status";
import { createApiStoreApi } from "./apiStoreApi";
import { createHttpClient, type TokenSource } from "./http/client";
import { ApiError, NotImplementedApiError } from "./http/errors";
import { CutoffError, NotFoundError } from "./StoreApi";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stub(...replies: Response[]) {
  const calls: Call[] = [];
  let index = 0;
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: String(init?.method), headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined });
    return replies[Math.min(index++, replies.length - 1)].clone();
  }) as typeof fetch;
  const expired: Role[] = [];
  const tokens: TokenSource = { get: (role) => (role === "store" ? "tok-store" : null), onUnauthorized: (role) => void expired.push(role) };
  const api = createApiStoreApi(() => createHttpClient({ baseUrl: "http://api.test", role: "store", tokens, fetchImpl: impl }));
  return { api, calls, expired };
}

const orderOut = {
  id: "ORD2001",
  outletId: "OUT084",
  outletName: "Waypoint Fresh Kandy",
  district: "Kandy",
  deliveryDate: "2026-09-29",
  dock: "rear_dock",
  window: { start: "05:30", end: "08:00" },
  line: { id: "ORD2001-1", kind: "ambient", units: 8, estimatedKg: 96, estimatedM3: 0.8 },
  status: "deferred",
  receivedAt: "2026-09-28T15:40:00+05:30",
  updatedAt: null,
  afterCutoff: false,
  arrival: null,
  deferral: { type: "store_request", reason: "Receiving staff unavailable", decidedBy: "Kumari", nextRun: "Wed 30 Sep" },
};

const deliveryOut = {
  date: "2026-09-29",
  outletId: "OUT084",
  outletName: "Waypoint Fresh Kandy",
  district: "Kandy",
  window: { start: "05:30", end: "08:00" },
  dock: "rear_dock",
  vehicle: null,
  orders: [{ id: "ORD2001", kind: "chilled", units: 12, status: "delivered", issue: "Missing", received: null }],
  status: "delivered",
  journey: [
    { step: "Ordered", actor: "You", at: "15:40", state: "done" },
    { step: "Delivered", actor: "Driver", at: "05:40", state: "done" },
    { step: "Receipt confirmed", actor: "You", at: null, state: "current" },
  ],
  arrival: { from: "05:30", mayArriveAt: "05:26" },
  planPending: false,
  loaded: { place: "Kandy dock", at: "04:50" },
  onTheWay: null,
  lastUpdate: null,
  receiversCue: false,
  deferral: null,
  review: null,
  proof: { receivedBy: "Anusha", at: "05:40", driver: "Nimal", vehicle: "VEH039", units: [12] },
  tags: ["Receipt confirmed"],
  withdrawnNote: null,
  receiptConfirmedAt: "07:30",
  receiptBy: "Anusha",
  shortfallReason: null,
  issues: [],
  receivedAnswered: false,
};

describe("requests", () => {
  it("reads the order form for a day, as the store role", async () => {
    const { api, calls } = stub(
      json({
        outletId: "OUT084",
        deliveryDate: "2026-09-29",
        afterCutoff: false,
        window: { start: "05:30", end: "08:00" },
        dock: "rear_dock",
        unitFactors: { chilled: { kg: 12, m3: 0.1 }, ambient: { kg: 10, m3: 0.09 } },
        defaultUnits: { chilled: 12, ambient: 8 },
        orders: [orderOut],
      }),
    );

    const draft = await api.getOrderDraft("OUT084", "2026-09-29");

    expect(calls[0].url).toBe("http://api.test/api/v1/store/order-form?date=2026-09-29");
    expect(calls[0].headers.Authorization).toBe("Bearer tok-store");
    // The server's "ambient" is the store's "dry".
    expect(draft.unitFactors).toEqual({ chilled: { kg: 12, m3: 0.1 }, dry: { kg: 10, m3: 0.09 } });
    expect(draft.defaultUnits).toEqual({ chilled: 12, dry: 8 });
    expect(draft.orders[0].line.kind).toBe("dry");
  });

  it("places chilled and dry together, sending dry as ambient", async () => {
    const { api, calls } = stub(json([orderOut], 201));
    await api.placeOrders([
      { outletId: "OUT084", deliveryDate: "2026-09-29", line: { kind: "chilled", units: 12, estimatedKg: 144, estimatedM3: 1.2 } },
      { outletId: "OUT084", deliveryDate: "2026-09-29", line: { kind: "dry", units: 8, estimatedKg: 96, estimatedM3: 0.8 } },
    ]);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("http://api.test/api/v1/store/orders");
    expect((calls[0].body as { orders: { line: { kind: string } }[] }).orders.map((o) => o.line.kind)).toEqual(["chilled", "ambient"]);
  });

  it("sends receipt counts and the device time, and leaves out what was not given", async () => {
    const { api, calls } = stub(json(deliveryOut, 201));
    await api.confirmReceipt({ outletId: "OUT084", date: "2026-09-29", lines: [{ orderId: "ORD2001", received: 10 }], reason: "Two crates were damaged", deviceTime: "07:30" });
    await api.confirmReceipt({ outletId: "OUT084", date: "2026-09-29", lines: [{ orderId: "ORD2001", received: 12 }] });
    expect(calls[0].body).toEqual({ date: "2026-09-29", lines: [{ orderId: "ORD2001", received: 10 }], reason: "Two crates were damaged", deviceTime: "07:30" });
    expect(calls[1].body).toEqual({ date: "2026-09-29", lines: [{ orderId: "ORD2001", received: 12 }] });
  });

  it("does not send the outlet id: the server takes it from the token", async () => {
    const { api, calls } = stub(json([]));
    await api.listDeliveries("OUT084", "2026-09-29");
    expect(calls[0].url).toBe("http://api.test/api/v1/store/deliveries/2026-09-29");
    expect(calls[0].url).not.toContain("OUT084");
  });

  it("lists every delivery day when no date is given", async () => {
    const { api, calls } = stub(json([deliveryOut]));
    const days = await api.listDeliveries("OUT084");
    expect(calls[0].url).toBe("http://api.test/api/v1/store/deliveries");
    expect(days).toHaveLength(1);
  });

  it("asks for the history with a limit and a cut-off date", async () => {
    const { api, calls } = stub(json([{ date: "2026-09-26", orderCount: 2, status: "delivered", deliveredAt: "05:40", deferral: null }]));
    const days = await api.listRecent("OUT084", { limit: 3, before: "2026-09-28" });
    expect(calls[0].url).toBe("http://api.test/api/v1/store/history?limit=3&before=2026-09-28");
    expect(days[0]).toEqual({ date: "2026-09-26", orderCount: 2, status: "Delivered", deliveredAt: "05:40" });
  });

  it("marks everything read with no body and treats 204 as done", async () => {
    const { api, calls } = stub(new Response(null, { status: 204 }));
    await expect(api.markAllRead("OUT084")).resolves.toBeUndefined();
    expect(calls[0].url).toBe("http://api.test/api/v1/store/updates/read-all");
    expect(calls[0].method).toBe("POST");
  });
});

describe("mapping", () => {
  it("translates the wire vocabulary: status, deferral type and kind", async () => {
    const { api } = stub(json([orderOut], 201));
    const [order] = await api.placeOrders([{ outletId: "OUT084", deliveryDate: "2026-09-29", line: { kind: "dry", units: 8, estimatedKg: 96, estimatedM3: 0.8 } }]);
    expect(order.status).toBe("Deferred");
    expect(order.deferral).toEqual({ type: "store request", reason: "Receiving staff unavailable", decidedBy: "Kumari", nextRun: "Wed 30 Sep" });
    expect(order.updatedAt).toBeUndefined();
    expect(order.arrival).toBeUndefined();
  });

  it("maps a delivery, turning nulls into absent fields", async () => {
    const { api } = stub(json([deliveryOut]));
    const [delivery] = await api.listDeliveries("OUT084", "2026-09-29");
    expect(delivery.status).toBe("Delivered");
    expect(delivery.vehicle).toBeUndefined();
    expect(delivery.deferral).toBeUndefined();
    expect(delivery.orders[0]).toEqual({ id: "ORD2001", kind: "chilled", units: 12, status: "Delivered", issue: "Missing" });
    expect(delivery.arrival).toEqual({ from: "05:30", mayArriveAt: "05:26" });
    expect(delivery.loaded).toEqual({ place: "Kandy dock", at: "04:50" });
    expect(delivery.journey[2]).toEqual({ step: "Receipt confirmed", actor: "You", state: "current" });
    expect(delivery.tags).toEqual(["Receipt confirmed"]);
  });

  it("maps the updates feed and its link targets", async () => {
    const { api } = stub(
      json({
        unread: 1,
        updates: [
          { id: "u1", tag: "Review", date: "2026-09-29", time: "06:44", title: "Resolved", body: "Kept.", viewLabel: "View delivery", target: { screen: "delivery", date: "2026-09-29" }, unread: true, resolvedAt: "06:44" },
          { id: "u2", tag: "Order", date: "2026-09-28", time: "15:40", title: "Order received", body: "ORD2001", viewLabel: null, target: { screen: "orders" }, unread: false, resolvedAt: null },
        ],
      }),
    );
    const feed = await api.getUpdates("OUT084");
    expect(feed.unread).toBe(1);
    expect(feed.updates[0].target).toEqual({ screen: "delivery", date: "2026-09-29" });
    expect(feed.updates[1].target).toEqual({ screen: "orders" });
    expect(feed.updates[1].viewLabel).toBeUndefined();
  });

  it("fails as unexpected_reply when a value is outside the contract, instead of passing it to a screen", async () => {
    const { api } = stub(json([{ ...orderOut, status: "teleported" }], 201));
    const error = await api.placeOrders([{ outletId: "OUT084", deliveryDate: "2026-09-29", line: { kind: "dry", units: 8, estimatedKg: 96, estimatedM3: 0.8 } }]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("unexpected_reply");
  });

  it("fails as unexpected_reply when a loose dict is missing a key the screens need", async () => {
    const { api } = stub(json([{ ...deliveryOut, loaded: { place: "Kandy dock" } }]));
    const error = await api.listDeliveries("OUT084", "2026-09-29").catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("unexpected_reply");
  });
});

describe("errors", () => {
  const edit = { units: 10, estimatedKg: 120, estimatedM3: 1 };

  it("turns a 409 on an order edit or cancel into the cutoff error the screens catch", async () => {
    const refused = json({ code: "illegal_transition", message: "Past cutoff", details: null }, 409);
    const { api } = stub(refused);
    await expect(api.editOrder("ORD2001", edit)).rejects.toBeInstanceOf(CutoffError);
    await expect(api.cancelOrder("ORD2001")).rejects.toBeInstanceOf(CutoffError);
  });

  it("turns a 404 on an order into NotFoundError", async () => {
    const { api } = stub(json({ code: "not_found", message: "That order was not found", details: null }, 404));
    await expect(api.editOrder("ORD9999", edit)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lets every other failure through as the typed ApiError", async () => {
    const { api } = stub(json({ code: "validation_error", message: "The request is not valid", details: [] }, 422));
    const error = await api.editOrder("ORD2001", edit).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(CutoffError);
    expect((error as ApiError).status).toBe(422);
  });

  it("surfaces a 501 as a NotImplementedApiError with the operation, with no mock fallback", async () => {
    const { api, calls } = stub(json({ code: "not_implemented", message: "getUpdates is not built yet", details: { operation: "getUpdates" } }, 501));
    const error = await api.getUpdates("OUT084").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotImplementedApiError);
    expect((error as NotImplementedApiError).operation).toBe("getUpdates");
    expect(calls).toHaveLength(1);
  });

  it("clears the store session on a real 401 and nothing else", async () => {
    const { api, expired } = stub(json({ code: "unauthenticated", message: "Sign in to continue", details: null }, 401));
    await expect(api.listIssues("OUT084")).rejects.toBeInstanceOf(ApiError);
    expect(expired).toEqual(["store"]);
  });
});

describe("routes keyed by something other than the day", () => {
  const deferred = { ...deliveryOut, status: "deferred", deferral: { id: 31, type: "store_request", headline: "Deferred at your request", subline: null, explanation: null, reason: "r", decidedBy: "Kumari", decidedAt: "05:21", nextRunLabel: "New ETA", nextRun: "Wed 30 Sep", nextRunShort: "Wed", acknowledged: false } };

  it("finds the day's deferral and marks it seen", async () => {
    const { api, calls } = stub(json([deferred]), new Response(null, { status: 204 }));
    await api.acknowledgeDeferral({ outletId: "OUT084", date: "2026-09-29" });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["GET", "http://api.test/api/v1/store/deliveries/2026-09-29"],
      ["POST", "http://api.test/api/v1/store/deferrals/31/seen"],
    ]);
  });

  it("does nothing when the deferral is already gone", async () => {
    const { api, calls } = stub(json([deliveryOut]));
    await api.acknowledgeDeferral({ outletId: "OUT084", date: "2026-09-29" });
    expect(calls).toHaveLength(1);
  });

  it("answers the review by the conflict id the delivery carries", async () => {
    const reviewing = { ...deliveryOut, status: "conflict", review: { askedAt: "06:30", deliveredAt: "05:40", receivedBy: "Anusha", conflictId: "12" } };
    const { api, calls } = stub(json([reviewing]), new Response(null, { status: 204 }));
    await api.answerReceivedQuestion({ outletId: "OUT084", date: "2026-09-29", answer: "received" });
    expect(calls[1].url).toBe("http://api.test/api/v1/store/reviews/12/answer");
    expect(calls[1].body).toEqual({ answer: "received" });
  });

  it("says so, and sends nothing, when the delivery under review carries no conflict id", async () => {
    const reviewing = { ...deliveryOut, status: "conflict", review: { askedAt: "06:30", deliveredAt: "05:40", receivedBy: "Anusha" } };
    const { api, calls } = stub(json([reviewing]));
    const error = await api.answerReceivedQuestion({ outletId: "OUT084", date: "2026-09-29", answer: "received" }).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("unexpected_reply");
    expect(calls).toHaveLength(1);
  });
});
