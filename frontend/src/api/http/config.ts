import type { Role } from "../../domain/status";
import { modeFor, type ApiMode } from "../dataSource";
import { createHttpClient, type HttpClient } from "./client";
import { sessionTokens } from "./tokens";

/**
 * The backend's origin, from `VITE_API_BASE`. Unset, dev talks to the API on port 8000 and a production build
 * uses the same origin, where nginx proxies `/api` (docker-compose.yml). No trailing slash.
 */
export function apiBase(): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  const base = configured ?? (import.meta.env.DEV ? "http://localhost:8000" : "");
  return base.replace(/\/+$/, "");
}

export type { ApiMode } from "../dataSource";

/** Whether `role` runs on the API or its mock: `VITE_DATA_SOURCE` (live or mock, mock by default), unless `VITE_<ROLE>_API` overrides it. */
export function roleApiMode(role: Role): ApiMode {
  const env = import.meta.env;
  return modeFor({ store: env.VITE_STORE_API, dispatcher: env.VITE_DISPATCHER_API, loader: env.VITE_LOADER_API, driver: env.VITE_DRIVER_API }[role]);
}

/** A client that makes every request as `role`, with that role's own token. */
export function apiClient(role: Role): HttpClient {
  return createHttpClient({ baseUrl: apiBase(), role, tokens: sessionTokens });
}

/** A client for the routes that need no sign-in: login and health. */
export function publicApiClient(): HttpClient {
  return createHttpClient({ baseUrl: apiBase() });
}
