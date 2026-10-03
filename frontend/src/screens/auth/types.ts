import type { Role } from "../../domain/status";

/**
 * Sign-in and per-role sessions (PRD v3 sections 9 Auth and 4c "People and accounts").
 *
 * One browser holds up to four sessions at once, one per role, because the judge
 * walkthrough (PRD v3 section 16) opens four tabs and signs in as each role in turn.
 * Everything here is shape only: no rule logic lives in the frontend.
 */

/** The four demo accounts (PRD v3 section 4c). The loader account is a shared dock tablet, not a person. */
export type Account = {
  /** "dispatcher@waypoint.demo". The sign-in identifier. */
  email: string;
  /** The role the account signs in as. One account per role in the demo. */
  role: Role;
  /** "Kumari", "Nimal", "Anusha", or "Dock tablet" for the shared loader account. */
  displayName: string;
  /** The app name this role sees in its chrome: "Waypoint Dispatch", "Waypoint Load", "Waypoint Driver", "Waypoint Store". */
  appName: string;
};

/**
 * A signed-in session, stored under `wp.session.<role>`.
 *
 * In mock mode `token` is an opaque demo string. The shape is what a real JWT swap
 * would need, so wiring the backend stays a swap and not a rewrite (PRD v3 section 9 principle 7).
 */
export type Session = {
  role: Role;
  email: string;
  displayName: string;
  /** Opaque bearer token. Never parsed by the frontend. */
  token: string;
  /** ISO 8601 instant the session was created, for display only. */
  signedInAt: string;
};

/** Why a sign-in did not succeed. A typed result, never a thrown string (prompt 06 section 8). */
export type SignInFailureReason =
  /** The email is not one of the demo accounts, or the password is wrong. One message for both, so neither is confirmed separately. */
  | "invalid_credentials"
  /** The device has no connection. A new sign-in needs one; an existing session does not. */
  | "offline"
  /** The device is online but the server cannot be reached, took too long, or failed. Only the real API has this case. */
  | "unavailable";

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: SignInFailureReason };
