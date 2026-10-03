import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createHttpClient, type TokenSource } from "../../../api/http/client";
import { ApiError, NotImplementedApiError } from "../../../api/http/errors";
import type { Role } from "../../../domain/status";
import { clearSyncHandlers, connectivity, createFetchTransport, createRoutingTransport, db, getRecord, mockTransport, NetworkError, runSync, setTimeSource, resetTimeSource, setTransport } from "../../../field/offline";
import { createApiDriverApi, registerApiDriverHandlers, NOTICES_REFRESH_MS, RUN_REFRESH_MS } from "./apiDriverApi";

const DATE = "2026-09-29";
let clock = Date.parse(`${DATE}T04:30:00+05:30`);
const now = () => clock;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type Route = (url: URL, init: RequestInit) => Response | Error;

/** A fetch answering by path, recording every call. */
function server(routes: Record<string, Route | Response | Error>) {
  const calls: { path: string; method: string; body: unknown }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ path: url.pathname, method: String(init?.method), body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined });
    const route = routes[url.pathname];
    if (!route) return json({ code: "not_found", message: "no route", details: null }, 404);
    const reply = typeof route === "function" ? route(url, init ?? {}) : route;
    if (reply instanceof Error) throw reply;
    return reply.clone();
  }) as typeof fetch;
  const expired: Role[] = [];
  const tokens: TokenSource = { get: (role) => (role === "driver" ? "tok-driver" : null), onUnauthorized: (role) => void expired.push(role) };
  const transport = createFetchTransport({ clientFor: (role) => createHttpClient({ baseUrl: "http://api.test", role, tokens, fetchImpl: impl }) });
  setTransport(createRoutingTransport({ real: transport, modeOf: () => "api" }));
  return { calls, expired, count: (path: string) => calls.filter((c) => c.path === path).length };
}

const run = (overrides: Record<string, unknown> = {}) => ({
  date: DATE,
  vehicleId: "VEH039",
  tripNo: 1,
  planVersion: 4,
  driver: "Nimal",
  departAt: `${DATE}T05:10:00+05:30`,
  plannedKm: 120,
  acknowledged: false,
  serverTime: `${DATE}T04:30:00+05:30`,
  stops: [
    { orderId: "ORD2002", outletId: "OUT084", outletName: "Waypoint Style Kandy", seq: 1, temp: "ambient", units: 8, window: { start: "05:30", end: "08:00" }, plannedArrival: `${DATE}T05:26:00+05:30`, status: "loaded", tags: ["Ambient", "Mystery tag"] },
    { orderId: "ORD2001", outletId: "OUT084", outletName: "Waypoint Style Kandy", seq: 1, temp: "chilled", units: 12, window: { start: "05:30", end: "08:00" }, plannedArrival: `${DATE}T05:26:00+05:30`, status: "loaded", tags: ["Chilled"] },
    { orderId: "ORD2010", outletId: "OUT090", outletName: "Waypoint Tech Matale", seq: 2, temp: "ambient", units: 5, window: { start: "07:00", end: "09:00" }, plannedArrival: `${DATE}T07:20:00+05:30`, status: "loaded", tags: [] },
  ],
  ...overrides,
});
const me = { id: 1, email: "driver@waypoint.demo", role: "driver", displayName: "Nimal", depot: "kandy", outletId: null, vehicleId: "VEH039" };

const okRoutes = () => ({ "/api/v1/driver/runs/2026-09-29": json(run()), "/api/v1/me": json(me), "/api/v1/driver/notices": json([]) });

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  connectivity.reset();
  clearSyncHandlers();
  clock = Date.parse(`${DATE}T04:30:00+05:30`);
  setTimeSource(now);
});

afterEach(() => {
  setTransport(mockTransport);
  resetTimeSource();
});

