import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Role } from "../../domain/status";
import { readSession } from "./session";

/**
 * Lets a role's screens render only when that role has a session in this browser (PRD v3 section 15). Anyone
 * else goes to sign-in. Reading storage never throws, so a blocked `localStorage` also lands on sign-in.
 */
export function RequireSession({ role, children }: { role: Role; children: ReactNode }) {
  return readSession(role) ? <>{children}</> : <Navigate to="/sign-in" replace />;
}
