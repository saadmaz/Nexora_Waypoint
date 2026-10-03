import { createHttpClient, type HttpClient } from "../../api/http/client";
import { apiBase } from "../../api/http/config";
import { ApiError, isApiError, isNetworkUnavailable } from "../../api/http/errors";
import type { Role } from "../../domain/status";
import { connectivity } from "../../field/offline/connectivity";
import type { AuthApi } from "./AuthApi";
import { clearSession, readSession, writeSession } from "./session";
import type { Session, SignInResult } from "./types";

const ROLES_KNOWN: ReadonlySet<string> = new Set<Role>(["dispatcher", "loader", "driver", "store"]);

/**
 * The real sign-in, against `POST /api/v1/auth/login` (backend `routers/auth.py`). Same interface as the mock, so
 * a screen cannot tell them apart.
 *
 * - A wrong email or password, and any other 4xx, is `invalid_credentials`. The backend answers an unknown email and
 *   a wrong password identically, and so do we.
 * - A device with no connection is `offline`, checked before any request, like the mock.
 * - A server that cannot be reached, times out or fails (5xx) is `unavailable`: the device is online but there is
 *   nobody to sign in to. The mock has no such case. Too many failed attempts (429) is `unavailable` too: the
 *   credentials were never checked, so saying the password is wrong would be untrue, and this reason already
 *   tells the person to try again shortly.
 *
 * The token is stored opaque under the role the backend returned. Signing in as one role leaves the other three
 * sessions alone, and there is no logout endpoint, so signing out is local.
 */
export function createApiAuthApi(getClient: () => HttpClient): AuthApi {
  return {
    async signIn(email, password): Promise<SignInResult> {
      if (!connectivity.isConnected()) return { ok: false, reason: "offline" };

      try {
        const out = await getClient().post("/api/v1/auth/login", { body: { email: email.trim().toLowerCase(), password } });
        if (!ROLES_KNOWN.has(out.user.role)) throw new ApiError(500, "unknown_role", `The server returned a role this app does not have: ${out.user.role}`);

        const role = out.user.role as Role;
        const session: Session = {
          role,
          email: out.user.email,
          displayName: out.user.displayName,
          token: out.accessToken,
          // Display only, and real time: a token's age is not scenario time.
          signedInAt: new Date().toISOString(),
        };
        writeSession(role, session);
        return { ok: true, session };
      } catch (error) {
        if (isNetworkUnavailable(error)) return { ok: false, reason: "unavailable" };
        if (isApiError(error)) {
          if (error.status >= 500 || error.status === 429) return { ok: false, reason: "unavailable" };
          return { ok: false, reason: "invalid_credentials" };
        }
        throw error;
      }
    },

    async signOut(role) {
      clearSession(role);
    },

    async getSession(role) {
      return readSession(role);
    },
  };
}

/** The app's real sign-in: a client with no role, since login needs no token. */
export const apiAuthApi: AuthApi = createApiAuthApi(() => createHttpClient({ baseUrl: apiBase() }));
