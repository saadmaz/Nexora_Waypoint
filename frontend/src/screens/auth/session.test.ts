import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ROLES, clearSession, readAllSessions, readAnySession, readSession, sessionKey, writeSession } from "./session";
import type { Session } from "./types";

/**
 * Per-role sessions (PRD v3 section 9). The judge walkthrough signs in as four roles in
 * four tabs of one browser, so the keys must stay separate and a storage failure must
 * never break sign-in.
 */

type Store = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** A localStorage stand-in. The node test environment has no window of its own. */
function fakeStorage(): Store & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

function install(store: Store | (() => never) | null): void {
  const descriptor = store === null ? { value: undefined } : typeof store === "function" ? { get: store } : { value: store };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.defineProperty({}, "localStorage", { configurable: true, ...descriptor }),
  });
}

function session(role: Session["role"], email: string): Session {
  return { role, email, displayName: "Tester", token: `demo.${role}.abc123`, signedInAt: "2026-09-28T15:30:00+05:30" };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("per-role session keys", () => {
  beforeEach(() => install(fakeStorage()));

  it("stores each role under its own wp.session.<role> key", () => {
    expect(ROLES.map(sessionKey)).toEqual([
      "wp.session.dispatcher",
      "wp.session.loader",
      "wp.session.driver",
      "wp.session.store",
    ]);
  });

  it("holds all four roles at once", () => {
    for (const role of ROLES) writeSession(role, session(role, `${role}@waypoint.demo`));
    for (const role of ROLES) expect(readSession(role)?.email).toBe(`${role}@waypoint.demo`);
  });

  it("signs out of one role and leaves the other three signed in", () => {
    for (const role of ROLES) writeSession(role, session(role, `${role}@waypoint.demo`));
    clearSession("driver");
    expect(readSession("driver")).toBeNull();
    expect(readSession("dispatcher")).not.toBeNull();
    expect(readSession("loader")).not.toBeNull();
    expect(readSession("store")).not.toBeNull();
  });

  it("reads back nothing for a role that never signed in", () => {
    expect(readSession("store")).toBeNull();
    expect(readAnySession()).toBeNull();
    expect(readAllSessions()).toEqual({});
  });

  it("finds the first session in role-picker order for the / redirect", () => {
    writeSession("driver", session("driver", "driver@waypoint.demo"));
    writeSession("store", session("store", "store@waypoint.demo"));
    expect(readAnySession()?.role).toBe("driver");
  });
});

describe("storage that misbehaves", () => {
  it("treats a session stored under the wrong role as not signed in", () => {
    const store = fakeStorage();
    install(store);
    store.map.set("wp.session.store", JSON.stringify(session("driver", "driver@waypoint.demo")));
    expect(readSession("store")).toBeNull();
  });

  it("treats truncated JSON as not signed in rather than throwing", () => {
    const store = fakeStorage();
    install(store);
    store.map.set("wp.session.store", '{"role":"store","email":');
    expect(readSession("store")).toBeNull();
  });

  it("treats a session missing a token as not signed in", () => {
    const store = fakeStorage();
    install(store);
    store.map.set("wp.session.store", JSON.stringify({ role: "store", email: "a@b.c", displayName: "A", signedInAt: "x" }));
    expect(readSession("store")).toBeNull();
  });

  it("keeps the session for the tab when writing throws, so sign-in still works", () => {
    const store = fakeStorage();
    store.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    install(store);
    writeSession("driver", session("driver", "driver@waypoint.demo"));
    expect(readSession("driver")?.token).toBe("demo.driver.abc123");
  });

  it("signs in when localStorage itself is blocked", () => {
    install((() => {
      throw new DOMException("blocked", "SecurityError");
    }) as () => never);
    writeSession("driver", session("driver", "driver@waypoint.demo"));
    expect(readSession("driver")?.email).toBe("driver@waypoint.demo");
    clearSession("driver");
    expect(readSession("driver")).toBeNull();
  });
});
