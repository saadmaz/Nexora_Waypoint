import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHttpClient, type TokenSource } from "../../api/http/client";
import { ApiError, NotImplementedApiError } from "../../api/http/errors";
import type { Role } from "../../domain/status";
import { createApiBlobUploader, createApiSyncHandler, outcomeFromResult, registerApiSyncHandlers, setUploadGuard, toSyncRecord } from "./apiSync";
import { connectivity } from "./connectivity";
import { db } from "./db";
import { createFetchTransport, createRoutingTransport, installFieldTransport, roleOfOp } from "./fetchTransport";
import { enqueue, getRecord } from "./outbox";
import { saveBlob } from "./blobs";
import { clearSyncHandlers, runSync } from "./sync";
import { resetTimeSource, setTimeSource } from "./time";
import { mockTransport, NetworkError, request, setTransport, type Transport } from "./transport";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** A fetch that records each call and answers with the next canned reply (the last one repeats). */
function stubFetch(...replies: Array<Response | Error | (() => Promise<Response>)>) {
  const calls: Call[] = [];
  let index = 0;
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body;
    calls.push({
      url: String(url),
      method: String(init?.method),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof body === "string" ? (JSON.parse(body) as unknown) : body,
    });
    const reply = replies[Math.min(index++, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    if (typeof reply === "function") return reply();
    return reply.clone();
  }) as typeof fetch;
  return { impl, calls };
}

function setup(fetchImpl: typeof fetch, tokenMap: Partial<Record<Role, string>> = { driver: "tok-driver", loader: "tok-loader" }, timeoutMs?: number) {
  const expired: Role[] = [];
  const tokens: TokenSource = { get: (role) => tokenMap[role] ?? null, onUnauthorized: (role) => void expired.push(role) };
  const transport = createFetchTransport({ clientFor: (role) => createHttpClient({ baseUrl: "http://api.test", role, tokens, fetchImpl, timeoutMs }) });
  return { transport, expired };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  connectivity.reset();
  clearSyncHandlers();
  setUploadGuard(undefined);
  setTimeSource(() => Date.parse("2026-09-29T05:17:00+05:30"));
});

afterEach(() => {
  setTransport(mockTransport);
  resetTimeSource();
});

