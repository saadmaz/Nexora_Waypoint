import type { Role } from "../../domain/status";
import type { Session } from "./types";

/**
 * Per-role session storage (PRD v3 section 9).
 *
 * Sessions live under `wp.session.dispatcher`, `wp.session.loader`, `wp.session.driver`
 * and `wp.session.store`, one key each, so one browser can hold all four roles in four
 * tabs at once. The judge walkthrough (PRD v3 section 16) depends on exactly that, so
 * these are never collapsed into a single key.
 *
 * Every read and write is wrapped: a private window, cleared site data or a quota error
 * must never break sign-in. A failed read counts as "not signed in"; a failed write
 * leaves a session that lasts the tab, held in memory below.
 *
 * The driver's token has to survive going offline so the outbox can sync later
 * (PRD v3 section 15), so nothing here clears a session on a failed network call.
 * Only an explicit sign-out clears one.
 */

const KEY_PREFIX = "wp.session.";

/** The four roles, in the order the role picker shows them (PRD v3 section 3). */
export const ROLES: Role[] = ["dispatcher", "loader", "driver", "store"];

export function sessionKey(role: Role): string {
  return `${KEY_PREFIX}${role}`;
}

/**
 * Sessions that could not be persisted, kept for the life of the tab. A browser that
 * refuses localStorage still signs in; the session just does not outlive the tab.
 *
 * Only roles whose write actually failed are held here. A role that persisted normally
 * is dropped from the map, so storage stays the single source for it: a session cleared
 * in another tab, or by clearing site data, then correctly reads as signed out.
 */
const fallback = new Map<Role, Session>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Accessing localStorage itself throws when site data is blocked.
    return null;
  }
}

/** A stored value is only a session if it still carries all four fields for the role asked for. */
function parse(raw: string, role: Role): Session | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const candidate = value as Partial<Session>;
    if (
      typeof candidate.email !== "string" ||
      typeof candidate.displayName !== "string" ||
      typeof candidate.token !== "string" ||
      typeof candidate.signedInAt !== "string" ||
      candidate.role !== role
    ) {
      return null;
    }
    return {
      role,
      email: candidate.email,
      displayName: candidate.displayName,
      token: candidate.token,
      signedInAt: candidate.signedInAt,
    };
  } catch {
    // Truncated or hand-edited JSON reads as "not signed in" rather than crashing the app.
    return null;
  }
}

export function readSession(role: Role): Session | null {
  const store = storage();
  if (store) {
    try {
      const raw = store.getItem(sessionKey(role));
      if (raw !== null) return parse(raw, role);
      // Storage is readable and holds nothing for this role. That is a real signed-out
      // answer unless this tab knows the write failed, which is the only case the
      // fallback is allowed to answer.
      return fallback.get(role) ?? null;
    } catch {
      // Storage exists but refused to read. Fall through to what this tab holds.
    }
  }
  return fallback.get(role) ?? null;
}

export function writeSession(role: Role, session: Session): void {
  // Held either way, so a quota error still leaves the tab signed in.
  fallback.set(role, session);
  const store = storage();
  if (!store) return;
  try {
    store.setItem(sessionKey(role), JSON.stringify(session));
    // Persisted, so storage is now the single source for this role and the fallback
    // must not be able to answer with an older session later.
    fallback.delete(role);
  } catch {
    // Quota exceeded or storage disabled: the in-memory session above is the session.
  }
}

/** Signs out of one role only. The other three keep their sessions (prompt 06 section 6). */
export function clearSession(role: Role): void {
  fallback.delete(role);
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(sessionKey(role));
  } catch {
    // Nothing to do: the in-memory session is already gone.
  }
}

/**
 * The first session found, for the `/` redirect, in role-picker order. A browser holding
 * several roles lands on the first of them; the role picker at `/start` is how you reach
 * the others.
 */
export function readAnySession(): Session | null {
  for (const role of ROLES) {
    const session = readSession(role);
    if (session) return session;
  }
  return null;
}

/** Every session this browser holds, for the `/start` cards' signed-in state. */
export function readAllSessions(): Partial<Record<Role, Session>> {
  const all: Partial<Record<Role, Session>> = {};
  for (const role of ROLES) {
    const session = readSession(role);
    if (session) all[role] = session;
  }
  return all;
}
