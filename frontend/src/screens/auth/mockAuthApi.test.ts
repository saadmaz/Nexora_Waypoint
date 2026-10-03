import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectivity } from "../../field/offline/connectivity";
import { ACCOUNTS, DEMO_PASSWORD } from "./AuthApi";
import { mockAuthApi } from "./mockAuthApi";
import { readAllSessions, readSession } from "./session";

/**
 * The sign-in mock (prompt 06 section 8). A wrong password and an unknown email must be
 * indistinguishable, an offline device must never touch stored sessions, and signing in as one
 * role must leave the other three alone.
 */

/** A localStorage stand-in. The node test environment has no window of its own. */
function installStorage(): void {
  const map = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
}

beforeEach(() => {
  installStorage();
  connectivity.reset();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  connectivity.reset();
});

describe("mock sign-in", () => {
  it("accepts the demo password for every account and stores that role's session", async () => {
    for (const account of ACCOUNTS) {
      const result = await mockAuthApi.signIn(account.email, DEMO_PASSWORD);
      expect(result.ok).toBe(true);
      expect(readSession(account.role)).toMatchObject({ role: account.role, email: account.email, displayName: expect.any(String) });
    }
  });

  it("uses the password the backend seeds from DEMO_PASSWORD", () => {
    expect(DEMO_PASSWORD).toBe("waypoint-demo");
  });

  it("answers a wrong password with a typed failure and stores nothing", async () => {
    const result = await mockAuthApi.signIn("driver@waypoint.demo", "nope");
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(readAllSessions()).toEqual({});
  });

  it("answers an unknown email exactly like a wrong password", async () => {
    const wrong = await mockAuthApi.signIn("driver@waypoint.demo", "nope");
    const unknown = await mockAuthApi.signIn("nobody@waypoint.demo", DEMO_PASSWORD);
    expect(unknown).toEqual(wrong);
  });

  it("trims and lower-cases the email", async () => {
    const result = await mockAuthApi.signIn("  Store@Waypoint.demo ", DEMO_PASSWORD);
    expect(result.ok).toBe(true);
  });

  it("leaves the other roles signed in when one more signs in", async () => {
    await mockAuthApi.signIn("dispatcher@waypoint.demo", DEMO_PASSWORD);
    await mockAuthApi.signIn("driver@waypoint.demo", DEMO_PASSWORD);
    expect(Object.keys(readAllSessions()).sort()).toEqual(["dispatcher", "driver"]);
  });

  it("blocks a new sign-in offline and never touches a stored session", async () => {
    await mockAuthApi.signIn("driver@waypoint.demo", DEMO_PASSWORD);
    connectivity.setBrowserOnline(false);
    const result = await mockAuthApi.signIn("store@waypoint.demo", DEMO_PASSWORD);
    expect(result).toEqual({ ok: false, reason: "offline" });
    expect(Object.keys(readAllSessions())).toEqual(["driver"]);
    expect(await mockAuthApi.getSession("driver")).not.toBeNull();
  });

  it("signs out one role only", async () => {
    await mockAuthApi.signIn("dispatcher@waypoint.demo", DEMO_PASSWORD);
    await mockAuthApi.signIn("loader@waypoint.demo", DEMO_PASSWORD);
    await mockAuthApi.signOut("dispatcher");
    expect(Object.keys(readAllSessions())).toEqual(["loader"]);
  });
});
