import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHttpClient, type TokenSource } from "../../api/http/client";
import { ApiError, NotImplementedApiError } from "../../api/http/errors";
import type { Role } from "../../domain/status";
import { clearSyncHandlers, connectivity, createFetchTransport, createRoutingTransport, db, getBlob, getRecord, mockTransport, NetworkError, resetTimeSource, runSync, saveBlob, setTimeSource, setTransport } from "../../field/offline";
import { createApiLoaderApi, registerApiLoaderHandlers } from "./apiLoaderApi";

const DATE = "2026-09-29";
const clock = Date.parse(`${DATE}T03:10:00+05:30`);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type Route = (url: URL, init: RequestInit) => Response | Error;

function server(routes: Record<string, Route | Response | Error>) {
  const calls: { path: string; search: string; method: string; body: unknown }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ path: url.pathname, search: url.search, method: String(init?.method), body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : init?.body });
    const route = routes[url.pathname];
    if (!route) return json({ code: "not_found", message: "no route", details: null }, 404);
    const reply = typeof route === "function" ? route(url, init ?? {}) : route;
    if (reply instanceof Error) throw reply;
    return reply.clone();
  }) as typeof fetch;
  const expired: Role[] = [];
  const tokens: TokenSource = { get: (role) => (role === "loader" ? "tok-loader" : null), onUnauthorized: (role) => void expired.push(role) };
  const transport = createFetchTransport({ clientFor: (role) => createHttpClient({ baseUrl: "http://api.test", role, tokens, fetchImpl: impl }) });
  setTransport(createRoutingTransport({ real: transport, modeOf: () => "api" }));
  return { calls };
}

const dock = (overrides: Record<string, unknown> = {}) => ({
  dock: "peliyagoda",
  planVersion: 3,
  acknowledged: false,
  people: [{ id: 1, name: "Ruwan", dock: "peliyagoda" }],
  vehicles: [
    { vehicleId: "VEH003", tripNo: 1, departAt: `${DATE}T04:50:00+05:30`, planVersion: 3, tags: [], orders: 4, kg: 400 },
    { vehicleId: "VEH003", tripNo: 2, departAt: `${DATE}T09:10:00+05:30`, planVersion: 3, tags: [], orders: 3, kg: 300 },
    { vehicleId: "VEH035", tripNo: 1, departAt: `${DATE}T05:20:00+05:30`, planVersion: 3, tags: ["Held", "Mystery"], orders: 5, kg: 500 },
  ],
  ...overrides,
});

const loadPlan = {
  vehicleId: "VEH003",
  tripNo: 1,
  planVersion: 3,
  departAt: `${DATE}T04:50:00+05:30`,
  confirmedAt: null,
  lines: [
    { orderId: "ORD1", outletId: "OUT3", outletName: "Waypoint Tech Matale", loadNo: 1, unitsExpected: 5, unitsLoaded: null, window: null },
    { orderId: "ORD2", outletId: "OUT2", outletName: "Waypoint Style Kandy", loadNo: 2, unitsExpected: 8, unitsLoaded: 8, window: null },
    { orderId: "ORD3", outletId: "OUT1", outletName: "Waypoint Fresh Kandy", loadNo: 3, unitsExpected: 12, unitsLoaded: null, window: null },
  ],
};

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  connectivity.reset();
  clearSyncHandlers();
  setTimeSource(() => clock);
});

afterEach(() => {
  setTransport(mockTransport);
  resetTimeSource();
});

