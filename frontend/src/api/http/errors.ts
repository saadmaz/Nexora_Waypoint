import type { components } from "../schema";

/** The one error shape every backend route returns: `{code, message, details}` (Contributing section 19). */
export type ErrorBody = components["schemas"]["ErrorBody"];

/** A reply from the backend that was not a success. `code` is the backend's own code, for example `invalid_credentials`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * A route that is in the contract but not built yet (HTTP 501, code `not_implemented`). Its own class so a
 * screen can say "not built yet" in its error state instead of a generic failure.
 */
export class NotImplementedApiError extends ApiError {
  /** The backend's operation name, for example `getRun`. */
  readonly operation: string;

  constructor(message: string, details: unknown = null) {
    super(501, "not_implemented", message, details);
    this.name = "NotImplementedApiError";
    const operation = (details as { operation?: unknown } | null)?.operation;
    this.operation = typeof operation === "string" ? operation : "unknown";
  }
}

/**
 * The request never got an answer: the device is offline, the server is unreachable, or the request ran out
 * of time. This is not a verdict from the server, so nothing here ever signs a person out.
 */
export class NetworkUnavailableError extends Error {
  readonly reason: "offline" | "timeout";

  constructor(reason: "offline" | "timeout") {
    super(reason === "timeout" ? "The server took too long to answer" : "No connection");
    this.name = "NetworkUnavailableError";
    this.reason = reason;
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}

/**
 * Turns a failed reply into a typed error. A body that is not the backend's error shape (a proxy's HTML 502, an
 * empty body) still becomes an ApiError, with the code `http_error`, so callers handle one kind of failure.
 */
export function toApiError(status: number, body: unknown): ApiError {
  if (isErrorBody(body)) {
    if (status === 501 || body.code === "not_implemented") return new NotImplementedApiError(body.message, body.details);
    return new ApiError(status, body.code, body.message, body.details ?? null);
  }
  return new ApiError(status, "http_error", status >= 500 ? "The server had a problem. Try again." : `The request failed (${status})`);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNotImplemented(error: unknown): error is NotImplementedApiError {
  return error instanceof NotImplementedApiError;
}

export function isNetworkUnavailable(error: unknown): error is NetworkUnavailableError {
  return error instanceof NetworkUnavailableError;
}