describe("op mapping", () => {
  it.each([
    ["driver.getRun", { date: "2026-09-29" }, "GET", "http://api.test/api/v1/driver/runs/2026-09-29", "tok-driver"],
    ["driver.downloadRoute", { date: "2026-09-29", version: 4 }, "GET", "http://api.test/api/v1/driver/runs/2026-09-29", "tok-driver"],
    ["driver.getNotices", { since: "2026-09-29T05:00:00+05:30" }, "GET", "http://api.test/api/v1/driver/notices?since=2026-09-29T05%3A00%3A00%2B05%3A30", "tok-driver"],
    ["driver.getNotices", undefined, "GET", "http://api.test/api/v1/driver/notices", "tok-driver"],
    ["driver.getHistory", undefined, "GET", "http://api.test/api/v1/driver/history", "tok-driver"],
    ["loader.getDock", { dock: "peliyagoda" }, "GET", "http://api.test/api/v1/loader/docks/peliyagoda", "tok-loader"],
    ["loader.getLoadPlan", { vehicleId: "VEH003", trip: 1 }, "GET", "http://api.test/api/v1/loader/vehicles/VEH003/trips/1", "tok-loader"],
    ["loader.getException", { id: 7 }, "GET", "http://api.test/api/v1/loader/exceptions/7", "tok-loader"],
    ["loader.getPlanDiff", { dock: "kandy", from: 3, to: 4 }, "GET", "http://api.test/api/v1/loader/docks/kandy/diff?from=3&to=4", "tok-loader"],
    ["loader.verifyPin", { personId: 12, pin: "4821" }, "POST", "http://api.test/api/v1/loader/pins/verify", "tok-loader"],
  ] as const)("%s calls %s %s as that role", async (op, payload, method, url, token) => {
    const { impl, calls } = stubFetch(json({}));
    const { transport } = setup(impl);
    await transport.send(op, payload);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe(method);
    expect(calls[0].url).toBe(url);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("sends the pin check as a JSON body", async () => {
    const { impl, calls } = stubFetch(json({ ok: true }));
    await setup(impl).transport.send("loader.verifyPin", { personId: 12, pin: "4821" });
    expect(calls[0].body).toEqual({ personId: 12, pin: "4821" });
  });

  it("sends `sync` for either role to POST /sync with that role's token", async () => {
    const { impl, calls } = stubFetch(json({ results: [] }));
    const { transport } = setup(impl);
    await transport.send("driver.sync", { deviceId: "d", records: [] });
    await transport.send("loader.sync", { deviceId: "d", records: [] });
    expect(calls.map((c) => [c.method, c.url, c.headers.Authorization])).toEqual([
      ["POST", "http://api.test/api/v1/sync", "Bearer tok-driver"],
      ["POST", "http://api.test/api/v1/sync", "Bearer tok-loader"],
    ]);
  });

  it("uploads a photo as multipart with the blob's clientId and kind", async () => {
    const { impl, calls } = stubFetch(json({ id: "b1", kind: "photo", mime: "image/jpeg", bytes: 3, duplicate: false }, 201));
    await setup(impl).transport.send("driver.uploadBlob", { clientId: "b1", kind: "photo", blob: new Blob(["abc"], { type: "image/jpeg" }) });
    const form = calls[0].body as FormData;
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("http://api.test/api/v1/attachments");
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("clientId")).toBe("b1");
    expect(form.get("kind")).toBe("photo");
    expect(form.get("file")).toBeInstanceOf(Blob);
    // The browser sets the multipart boundary itself, so no Content-Type is sent.
    expect(calls[0].headers["Content-Type"]).toBeUndefined();
  });

  it("refuses an op it has no route for, and says which", async () => {
    const { impl, calls } = stubFetch(json({}));
    await expect(setup(impl).transport.send("driver.ack", {})).rejects.toThrow("No API route for driver.ack");
    expect(calls).toHaveLength(0);
  });

  it("reads the role from the op name", () => {
    expect(roleOfOp("driver.ack")).toBe("driver");
    expect(roleOfOp("loader.sync")).toBe("loader");
    expect(roleOfOp("sync")).toBeUndefined();
  });
});

describe("the network", () => {
  it("turns a request that never gets an answer into the NetworkError the outbox already handles", async () => {
    const { impl } = stubFetch(new TypeError("Failed to fetch"));
    await expect(setup(impl).transport.send("driver.getRun", { date: "2026-09-29" })).rejects.toBeInstanceOf(NetworkError);
  });

  it("turns a timeout into a NetworkError too", async () => {
    const hang = (async (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch;
    await expect(setup(hang, undefined, 20).transport.send("driver.getRun", { date: "2026-09-29" })).rejects.toBeInstanceOf(NetworkError);
  });

  it("marks the connection failed through request(), and a reply clears it", async () => {
    const { impl } = stubFetch(new TypeError("Failed to fetch"), json({}));
    setTransport(setup(impl).transport);

    await expect(request("driver.getRun", { date: "2026-09-29" })).rejects.toBeInstanceOf(NetworkError);
    expect(connectivity.isConnected()).toBe(false);

    connectivity.clearNetworkFailure();
    await request("driver.getRun", { date: "2026-09-29" });
    expect(connectivity.isConnected()).toBe(true);
  });

  it("fails with a NetworkError before any request when the device is simulated offline", async () => {
    const { impl, calls } = stubFetch(json({}));
    await connectivity.setSimulatedOffline(true);
    await expect(setup(impl).transport.send("driver.getRun", { date: "2026-09-29" })).rejects.toBeInstanceOf(NetworkError);
    expect(calls).toHaveLength(0);
  });

  it("does not sign anyone out when the network fails", async () => {
    const { impl } = stubFetch(new TypeError("Failed to fetch"));
    const { transport, expired } = setup(impl);
    await expect(transport.send("driver.getRun", { date: "2026-09-29" })).rejects.toBeInstanceOf(NetworkError);
    expect(expired).toEqual([]);
  });
});

describe("what the server says", () => {
  it("clears only the role that got a 401, and keeps the error typed", async () => {
    const { impl } = stubFetch(json({ code: "unauthenticated", message: "Sign in to continue", details: null }, 401));
    const { transport, expired } = setup(impl);
    const error = await transport.send("loader.getDock", { dock: "kandy" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(NetworkError);
    expect((error as ApiError).status).toBe(401);
    expect(expired).toEqual(["loader"]);
  });

  it("makes no request for a role that is signed out, and fails 401", async () => {
    const { impl, calls } = stubFetch(json({}));
    const { transport, expired } = setup(impl, { loader: "tok-loader" });
    const error = await transport.send("driver.getRun", { date: "2026-09-29" }).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(401);
    expect(calls).toHaveLength(0);
    expect(expired).toEqual(["driver"]);
  });

  it("surfaces a 501 as a NotImplementedApiError that names the operation", async () => {
    const { impl } = stubFetch(json({ code: "not_implemented", message: "getRun is not built yet", details: { operation: "getRun" } }, 501));
    const error = await setup(impl).transport.send("driver.getRun", { date: "2026-09-29" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotImplementedApiError);
    expect((error as NotImplementedApiError).operation).toBe("getRun");
  });

  it("does not mark the connection failed for an error reply: the server was reached", async () => {
    const { impl } = stubFetch(json({ code: "not_implemented", message: "x", details: { operation: "getRun" } }, 501));
    setTransport(setup(impl).transport);
    await expect(request("driver.getRun", { date: "2026-09-29" })).rejects.toBeInstanceOf(NotImplementedApiError);
    expect(connectivity.isConnected()).toBe(true);
  });
});

describe("routing", () => {
  const tag = (name: string): Transport => ({ send: async () => name });

  it("sends an op to the real transport only when its own role is on the API", async () => {
    const transport = createRoutingTransport({ real: tag("real"), mock: tag("mock"), modeOf: (role) => (role === "loader" ? "api" : "mock") });
    expect(await transport.send("loader.getDock", {})).toBe("real");
    expect(await transport.send("driver.getRun", {})).toBe("mock");
    expect(await transport.send("driver.ack", {})).toBe("mock");
  });

  it("installs nothing when both field roles are on the mock", () => {
    expect(installFieldTransport()).toBe(false);
  });
});

describe("records and the outbox", () => {
  function syncStub(results: (clientId: string) => unknown) {
    const calls: Call[] = [];
    const impl = (async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { records: { clientId: string }[] };
      calls.push({ url: String(url), method: String(init?.method), headers: (init?.headers ?? {}) as Record<string, string>, body });
      return json({ results: body.records.map((r) => results(r.clientId)) });
    }) as typeof fetch;
    return { impl, calls };
  }

  it("sends the record with its own clientId, device time, actor and plan version", async () => {
    const record = await enqueue({ type: "driver.arrival", payload: { date: "2026-09-29", outletId: "OUT084", at: "05:40" }, actor: "nimal", planVersionOnDevice: 4, clientId: "c1" });
    const { impl, calls } = syncStub((id) => ({ clientId: id, result: "accepted" }));
    setTransport(setup(impl).transport);

    const outcome = await createApiSyncHandler("driver")(record);

    expect(outcome.result).toBe("accepted");
    const sent = calls[0].body as { deviceId: string; records: Record<string, unknown>[] };
    expect(sent.deviceId).toMatch(/^dev-/);
    expect(sent.records).toEqual([
      {
        clientId: "c1",
        type: "driver.arrival",
        payload: { date: "2026-09-29", outletId: "OUT084", at: "05:40" },
        deviceTime: record.deviceTime,
        planVersionOnDevice: 4,
        actor: "nimal",
        blobIds: [],
      },
    ]);
  });

  it("keeps one device id across sends", async () => {
    const a = await enqueue({ type: "driver.ack", payload: {}, actor: "n", planVersionOnDevice: 4, clientId: "a" });
    const b = await enqueue({ type: "driver.ack", payload: {}, actor: "n", planVersionOnDevice: 4, clientId: "b" });
    const { impl, calls } = syncStub((id) => ({ clientId: id, result: "accepted" }));
    setTransport(setup(impl).transport);
    const handler = createApiSyncHandler("driver");
    await handler(a);
    await handler(b);
    const ids = calls.map((c) => (c.body as { deviceId: string }).deviceId);
    expect(ids[0]).toBe(ids[1]);
  });

  it("counts a duplicate as accepted and does not change the record's clientId", async () => {
    await enqueue({ type: "driver.arrival", payload: {}, actor: "nimal", planVersionOnDevice: 4, clientId: "dup-1" });
    const { impl } = syncStub((id) => ({ clientId: id, result: "duplicate" }));
    setTransport(setup(impl).transport);
    registerApiSyncHandlers("driver");

    const run = await runSync();

    expect(run?.accepted).toBe(1);
    const saved = await getRecord("dup-1");
    expect(saved?.status).toBe("accepted");
  });

  it("resends the same clientId after the network drops, so the server can answer duplicate and nothing is counted twice", async () => {
    await enqueue({ type: "driver.outcome", payload: { orderId: "ORD2001" }, actor: "nimal", planVersionOnDevice: 4, clientId: "once" });
    const seen: string[] = [];
    let drop = true;
    const impl = (async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { records: { clientId: string }[] };
      seen.push(body.records[0].clientId);
      if (drop) throw new TypeError("Failed to fetch");
      return json({ results: [{ clientId: body.records[0].clientId, result: "duplicate" }] });
    }) as typeof fetch;
    setTransport(setup(impl).transport);
    registerApiSyncHandlers("driver");

    const first = await runSync();
    expect(first?.interrupted).toBe(true);
    expect((await getRecord("once"))?.status).toBe("waiting");

    drop = false;
    const second = await runSync({ force: true });
    expect(second?.accepted).toBe(1);
    expect(seen).toEqual(["once", "once"]);
    expect((await getRecord("once"))?.status).toBe("accepted");
  });

  it("keeps a conflict's details, with the server's conflictId inside, for the screen", async () => {
    await enqueue({ type: "driver.outcome", payload: { orderId: "ORD2001" }, actor: "nimal", planVersionOnDevice: 4, clientId: "cf" });
    const { impl } = syncStub((id) => ({ clientId: id, result: "conflict", conflictId: 9, serverPayload: { serverVersion: 5 } }));
    setTransport(setup(impl).transport);
    registerApiSyncHandlers("driver");

    const run = await runSync();

    expect(run?.conflicts).toBe(1);
    const saved = await getRecord("cf");
    expect(saved?.status).toBe("conflict");
    expect(saved?.serverPayload).toEqual({ serverVersion: 5, conflictId: 9 });
  });

  it("turns a missing answer into an error to retry, never an accept", () => {
    expect(outcomeFromResult(undefined).result).toBe("error");
    expect(outcomeFromResult({ clientId: "x", result: "error", reason: "bad actor" })).toMatchObject({ result: "error", reason: "bad actor" });
  });

  it("refuses a record type the backend does not know, with a reason, without calling it", async () => {
    const record = await enqueue({ type: "driver.dance", payload: {}, actor: "n", planVersionOnDevice: null, clientId: "odd" });
    const { impl, calls } = stubFetch(json({}));
    setTransport(setup(impl).transport);
    expect(await createApiSyncHandler("driver")(record)).toEqual({ result: "error", reason: "The server has no record type driver.dance" });
    expect(calls).toHaveLength(0);
  });

  it("sends an empty object for a payload that is not an object", () => {
    expect(toSyncRecord({ clientId: "p", type: "driver.ack", payload: "oops", deviceTime: "t", planVersionOnDevice: null, actor: "a", status: "waiting", attempts: 0, createdAt: 0 }).payload).toEqual({});
  });

  it("surfaces a 501 on /sync as an error outcome that retries, and keeps the record", async () => {
    await enqueue({ type: "driver.arrival", payload: {}, actor: "nimal", planVersionOnDevice: 4, clientId: "nb" });
    const { impl } = stubFetch(json({ code: "not_implemented", message: "sync is not built yet", details: { operation: "sync" } }, 501));
    setTransport(setup(impl).transport);
    registerApiSyncHandlers("driver");

    const run = await runSync();

    expect(run?.errors).toBe(1);
    const saved = await getRecord("nb");
    expect(saved?.status).toBe("error");
    expect(saved?.lastError).toBe("sync is not built yet");
  });
});

describe("photos", () => {
  async function savedPhoto(recordType: string, recordClientId: string) {
    const record = await enqueue({ type: recordType, payload: {}, actor: "nimal", planVersionOnDevice: 4, clientId: recordClientId });
    const id = await saveBlob({ kind: "photo", blob: new Blob(["abc"], { type: "image/jpeg" }), recordClientId });
    const { getBlob } = await import("./blobs");
    return { record, blob: (await getBlob(id))! };
  }

  it("uploads with the blob's id as the idempotency key and counts a replay as done", async () => {
    const { record, blob } = await savedPhoto("driver.outcome", "own-1");
    const { impl, calls } = stubFetch(json({ id: blob.id, kind: "photo", mime: "image/jpeg", bytes: 3, duplicate: true }, 201));
    setTransport(setup(impl).transport);

    expect(await createApiBlobUploader()(blob, record)).toBe("duplicate");
    expect((calls[0].body as FormData).get("clientId")).toBe(blob.id);
  });

  it("goes out as the role of the record it belongs to", async () => {
    const { record, blob } = await savedPhoto("loader.exception", "own-2");
    const { impl, calls } = stubFetch(json({ id: blob.id, kind: "photo", mime: "image/jpeg", bytes: 3, duplicate: false }, 201));
    setTransport(setup(impl).transport);

    expect(await createApiBlobUploader("driver")(blob, record)).toBe("uploaded");
    expect(calls[0].headers.Authorization).toBe("Bearer tok-loader");
  });

  it("lets the upload guard fail an upload before any request", async () => {
    const { record, blob } = await savedPhoto("driver.outcome", "own-3");
    const { impl, calls } = stubFetch(json({}));
    setTransport(setup(impl).transport);
    setUploadGuard(() => {
      throw new Error("WP-SYNC-409");
    });

    await expect(createApiBlobUploader()(blob, record)).rejects.toThrow("WP-SYNC-409");
    expect(calls).toHaveLength(0);
  });
});
