import type { HttpClient } from "../../api/http/client";
import { apiClient, roleApiMode, type ApiMode } from "../../api/http/config";
import { isNetworkUnavailable } from "../../api/http/errors";
import type { components } from "../../api/schema";
import type { Role } from "../../domain/status";
import { connectivity } from "./connectivity";
import { mockTransport, NetworkError, setTransport, type Transport } from "./transport";

/** The request and reply of `POST /sync`, straight from the generated schema. */
export type SyncIn = components["schemas"]["SyncIn"];
export type SyncOut = components["schemas"]["SyncOut"];

/** The two roles that work through the offline core. The store and the dispatcher are online-only and call `apiClient` directly. */
export type FieldRole = "driver" | "loader";
export const FIELD_ROLES: readonly FieldRole[] = ["driver", "loader"];

/** What a role's `uploadBlob` op carries. `clientId` is the blob's own id, the idempotency key of `POST /attachments`. */
export type UploadBlobPayload = {
  clientId: string;
  kind: "photo" | "signature";
  blob: Blob;
  /** The mock ignores everything below; the real route needs only the three above. */
  id?: string;
  bytes?: number;
};

type Route = (client: HttpClient, payload: unknown) => Promise<unknown>;

/** Types a route's payload once, here, so a table row reads as "this op takes that and calls this route". */
function route<P = undefined>(run: (client: HttpClient, payload: P) => Promise<unknown>): Route {
  return (client, payload) => run(client, payload as P);
}

function upload(client: HttpClient, payload: UploadBlobPayload): Promise<unknown> {
  const form = new FormData();
  form.append("clientId", payload.clientId);
  form.append("kind", payload.kind);
  form.append("file", payload.blob, payload.kind === "signature" ? "signature.png" : "photo.jpg");
  return client.post("/api/v1/attachments", { body: form as never });
}

/**
 * Every op of the field roles that the real backend answers, as method, path and params. The op names are the ones the
 * offline core already speaks (`driver.downloadRoute`, ...), so nothing above the transport changes. Writes are not here
 * one by one: PRD section 19 sends every driver and loader write through `POST /sync` as an outbox record, so a role has
 * one `sync` op, not one per action.
 */
const ROUTES: Record<string, Route> = {
  "driver.getRun": route<{ date: string }>((c, p) => c.get("/api/v1/driver/runs/{day}", { path: { day: p.date } })),
  // The same endpoint: `downloadRun` only also keeps the reply on the phone. The route package carries its own plan version.
  "driver.downloadRoute": route<{ date: string }>((c, p) => c.get("/api/v1/driver/runs/{day}", { path: { day: p.date } })),
  "driver.getNotices": route<{ since?: string } | undefined>((c, p) => c.get("/api/v1/driver/notices", { query: { since: p?.since } })),
  // Who is signed in: the depot is read from here, since the route package does not carry it.
  "driver.getMe": route((c) => c.get("/api/v1/me")),
  "driver.getHistory": route((c) => c.get("/api/v1/driver/history")),
  "driver.sync": route<SyncIn>((c, p) => c.post("/api/v1/sync", { body: p })),
  "driver.uploadBlob": route<UploadBlobPayload>(upload),

  "loader.getDock": route<{ dock: string }>((c, p) => c.get("/api/v1/loader/docks/{dock}", { path: { dock: p.dock } })),
  "loader.verifyPin": route<{ personId: number; pin: string }>((c, p) => c.post("/api/v1/loader/pins/verify", { body: p })),
  "loader.getLoadPlan": route<{ vehicleId: string; trip: number }>((c, p) =>
    c.get("/api/v1/loader/vehicles/{vehicle_id}/trips/{trip}", { path: { vehicle_id: p.vehicleId, trip: p.trip } }),
  ),
  "loader.getException": route<{ id: number }>((c, p) => c.get("/api/v1/loader/exceptions/{exception_id}", { path: { exception_id: p.id } })),
  "loader.getPlanDiff": route<{ dock: string; from: number; to: number }>((c, p) =>
    c.get("/api/v1/loader/docks/{dock}/diff", { path: { dock: p.dock }, query: { from: p.from, to: p.to } }),
  ),
  "loader.sync": route<SyncIn>((c, p) => c.post("/api/v1/sync", { body: p })),
  "loader.uploadBlob": route<UploadBlobPayload>(upload),
};

