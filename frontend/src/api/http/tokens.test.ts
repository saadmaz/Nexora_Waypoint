import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../screens/auth/types";
import { clearSession, readSession, writeSession } from "../../screens/auth/session";
import { SESSION_EXPIRED_EVENT, sessionTokens } from "./tokens";

function session(role: Session["role"], token: string): Session {
  return { role, email: `${role}@waypoint.demo`, displayName: role, token, signedInAt: "2026-09-29T04:45:00+05:30" };
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const role of ["store", "dispatcher", "loader", "driver"] as const) clearSession(role);
});

describe("sessionTokens", () => {
  it("reads the token of the role asked for, and null when that role is signed out", () => {
    writeSession("driver", session("driver", "tok-driver"));

    expect(sessionTokens.get("driver")).toBe("tok-driver");
    expect(sessionTokens.get("store")).toBeNull();
  });

  it("ends only the role the server rejected", () => {
    writeSession("driver", session("driver", "tok-driver"));
    writeSession("store", session("store", "tok-store"));

    sessionTokens.onUnauthorized("store");

    expect(readSession("store")).toBeNull();
    expect(readSession("driver")?.token).toBe("tok-driver");
  });

  it("announces the expiry on window so the app can send the person to sign in", () => {
    const heard: Array<{ type: string; detail: unknown }> = [];
    vi.stubGlobal("window", { dispatchEvent: (event: CustomEvent) => void heard.push({ type: event.type, detail: event.detail }) });
    writeSession("loader", session("loader", "tok-loader"));

    sessionTokens.onUnauthorized("loader");

    expect(heard).toEqual([{ type: SESSION_EXPIRED_EVENT, detail: { role: "loader" } }]);
  });
});
