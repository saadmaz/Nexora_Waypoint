import type { Role } from "../../domain/status";
import { connectivity } from "../../field/offline/connectivity";
import type { AuthApi } from "./AuthApi";
import { DEMO_PASSWORD, accountFor } from "./AuthApi";
import { clearSession, readSession, writeSession } from "./session";
import type { Session, SignInResult } from "./types";

/** Who the demo accounts are in the mock (the design's cast). The real API sends the name with the sign-in. */
const MOCK_NAMES: Record<Role, string> = { dispatcher: "Kumari", loader: "Dock tablet", driver: "Nimal", store: "Anusha" };

/**
 * The sign-in mock (prompt 06 section 8).
 *
 * Answers in 300 to 600 ms like the field transport, so the loading state is real and
 * visible rather than a flash. Tests answer at once. All four accounts take `DEMO_PASSWORD`.
 */
const latency: [number, number] = import.meta.env.MODE === "test" ? [0, 0] : [300, 600];

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/** A demo token. Opaque to the frontend, the same way a real JWT is. */
function demoToken(role: Role): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  return `demo.${role}.${nonce}`;
}

export const mockAuthApi: AuthApi = {
  async signIn(email, password): Promise<SignInResult> {
    // A new sign-in needs a connection. An existing session does not, which is why this
    // checks before authenticating and never touches stored sessions on the way out.
    if (!connectivity.isConnected()) {
      return { ok: false, reason: "offline" };
    }
    await wait(latency[0] + Math.random() * (latency[1] - latency[0]));
    if (!connectivity.isConnected()) {
      return { ok: false, reason: "offline" };
    }

    const account = accountFor(email);
    // An unknown email and a wrong password give the same answer, so neither is confirmed on its own.
    if (!account || password !== DEMO_PASSWORD) {
      return { ok: false, reason: "invalid_credentials" };
    }

    const session: Session = {
      role: account.role,
      email: account.email,
      displayName: MOCK_NAMES[account.role],
      token: demoToken(account.role),
      signedInAt: new Date().toISOString(),
    };
    writeSession(account.role, session);
    return { ok: true, session };
  },

  async signOut(role) {
    clearSession(role);
  },

  async getSession(role) {
    return readSession(role);
  },
};
