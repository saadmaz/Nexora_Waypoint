import { isNetworkUnavailable } from "../../../api/http/errors";
import { oneOf } from "../../../api/vocab";
import type { components } from "../../../api/schema";
import type { DepotId } from "../../../domain/field";
import {
  connectivity,
  getCache,
  NetworkError,
  createApiSyncHandler,
  putCache,
  registerApiBlobUploader,
  registerSyncHandler,
  request,
  setUploadGuard,
  type SyncHandler,
} from "../../../field/offline";
import { formatTime } from "../../../field/clock/clock";
import type { DriverNotice, DriverRun } from "../types";
import type { DriverApi } from "./DriverApi";
import {
  applyConflict,
  consumeFailNextUpload,
  createMockDriverApi,
  readDeviceState,
  writeDeviceState,
  sortNotices,
} from "./mockDriverApi";
import { conflictFromServer, mapNotice, mapRun, requireRun, SERVER_NOTICE_PREFIX } from "./runMapper";

type RunOut = components["schemas"]["RunOut"];
type MeOut = components["schemas"]["MeOut"];
type NoticeOut = components["schemas"]["NoticeOut"];

/** The route package as the phone keeps it: the server's run, and the depot from `/me`. */
type RunPackage = { run: RunOut; depot: DepotId };

const DEPOTS: readonly DepotId[] = ["peliyagoda", "kandy"];

/** A cached package younger than this is used as it is; an older one is refreshed when the phone is online. Scenario time, ms. */
export const RUN_REFRESH_MS = 30_000;
/** The same for the server's notices, so a 5 second poll does not become a 5 second request. */
export const NOTICES_REFRESH_MS = 15_000;

const packageKey = (date: string) => `driver:server-run:${date}`;
const noticesKey = (date: string) => `driver:server-notices:${date}`;
const readKey = (date: string) => `driver:server-notices-read:${date}`;

/**
 * The record types the driver sends. `driver.problem` and `driver.finishRun` are in the backend's contract; no screen records
 * them yet, so nothing is registered for them (a record of an unregistered type is left in the outbox as an error, not dropped).
 */
const DRIVER_RECORD_TYPES = ["driver.ack", "driver.startRoute", "driver.arrival", "driver.outcome"] as const;

/**
 * Registers how the driver's records reach the real server: through `POST /sync`, one record at a time, keyed by `clientId`.
 * It replaces `registerDriverHandlers` (the mock's) when `VITE_DRIVER_API=api`; never both. When the server answers
 * `conflict` for an outcome, the phone keeps the record and writes the conflict onto that stop (R1.7) from what the server
 * sent, with the "Delivery sent for review" notice, as the mock does. Safe to call more than once.
 */
export function registerApiDriverHandlers(now: () => number): void {
  const send = createApiSyncHandler("driver");
  const handler: SyncHandler = async (record) => {
    const outcome = await send(record);
    if (outcome.result === "conflict") {
      const { date, outletId } = (record.payload ?? {}) as { date?: string; outletId?: string };
      if (date && outletId) await applyConflict(date, outletId, conflictFromServer(outcome.serverPayload, now()), now());
    }
    return outcome;
  };
  for (const type of DRIVER_RECORD_TYPES) registerSyncHandler(type, handler);

  registerApiBlobUploader("driver");
  // "Fail next photo upload" (PRD section 13) is a transport setting of the presenter, and works against the real route too.
  setUploadGuard((role) => {
    if (role === "driver" && consumeFailNextUpload()) throw new Error("WP-SYNC-409");
  });
}

async function readServerNoticeIds(date: string): Promise<Set<string>> {
  return new Set((await getCache<string[]>(readKey(date)))?.value ?? []);
}

/**
 * The driver's real API (field conventions section 10), over `/api/v1/driver/*` and `POST /sync`.
 *
 * - **Reads** come from the server and are kept on the phone. `getRun` answers from that copy, so a driver who goes offline
 *   keeps the route; online it refreshes a copy older than 30 s. With no copy and no connection it throws `NetworkError`.
 * - **Writes** are the same as the mock's: saved on the phone first (so the screen shows them at once, even offline) and queued
 *   in the outbox for `/sync`. They reuse the mock's device-side logic on purpose: nothing in it is simulated server behaviour.
 * - **Notices** are the server's plus the ones the phone makes itself ("N records synced", a failed photo). A failed refresh
 *   never fails the call: the bell and list answer from the phone.
 * - Nothing falls back to fixtures. A 501 or a 401 from `getRun` reaches the screen as the typed error.
 */
