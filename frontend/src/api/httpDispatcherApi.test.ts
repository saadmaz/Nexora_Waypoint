import { describe, expect, it } from "vitest";
import type { Role } from "../domain/status";
import { ApiError, NetworkError, NO_FILTERS, type DispatcherApi } from "./DispatcherApi";
import { compact, moveTargetFromApi, moveTargetToApi, numericId, queueQuery, resolutionFromApi, statusToApi } from "./dispatcherMappers";
import { createDispatcherDemo, createHttpDispatcherApi, fromServerTime, toDispatcherError, toServerTime } from "./httpDispatcherApi";
import { createHttpClient, type TokenSource } from "./http/client";
import { ApiError as HttpApiError, NetworkUnavailableError, NotImplementedApiError } from "./http/errors";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function errorReply(status: number, code: string, message: string, details: unknown = null): Response {
  return json({ code, message, details }, status);
}

function harness(...replies: Response[]) {
  const calls: Call[] = [];
  let index = 0;
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: String(init?.method), headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined });
    return replies[Math.min(index++, replies.length - 1)]!.clone();
  }) as typeof fetch;
  const expired: Role[] = [];
  const tokens: TokenSource = { get: (role) => (role === "dispatcher" ? "tok-dispatcher" : null), onUnauthorized: (role) => void expired.push(role) };
  const makeClient = () => createHttpClient({ baseUrl: "http://api.test", role: "dispatcher", tokens, fetchImpl: impl });
  const connection: boolean[] = [];
  const api: DispatcherApi = createHttpDispatcherApi(makeClient, { onConnection: (online) => void connection.push(online) });
  return { api, calls, expired, connection, demo: createDispatcherDemo(makeClient) };
}

const url = (call: Call) => new URL(call.url);
const path = (call: Call) => url(call).pathname;
const params = (call: Call) => url(call).searchParams;

const wireOrder = { id: "ORD2001", outletId: "OUT084", brand: "Fresh", district: "Kandy", temp: "chilled", access: ["Rear dock"], window: { start: "05:30", end: "08:00" }, mallWindow: false, units: 12, kg: 100, m3: 1.2, status: "ordered", tags: [], receivedAt: "13:41", note: null, daysSinceServed: null, justIn: null };

