import type { Role } from "../../domain/status";
import type { paths } from "../schema";
import { ApiError, NetworkUnavailableError, toApiError } from "./errors";
import { WRITE_EVENT } from "./events";
import type { Method, OperationOf, OptionsArgs, PathsFor, RequestOptions, ResponseOf } from "./types";

/** Where a client gets the bearer token for a role, and what happens when the server rejects it. */
export type TokenSource = {
  /** The stored token for the role, or null when that role is signed out. Reads storage; makes no request. */
  get(role: Role): string | null;
  /** The server answered 401 for a request made as this role: the session is no longer valid. */
  onUnauthorized(role: Role): void;
};

export type HttpClientConfig = {
  /** `http://localhost:8000` in dev, `""` for the same origin (the nginx proxy in Docker). No trailing slash. */
  baseUrl: string;
  /** The role every request is made as. Omit for the few routes that need no sign-in (login, health). */
  role?: Role;
  /** Required when `role` is set. */
  tokens?: TokenSource;
  /** Milliseconds before a request is given up as a timeout. Default 15 000. */
  timeoutMs?: number;
  /** For tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
};

export type HttpClient = {
  request<M extends Method, P extends PathsFor<M>>(
    method: M,
    path: P,
    ...args: OptionsArgs<OperationOf<P, M>>
  ): Promise<ResponseOf<OperationOf<P, M>>>;
  get<P extends PathsFor<"get">>(path: P, ...args: OptionsArgs<OperationOf<P, "get">>): Promise<ResponseOf<OperationOf<P, "get">>>;
  post<P extends PathsFor<"post">>(path: P, ...args: OptionsArgs<OperationOf<P, "post">>): Promise<ResponseOf<OperationOf<P, "post">>>;
  patch<P extends PathsFor<"patch">>(path: P, ...args: OptionsArgs<OperationOf<P, "patch">>): Promise<ResponseOf<OperationOf<P, "patch">>>;
  delete<P extends PathsFor<"delete">>(path: P, ...args: OptionsArgs<OperationOf<P, "delete">>): Promise<ResponseOf<OperationOf<P, "delete">>>;
};

const DEFAULT_TIMEOUT_MS = 15_000;

/** Fills `{name}` in a path template. The generated schema names params exactly as the backend does, for example `order_id`. */
function fillPath(template: string, params: Record<string, unknown> | undefined): string {
  return template.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined || value === null) throw new Error(`Missing path parameter "${name}" for ${template}`);
    return encodeURIComponent(String(value));
  });
}

function queryString(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) for (const item of value) search.append(key, String(item));
    else search.append(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * The typed HTTP client for the backend. Every call is checked against the generated `schema.ts`: the path, its
 * params, the body and the reply type. It owns the bearer header, the timeout and the one error shape, so a role
 * client only says which operation it wants.
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request(method: Method, template: string, options: RequestOptions<never> | undefined): Promise<unknown> {
    const opts = (options ?? {}) as { path?: Record<string, unknown>; query?: Record<string, unknown>; body?: unknown; signal?: AbortSignal };
    const headers: Record<string, string> = { Accept: "application/json" };

    if (config.role) {
      const token = config.tokens?.get(config.role) ?? null;
      if (token === null) {
        // Nothing to send: signed out already. Say so without a pointless round trip.
        config.tokens?.onUnauthorized(config.role);
        throw new ApiError(401, "unauthenticated", "Sign in to continue");
      }
      headers.Authorization = `Bearer ${token}`;
    }

    let body: BodyInit | undefined;
    if (opts.body instanceof FormData) {
      body = opts.body; // the browser sets the multipart boundary itself
    } else if (opts.body !== undefined) {
      body = JSON.stringify(opts.body);
      headers["Content-Type"] = "application/json";
    }

    const url = `${config.baseUrl}${fillPath(template, opts.path)}${queryString(opts.query)}`;

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const forwardAbort = () => controller.abort();
    if (opts.signal?.aborted) controller.abort();
    else opts.signal?.addEventListener("abort", forwardAbort, { once: true });

    let response: Response;
    try {
      response = await (config.fetchImpl ?? fetch)(url, { method: method.toUpperCase(), headers, body, signal: controller.signal });
    } catch (error) {
      if (timedOut) throw new NetworkUnavailableError("timeout");
      // A caller's own abort is not a network problem: let it through untouched.
      if (opts.signal?.aborted) throw error;
      throw new NetworkUnavailableError("offline");
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", forwardAbort);
    }

    const parsed = await readBody(response);
    if (response.ok) {
      // A write may have moved the scenario clock or its jobs: tell the clock to look again (DP-26).
      if (method !== "get" && typeof window !== "undefined") window.dispatchEvent(new Event(WRITE_EVENT));
      return parsed;
    }

    // Only a real 401 from the server ends a session. A dropped connection never reaches this line.
    if (response.status === 401 && config.role) config.tokens?.onUnauthorized(config.role);
    throw toApiError(response.status, parsed);
  }

  const call = (method: Method) => (path: string, ...args: unknown[]) => request(method, path, args[0] as RequestOptions<never> | undefined);

  return {
    request: (method: Method, path: string, ...args: unknown[]) => request(method, path, args[0] as RequestOptions<never> | undefined),
    get: call("get"),
    post: call("post"),
    patch: call("patch"),
    delete: call("delete"),
  } as HttpClient;
}

/** Type-only re-export so callers can name a path without importing the generated file. */
export type ApiPath = keyof paths;