export function createApiDriverApi(now: () => number): DriverApi {
  // The device-side half: acknowledge, start route, arrival, outcome, mark read, went offline. All local, none simulated.
  const device = createMockDriverApi(now);
  const inflight = new Map<string, Promise<RunPackage>>();

  async function fetchPackage(date: string): Promise<RunPackage> {
    const [run, me] = await Promise.all([request<RunOut>("driver.getRun", { date }), request<MeOut>("driver.getMe")]);
    const depot = oneOf(DEPOTS, me.depot ?? "", "depot");
    const pkg: RunPackage = { run, depot };
    await putCache(packageKey(date), pkg, now());
    return pkg;
  }

  /** One refresh at a time per day: a second caller joins the first. */
  function refresh(date: string): Promise<RunPackage> {
    const running = inflight.get(date);
    if (running) return running;
    const next = fetchPackage(date).finally(() => inflight.delete(date));
    inflight.set(date, next);
    return next;
  }

  async function packageFor(date: string): Promise<RunPackage> {
    const cached = await getCache<RunPackage>(packageKey(date));
    const fresh = cached !== undefined && now() - cached.updatedAt < RUN_REFRESH_MS;
    if (cached && (fresh || !connectivity.isConnected())) return cached.value;
    try {
      return await refresh(date);
    } catch (error) {
      // A phone with a copy keeps working when the refresh cannot get through. Only "never downloaded" fails.
      if (cached && (error instanceof NetworkError || isNetworkUnavailable(error))) return cached.value;
      throw error;
    }
  }

  async function getRun(date: string): Promise<DriverRun> {
    const pkg = await packageFor(date);
    const local = await readDeviceState(date);
    return mapRun(pkg.run, pkg.depot, local);
  }

  async function downloadRun(date: string, _version: number, onProgress?: (done: number, total: number) => void): Promise<void> {
    if (!connectivity.isConnected()) throw new NetworkError();
    onProgress?.(0, 2);
    const pkg = await refresh(date);
    onProgress?.(2, 2);
    const local = await readDeviceState(date);
    local.downloadedVersion = requireRun(pkg.run).planVersion;
    await writeDeviceState(date, local, now());
  }

  async function serverNotices(date: string, since?: string): Promise<NoticeOut[]> {
    const cached = await getCache<NoticeOut[]>(noticesKey(date));
    if (cached && (now() - cached.updatedAt < NOTICES_REFRESH_MS || !connectivity.isConnected())) return cached.value;
    try {
      const fresh = await request<NoticeOut[]>("driver.getNotices", since ? { since } : undefined);
      await putCache(noticesKey(date), fresh, now());
      return fresh;
    } catch {
      return cached?.value ?? [];
    }
  }

  async function getNotices(date: string, sinceIso?: string): Promise<DriverNotice[]> {
    const [server, read, local] = await Promise.all([serverNotices(date, sinceIso), readServerNoticeIds(date), readDeviceState(date)]);
    const fromServer = server.map((notice) => mapNotice(notice, read)).filter((notice): notice is DriverNotice => notice !== undefined);

    // Dispatch's answer to a conflict arrives as a "resolved" notice naming the stop. It also clears the conflict on that stop.
    let changed = false;
    for (const notice of server) {
      const outletId = typeof notice.link?.outletId === "string" ? notice.link.outletId : undefined;
      if (notice.tag !== "resolved" || !outletId || local.resolutions[outletId]) continue;
      const link = notice.link ?? {};
      // Keeping the deferral is not a kept delivery. The notice still lists it; the stop has no screen for it yet.
      if (link.decision === "keep_deferral") continue;
      local.resolutions[outletId] = {
        decision: link.decision === "keep_partial" ? "keep_partial" : "keep_delivery",
        by: typeof link.by === "string" ? link.by : "Dispatch",
        at: formatTime(Date.parse(notice.createdAt)),
        ...(typeof link.units === "number" ? { units: link.units } : {}),
      };
      changed = true;
    }
    if (changed) await writeDeviceState(date, local, now());

    return sortNotices([...fromServer, ...local.notices]);
  }

  async function markNoticesRead(date: string, ids?: string[]): Promise<void> {
    await device.markNoticesRead(date, ids);
    const read = await readServerNoticeIds(date);
    const known = ((await getCache<NoticeOut[]>(noticesKey(date)))?.value ?? []).map((notice) => `${SERVER_NOTICE_PREFIX}${notice.id}`);
    for (const id of ids ?? known) if (id.startsWith(SERVER_NOTICE_PREFIX)) read.add(id);
    await putCache(readKey(date), [...read], now());
  }

  return {
    getRun,
    downloadRun,
    acknowledgePlan: device.acknowledgePlan,
    startRoute: device.startRoute,
    recordArrival: device.recordArrival,
    recordOutcome: device.recordOutcome,
    getNotices,
    markNoticesRead,
    noteWentOffline: device.noteWentOffline,
  };
}