describe("every operation, on the wire", () => {
  it("getQueue sends repeated filter params and converts the status", async () => {
    const { api, calls } = harness(
      json({
        depot: "kandy", serviceDate: "2026-09-29", cutoff: { closed: false, at: "16:00", minutesLeft: 30 }, counts: { peliyagoda: 3, kandy: 1 }, carryOvers: 0, atRisk: 0,
        groups: [{ key: "other", title: "Other orders", kind: "other", outlet: null, orders: [wireOrder] }], shown: 1, total: 1, matching: null, hiddenCarryOvers: 0, lastReceived: null,
      }),
    );
    const view = await api.getQueue({
      depot: "kandy",
      date: "2026-09-29",
      search: " OUT084 ",
      filters: { brand: ["Fresh", "Style"], temp: ["chilled"], status: ["Ordered", "Pending sync"], window: ["early", "late"], tags: ["Van only"], district: ["Kandy"] },
    });
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/queue");
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.headers.Authorization).toBe("Bearer tok-dispatcher");
    const p = params(calls[0]!);
    expect(p.get("depot")).toBe("kandy");
    expect(p.get("date")).toBe("2026-09-29");
    expect(p.getAll("brand")).toEqual(["Fresh", "Style"]);
    expect(p.getAll("temp")).toEqual(["chilled"]);
    expect(p.getAll("status")).toEqual(["ordered", "pending_sync"]);
    expect(p.getAll("window")).toEqual(["early", "late"]);
    expect(p.getAll("tags")).toEqual(["Van only"]);
    expect(p.getAll("district")).toEqual(["Kandy"]);
    expect(p.get("search")).toBe("OUT084");
    expect(view.groups[0]!.orders[0]!.status).toBe("Ordered");
    // Nulls on optional fields are absent, because the screens test `!== undefined`.
    expect("note" in view.groups[0]!.orders[0]!).toBe(false);
    expect(view.groups[0]!.orders[0]!.daysSinceServed).toBeUndefined();
    expect(view.matching).toBeUndefined();
    expect(view.groups[0]!.outlet).toBeUndefined();
  });

  it("getQueue with no filters sends only the depot", async () => {
    const { calls, api } = harness(json({ groups: [] }));
    await api.getQueue({ depot: "peliyagoda", filters: NO_FILTERS, search: "  " });
    expect(url(calls[0]!).search).toBe("?depot=peliyagoda");
  });

  it("getOrderHistory converts the order status and keeps the journey step as sent", async () => {
    const { api, calls } = harness(json({ order: { ...wireOrder, status: "delivered" }, outletName: "Waypoint Fresh", summary: "", continuity: { protected: false, text: "" }, lastRuns: [], journey: [{ step: "Receipt confirmed", by: null, state: "pending" }], notes: [] }));
    const view = await api.getOrderHistory("ORD 2001/x");
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/orders/ORD%202001%2Fx/history");
    expect(view.order.status).toBe("Delivered");
    expect(view.journey[0]).toEqual({ step: "Receipt confirmed", state: "pending" });
  });

  it("getCapacity keeps the null a screen reads (no plan yet, no binding) and drops the optional ones", async () => {
    const { api, calls } = harness(json({ depot: "peliyagoda", plan: null, binding: null, spare: null, fleet: null, lane: null, released: null, freshUse: null, orders: 4 }));
    const view = await api.getCapacity({ depot: "peliyagoda" });
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/capacity");
    expect(params(calls[0]!).get("depot")).toBe("peliyagoda");
    expect(view.plan).toBeNull();
    expect(view.binding).toBeNull();
    expect("spare" in view).toBe(false);
    expect("freshUse" in view).toBe(false);
  });

  it("getCapacity compacts the plan reference once there is a draft", async () => {
    const { api } = harness(json({ plan: { number: 3, state: "draft", at: "Mon 16:05", releasedAt: null }, binding: null }));
    const view = await api.getCapacity({ depot: "kandy" });
    expect(view.plan).toEqual({ number: 3, state: "draft", at: "Mon 16:05" });
  });

  it("getPlan converts each deferral kind and keeps a null capacity (a van with no limit)", async () => {
    const { api, calls } = harness(
      json({
        depot: "kandy", version: { number: 4, state: "draft", at: "Tue 03:02", note: "", scope: null, current: true }, versions: [], readOnly: false,
        lanes: [{ vehicleId: "VEH003", kind: "reefer", reefer: true, status: "active", workshopUntil: null, meters: [], trips: [{ vehicleId: "VEH003", trip: 1, departs: "03:30", brand: "Fresh", district: "Colombo", stops: [{ orderId: "ORD2001", orderIds: ["ORD2001"], outletId: "OUT084", seq: 1, arrival: "03:54", note: null, protected: false, kg: 1, m3: 1 }], kg: 1, kgCap: null, m3: 1, m3Cap: 5, minutes: 40, fill: { kg: 0, m3: 0, minutes: 0 } }] }],
        deferred: [{ orderId: "ORD1020", outletId: "OUT009", brand: "Fresh", temp: "chilled", kind: "store_request", binding: "window", nextRun: "Wed", kg: 1, m3: 1, window: { start: "05:00", end: "06:00" }, dock: "Rear", district: "Kandy" }],
        deferredTotal: 1, summary: {}, checks: [], readyToRelease: false,
      }),
    );
    const view = await api.getPlan({ depot: "kandy", version: 4 });
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/plan");
    expect(params(calls[0]!).get("version")).toBe("4");
    expect(view.deferred[0]!.kind).toBe("store request");
    expect(view.lanes[0]!.trips[0]!.kgCap).toBeNull();
    expect(view.lanes[0]!.trips[0]!.m3Cap).toBe(5);
    expect(view.lanes[0]!.workshopUntil).toBeUndefined();
    expect(view.version.scope).toBeUndefined();
  });

  it("getPlan leaves version off when none is asked for", async () => {
    const { api, calls } = harness(json({ deferred: [] }));
    await api.getPlan({ depot: "peliyagoda" });
    expect(url(calls[0]!).search).toBe("?depot=peliyagoda");
  });

  it("redraftPlan, saveMoves and releasePlan pass the depot of the last getPlan, and the default before that", async () => {
    const { api, calls } = harness(json({ deferred: [] }));
    await api.redraftPlan();
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/plan/redraft");
    expect(calls[0]!.method).toBe("POST");
    expect(params(calls[0]!).get("depot")).toBe("peliyagoda");

    await api.getPlan({ depot: "kandy" });
    await api.releasePlan({ sendNotices: false });
    expect(path(calls[2]!)).toBe("/api/v1/dispatcher/plan/release");
    expect(params(calls[2]!).get("depot")).toBe("kandy");
    expect(calls[2]!.body).toEqual({ sendNotices: false });

    await api.saveMoves({ moves: [{ orderId: "ORD1", to: { vehicleId: "VEH1", trip: 2 } }, { orderId: "ORD2", to: "deferred" }], note: "Kumari" });
    expect(path(calls[3]!)).toBe("/api/v1/dispatcher/plan/moves");
    expect(params(calls[3]!).get("depot")).toBe("kandy");
    expect(calls[3]!.body).toEqual({
      moves: [
        { orderId: "ORD1", to: { vehicleId: "VEH1", trip: 2, deferred: false } },
        { orderId: "ORD2", to: { deferred: true } },
      ],
      note: "Kumari",
    });
  });

  it("saveMoves leaves the note off when there is none", async () => {
    const { api, calls } = harness(json({ deferred: [] }));
    await api.saveMoves({ moves: [{ orderId: "ORD1", to: "deferred" }] });
    expect(calls[0]!.body).toEqual({ moves: [{ orderId: "ORD1", to: { deferred: true } }] });
  });

  it("validateMove converts the target out and the result's target back, in both shapes", async () => {
    const { api, calls } = harness(
      json({ ok: false, orderId: "ORD1", to: { vehicleId: "VEH1", trip: 2, deferred: false }, violations: [{ rule: "window", text: "08:06" }], checks: [], preview: null, protectedReason: null, summary: "No" }),
      json({ ok: true, orderId: "ORD1", to: { vehicleId: null, trip: null, deferred: true }, violations: [], checks: [], preview: { headline: "h", rows: [{ label: "kg", text: "t", before: null, after: 5, limit: null, ok: true }], source: null, note: "", verdict: "" }, protectedReason: "Deferred yesterday", summary: "" }),
    );
    const refused = await api.validateMove({ orderId: "ORD1", to: { vehicleId: "VEH1", trip: 2 } });
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/plan/validate-move");
    expect(calls[0]!.body).toEqual({ orderId: "ORD1", to: { vehicleId: "VEH1", trip: 2, deferred: false } });
    expect(refused.to).toEqual({ vehicleId: "VEH1", trip: 2 });
    expect(refused.preview).toBeUndefined();
    expect(refused.protectedReason).toBeUndefined();

    const deferred = await api.validateMove({ orderId: "ORD1", to: "deferred" });
    expect(calls[1]!.body).toEqual({ orderId: "ORD1", to: { deferred: true } });
    expect(deferred.to).toBe("deferred");
    expect(deferred.protectedReason).toBe("Deferred yesterday");
    expect(deferred.preview!.rows[0]).toEqual({ label: "kg", text: "t", after: 5, ok: true });
    expect(deferred.preview!.source).toBeUndefined();
  });

  it("listDeferrals converts the kind on every card in all three lists", async () => {
    const card = (kind: string) => ({ orderId: "ORD1", outletId: "OUT1", outletName: "n", brand: "Fresh", temp: "chilled", access: [], kind, line: "", title: "", reason: { headline: "", detail: "" }, decidedBy: "", storeTold: { state: "not sent", at: null, note: null }, impact: "", frees: "", nextRun: "", binding: "", newInVersion: null, pairedOrderIds: null, footnote: null, detail: {} });
    const { api, calls } = harness(json({ depot: "kandy", capacity: [card("capacity")], policy: [card("policy")], storeRequest: [card("store_request")], side: null, policyMore: 0 }));
    const view = await api.listDeferrals({ depot: "kandy" });
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/deferrals");
    expect([view.capacity[0]!.kind, view.policy[0]!.kind, view.storeRequest[0]!.kind]).toEqual(["capacity", "policy", "store request"]);
    expect(view.capacity[0]!.newInVersion).toBeUndefined();
    expect(view.side).toBeUndefined();
    expect(view.capacity[0]!.storeTold).toEqual({ state: "not sent" });
  });

  it("notifyDeferrals posts the depot in the body and returns the count", async () => {
    const { api, calls } = harness(json({ sent: 19 }));
    expect(await api.notifyDeferrals({ depot: "kandy" })).toEqual({ sent: 19 });
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/deferrals/notify");
    expect(calls[0]!.body).toEqual({ depot: "kandy" });
  });

  it("notifyDeferrals with an orderId resends that one notice", async () => {
    const { api, calls } = harness(json({ sent: 1 }));
    expect(await api.notifyDeferrals({ depot: "peliyagoda", orderId: "ORD1020" })).toEqual({ sent: 1 });
    expect(calls[0]!.body).toEqual({ depot: "peliyagoda", orderId: "ORD1020" });
  });

  it("contact posts who to ask and returns who was asked", async () => {
    const { api, calls } = harness(json({ to: "dock", recipient: "Kandy dock", at: "2026-09-29T03:01:00+05:30" }));
    const out = await api.contact({ to: "dock", depot: "kandy", about: "plan v4" });
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/contact");
    expect(calls[0]!.body).toEqual({ to: "dock", depot: "kandy", about: "plan v4" });
    expect(out.recipient).toBe("Kandy dock");
  });

  it("listAcknowledgements sends the version only when asked, and keeps a null banner", async () => {
    const { api, calls } = harness(json({ version: 3, acknowledged: 1, total: 2, rows: [{ person: "A", role: "Loader", place: "p", has: 3, state: "pending", at: null, note: null, departsIn: "n/a" }], banner: null }));
    const view = await api.listAcknowledgements({});
    expect(url(calls[0]!).search).toBe("");
    expect(view.banner).toBeNull();
    expect(view.rows[0]!.at).toBeUndefined();
    await api.listAcknowledgements({ version: 4 });
    expect(params(calls[1]!).get("version")).toBe("4");
  });

  it("getLiveBoard sends depot (including both) and the all alias only when on", async () => {
    const { api, calls } = harness(json({ asOf: "05:00", date: "2026-09-29", plan: null, decisions: [{ id: "d", kind: "info", title: "", text: "", at: null, chip: null, action: null, infoOnly: true, countdown: null }], rows: [], depot: "both" }));
    const view = await api.getLiveBoard({ depot: "both" });
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/live");
    expect(url(calls[0]!).search).toBe("?depot=both");
    expect(view.plan).toBeUndefined();
    expect(view.decisions[0]).toEqual({ id: "d", kind: "info", title: "", text: "", infoOnly: true });
    await api.getLiveBoard({ depot: "kandy", all: true });
    expect(params(calls[1]!).get("all")).toBe("true");
    await api.getLiveBoard({ depot: "kandy", all: false });
    expect(params(calls[2]!).has("all")).toBe(false);
  });

  it("deferStop converts the kind and sends orderIds, kind and reason", async () => {
    const { api, calls } = harness(json({ plan: 5, deferred: ["ORD2001", "ORD2002"] }));
    const result = await api.deferStop({ orderIds: ["ORD2001", "ORD2002"], kind: "store request", reason: "Store asked" });
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/stops/defer");
    expect(calls[0]!.body).toEqual({ orderIds: ["ORD2001", "ORD2002"], kind: "store_request", reason: "Store asked" });
    expect(result).toEqual({ plan: 5, deferred: ["ORD2001", "ORD2002"] });
  });

  it("getInbox compacts the items", async () => {
    const { api, calls } = harness(json({ items: [{ id: "c1", kind: "conflict", title: "", text: "", at: null, chip: null, action: { label: "Open", to: "/dispatcher/conflict/7" }, infoOnly: null, countdown: null }] }));
    const view = await api.getInbox();
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/inbox");
    expect(view.items[0]).toEqual({ id: "c1", kind: "conflict", title: "", text: "", action: { label: "Open", to: "/dispatcher/conflict/7" } });
  });

  const wireConflict = (choice: string) => ({ id: "7", outletId: "OUT084", outletName: "n", district: "Kandy", orders: [], state: "needs decision", outcome: null, timeline: [], driverRecord: {}, dispatchRecord: {}, storeReport: null, asked: null, recommendation: { choice, title: "", reasons: [], outcome: "", chip: null, pausedNote: null }, resolved: null });

  it("the conflict operations send the id as a number and convert the recommendation", async () => {
    const { api, calls } = harness(json(wireConflict("keep_partial")), json(wireConflict("keep_delivery")), json(wireConflict("keep_delivery")));
    const view = await api.getConflict("7");
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/conflicts/7");
    expect(view.id).toBe("7");
    expect(view.recommendation.choice).toBe("keep as partial");
    expect(view.resolved).toBeUndefined();

    await api.askStore("7");
    expect(path(calls[1]!)).toBe("/api/v1/dispatcher/conflicts/7/ask-store");
    expect(calls[1]!.method).toBe("POST");

    await api.resolveConflict("7", "keep delivery");
    expect(path(calls[2]!)).toBe("/api/v1/dispatcher/conflicts/7/resolve");
    expect(calls[2]!.body).toEqual({ resolution: "keep_delivery" });
    await api.resolveConflict("7", "keep as partial");
    expect(calls[3]!.body).toEqual({ resolution: "keep_partial" });
  });

  it("a conflict recommendation the screens cannot draw is an unexpected reply, not a guess", async () => {
    const { api } = harness(json(wireConflict("keep_deferral")));
    await expect(api.getConflict("7")).rejects.toMatchObject({ name: "ApiError", code: "unexpected_reply" });
  });

  it("a non-numeric conflict or exception id never reaches the server", async () => {
    const { api, calls } = harness(json({}));
    await expect(api.getConflict("abc")).rejects.toMatchObject({ code: "unexpected_reply" });
    await expect(api.resolveConflict("", "keep delivery")).rejects.toMatchObject({ code: "unexpected_reply" });
    await expect(api.getExceptionForReview("1.5")).rejects.toMatchObject({ code: "unexpected_reply" });
    expect(calls).toHaveLength(0);
  });

  const wireException = {
    id: "3", state: "recommendation", title: "", flaggedBy: "", flaggedAt: "", reason: "", ordersText: "", minutesToDeparture: 20,
    failed: { vehicleId: "VEH003", spec: "", reason: "", tag: "Held" }, replacement: null, before: null,
    recommendation: { orderId: "ORD1002", orderIds: ["ORD1002", "ORD1010", "ORD1011", "ORD1012"], outletId: "OUT1", title: "", kind: "policy", typeNote: "", reason: "", decidedBy: "", impact: "", frees: "", nextRun: "", protected: [] },
    candidates: [], need: { kg: 1, m3: 1 }, after: null, confirmed: null,
  };

  it("the exception operations send the id as a number, convert the decision and the kind", async () => {
    const { api, calls } = harness(json(wireException), json({ ...wireException, state: "confirmed", recommendation: null }));
    const view = await api.getExceptionForReview("3");
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/exceptions/3");
    expect(view.recommendation!.kind).toBe("policy");
    expect(view.replacement).toBeUndefined();
    expect(view.confirmed).toBeUndefined();

    const decided = await api.decideException("3", { decision: "swap vehicle", deferOrderIds: ["ORD1002"] });
    expect(path(calls[1]!)).toBe("/api/v1/dispatcher/exceptions/3/decide");
    expect(calls[1]!.body).toEqual({ decision: "swap_vehicle", deferOrderIds: ["ORD1002"] });
    expect(decided.recommendation).toBeUndefined();
  });

  it("the whole recommended set reaches the decide request, not just the first order", async () => {
    const { api, calls } = harness(json(wireException), json({ ...wireException, state: "confirmed" }));
    const rec = (await api.getExceptionForReview("3")).recommendation!;
    expect(rec.orderId).toBe("ORD1002");
    expect(rec.orderIds).toEqual(["ORD1002", "ORD1010", "ORD1011", "ORD1012"]);

    // The confirm button sends rec.orderIds. A swap that is short by more than one order is refused if only one goes.
    await api.decideException("3", { decision: "swap vehicle", deferOrderIds: rec.orderIds });
    expect(calls[1]!.body).toEqual({ decision: "swap_vehicle", deferOrderIds: ["ORD1002", "ORD1010", "ORD1011", "ORD1012"] });
  });

  it("getForecast sends the depot and compacts the weeks", async () => {
    const { api, calls } = harness(json({ asOf: "Mon", depot: "kandy", label: "Baseline", weeks: [{ monday: "Mon 5 Oct", percent: 101, status: "Short", flags: [], lever: "", gap: null, days: null, levers: null }] }));
    const view = await api.getForecast({ depot: "kandy" });
    expect(path(calls[0]!)).toBe("/api/v1/dispatcher/forecast");
    expect(params(calls[0]!).get("depot")).toBe("kandy");
    expect(view.weeks[0]).toEqual({ monday: "Mon 5 Oct", percent: 101, status: "Short", flags: [], lever: "" });
  });
});

