import { authApiMode, type AuthApi } from "./AuthApi";
import { mockAuthApi } from "./mockAuthApi";

/**
 * The AuthApi the screens use, chosen by `VITE_AUTH_API` (PRD v3 section 9 principle 7).
 * Screens call this and never `fetch` or the mock directly. The real client joins here when the
 * backend is wired; its shapes are in `claude/field-build/auth-endpoints.md`.
 */
export function getAuthApi(): AuthApi {
  if (authApiMode() === "api") {
    throw new Error("VITE_AUTH_API=api needs the real AuthApi client, which is not built yet.");
  }
  return mockAuthApi;
}
