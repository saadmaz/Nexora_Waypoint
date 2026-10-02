import { Navigate } from "react-router-dom";
import { ROLE_HOME } from "./AuthApi";
import { readAnySession } from "./session";

/**
 * `/`: a signed-in person goes to their role's home, anyone else to sign-in (PRD v3 section 15).
 * A browser holding several roles lands on the first of them; `/start` is how it reaches the others.
 * Reading storage never throws, so a blocked `localStorage` simply sends the person to sign-in.
 */
export function RootRedirect() {
  const session = readAnySession();
  return <Navigate to={session ? ROLE_HOME[session.role] : "/sign-in"} replace />;
}
