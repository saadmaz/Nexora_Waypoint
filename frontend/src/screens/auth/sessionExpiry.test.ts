import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sessionTokens } from "../../api/http/tokens";
import { ROLES, clearSession, readSession, writeSession } from "./session";
import type { Session } from "./types";

/**
 * What a 401 means for route guarding (the auth audit, `docs/auth-audit.md`).
 *
 * `api/http/client.test.ts` already covers the client half: a real 401 ends that role's session and
 * a network failure never does. This covers the half that matters now that every role area is
 * guarded: once the session is gone, `RequireSession` stops letting that role through, so the
 * screens cannot keep rendering stale data behind a token the server has rejected.
 */

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

function fakeStorage(): Store {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function install(store: Store): void {
  const events: string[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.defineProperties(
      {},
      {
        localStorage: { configurable: true, value: store },
        dispatchEvent: {
          configurable: true,
          value: (event: Event) => {
            events.push((event as CustomEvent<{ role: string }>).detail.role);
            return true;
          },
        },
        __events: { configurable: true, value: events },
      },
    ),
  });
}

function fired(): string[] {
  return (window as unknown as { __events: string[] }).__events;
}

function session(role: Session["role"]): Session {
  return { role, email: `${role}@waypoint.demo`, displayName: "Tester", token: "t", signedInAt: "2026-09-28T15:30:00+05:30" };
}

/** What `RequireSession role={role}` decides. */
const allows = (role: Session["role"]) => readSession(role) !== null;

beforeEach(() => install(fakeStorage()));
afterEach(() => {
  for (const role of ROLES) clearSession(role);
  Reflect.deleteProperty(globalThis, "window");
});

describe("after the server rejects a session", () => {
  it("the guard stops letting that role through, and announces which role", () => {
    writeSession("store", session("store"));
    expect(allows("store")).toBe(true);

    sessionTokens.onUnauthorized("store");

    expect(allows("store")).toBe(false);
    expect(fired()).toEqual(["store"]);
  });

  it("leaves the other three roles signed in", () => {
    // Four tabs, four roles (PRD v3 section 16). A Store expiry must not move the driver.
    for (const role of ROLES) writeSession(role, session(role));

    sessionTokens.onUnauthorized("store");

    expect(allows("store")).toBe(false);
    expect(allows("dispatcher")).toBe(true);
    expect(allows("loader")).toBe(true);
    expect(allows("driver")).toBe(true);
    expect(fired()).toEqual(["store"]);
  });

  it("a made-up token survives the guard but not the first answer from the server", () => {
    // The whole client-side story in one test: the guard checks shape, the server checks the token.
    window.localStorage.setItem("wp.session.dispatcher", JSON.stringify({ ...session("dispatcher"), token: "totally-made-up" }));
    expect(allows("dispatcher")).toBe(true);

    sessionTokens.onUnauthorized("dispatcher");

    expect(allows("dispatcher")).toBe(false);
  });
});

describe("the driver offline", () => {
  it("keeps the session when nothing rejected it", () => {
    // Only `onUnauthorized` clears a session. A network failure never calls it, so the token is
    // still on the phone for the outbox to sync later (PRD v3 section 15).
    writeSession("driver", session("driver"));

    expect(allows("driver")).toBe(true);
    expect(fired()).toEqual([]);
  });
});
