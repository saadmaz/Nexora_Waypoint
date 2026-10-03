import { ApiError, NetworkError, type DepotId, type DispatcherApi } from "./DispatcherApi";
import {
  acknowledgementsFromApi,
  capacityViewFromApi,
  conflictViewFromApi,
  decisionToApi,
  deferralKindToApi,
  deferralsViewFromApi,
  deferStopResultFromApi,
  exceptionViewFromApi,
  forecastFromApi,
  inboxFromApi,
  liveBoardFromApi,
  moveRequestToApi,
  moveResultFromApi,
  numericId,
  orderHistoryFromApi,
  planViewFromApi,
  queueQuery,
  queueViewFromApi,
  resolutionToApi,
} from "./dispatcherMappers";
import type { HttpClient } from "./http/client";
import { apiClient } from "./http/config";
import { ApiError as HttpApiError, NetworkUnavailableError, NotImplementedApiError } from "./http/errors";

/** The depot a plan route answers for when no screen has asked for a plan yet: Peliyagoda, the first tab (D3). */
export const DEFAULT_VIEW_DEPOT: DepotId = "peliyagoda";

/** The operations whose 409 means "this plan is released, so it can no longer be changed" (the mock's `read_only`). */
const PLAN_EDITS: ReadonlySet<string> = new Set(["redraftPlan", "saveMoves", "releasePlan"]);

/**
 * Turns whatever the HTTP layer threw into the errors the dispatcher screens already catch (`DispatcherApi.ts`): its own
 * `ApiError(code, message)` and `NetworkError`. The message is always the server's, because the screens print it.
 *
 *  - no answer (offline, timeout)   -> `NetworkError`
 *  - 501 `not_implemented`          -> `ApiError("not_implemented")`; no mock fallback (the screen's error state shows it)
 *  - 404                            -> `ApiError("not_found")`, which the conflict and exception screens test for
 *  - 409 on a plan edit             -> `ApiError("read_only")`; `illegal_transition` or `illegal_move` on `saveMoves` -> `"illegal_move"`
 *  - anything else                  -> `ApiError` with the server's own code
 */
export function toDispatcherError(error: unknown, operation: string): unknown {
  if (error instanceof NetworkUnavailableError) return new NetworkError();
  if (error instanceof NotImplementedApiError) return new ApiError("not_implemented", error.message);
  if (error instanceof HttpApiError) {
    if (operation === "saveMoves" && (error.code === "illegal_transition" || error.code === "illegal_move")) return new ApiError("illegal_move", error.message);
    if (error.status === 404) return new ApiError("not_found", error.message);
    if (error.status === 409 && PLAN_EDITS.has(operation)) return new ApiError("read_only", error.message);
    return new ApiError(error.code, error.message);
  }
  return error;
}

export type HttpDispatcherOptions = {
  /**
   * Called with `true` when a request got no answer and with `false` when one did, so the provider can switch the screens to
   * their offline behaviour (keep what they last loaded, writes off) on a real failure and not only on `navigator.onLine`.
   */
  onConnection?: (online: boolean) => void;
};

/**
 * The real `DispatcherApi`, over `/api/v1/dispatcher/*` (backend `routers/dispatcher.py`). Same interface as the mock, so a
 * screen cannot tell them apart.
 *
 * - No response type is written by hand. Replies are `schema.ts` types, converted to the screens' views in
 *   `dispatcherMappers.ts` (enum values, null versus absent, the move target, ids).
 * - `redraftPlan`, `saveMoves` and `releasePlan` act on the whole service day and take a `depot` query param that picks which
 *   depot's view comes back. The interface has no depot there, so the client uses the depot of the last `getPlan` the
 *   screens made, and `DEFAULT_VIEW_DEPOT` before that. `listAcknowledgements` takes no depot.
 * - Every failure becomes the dispatcher's own `ApiError` or `NetworkError` (`toDispatcherError`). A 501 is a typed error and
 *   never falls back to the mock.
 */
