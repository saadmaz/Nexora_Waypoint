import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHttpClient } from "../../api/http/client";
import { connectivity } from "../../field/offline/connectivity";
import { createApiAuthApi } from "./apiAuthApi";
import { clearSession, readSession } from "./session";

type Call = { url: string; body: unknown };

function login(role: string, email = `${role}@waypoint.demo`): Response {
  const body = {
    accessToken: `jwt-${role}`,
    tokenType: "bearer",
    expiresAt: "2026-09-29T17:00:00Z",
    user: { id: 1, email, role, displayName: role === "driver" ? "Nimal" : role, depot: null, outletId: null, vehicleId: null },
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function failure(status: number, code: string, message = "no"): Response {
  return new Response(JSON.stringify({ code, message, details: null }), { status, headers: { "Content-Type": "application/json" } });
}

function apiWith(...replies: Array<Response | Error>) {
  const calls: Call[] = [];
  let index = 0;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[Math.min(index++, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    return reply.clone();
  }) as typeof fetch;
  return { api: createApiAuthApi(() => createHttpClient({ baseUrl: "http://api.test", fetchImpl })), calls };
}

beforeEach(() => connectivity.reset());
afterEach(async () => {
  await connectivity.setSimulatedOffline(false);
  for (const role of ["dispatcher", "loader", "driver", "store"] as const) clearSession(role);
  connectivity.reset();
});

describe("signIn", () => {
  it("stores the session under the role the backend returned, with the token kept as given", async () => {
    const { api, calls } = apiWith(login("driver"));

    const result = await api.signIn("driver@waypoint.demo", "waypoint-demo");

    expect(result.ok).toBe(true);
    expect(calls[0].url).toBe("http://api.test/api/v1/auth/login");
    expect(readSession("driver")).toMatchObject({ role: "driver", email: "driver@waypoint.demo", displayName: "Nimal", token: "jwt-driver" });
  });

  it("sends the email trimmed and lower-cased, like the mock", async () => {
    const { api, calls } = apiWith(login("store"));

    await api.signIn("  Store@Waypoint.demo ", "waypoint-demo");

    expect(calls[0].body).toEqual({ email: "store@waypoint.demo", password: "waypoint-demo" });
  });

  it("keeps the other roles' sessions when another signs in", async () => {
    const { api } = apiWith(login("driver"), login("store"));

    await api.signIn("driver@waypoint.demo", "waypoint-demo");
    await api.signIn("store@waypoint.demo", "waypoint-demo");

    expect(readSession("driver")?.token).toBe("jwt-driver");
    expect(readSession("store")?.token).toBe("jwt-store");
  });

  it("answers a 404 (the app is not talking to the API) with unavailable, never a wrong password", async () => {
    const { api } = apiWith(failure(404, "not_found", "Not Found"));
    expect(await api.signIn("store@waypoint.demo", "waypoint-demo")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("answers a wrong password with invalid_credentials and stores nothing", async () => {
    const { api } = apiWith(failure(401, "invalid_credentials", "That email and password don't match"));

    const result = await api.signIn("driver@waypoint.demo", "nope");

    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(readSession("driver")).toBeNull();
  });

  it("treats a rejected request body the same way", async () => {
    const { api } = apiWith(failure(422, "validation_error"));

    expect(await api.signIn("", "")).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("says unavailable when the server cannot be reached", async () => {
    const { api } = apiWith(new TypeError("Failed to fetch"));

    expect(await api.signIn("driver@waypoint.demo", "waypoint-demo")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("says unavailable when the server fails", async () => {
    const { api } = apiWith(failure(500, "internal_error"));

    expect(await api.signIn("driver@waypoint.demo", "waypoint-demo")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("says unavailable, not a wrong password, after too many attempts", async () => {
    // The rate limiter never checked the credentials, so blaming the password would be untrue.
    const { api } = apiWith(failure(429, "too_many_attempts"));

    expect(await api.signIn("driver@waypoint.demo", "waypoint-demo")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("says unavailable, not a stored session, when the backend returns a role this app does not have", async () => {
    const { api } = apiWith(login("auditor"));

    expect(await api.signIn("x@waypoint.demo", "waypoint-demo")).toEqual({ ok: false, reason: "unavailable" });
    expect(readSession("driver")).toBeNull();
  });

  it("answers offline without making a request", async () => {
    await connectivity.setSimulatedOffline(true);
    const { api, calls } = apiWith(login("driver"));

    expect(await api.signIn("driver@waypoint.demo", "waypoint-demo")).toEqual({ ok: false, reason: "offline" });
    expect(calls).toHaveLength(0);
  });
});

describe("signOut and getSession", () => {
  it("signs out one role only, locally", async () => {
    const { api, calls } = apiWith(login("driver"), login("store"));
    await api.signIn("driver@waypoint.demo", "waypoint-demo");
    await api.signIn("store@waypoint.demo", "waypoint-demo");

    await api.signOut("store");

    expect(await api.getSession("store")).toBeNull();
    expect((await api.getSession("driver"))?.token).toBe("jwt-driver");
    expect(calls).toHaveLength(2); // no logout request: the backend has no logout endpoint
  });
});
