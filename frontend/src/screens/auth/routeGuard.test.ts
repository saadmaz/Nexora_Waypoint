import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Role } from "../../domain/status";
import { ROLES, clearSession, readAnySession, readSession, sessionKey, writeSession } from "./session";
import type { Session } from "./types";

/**
 * Route guarding per role (PRD v3 section 15, and the auth audit in `docs/auth-audit.md`).
 *
 * Before the audit only `/dispatcher` was guarded, so typing `/store/orders`, `/loader` or
 * `/driver/run` with no session rendered that role's screens. `App.tsx` now wraps all four, and
 * `RequireSession` is the one decision behind every one of them: a session for *this* role, read
 * from storage, or sign-in.
 *
 * The guard is tested through `readSession`, which is exactly what `RequireSession` calls. The test
 * environment is node, so this covers the decision rather than the rendering: whether the person
 * gets the screens or `/sign-in`.
 */

type Store = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function fakeStorage(): Store {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

function install(store: Store | null): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.defineProperty({}, "localStorage", { configurable: true, value: store ?? undefined }),
  });
}

function session(role: Role): Session {
  return {
    role,
    email: `${role}@waypoint.demo`,
    displayName: "Tester",
    token: `demo.${role}.abc123`,
    signedInAt: "2026-09-28T15:30:00+05:30",
  };
}

/** What `RequireSession role={role}` decides: the children, or a redirect to sign-in. */
function allows(role: Role): boolean {
  return readSession(role) !== null;
}

beforeEach(() => install(fakeStorage()));
afterEach(() => {
  for (const role of ROLES) clearSession(role);
  Reflect.deleteProperty(globalThis, "window");
});

describe("a signed-out browser", () => {
  it.each(ROLES)("sends %s to sign-in", (role) => {
    expect(allows(role)).toBe(false);
  });
});

describe("a signed-in role", () => {
  it.each(ROLES)("lets %s through to its own screens", (role) => {
    writeSession(role, session(role));
    expect(allows(role)).toBe(true);
  });

  it("does not let one role into another role's screens", () => {
    // The walkthrough holds four sessions at once, so this has to be per role, not "signed in".
    for (const held of ROLES) {
      writeSession(held, session(held));
      for (const wanted of ROLES) {
        expect(allows(wanted)).toBe(wanted === held);
      }
      clearSession(held);
    }
  });

  it("keeps the other three when one signs out", () => {
    for (const role of ROLES) writeSession(role, session(role));
    clearSession("store");
    expect(allows("store")).toBe(false);
    expect(allows("dispatcher")).toBe(true);
    expect(allows("loader")).toBe(true);
    expect(allows("driver")).toBe(true);
  });
});

describe("a hand-edited session", () => {
  it("is refused when the role inside does not match the key", () => {
    // Flipping `role` to reach another area: the key and the payload must agree.
    window.localStorage.setItem(sessionKey("dispatcher"), JSON.stringify(session("store")));
    expect(allows("dispatcher")).toBe(false);
  });

  it("is refused when a field is missing", () => {
    const { token: _token, ...withoutToken } = session("dispatcher");
    window.localStorage.setItem(sessionKey("dispatcher"), JSON.stringify(withoutToken));
    expect(allows("dispatcher")).toBe(false);
  });

  it("is refused when the stored value is not JSON", () => {
    window.localStorage.setItem(sessionKey("driver"), "not-json");
    expect(allows("driver")).toBe(false);
  });

  it("passes the guard when the shape is right, and the server is what refuses it", () => {
    // The client cannot tell a real token from a string, and must not pretend to. A made-up token
    // gets past this guard; every call it then makes is a 401, which clears the session and sends
    // the person to sign-in (see `api/http/tokens.ts`). The audit records this as the client-side
    // limit it is.
    window.localStorage.setItem(
      sessionKey("dispatcher"),
      JSON.stringify({ ...session("dispatcher"), token: "totally-made-up" }),
    );
    expect(allows("dispatcher")).toBe(true);
  });
});

describe("the driver offline", () => {
  it("still reaches the run with a session already on the phone", () => {
    // The guard only reads storage. If it ever asked the server, a driver with no coverage would be
    // bounced to sign-in and the outbox would never sync (PRD v3 section 15).
    writeSession("driver", session("driver"));
    install({
      getItem: () => JSON.stringify(session("driver")),
      setItem: () => {
        throw new Error("offline");
      },
      removeItem: () => undefined,
    });
    expect(allows("driver")).toBe(true);
  });

  it("is sent to sign-in when storage is blocked entirely", () => {
    install(null);
    expect(allows("driver")).toBe(false);
  });
});

describe("the root redirect", () => {
  it("has nothing to go to when signed out", () => {
    expect(readAnySession()).toBeNull();
  });

  it("goes to the one role the browser holds", () => {
    writeSession("driver", session("driver"));
    expect(readAnySession()?.role).toBe("driver");
  });

  it("goes to the first in role-picker order when the browser holds several", () => {
    writeSession("driver", session("driver"));
    writeSession("dispatcher", session("dispatcher"));
    expect(readAnySession()?.role).toBe(ROLES[0]);
  });
});