describe("getRun", () => {
  it("groups the server's orders by outlet and maps what the contract carries", async () => {
    server(okRoutes());
    const result = await createApiDriverApi(now).getRun(DATE);

    expect(result.runNo).toBe(1);
    expect(result.vehicle.id).toBe("VEH039");
    expect(result.depot).toBe("kandy");
    expect(result.currentVersion?.v).toBe(4);
    expect(result.stops.map((s) => [s.number, s.outletId, s.orders.map((o) => o.id)])).toEqual([
      [1, "OUT084", ["ORD2002", "ORD2001"]],
      [2, "OUT090", ["ORD2010"]],
    ]);
    const first = result.stops[0];
    expect(first.window).toEqual({ open: "05:30", close: "08:00" });
    expect(first.plannedArrival).toBe("05:26");
    expect(first.orders[1]).toMatchObject({ temperature: "chilled", status: "Loaded", units: 12 });
    // A tag the app has no name for is dropped, not shown.
    expect(first.orders[0].tags).toEqual(["Ambient"]);
  });

  it("reads brand from the outlet name, a reefer from a chilled order, and the load as confirmed once every order is loaded", async () => {
    server(okRoutes());
    const result = await createApiDriverApi(now).getRun(DATE);
    expect(result.stops.map((s) => s.brand)).toEqual(["Style", "Tech"]);
    expect(result.vehicle.temperature).toBe("reefer");
    expect(result.loaderConfirmation).not.toBeNull();
  });

  it("does not call the load confirmed while an order is still to load", async () => {
    const stops = run().stops.map((s, i) => (i === 2 ? { ...s, status: "planned" } : s));
    server({ ...okRoutes(), "/api/v1/driver/runs/2026-09-29": json(run({ stops })) });
    expect((await createApiDriverApi(now).getRun(DATE)).loaderConfirmation).toBeNull();
  });

  it("takes the plan the driver acknowledged from the phone, else from the server", async () => {
    server({ ...okRoutes(), "/api/v1/driver/runs/2026-09-29": json(run({ acknowledged: true })) });
    const api = createApiDriverApi(now);
    expect((await api.getRun(DATE)).acknowledgedVersion).toBe(4);
  });

  it("answers from the phone's copy within 30 s, and refreshes after", async () => {
    const s = server(okRoutes());
    const api = createApiDriverApi(now);
    await api.getRun(DATE);
    await api.getRun(DATE);
    expect(s.count("/api/v1/driver/runs/2026-09-29")).toBe(1);

    clock += RUN_REFRESH_MS + 1;
    await api.getRun(DATE);
    expect(s.count("/api/v1/driver/runs/2026-09-29")).toBe(2);
  });

  it("never throws offline once the route is on the phone", async () => {
    const s = server(okRoutes());
    const api = createApiDriverApi(now);
    await api.getRun(DATE);
    clock += RUN_REFRESH_MS + 1;
    await connectivity.setSimulatedOffline(true);
    const result = await api.getRun(DATE);
    expect(result.vehicle.id).toBe("VEH039");
    expect(s.count("/api/v1/driver/runs/2026-09-29")).toBe(1);
  });

  it("keeps the copy when a refresh cannot reach the server", async () => {
    let up = true;
    server({ ...okRoutes(), "/api/v1/driver/runs/2026-09-29": () => (up ? json(run()) : new TypeError("Failed to fetch")) });
    const api = createApiDriverApi(now);
    await api.getRun(DATE);
    up = false;
    clock += RUN_REFRESH_MS + 1;
    expect((await api.getRun(DATE)).vehicle.id).toBe("VEH039");
  });

  it("fails with a NetworkError when the route was never downloaded and there is no connection", async () => {
    server(okRoutes());
    await connectivity.setSimulatedOffline(true);
    await expect(createApiDriverApi(now).getRun(DATE)).rejects.toBeInstanceOf(NetworkError);
  });

  it("surfaces a 501 as the typed error, with no fixture to fall back to", async () => {
    server({ ...okRoutes(), "/api/v1/driver/runs/2026-09-29": json({ code: "not_implemented", message: "getRun is not built yet", details: { operation: "getRun" } }, 501) });
    const error = await createApiDriverApi(now).getRun(DATE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotImplementedApiError);
    expect((error as NotImplementedApiError).operation).toBe("getRun");
  });

  it("rejects a depot the app does not know", async () => {
    server({ ...okRoutes(), "/api/v1/me": json({ ...me, depot: "galle" }) });
    const error = await createApiDriverApi(now).getRun(DATE).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("unexpected_reply");
  });
});

