import { ApiError, isNetworkUnavailable } from "../../api/http/errors";
import type { DepotId } from "../../domain/field";
import type { components } from "../../api/schema";
import {
  attachBlob,
  enqueue,
  getCache,
  getRecord,
  listRecords,
  NetworkError,
  nowMs,
  putCache,
  registerApiBlobUploader,
  registerApiSyncHandlers,
  request,
} from "../../field/offline";
import { formatTime } from "../../field/clock/clock";
import { mapDock, mapException, mapLoadPlan, mapPlanDiff, readLocalState } from "./apiLoaderMapper";
import type { LoaderApi } from "./LoaderApi";
import type { ExceptionView } from "./types";

type Schemas = components["schemas"];

const LOADER_RECORD_TYPES = ["loader.ack", "loader.check", "loader.confirmLoaded", "loader.exception"] as const;

/**
 * Registers how the loader's records reach the real server: through `POST /sync`, keyed by `clientId`. Replaces the mock's
 * handlers (which register themselves when `mockLoaderApi.ts` loads) when `VITE_LOADER_API=api`. Safe to call more than once.
 */
export function registerApiLoaderHandlers(): void {
  registerApiSyncHandlers("loader", LOADER_RECORD_TYPES);
  registerApiBlobUploader("loader");
}

const isNumeric = (value: string) => /^\d+$/.test(value);

/**
 * The loader's real API (field conventions section 10), over `/api/v1/loader/*` and `POST /sync`. Same interface as the mock.
 *
 * - **Reads** go to the server, then the tablet's own unsent work is laid over them (see `apiLoaderMapper.ts`), so a count just
 *   recorded shows at once. The dock board and a load list are kept on the tablet as they last arrived; with no connection that copy
 *   stands in, and the unsent work is still laid over it, so counts taken offline show. Other reads need a connection.
 * - **Writes** (acknowledge, count, confirm loaded, flag) are saved in the outbox first and sent through `/sync`, as in the mock.
 * - **Flags** get their id from the server only once the record has synced. Until then the id is the record's own `clientId`,
 *   and `getException` answers from the tablet's copy of what was flagged.
 * - **PINs** are checked by the server and so need a connection. The tablet does not cache hashes for offline checks yet, and a
 *   guest PIN has no server counterpart, so a person who is not a numeric server id cannot be verified in api mode.
 * - Nothing falls back to fixtures. A 501 reaches the screen as the typed error.
 */
export function createApiLoaderApi(): LoaderApi {
  // The loader calls these with a vehicle or a version, not a dock, so the dock the tablet is at is remembered from `getDock`.
  let lastDock: DepotId = "peliyagoda";
  let dockVehicleIds: string[] = [];

  /** Reads from the server and keeps the answer. With no connection the last answer stands in; with none kept, the failure stands. */
  async function readKept<T>(key: string, load: () => Promise<T>): Promise<T> {
    try {
      const fresh = await load();
      await putCache(key, fresh, nowMs());
      return fresh;
    } catch (error) {
      if (!(error instanceof NetworkError) && !isNetworkUnavailable(error)) throw error;
      const kept = await getCache<T>(key);
      if (!kept) throw error;
      return kept.value;
    }
  }

  async function readDock(dockId: DepotId): Promise<Schemas["DockOut"]> {
    return readKept(`loader:dock:${dockId}`, () => request<Schemas["DockOut"]>("loader.getDock", { dock: dockId }));
  }

  async function getException(id: string): Promise<ExceptionView> {
    if (isNumeric(id)) return mapException(await request<Schemas["LoaderExceptionOut"]>("loader.getException", { id: Number(id) }));

    // Not synced yet: answer from the tablet's copy of the flag.
    const record = await getRecord(id);
    if (!record || record.type !== "loader.exception") throw new ApiError(404, "not_found", "That flag was not found on this tablet");
    const serverId = (record.serverPayload as { exceptionId?: unknown } | undefined)?.exceptionId;
    if (typeof serverId === "number") return mapException(await request<Schemas["LoaderExceptionOut"]>("loader.getException", { id: serverId }));
    const p = record.payload as Omit<ExceptionView, "id" | "status"> & { personName?: string };
    return {
      id,
      type: p.type,
      vehicleId: p.vehicleId,
      trip: p.trip,
      orderIds: p.orderIds,
      ...(p.unitsShort !== undefined ? { unitsShort: p.unitsShort } : {}),
      ...(p.note !== undefined ? { note: p.note } : {}),
      ...(p.reason !== undefined ? { reason: p.reason } : {}),
      ...(p.personName ? { raisedBy: p.personName } : {}),
      raisedAt: formatTime(record.createdAt),
      status: "reviewing",
    };
  }

  return {
    async getDock(dockId) {
      const out = await readDock(dockId);
      lastDock = dockId;
      dockVehicleIds = [...new Set(out.vehicles.map((v) => v.vehicleId))];
      return mapDock(out, dockId, readLocalState(await listRecords()));
    },

    async getPeople(dockId) {
      return (await readDock(dockId)).people.map((person) => ({ id: String(person.id), name: person.name }));
    },

    async verifyPin(personId, pin) {
      if (!isNumeric(personId)) return false;
      const out = await request<Schemas["VerifyPinOut"]>("loader.verifyPin", { personId: Number(personId), pin });
      return out.ok;
    },

    async acknowledgePlan({ dockId, version, personId, personName }) {
      // With a connection, a version released since is a conflict now. Without one the tablet takes the acknowledgement and
      // the server answers on sync, as for every offline write.
      try {
        if (version < (await readDock(dockId)).planVersion) return "conflict";
      } catch (error) {
        if (!(error instanceof NetworkError) && !isNetworkUnavailable(error)) throw error;
      }
      await enqueue({ type: "loader.ack", payload: { dockId, version, personId, personName }, actor: personId, planVersionOnDevice: version });
      return "accepted";
    },

    async getLoadPlan(vehicleId, trip) {
      const out = await readKept(`loader:plan:${vehicleId}:${trip}`, () => request<Schemas["LoadPlanOut"]>("loader.getLoadPlan", { vehicleId, trip }));
      return mapLoadPlan(out, lastDock, readLocalState(await listRecords()));
    },

    async recordCheck(input) {
      await enqueue({ type: "loader.check", payload: input, actor: input.personId, planVersionOnDevice: null });
    },

    async confirmLoaded(input) {
      await enqueue({ type: "loader.confirmLoaded", payload: input, actor: input.personId, planVersionOnDevice: null });
    },

    async flagException(input) {
      const clientId = crypto.randomUUID();
      // A photo is tied to its record before the record is queued: queueing starts a sync at once, and a photo with no owner
      // would be sent ahead of the flag it belongs to.
      await Promise.all((input.blobIds ?? []).map((id) => attachBlob(id, clientId)));
      await enqueue({
        clientId,
        type: "loader.exception",
        payload: { ...input, id: clientId },
        actor: input.personId,
        planVersionOnDevice: null,
        blobIds: input.blobIds,
      });
      return clientId;
    },

    getException,

    async getPlanDiff(dockId, from, to) {
      const out = await request<Schemas["PlanDiffOut"]>("loader.getPlanDiff", { dock: dockId, from, to });
      return mapPlanDiff(out, dockVehicleIds);
    },

    async getCurrentVersion() {
      return (await readDock(lastDock)).planVersion;
    },

    async devResolveExceptionNow() {
      // The mock's shortcut for the demo clock. On the real server Dispatch decides, so there is nothing to force here.
    },
  };
}