describe("errors", () => {
  it("a typed 501 is the dispatcher's ApiError with code not_implemented, and the call is made once with no fallback", async () => {
    const { api, calls } = harness(errorReply(501, "not_implemented", "getQueue is not built yet", { operation: "getQueue" }));
    const error = await api.getQueue({ depot: "peliyagoda" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "not_implemented", message: "getQueue is not built yet" });
    expect(calls).toHaveLength(1);
  });

  it("a network failure is the dispatcher's NetworkError and tells the provider the connection is down", async () => {
    const calls: string[] = [];
    const failing = createHttpClient({
      baseUrl: "http://api.test", role: "dispatcher", tokens: { get: () => "t", onUnauthorized: () => undefined },
      fetchImpl: (async (u: string | URL | Request) => { calls.push(String(u)); throw new TypeError("Failed to fetch"); }) as typeof fetch,
    });
    const connection: boolean[] = [];
    const api = createHttpDispatcherApi(() => failing, { onConnection: (online) => void connection.push(online) });
    await expect(api.getInbox()).rejects.toBeInstanceOf(NetworkError);
    expect(connection).toEqual([false]);
  });

  it("a server answer, even an error, reports the connection as up", async () => {
    const { api, connection } = harness(errorReply(501, "not_implemented", "x", { operation: "getInbox" }));
    await api.getInbox().catch(() => undefined);
    expect(connection).toEqual([true]);
  });

  it("a 401 clears the dispatcher session once and surfaces as an ApiError", async () => {
    const { api, expired } = harness(errorReply(401, "unauthenticated", "Sign in to continue"));
    await expect(api.getInbox()).rejects.toMatchObject({ code: "unauthenticated" });
    expect(expired).toEqual(["dispatcher"]);
  });

  it("a 403 keeps the server's code and message", async () => {
    const { api } = harness(errorReply(403, "forbidden", "Dispatcher only"));
    await expect(api.getInbox()).rejects.toMatchObject({ code: "forbidden", message: "Dispatcher only" });
  });

  it("maps 404 to not_found, as the conflict and exception screens expect", async () => {
    const { api } = harness(errorReply(404, "not_found", "Conflict 9 was not found."));
    await expect(api.getConflict("9")).rejects.toMatchObject({ code: "not_found", message: "Conflict 9 was not found." });
  });

  it("maps 409 on a plan edit to read_only and an illegal move on saveMoves to illegal_move", async () => {
    const { api } = harness(errorReply(409, "plan_released", "Plan v3 is released."));
    await expect(api.saveMoves({ moves: [{ orderId: "ORD1", to: "deferred" }] })).rejects.toMatchObject({ code: "read_only", message: "Plan v3 is released." });
    await expect(api.releasePlan({ sendNotices: true })).rejects.toMatchObject({ code: "read_only" });
    await expect(api.redraftPlan()).rejects.toMatchObject({ code: "read_only" });
  });

  it("maps illegal_transition on saveMoves to illegal_move, and leaves it alone elsewhere", () => {
    const refused = new HttpApiError(409, "illegal_transition", "Order ORD1 cannot move from loaded to planned");
    expect(toDispatcherError(refused, "saveMoves")).toMatchObject({ code: "illegal_move" });
    expect(toDispatcherError(refused, "resolveConflict")).toMatchObject({ code: "illegal_transition" });
  });

  it("any other failure keeps the server's own code, and a 502 body that is not the error shape is http_error", async () => {
    const { api } = harness(errorReply(422, "validation_error", "bad depot"), new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(api.getCapacity({ depot: "kandy" })).rejects.toMatchObject({ code: "validation_error" });
    await expect(api.getCapacity({ depot: "kandy" })).rejects.toMatchObject({ code: "http_error" });
  });

  it("toDispatcherError converts the three http errors and passes anything else through", () => {
    expect(toDispatcherError(new NetworkUnavailableError("timeout"), "getQueue")).toBeInstanceOf(NetworkError);
    expect(toDispatcherError(new NotImplementedApiError("m", { operation: "getPlan" }), "getPlan")).toMatchObject({ code: "not_implemented" });
    const other = new RangeError("boom");
    expect(toDispatcherError(other, "getPlan")).toBe(other);
  });
});

describe("conversions", () => {
  it("statusToApi inverts every status the screens know", () => {
    expect(statusToApi("Pending sync")).toBe("pending_sync");
    expect(statusToApi("Ordered")).toBe("ordered");
  });

  it("the move target round-trips", () => {
    expect(moveTargetFromApi(moveTargetToApi({ vehicleId: "VEH9", trip: 3 }))).toEqual({ vehicleId: "VEH9", trip: 3 });
    expect(moveTargetFromApi(moveTargetToApi("deferred"))).toBe("deferred");
    expect(() => moveTargetFromApi({ deferred: false })).toThrow(/move target/);
  });

  it("numericId accepts integers only", () => {
    expect(numericId("7", "conflict")).toBe(7);
    for (const bad of ["", " ", "x", "1.5", "NaN"]) expect(() => numericId(bad, "conflict")).toThrow();
  });

  it("resolutionFromApi refuses keep_deferral", () => {
    expect(resolutionFromApi("keep_delivery")).toBe("keep delivery");
    expect(() => resolutionFromApi("keep_deferral")).toThrow(/keep_deferral/);
  });

  it("queueQuery drops empty filters", () => {
    expect(queueQuery({ depot: "kandy", filters: NO_FILTERS })).toEqual({ depot: "kandy" });
  });

  it("compact drops nulls except the five fields that are null on purpose, at any depth", () => {
    expect(compact({ a: null, b: [{ c: null, kgCap: null, d: 1 }], banner: null, binding: null, m3Cap: null, e: { f: null } })).toEqual({
      b: [{ kgCap: null, d: 1 }],
      banner: null,
      binding: null,
      m3Cap: null,
      e: {},
    });
  });
});

describe("the scenario clock and the presenter control", () => {
  it("reads the server's time as the scenario wall clock", async () => {
    const { demo, calls } = harness(json({ now: "2026-09-28T15:30:00+05:30", checkpoint: "2026-09-28T15:30:00+05:30", serviceDate: "2026-09-29" }));
    const now = await demo.readClock();
    expect(path(calls[0]!)).toBe("/api/v1/clock");
    expect(now.getTime()).toBe(Date.parse("2026-09-28T15:30:00+05:30"));
  });

  it("advances by sending the instant and returns the new time", async () => {
    const { demo, calls } = harness(json({ now: "2026-09-29T03:02:00+05:30", checkpoint: "2026-09-28T15:30:00+05:30", serviceDate: "2026-09-29" }));
    const now = await demo.advance(new Date("2026-09-29T03:02:00+05:30"));
    expect(path(calls[0]!)).toBe("/api/v1/demo/advance");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.body).toEqual({ to: "2026-09-28T21:32:00.000Z" }); // the same moment, 03:02 in Colombo
    expect(now.getTime()).toBe(Date.parse("2026-09-29T03:02:00+05:30"));
  });

  it("a backwards advance is the server's 409 clock_backwards, as an ApiError", async () => {
    const { demo } = harness(errorReply(409, "clock_backwards", "The clock only moves forward. Use Reset demo to start again."));
    await expect(demo.advance(new Date("2026-09-28T09:00:00+05:30"))).rejects.toMatchObject({ name: "ApiError", code: "clock_backwards" });
  });

  it("reset returns the clock at the checkpoint", async () => {
    const { demo, calls } = harness(json({ clock: { now: "2026-09-28T15:30:00+05:30", checkpoint: "2026-09-28T15:30:00+05:30", serviceDate: "2026-09-29" }, seeded: true }));
    const now = await demo.reset();
    expect(path(calls[0]!)).toBe("/api/v1/demo/reset");
    expect(now.getTime()).toBe(Date.parse("2026-09-28T15:30:00+05:30"));
  });

  it("server time and wall-clock strings round-trip", () => {
    const date = fromServerTime("2026-09-29T07:31:00+05:30");
    expect(date.getTime()).toBe(Date.parse("2026-09-29T07:31:00+05:30"));
    expect(Date.parse(toServerTime(date))).toBe(date.getTime());
  });
});
