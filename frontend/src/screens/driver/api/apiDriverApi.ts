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
import { formatDate, formatTime } from "../../../field/clock/clock";
import { durationBetween } from "../history/historyView";
import type { DriverNotice, DriverRun, HistoryDay as DriverHistoryDay } from "../types";
import type { DriverApi } from "./DriverApi";
import {
  applyConflict,
  consumeFailNextUpload,
  createDeviceOps,
  readDeviceState,
  registerDeviceNoticeSync,
  writeDeviceState,
  sortNotices,
} from "./deviceDriverApi";
import { conflictFromServer, mapNotice, mapRun, requireRun, SERVER_NOTICE_PREFIX } from "./runMapper";

type RunOut = components["schemas"]["RunOut"];
type MeOut = components["schemas"]["MeOut"];
type NoticeOut = components["schemas"]["NoticeOut"];
type DriverHistoryRowOut = components["schemas"]["DriverHistoryRowOut"];

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

/** The record types the driver sends, all through `POST /sync`: R1 to R3, the R6 problem and the R9 finish. */
const DRIVER_RECORD_TYPES = ["driver.ack", "driver.startRoute", "driver.arrival", "driver.outcome", "driver.problem", "driver.finishRun"] as const;

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

const historyKey = "driver:server-history";

/** One server history row as R7.1 shows it. */
export function mapHistoryRow(row: DriverHistoryRowOut): DriverHistoryDay {
  const start = row.departedAt ? formatTime(Date.parse(row.departedAt)) : "";
  const end = row.finishedAt ? formatTime(Date.parse(row.finishedAt)) : null;
  return {
    date: row.date,
    label: formatDate(Date.parse(`${row.date}T12:00:00+05:30`)),
    run: {
      kind: "run",
      start,
      end,
      km: row.km ?? null,
      duration: start && end ? durationBetween(start, end) : null,
      stopsDone: row.delivered,
      stopsTotal: row.stops,
      synced: true,
    },
  };
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
  // The kilometres come from the plan; nothing is tracked by GPS here, so the planned distance stands (DP-14).
  const device = createDeviceOps(now, {
    getRun: (date) => getRun(date),
    distanceBasis: async (date) => {
      const { run } = await packageFor(date);
      return { trackedLegsKm: null, plannedKm: run.plannedKm ?? 0, kmPerL: run.vehicle?.kmPerL ?? 0 };
    },
  });
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

  /**
   * R7.1: today's run from the phone, then the earlier runs the server keeps. A failed or unbuilt read never fails the
   * screen: it shows today alone, and never the fixture weeks.
   */
  async function getHistory(date: string): Promise<DriverHistoryDay[]> {
    const today = (await device.getTodayHistory(date)).filter((day) => day.date === date);
    let rows: DriverHistoryRowOut[] = [];
    try {
      rows = await request<DriverHistoryRowOut[]>("driver.getHistory");
      await putCache(historyKey, rows, now());
    } catch {
      rows = (await getCache<DriverHistoryRowOut[]>(historyKey))?.value ?? [];
    }
    return [...today, ...rows.filter((row) => row.date !== date).map(mapHistoryRow)];
  }

  return {
    getRun,
    refreshRun: async (date) => {
      await refresh(date);
    },
    downloadRun,
    acknowledgePlan: device.acknowledgePlan,
    startRoute: device.startRoute,
    recordArrival: device.recordArrival,
    recordOutcome: device.recordOutcome,
    getNotices,
    markNoticesRead,
    noteWentOffline: device.noteWentOffline,
    // Problems and the finished run are written on the phone and sent as outbox records, as the mock's are.
    recordProblem: device.recordProblem,
    listProblems: device.listProblems,
    getHistory,
    getRunDistance: device.getRunDistance,
    getFinishedRun: device.getFinishedRun,
    finishRun: device.finishRun,
  };
}

/** The phone's own notices ("N records synced", a failed photo) for the real run: the photo notice names the stop from the downloaded route. */
export function registerApiDeviceNotices(date: string, now: () => number): void {
  registerDeviceNoticeSync(date, now, async (outletId) => {
    const pkg = (await getCache<RunPackage>(packageKey(date)))?.value;
    return pkg?.run.stops?.find((stop) => stop.outletId === outletId)?.seq;
  });
}
