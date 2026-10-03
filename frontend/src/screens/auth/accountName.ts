import type { Role } from "../../domain/status";
import { ACCOUNTS } from "./AuthApi";
import { readSession } from "./session";

export const ROLE_LABEL: Record<Role, string> = {
  dispatcher: "Dispatcher",
  loader: "Loader",
  driver: "Driver",
  store: "Store manager",
};

/** Who is signed in to this role: the session's name, or the demo account's when there is no session (galleries). */
export function accountName(role: Role): string {
  return readSession(role)?.displayName ?? ACCOUNTS.find((account) => account.role === role)?.displayName ?? ROLE_LABEL[role];
}