describe("downloadRun", () => {
  it("keeps the package on the phone and records the version it holds", async () => {
    server(okRoutes());
    const api = createApiDriverApi(now);
    const progress: number[] = [];
    await api.downloadRun(DATE, 4, (done) => progress.push(done));
    expect(progress).toEqual([0, 2]);
    expect((await api.getRun(DATE)).downloadedVersion).toBe(4);
  });

  it("throws NetworkError offline, before asking the server", async () => {
    const s = server(okRoutes());
    await connectivity.setSimulatedOffline(true);
    await expect(createApiDriverApi(now).downloadRun(DATE, 4)).rejects.toBeInstanceOf(NetworkError);
    expect(s.calls).toHaveLength(0);
  });
});

describe("writes", () => {
  it("saves an arrival on the phone at once and queues it for /sync with its own clientId", async () => {
    server(okRoutes());
    const api = createApiDriverApi(now);
    await api.getRun(DATE);
    await connectivity.setSimulatedOffline(true);

    await api.recordArrival(DATE, "OUT084");

    expect((await api.getRun(DATE)).stops[0].arrivalAt).toBe("04:30");
    const [saved] = await db.outbox.toArray();
    expect(saved).toMatchObject({ type: "driver.arrival", status: "waiting", payload: { date: DATE, outletId: "OUT084", at: "04:30" } });
    expect(saved.clientId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sends the queued record to POST /sync when the device is back, once", async () => {
    const s = server({
      ...okRoutes(),
      "/api/v1/sync": (_url, init) => {
        const sent = JSON.parse(String(init.body)) as { records: { clientId: string }[] };
        return json({ results: sent.records.map((r) => ({ clientId: r.clientId, result: "accepted" })) });
      },
    });
    registerApiDriverHandlers(now);
    const api = createApiDriverApi(now);
    await connectivity.setSimulatedOffline(true);
    await api.recordArrival(DATE, "OUT084");

    await connectivity.setSimulatedOffline(false);
    const result = await runSync({ force: true });

    expect(result?.accepted).toBe(1);
    expect(s.count("/api/v1/sync")).toBe(1);
    const sent = s.calls.find((c) => c.path === "/api/v1/sync")?.body as { records: { type: string; clientId: string }[] };
    expect(sent.records[0].type).toBe("driver.arrival");
    expect((await getRecord(sent.records[0].clientId))?.status).toBe("accepted");
  });

  it("writes a conflict onto the stop when the server refuses an outcome, and tells the driver", async () => {
    server({
      ...okRoutes(),
      "/api/v1/sync": (_url, init) => {
        const sent = JSON.parse(String(init.body)) as { records: { clientId: string }[] };
        return json({ results: sent.records.map((r) => ({ clientId: r.clientId, result: "conflict", conflictId: 9, serverPayload: { serverVersion: 5, change: "Deferred · store request, 05:21, by Kumari", changedAt: "05:21", changedBy: "Kumari" } })) });
      },
    });
    registerApiDriverHandlers(now);
    const api = createApiDriverApi(now);
    await api.getRun(DATE);

    await api.recordOutcome(DATE, "OUT084", [{ orderId: "ORD2001", outcome: "Delivered", unitsDelivered: 12, receiverName: "Anusha" }]);
    await runSync({ force: true });

    const stop = (await api.getRun(DATE)).stops[0];
    expect(stop.conflict).toMatchObject({ conflictId: "9", serverVersion: 5, changedBy: "Kumari", changedAt: "05:21" });
    expect((await api.getNotices(DATE)).some((n) => n.kind === "sent_for_review")).toBe(true);
  });
});

describe("notices", () => {
  const notice = (id: number, tag: string, extra: Record<string, unknown> = {}) => ({ id, tag, title: `Notice ${id}`, body: "Body", createdAt: `${DATE}T04:50:00+05:30`, read: false, link: null, ...extra });

  it("maps the server's notices, drops a tag it has no screen for, and merges the phone's own", async () => {
    server({ ...okRoutes(), "/api/v1/driver/notices": json([notice(1, "orders_on_board"), notice(2, "something_new")]) });
    const api = createApiDriverApi(now);
    await api.noteWentOffline(DATE, 1);

    const notices = await api.getNotices(DATE);

    expect(notices.map((n) => [n.id, n.kind])).toEqual([
      ["server-1", "orders_on_board"],
      [expect.stringMatching(/^offline-/), "went_offline"],
    ]);
    expect(notices[0].at).toBe("04:50");
  });

  it("answers from the phone when the server cannot be reached or does not answer", async () => {
    server({ ...okRoutes(), "/api/v1/driver/notices": json({ code: "not_implemented", message: "x", details: { operation: "getNotices" } }, 501) });
    const api = createApiDriverApi(now);
    await api.noteWentOffline(DATE, 1);
    expect((await api.getNotices(DATE)).map((n) => n.kind)).toEqual(["went_offline"]);
  });

  it("asks the server again only after 15 s", async () => {
    const s = server({ ...okRoutes(), "/api/v1/driver/notices": json([notice(1, "plan_released")]) });
    const api = createApiDriverApi(now);
    await api.getNotices(DATE);
    await api.getNotices(DATE);
    expect(s.count("/api/v1/driver/notices")).toBe(1);
    clock += NOTICES_REFRESH_MS + 1;
    await api.getNotices(DATE);
    expect(s.count("/api/v1/driver/notices")).toBe(2);
  });

  it("keeps a server notice read once the driver has read it", async () => {
    server({ ...okRoutes(), "/api/v1/driver/notices": json([notice(1, "plan_released"), notice(2, "orders_on_board")]) });
    const api = createApiDriverApi(now);
    await api.getNotices(DATE);

    await api.markNoticesRead(DATE, ["server-1"]);
    expect(Object.fromEntries((await api.getNotices(DATE)).map((n) => [n.id, n.read]))).toEqual({ "server-1": true, "server-2": false });

    await api.markNoticesRead(DATE);
    expect((await api.getNotices(DATE)).every((n) => n.read)).toBe(true);
  });

  it("clears a conflict when Dispatch's resolved notice arrives", async () => {
    let resolved = false;
    server({
      ...okRoutes(),
      "/api/v1/driver/notices": () => json(resolved ? [notice(7, "resolved", { link: { outletId: "OUT084", decision: "keep_delivery", by: "Kumari" }, createdAt: `${DATE}T06:44:00+05:30` })] : []),
      "/api/v1/sync": (_url, init) => {
        const sent = JSON.parse(String(init.body)) as { records: { clientId: string }[] };
        return json({ results: sent.records.map((r) => ({ clientId: r.clientId, result: "conflict", conflictId: 9, serverPayload: {} })) });
      },
    });
    registerApiDriverHandlers(now);
    const api = createApiDriverApi(now);
    await api.getRun(DATE);
    await api.recordOutcome(DATE, "OUT084", [{ orderId: "ORD2001", outcome: "Delivered", unitsDelivered: 12, receiverName: "Anusha" }]);
    await runSync({ force: true });
    expect((await api.getRun(DATE)).stops[0].conflict).toBeDefined();

    resolved = true;
    clock += NOTICES_REFRESH_MS + 1;
    await api.getNotices(DATE);

    const stop = (await api.getRun(DATE)).stops[0];
    expect(stop.conflict).toBeUndefined();
    expect(stop.resolution).toMatchObject({ decision: "keep_delivery", by: "Kumari", at: "06:44" });
  });
});
