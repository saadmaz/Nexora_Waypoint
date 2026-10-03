import type { Role } from "../../domain/status";
import type { Account, Session, SignInResult } from "./types";

/**
 * The sign-in interface (PRD v3 section 9 Auth, prompt 06 section 8).
 *
 * One interface for the mock and for the real client, so screens never talk to `fetch`
 * or to a fixture directly (PRD v3 section 9 principle 5). The real implementation lands
 * when `backend/app/routers/auth.py` exists; until then `mockAuthApi` is the only one.
 */
export interface AuthApi {
  /**
   * Signs in and stores the session under that account's role. Returns a typed result:
   * a wrong password is `{ ok: false, reason: "invalid_credentials" }`, never a throw.
   * Signing in as one role leaves the other three sessions untouched.
   */
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Clears that role's session only (prompt 06 section 6). */
  signOut(role: Role): Promise<void>;
  /** The stored session for a role, or null. Reads storage; makes no request. */
  getSession(role: Role): Promise<Session | null>;
}

/** Where each role lands once signed in (prompt 06 section 2). */
export const ROLE_HOME: Record<Role, string> = {
  dispatcher: "/dispatcher/queue",
  loader: "/loader/dock",
  driver: "/driver/run",
  store: "/store/orders",
};

/**
 * The four demo accounts (PRD v3 section 4c): the sign-in shortcuts. A person's name is not written here. It
 * comes from the database with the sign-in (`displayName` on the session); until then a row names its role. The
 * loader account is the shared dock tablet rather than a person: the loader still enters a PIN per action, which
 * the field foundation's PinSheet handles.
 *
 * Each role shows its own app name after sign-in. Sign-in itself prints a neutral "Waypoint" (PRD v3 section 6).
 */
export const ACCOUNTS: Account[] = [
  { email: "dispatcher@waypoint.demo", role: "dispatcher", displayName: "Dispatcher", appName: "Waypoint Dispatch" },
  { email: "loader@waypoint.demo", role: "loader", displayName: "Dock tablet", appName: "Waypoint Load" },
  { email: "driver@waypoint.demo", role: "driver", displayName: "Driver", appName: "Waypoint Driver" },
  { email: "store@waypoint.demo", role: "store", displayName: "Store manager", appName: "Waypoint Store" },
];

/**
 * The one password all four demo accounts accept (PRD v3 section 4c). It is the backend's
 * `DEMO_PASSWORD` (`.env.example`), so the mock and the real API agree. The README accounts
 * table documents it; the sign-in screen's "Demo accounts" rows send it for the person.
 */
export const DEMO_PASSWORD = "waypoint-demo";

export function accountFor(email: string): Account | undefined {
  const wanted = email.trim().toLowerCase();
  return ACCOUNTS.find((account) => account.email === wanted);
}

/**
 * Which implementation the app uses, from `VITE_AUTH_API=mock|api`.
 *
 * PRD v3 section 9 principle 7 names the pattern `VITE_<ROLE>_API` for the four roles.
 * Auth is not one of the four, so this is a small extension of that principle rather
 * than something the PRD already spells out. Recorded in the README.
 */
export function authApiMode(): "mock" | "api" {
  // A production build is always on the API: no flag can switch it to the mock (DP-26).
  if (!import.meta.env.DEV) return "api";
  return import.meta.env.VITE_AUTH_API === "api" ? "api" : "mock";
}