export function createHttpDispatcherApi(getClient: () => HttpClient = () => apiClient("dispatcher"), options: HttpDispatcherOptions = {}): DispatcherApi {
  const client = () => getClient();
  let viewing: DepotId = DEFAULT_VIEW_DEPOT;

  async function call<T>(operation: string, run: () => Promise<T>): Promise<T> {
    try {
      const result = await run();
      options.onConnection?.(true);
      return result;
    } catch (error) {
      if (error instanceof NetworkUnavailableError) options.onConnection?.(false);
      else if (error instanceof HttpApiError) options.onConnection?.(true); // the server answered, so the connection is up
      throw toDispatcherError(error, operation);
    }
  }

  return {
    getQueue(query) {
      return call("getQueue", async () => queueViewFromApi(await client().get("/api/v1/dispatcher/queue", { query: queueQuery(query) })));
    },

    getOrderHistory(orderId) {
      return call("getOrderHistory", async () =>
        orderHistoryFromApi(await client().get("/api/v1/dispatcher/orders/{order_id}/history", { path: { order_id: orderId } })),
      );
    },

    getCapacity({ depot }) {
      return call("getCapacity", async () => capacityViewFromApi(await client().get("/api/v1/dispatcher/capacity", { query: { depot } })));
    },

    getPlan({ depot, version }) {
      viewing = depot;
      return call("getPlan", async () =>
        planViewFromApi(await client().get("/api/v1/dispatcher/plan", { query: { depot, ...(version !== undefined ? { version } : {}) } })),
      );
    },

    redraftPlan() {
      return call("redraftPlan", async () => planViewFromApi(await client().post("/api/v1/dispatcher/plan/redraft", { query: { depot: viewing } })));
    },

    validateMove(request) {
      return call("validateMove", async () =>
        moveResultFromApi(await client().post("/api/v1/dispatcher/plan/validate-move", { body: moveRequestToApi(request) })),
      );
    },

    saveMoves({ moves, note }) {
      return call("saveMoves", async () =>
        planViewFromApi(
          await client().post("/api/v1/dispatcher/plan/moves", {
            query: { depot: viewing },
            body: { moves: moves.map(moveRequestToApi), ...(note !== undefined ? { note } : {}) },
          }),
        ),
      );
    },

    listDeferrals({ depot }) {
      return call("listDeferrals", async () => deferralsViewFromApi(await client().get("/api/v1/dispatcher/deferrals", { query: { depot } })));
    },

    notifyDeferrals({ depot }) {
      return call("notifyDeferrals", async () => {
        const out = await client().post("/api/v1/dispatcher/deferrals/notify", { body: { depot } });
        return { sent: out.sent };
      });
    },

    releasePlan({ sendNotices }) {
      return call("releasePlan", async () =>
        planViewFromApi(await client().post("/api/v1/dispatcher/plan/release", { query: { depot: viewing }, body: { sendNotices } })),
      );
    },

    listAcknowledgements({ version }) {
      return call("listAcknowledgements", async () =>
        acknowledgementsFromApi(await client().get("/api/v1/dispatcher/acknowledgements", { query: version !== undefined ? { version } : {} })),
      );
    },

    getLiveBoard({ depot, all }) {
      return call("getLiveBoard", async () => liveBoardFromApi(await client().get("/api/v1/dispatcher/live", { query: { depot, ...(all ? { all: true } : {}) } })));
    },

    deferStop({ orderIds, kind, reason }) {
      return call("deferStop", async () =>
        deferStopResultFromApi(await client().post("/api/v1/dispatcher/stops/defer", { body: { orderIds, kind: deferralKindToApi(kind), reason } })),
      );
    },

    getInbox() {
      return call("getInbox", async () => inboxFromApi(await client().get("/api/v1/dispatcher/inbox")));
    },

    getConflict(id) {
      return call("getConflict", async () =>
        conflictViewFromApi(await client().get("/api/v1/dispatcher/conflicts/{conflict_id}", { path: { conflict_id: numericId(id, "conflict") } })),
      );
    },

    askStore(id) {
      return call("askStore", async () =>
        conflictViewFromApi(await client().post("/api/v1/dispatcher/conflicts/{conflict_id}/ask-store", { path: { conflict_id: numericId(id, "conflict") } })),
      );
    },

    resolveConflict(id, resolution) {
      return call("resolveConflict", async () =>
        conflictViewFromApi(
          await client().post("/api/v1/dispatcher/conflicts/{conflict_id}/resolve", {
            path: { conflict_id: numericId(id, "conflict") },
            body: { resolution: resolutionToApi(resolution) },
          }),
        ),
      );
    },

    getExceptionForReview(id) {
      return call("getExceptionForReview", async () =>
        exceptionViewFromApi(await client().get("/api/v1/dispatcher/exceptions/{exception_id}", { path: { exception_id: numericId(id, "exception") } })),
      );
    },

    decideException(id, { decision, deferOrderIds }) {
      return call("decideException", async () =>
        exceptionViewFromApi(
          await client().post("/api/v1/dispatcher/exceptions/{exception_id}/decide", {
            path: { exception_id: numericId(id, "exception") },
            body: { decision: decisionToApi(decision), deferOrderIds },
          }),
        ),
      );
    },

    getForecast({ depot }) {
      return call("getForecast", async () => forecastFromApi(await client().get("/api/v1/dispatcher/forecast", { query: { depot } })));
    },
  };
}

// ---- The scenario clock and the presenter control ---------------------------

/**
 * The scenario clock lives on the server (`GET /clock`, `POST /demo/advance`, `POST /demo/reset`). A `Date` in the dispatcher
 * app is the scenario's wall clock read in the browser's zone, as the mock's `createScenarioClock` does, so a time from the
 * server is turned into that, and a time sent to the server is sent as a bare wall-clock string (the server reads a bare time
 * as Asia/Colombo). Colombo has no daylight saving, so the offset the server writes is always +05:30.
 */
const pad = (value: number) => String(value).padStart(2, "0");

/** "2026-09-28T15:30:00+05:30" as a Date whose local hours and minutes are 15:30. */
export function fromServerTime(text: string): Date {
  return new Date(text.slice(0, 19));
}

/** A Date whose local hours and minutes are the scenario time, as the bare string the server reads as Colombo. */
export function toServerTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export type DispatcherDemo = {
  /** The server's scenario time now. */
  readClock(): Promise<Date>;
  /** Moves the server clock forward to `to` and returns where it is now. A 409 `clock_backwards` is an `ApiError`. */
  advance(to: Date): Promise<Date>;
  /** Truncates the operational tables and re-runs the seed, then returns the clock (back at the checkpoint). */
  reset(): Promise<Date>;
};

export function createDispatcherDemo(getClient: () => HttpClient = () => apiClient("dispatcher")): DispatcherDemo {
  async function run(operation: string, request: () => Promise<{ now: string }>): Promise<Date> {
    try {
      return fromServerTime((await request()).now);
    } catch (error) {
      throw toDispatcherError(error, operation);
    }
  }
  return {
    readClock: () => run("getClock", () => getClient().get("/api/v1/clock")),
    advance: (to) => run("advanceClock", () => getClient().post("/api/v1/demo/advance", { body: { to: toServerTime(to) } })),
    reset: () => run("resetDemo", async () => (await getClient().post("/api/v1/demo/reset")).clock),
  };
}
