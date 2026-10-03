import { afterEach, describe, expect, it, vi } from "vitest";
import type { Role } from "../../domain/status";
import { createHttpClient, type TokenSource } from "./client";
import { ApiError, NetworkUnavailableError, NotImplementedApiError, isApiError, isNetworkUnavailable, isNotImplemented, toApiError } from "./errors";

type Call = { url: string; init: RequestInit };

/** A fetch that records each call and answers with the next canned reply. */
function stubFetch(...replies: Array<Response | Error | (() => Promise<Response>)>) {
  const calls: Call[] = [];
  let index = 0;
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const reply = replies[Math.min(index++, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    if (typeof reply === "function") return reply();
    return reply.clone();
  }) as typeof fetch;
  return { impl, calls };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function tokens(map: Partial<Record<Role, string>> = {}) {
  const expired: Role[] = [];
  const source: TokenSource = { get: (role) => map[role] ?? null, onUnauthorized: (role) => void expired.push(role) };
  return { source, expired };
}

afterEach(() => vi.useRealTimers());

describe("requests", () => {
  it("builds the URL from the base, the path params and the query, and sends the bearer token", async () => {
    const { impl, calls } = stubFetch(json([]));
    const { source } = tokens({ store: "tok-store" });
    const client = createHttpClient({ baseUrl: "http://api.test", role: "store", tokens: source, fetchImpl: impl });

    await client.get("/api/v1/store/deliveries/{day}", { path: { day: "2026-09-29" } });

    expect(calls[0].url).toBe("http://api.test/api/v1/store/deliveries/2026-09-29");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok-store");
    expect(calls[0].init.method).toBe("GET");
  });

  it("puts query values on the URL and skips the ones that are not set", async () => {
    const { impl, calls } = stubFetch(json([]));
    const { source } = tokens({ driver: "t" });
    const client = createHttpClient({ baseUrl: "", role: "driver", tokens: source, fetchImpl: impl });

    await client.get("/api/v1/driver/notices", { query: { since: "2026-09-29T05:00:00+05:30" } });
    await client.get("/api/v1/driver/notices");

    expect(calls[0].url).toBe("/api/v1/driver/notices?since=2026-09-29T05%3A00%3A00%2B05%3A30");
    expect(calls[1].url).toBe("/api/v1/driver/notices");
  });

  it("encodes a path param, so an id can never change the route", async () => {
    const { impl, calls } = stubFetch(new Response(null, { status: 204 }));
    const { source } = tokens({ store: "t" });
    const client = createHttpClient({ baseUrl: "", role: "store", tokens: source, fetchImpl: impl });

    await client.post("/api/v1/store/orders/{order_id}/cancel", { path: { order_id: "ORD/../x" } });

    expect(calls[0].url).toBe("/api/v1/store/orders/ORD%2F..%2Fx/cancel");
  });

  it("sends a JSON body with its content type and returns the typed reply", async () => {
    const { impl, calls } = stubFetch(
      json({ accessToken: "abc", tokenType: "bearer", expiresAt: "2026-09-29T17:00:00Z", user: { id: 1, email: "x@y", role: "store", displayName: "Anusha" } }),
    );
    const client = createHttpClient({ baseUrl: "", fetchImpl: impl });

    const out = await client.post("/api/v1/auth/login", { body: { email: "store@waypoint.demo", password: "pw" } });

    expect(out.accessToken).toBe("abc");
    expect(out.user.role).toBe("store");
    expect(calls[0].init.body).toBe(JSON.stringify({ email: "store@waypoint.demo", password: "pw" }));
    expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    // Login needs no sign-in, so no bearer header.
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("returns undefined for a 204", async () => {
    const { impl } = stubFetch(new Response(null, { status: 204 }));
    const { source } = tokens({ store: "t" });
    const client = createHttpClient({ baseUrl: "", role: "store", tokens: source, fetchImpl: impl });

    await expect(client.post("/api/v1/store/updates/read-all")).resolves.toBeUndefined();
  });

  it("checks a call against the generated schema at compile time", () => {
    // Never run: these lines only have to fail to compile. `tsc` is the assertion.
    const compileOnly = () => {
      const client = createHttpClient({ baseUrl: "", fetchImpl: stubFetch(json({})).impl });
      // @ts-expect-error not a path in the backend contract
      void client.get("/api/v1/nope");
      // @ts-expect-error this route has no GET handler
      void client.get("/api/v1/auth/login");
      // @ts-expect-error a route with a path param needs it
      void client.get("/api/v1/store/deliveries/{day}");
      // @ts-expect-error the login body is {email, password}
      void client.post("/api/v1/auth/login", { body: { email: "a" } });
    };
    expect(typeof compileOnly).toBe("function");
  });
});

describe("a signed-out role", () => {
  it("fails with 401 without calling the network", async () => {
    const { impl, calls } = stubFetch(json({}));
    const { source, expired } = tokens({});
    const client = createHttpClient({ baseUrl: "", role: "loader", tokens: source, fetchImpl: impl });

    const error = await client.get("/api/v1/loader/docks/{dock}", { path: { dock: "kandy" } }).catch((e: unknown) => e);

    expect(isApiError(error) && error.status === 401 && error.code === "unauthenticated").toBe(true);
    expect(calls).toHaveLength(0);
    expect(expired).toEqual(["loader"]);
  });
});

describe("errors", () => {
  it("maps the backend's error shape to an ApiError", async () => {
    const { impl } = stubFetch(json({ code: "invalid_credentials", message: "That email and password don't match", details: null }, 401));
    const client = createHttpClient({ baseUrl: "", fetchImpl: impl });

    const error = await client.post("/api/v1/auth/login", { body: { email: "a@b", password: "x" } }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: "invalid_credentials", message: "That email and password don't match" });
  });

  it("keeps the details of a validation error", async () => {
    const details = [{ loc: ["body", "email"], msg: "field required", type: "missing" }];
    const { impl } = stubFetch(json({ code: "validation_error", message: "The request is not valid", details }, 422));
    const client = createHttpClient({ baseUrl: "", fetchImpl: impl });

    const error = await client.post("/api/v1/auth/login", { body: { email: "a@b", password: "x" } }).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 422, code: "validation_error", details });
  });

  it("gives a 501 its own class and names the operation", async () => {
    const { impl } = stubFetch(json({ code: "not_implemented", message: "getRun is not built yet", details: { operation: "getRun" } }, 501));
    const { source } = tokens({ driver: "t" });
    const client = createHttpClient({ baseUrl: "", role: "driver", tokens: source, fetchImpl: impl });

    const error = await client.get("/api/v1/driver/runs/{day}", { path: { day: "2026-09-29" } }).catch((e: unknown) => e);

    expect(isNotImplemented(error)).toBe(true);
    expect(error).toBeInstanceOf(NotImplementedApiError);
    expect(error).toMatchObject({ status: 501, operation: "getRun" });
  });

  it("turns a reply that is not the error shape into an ApiError instead of crashing", () => {
    expect(toApiError(502, undefined)).toMatchObject({ status: 502, code: "http_error" });
    expect(toApiError(404, "<html>nope</html>")).toMatchObject({ status: 404, code: "http_error" });
  });
});

