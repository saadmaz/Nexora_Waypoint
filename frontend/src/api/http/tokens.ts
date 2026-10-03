import type { Role } from "../../domain/status";
import { clearSession, readSession } from "../../screens/auth/session";
import type { TokenSource } from "./client";

/** Fired on `window` when the server says a role's session is no longer valid. `detail.role` is the role. */
export const SESSION_EXPIRED_EVENT = "wp:session-expired";

export type SessionExpiredDetail = { role: Role };

/**
 * The token source the app uses: the per-role session store (`wp.session.<role>`). A 401 clears that one role and
 * announces it, so the app can send the person to sign in. The other three roles keep their sessions, and nothing
 * here runs on a network failure: a driver who goes offline keeps their token so the outbox can sync later.
 */
export const sessionTokens: TokenSource = {
  get(role) {
    return readSession(role)?.token ?? null;
  },
  onUnauthorized(role) {
    clearSession(role);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, { detail: { role } }));
    }
  },
};