describe("reads", () => {
  it("maps the dock: vehicles grouped, counts derived, first departure, unknown tags dropped", async () => {
    const { calls } = server({ "/api/v1/loader/docks/peliyagoda": json(dock()) });
    const view = await createApiLoaderApi().getDock("peliyagoda");

    expect(calls[0].method).toBe("GET");
    expect(view).toMatchObject({ dockId: "peliyagoda", planVersion: 3, vehicleCount: 2, orderCount: 12, firstDeparture: "04:50", newerVersionExists: false });
    expect(view.acknowledgement).toBeUndefined();
    const [a, b] = view.vehicles;
    expect(a).toMatchObject({ trips: 2, orderCount: 7, activeTrip: 1, departsAt: "04:50", status: "to_load" });
    expect(b).toMatchObject({ status: "held" });
    expect(b.vehicle.tags).toEqual(["Held"]);
  });

  it("shows an acknowledgement the tablet made, and flags a newer version released since", async () => {
    server({ "/api/v1/loader/docks/peliyagoda": json(dock({ acknowledged: true, planVersion: 4 })) });
    const api = createApiLoaderApi();
    await db.outbox.add({ clientId: "a1", type: "loader.ack", payload: { dockId: "peliyagoda", version: 3, personId: "1", personName: "Ruwan" }, deviceTime: "t", planVersionOnDevice: 3, actor: "1", status: "accepted", attempts: 1, createdAt: clock });
    const view = await api.getDock("peliyagoda");
    expect(view.acknowledgement).toMatchObject({ version: 3, personName: "Ruwan", at: "03:10" });
    expect(view.newerVersionExists).toBe(true);
  });

  it("maps the load plan in reverse stop order and lays the tablet's unsent counts over the server's", async () => {
    server({ "/api/v1/loader/docks/peliyagoda": json(dock()), "/api/v1/loader/vehicles/VEH003/trips/1": json(loadPlan) });
    const api = createApiLoaderApi();
    await api.getDock("peliyagoda");
    await api.recordCheck({ vehicleId: "VEH003", trip: 1, orderId: "ORD1", unitsLoaded: 5, personId: "1" });

    const plan = await api.getLoadPlan("VEH003", 1);

    expect(plan.orders.map((o) => [o.orderId, o.loadNumber, o.stopNumber, o.brand, o.unitsLoaded, o.state])).toEqual([
      ["ORD1", 1, 3, "Tech", 5, "checked"],
      ["ORD2", 2, 2, "Style", 8, "checked"],
      ["ORD3", 3, 1, "Fresh", 0, "todo"],
    ]);
    expect(plan.status).toBe("loading");
    expect(plan.vehicle.depot).toBe("peliyagoda");
  });

  it("shows a load the tablet confirmed, with who confirmed it", async () => {
    server({ "/api/v1/loader/vehicles/VEH003/trips/1": json(loadPlan) });
    const api = createApiLoaderApi();
    await api.confirmLoaded({ vehicleId: "VEH003", trip: 1, personId: "1", personName: "Ruwan" });
    expect(await api.getLoadPlan("VEH003", 1)).toMatchObject({ status: "loaded", confirmedAt: "03:10", confirmedBy: "Ruwan" });
  });

  it("maps a decided exception and the time it was raised", async () => {
    const { calls } = server({
      "/api/v1/loader/exceptions/7": json({ id: 7, type: "Vehicle check failed", vehicleId: "VEH003", tripNo: 1, orderIds: [], unitsShort: {}, detail: "Reefer not holding temperature", raisedAt: `${DATE}T02:55:00+05:30`, status: "decided", decision: { version: 4, by: "Kumari", at: "03:00" } }),
    });
    const view = await createApiLoaderApi().getException("7");
    expect(calls[0].path).toBe("/api/v1/loader/exceptions/7");
    expect(view).toMatchObject({ id: "7", status: "decided", decidedVersion: 4, decidedBy: "Kumari", decidedAt: "03:00", note: "Reefer not holding temperature", raisedAt: "02:55" });
  });

  it("fails as unexpected_reply for an exception type it has no name for", async () => {
    server({ "/api/v1/loader/exceptions/7": json({ id: 7, type: "gremlins", vehicleId: null, tripNo: null, orderIds: [], unitsShort: {}, detail: null, raisedAt: `${DATE}T02:55:00+05:30`, status: "open", decision: null }) });
    const error = await createApiLoaderApi().getException("7").catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("unexpected_reply");
  });

  it("reads the plan diff with the versions as query and lists the vehicles it did not touch", async () => {
    const { calls } = server({
      "/api/v1/loader/docks/peliyagoda": json(dock()),
      "/api/v1/loader/docks/peliyagoda/diff": json({
        dock: "peliyagoda",
        fromVersion: 3,
        toVersion: 4,
        lines: [
          { vehicleId: "VEH003", tripNo: 1, change: "vehicle", orderId: null, before: "VEH003", after: "VEH036" },
          { vehicleId: "VEH003", tripNo: 1, change: "removed", orderId: "ORD1002", before: null, after: null },
        ],
      }),
    });
    const api = createApiLoaderApi();
    await api.getDock("peliyagoda");
    const diff = await api.getPlanDiff("peliyagoda", 3, 4);
    expect(calls.at(-1)?.search).toBe("?from=3&to=4");
    expect(diff.changed[0]).toMatchObject({ fromVehicleId: "VEH003", toVehicleId: "VEH036" });
    expect(diff.removed.map((r) => r.orderId)).toEqual(["ORD1002"]);
    expect(diff.noChangeVehicleIds).toEqual(["VEH035"]);
  });

  it("surfaces a 501 as the typed error and falls back to nothing", async () => {
    server({ "/api/v1/loader/docks/kandy": json({ code: "not_implemented", message: "getDock is not built yet", details: { operation: "getDock" } }, 501) });
    const error = await createApiLoaderApi().getDock("kandy").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotImplementedApiError);
  });

  it("throws NetworkError offline, so the screen shows its offline state", async () => {
    server({ "/api/v1/loader/docks/kandy": json(dock()) });
    await connectivity.setSimulatedOffline(true);
    await expect(createApiLoaderApi().getDock("kandy")).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("PINs", () => {
  it("checks a numeric person against the server", async () => {
    const { calls } = server({ "/api/v1/loader/pins/verify": json({ ok: true, person: { id: 1, name: "Ruwan", dock: "peliyagoda" } }) });
    expect(await createApiLoaderApi().verifyPin("1", "4821")).toBe(true);
    expect(calls[0].body).toEqual({ personId: 1, pin: "4821" });
  });

  it("reports a wrong PIN as false", async () => {
    server({ "/api/v1/loader/pins/verify": json({ ok: false, person: null }) });
    expect(await createApiLoaderApi().verifyPin("1", "0000")).toBe(false);
  });

  it("cannot verify a person who is not a server id, and does not ask", async () => {
    const { calls } = server({ "/api/v1/loader/pins/verify": json({ ok: true }) });
    expect(await createApiLoaderApi().verifyPin("other", "1234", "Guest")).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("acknowledge", () => {
  const ack = { dockId: "peliyagoda" as const, version: 3, personId: "1", personName: "Ruwan" };

  it("is a conflict, with nothing queued, when a newer version is already out", async () => {
    server({ "/api/v1/loader/docks/peliyagoda": json(dock({ planVersion: 4 })) });
    expect(await createApiLoaderApi().acknowledgePlan(ack)).toBe("conflict");
    expect(await db.outbox.count()).toBe(0);
  });

  it("queues the acknowledgement when the version is current", async () => {
    server({ "/api/v1/loader/docks/peliyagoda": json(dock()) });
    expect(await createApiLoaderApi().acknowledgePlan(ack)).toBe("accepted");
    expect((await db.outbox.toArray())[0]).toMatchObject({ type: "loader.ack", payload: ack });
  });

  it("takes the acknowledgement offline and lets the server answer on sync", async () => {
    server({ "/api/v1/loader/docks/peliyagoda": json(dock()) });
    await connectivity.setSimulatedOffline(true);
    expect(await createApiLoaderApi().acknowledgePlan(ack)).toBe("accepted");
    expect(await db.outbox.count()).toBe(1);
  });
});

describe("flags", () => {
  const flag = { type: "Damaged item" as const, vehicleId: "VEH003", trip: 1 as const, orderIds: ["ORD1"], unitsShort: 2, personId: "1", personName: "Ruwan" };

  it("returns the record's clientId as the id until the server assigns one, and answers from the tablet's copy", async () => {
    server({});
    const api = createApiLoaderApi();
    const id = await api.flagException(flag);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await getRecord(id)).toMatchObject({ type: "loader.exception", clientId: id });

    expect(await api.getException(id)).toMatchObject({ id, type: "Damaged item", vehicleId: "VEH003", orderIds: ["ORD1"], unitsShort: 2, raisedBy: "Ruwan", status: "reviewing" });
  });

  it("switches to the server's copy once the sync answered with its id", async () => {
    server({ "/api/v1/loader/exceptions/12": json({ id: 12, type: "Damaged item", vehicleId: "VEH003", tripNo: 1, orderIds: ["ORD1"], unitsShort: { ORD1: 2 }, detail: null, raisedAt: `${DATE}T03:12:00+05:30`, status: "open", decision: null }) });
    const api = createApiLoaderApi();
    const id = await api.flagException(flag);
    await db.outbox.where("clientId").equals(id).modify({ status: "accepted", serverPayload: { exceptionId: 12 } });
    expect(await api.getException(id)).toMatchObject({ id: "12", unitsShort: 2, raisedAt: "03:12" });
  });

  it("says a flag is not on this tablet when the id is unknown", async () => {
    server({});
    const error = await createApiLoaderApi().getException("not-a-flag").catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(404);
  });

  it("ties a photo to its flag before the flag is queued", async () => {
    server({});
    const photo = await saveBlob({ kind: "photo", blob: new Blob(["x"], { type: "image/jpeg" }) });
    const id = await createApiLoaderApi().flagException({ ...flag, blobIds: [photo] });
    expect((await getBlob(photo))?.recordClientId).toBe(id);
  });
});

describe("sync", () => {
  it("sends a count to POST /sync as the loader, with its clientId", async () => {
    const { calls } = server({
      "/api/v1/sync": (_url, init) => {
        const sent = JSON.parse(String(init.body)) as { records: { clientId: string }[] };
        return json({ results: sent.records.map((r) => ({ clientId: r.clientId, result: "accepted" })) });
      },
    });
    registerApiLoaderHandlers();
    await createApiLoaderApi().recordCheck({ vehicleId: "VEH003", trip: 1, orderId: "ORD1", unitsLoaded: 5, personId: "1" });

    const result = await runSync({ force: true });

    expect(result?.accepted).toBe(1);
    const sent = calls.find((c) => c.path === "/api/v1/sync")?.body as { records: { type: string; actor: string }[] };
    expect(sent.records[0]).toMatchObject({ type: "loader.check", actor: "1" });
  });
});
