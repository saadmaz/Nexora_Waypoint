import type { Role } from "../../domain/status";

/**
 * Every string on the sign-in frames G1.1 to G1.5, copied from Figma. The sign-in prints the
 * neutral "Waypoint"; each role shows its own app name after it (PRD v3 section 6).
 */
export const SIGN_IN_STRINGS = {
  brand: "Waypoint",
  title: "Sign in",
  emailLabel: "Email",
  emailPlaceholder: "name@waypoint.lk",
  passwordLabel: "Password",
  submit: "Sign in",
  /** G1.4. One message for a wrong password and an unknown email, so neither is confirmed alone. */
  wrongPassword: "Email or password is wrong.",
  /** G1.5. */
  offlineTitle: "You're offline",
  offlineBody: "Sign-in needs a connection once. After that, field screens work offline.",
  demoHeading: "Demo accounts",
  demoTag: "Prototype",
} as const;

/** The role name on a demo row: "Kumari · Dispatcher". The store's person is a store manager. */
export const ROLE_LABEL: Record<Role, string> = {
  dispatcher: "Dispatcher",
  loader: "Loader",
  driver: "Driver",
  store: "Store manager",
};