describe("401 handling", () => {
  it("ends that role's session on a real 401, and no other", async () => {
    const { impl } = stubFetch(json({ code: "unauthenticated", message: "Your session has expired. Sign in again", details: null }, 401));
    const { source, expired } = tokens({ store: "old", driver: "keep" });
    const client = createHttpClient({ baseUrl: "", role: "store", tokens: source, fetchImpl: impl });

    await client.get("/api/v1/store/updates").catch(() => undefined);

    expect(expired).toEqual(["store"]);
  });

  it("does not end a session for a 403, a 409 or a 501", async () => {
    const { source, expired } = tokens({ store: "t" });
    for (const status of [403, 409, 501]) {
      const { impl } = stubFetch(json({ code: "x", message: "no", details: null }, status));
      const client = createHttpClient({ baseUrl: "", role: "store", tokens: source, fetchImpl: impl });
      await client.get("/api/v1/store/updates").catch(() => undefined);
    }
    expect(expired).toEqual([]);
  });

  it("does not sign anyone out on a wrong password, which has no role", async () => {
    const { impl } = stubFetch(json({ code: "invalid_credentials", message: "no", details: null }, 401));
    const { source, expired } = tokens({ store: "t" });
    const client = createHttpClient({ baseUrl: "", tokens: source, fetchImpl: impl });

    await client.post("/api/v1/auth/login", { body: { email: "a@b", password: "x" } }).catch(() => undefined);

    expect(expired).toEqual([]);
  });
});

describe("no answer", () => {
  it("reports an unreachable server as offline, and never ends a session", async () => {
    const { impl } = stubFetch(new TypeError("Failed to fetch"));
    const { source, expired } = tokens({ driver: "t" });
    const client = createHttpClient({ baseUrl: "", role: "driver", tokens: source, fetchImpl: impl });

    const error = await client.get("/api/v1/driver/notices").catch((e: unknown) => e);

    expect(isNetworkUnavailable(error)).toBe(true);
    expect(error).toBeInstanceOf(NetworkUnavailableError);
    expect(error).toMatchObject({ reason: "offline" });
    expect(expired).toEqual([]);
  });

  it("gives up after the timeout and says so", async () => {
    vi.useFakeTimers();
    const hang = (async (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch;
    const { source, expired } = tokens({ driver: "t" });
    const client = createHttpClient({ baseUrl: "", role: "driver", tokens: source, timeoutMs: 5000, fetchImpl: hang });

    const pending = client.get("/api/v1/driver/notices").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5000);

    expect(await pending).toMatchObject({ name: "NetworkUnavailableError", reason: "timeout" });
    expect(expired).toEqual([]);
  });

  it("lets a caller's own abort through as an abort, not a network failure", async () => {
    const hang = (async (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch;
    const { source } = tokens({ driver: "t" });
    const client = createHttpClient({ baseUrl: "", role: "driver", tokens: source, fetchImpl: hang });
    const controller = new AbortController();

    const pending = client.get("/api/v1/driver/notices", { signal: controller.signal }).catch((e: unknown) => e);
    controller.abort();

    const error = await pending;
    expect(isNetworkUnavailable(error)).toBe(false);
    expect(error).toMatchObject({ name: "AbortError" });
  });
});
