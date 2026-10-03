import { authApiMode, type AuthApi } from "./AuthApi";
import { apiAuthApi } from "./apiAuthApi";
import { devMocks } from "../../devMocks/registry";

/**
 * The AuthApi the screens use, chosen by `VITE_AUTH_API` (PRD v3 section 9 principle 7).
 * Screens call this and never `fetch` or the mock directly. `api` is the real backend
 * (`apiAuthApi`); `mock` stays the default.
 */
export function getAuthApi(): AuthApi {
  return authApiMode() === "api" ? apiAuthApi : devMocks().auth.mockAuthApi;
}