/** The role an op belongs to: the word before the first dot, as in `driver.ack`. */
export function roleOfOp(op: string): Role | undefined {
  const prefix = op.split(".", 1)[0];
  return prefix === "driver" || prefix === "loader" || prefix === "store" || prefix === "dispatcher" ? prefix : undefined;
}

export function hasRoute(op: string): boolean {
  return op in ROUTES;
}

export type FetchTransportOptions = {
  /** The client that makes requests as one role. Defaults to `apiClient`; tests pass a stubbed one. */
  clientFor?: (role: Role) => HttpClient;
};

/**
 * The real transport (field conventions section 10): the same `Transport` as the mock, over `fetch`.
 *
 * - A device that is offline, simulated offline or behind a closed coverage gate fails with a `NetworkError` before any
 *   request is made, exactly like the mock, so the Simulate offline switch and the Kandy gap still work in api mode.
 * - A request that gets no answer (offline, unreachable, timed out) becomes a `NetworkError`, so the outbox puts the record
 *   back and the connectivity chip shows it. It never signs anyone out.
 * - Every other failure stays a typed `ApiError`, and a 501 stays a `NotImplementedApiError`. A real 401 is handled by the
 *   client (it clears that one role and fires `wp:session-expired`).
 * - An op with no route is a programming error, not a network problem, and says so.
 *
 * Retrying is safe because writes carry their `clientId`: this transport never creates, changes or drops one.
 */
export function createFetchTransport(options: FetchTransportOptions = {}): Transport {
  const clientFor = options.clientFor ?? apiClient;
  return {
    async send(op, payload) {
      const handler = ROUTES[op];
      const role = roleOfOp(op);
      if (!handler || !role) throw new Error(`No API route for ${op}`);
      if (!connectivity.isConnected()) throw new NetworkError();
      try {
        return await handler(clientFor(role), payload);
      } catch (error) {
        if (isNetworkUnavailable(error)) throw new NetworkError(error.message);
        throw error;
      }
    },
  };
}

export type RoutingOptions = {
  real: Transport;
  mock?: Transport;
  /** Defaults to `roleApiMode`. */
  modeOf?: (role: Role) => ApiMode;
};

/**
 * One transport for both field roles. Each op goes to the real transport when its own role is in api mode and to the mock
 * otherwise, so a loader on the API and a driver on the mock can share a page without either noticing. An op for a role
 * the transport does not know goes to the mock.
 */
export function createRoutingTransport(options: RoutingOptions): Transport {
  const mock = options.mock ?? mockTransport;
  const modeOf = options.modeOf ?? roleApiMode;
  return {
    send(op, payload) {
      const role = roleOfOp(op);
      const target = role !== undefined && modeOf(role) === "api" ? options.real : mock;
      return target.send(op, payload);
    },
  };
}

/** True when at least one field role has been switched to the API (`VITE_DRIVER_API` or `VITE_LOADER_API`). */
export function anyFieldRoleOnApi(modeOf: (role: Role) => ApiMode = roleApiMode): boolean {
  return FIELD_ROLES.some((role) => modeOf(role) === "api");
}

/**
 * Installs the routing transport when a field role is on the API. With both roles on the mock (the default) nothing is
 * installed and the mock transport stays, so the app behaves as it did before this existed. Returns whether it installed.
 */
export function installFieldTransport(): boolean {
  if (!anyFieldRoleOnApi()) return false;
  setTransport(createRoutingTransport({ real: createFetchTransport() }));
  return true;
}
