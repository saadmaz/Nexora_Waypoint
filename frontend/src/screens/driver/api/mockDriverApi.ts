import { formatTime } from "../../../field/clock/clock";
import {
  getCache,
  NetworkError,
  putCache,
  registerBlobUploader,
  registerMockHandler,
  registerSyncHandler,
  request,
  connectivity,
  enqueue,
} from "../../../field/offline";
import { DRIVER_ACTOR_ID, LOADER_CONFIRMATION, PLAN_VERSIONS, VEHICLE, baseStops } from "../fixtures";
import type { DriverRun, DriverStop, LoaderConfirmation, OutcomeInput, RecordedOutcome } from "../types";
import type { DriverApi } from "./DriverApi";

export type LocalStopState = { arrivalAt?: string; outcomes: Record<string, RecordedOutcome> };
export type LocalRunState = {
  downloadedVersion: number | null;
  acknowledgedVersion: number | null;
  departedAt: string | null;
  stops: Record<string, LocalStopState>;
};

export function defaultLocalState(): LocalRunState {
  return { downloadedVersion: null, acknowledgedVersion: null, departedAt: null, stops: {} };
}

function cacheKey(date: string): string {
  return `driver:run:${date}`;
}

function currentPlanVersion(nowMs: number): (typeof PLAN_VERSIONS)[number] | null {
  let current: (typeof PLAN_VERSIONS)[number] | null = null;
  for (const version of PLAN_VERSIONS) {
    if (Date.parse(version.releasedAt) <= nowMs) current = version;
  }
  return current;
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/** Registers the driver's sync handlers and mock server ops once. Safe to call more than once. */
export function registerDriverHandlers(): void {
  registerMockHandler("driver.downloadRoute", () => ({ ok: true }));
  registerMockHandler("driver.ack", () => ({ ok: true }));
  registerMockHandler("driver.startRoute", () => ({ ok: true }));
  registerMockHandler("driver.arrival", () => ({ ok: true }));
  registerMockHandler("driver.outcome", () => ({ ok: true }));
  registerMockHandler("driver.uploadBlob", () => ({ ok: true }));

  registerSyncHandler("driver.ack", async (record) => {
    await request("driver.ack", record.payload);
    return { result: "accepted" };
  });
  registerSyncHandler("driver.startRoute", async (record) => {
    await request("driver.startRoute", record.payload);
    return { result: "accepted" };
  });
  registerSyncHandler("driver.arrival", async (record) => {
    await request("driver.arrival", record.payload);
    return { result: "accepted", groupKey: record.groupKey };
  });
  registerSyncHandler("driver.outcome", async (record) => {
    await request("driver.outcome", record.payload);
    return { result: "accepted", groupKey: record.groupKey };
  });

  registerBlobUploader(async (blob) => {
    await request("driver.uploadBlob", { id: blob.id, kind: blob.kind, bytes: blob.bytes });
    return "uploaded";
  });
}

export type MockDriverApiOptions = {
  /** Overrides the loader's gate confirmation, for the R2.3 B shortfall state-gallery frame. */
  confirmation?: LoaderConfirmation;
  /** The state gallery and tests only: seeds an in-memory local state instead of the phone's real
   * IndexedDB cache, so every frame on `/driver/_states` can show its own moment independently, and
   * writes there never touch the real outbox. */
  seed?: Partial<LocalRunState>;
  /** The state gallery only: `getRun` never resolves, for the R2.S 4 loading frame. */
  stuckLoading?: boolean;
};

/**
 * The driver's mock API (field conventions section 10). `getRun` reads the phone's own cache, so
 * it never throws offline: the route is already on the phone by the time it matters. Writes save
 * to that same cache at once (so the screen reflects them immediately, even offline) and queue an
 * outbox record for the sync engine to send when it can.
 */
export function createMockDriverApi(now: () => number, options: MockDriverApiOptions = {}): DriverApi {
  const confirmation = options.confirmation ?? LOADER_CONFIRMATION;
  let memory: LocalRunState | undefined = options.seed ? { ...defaultLocalState(), ...options.seed } : undefined;
  const isolated = memory !== undefined;

  async function readState(date: string): Promise<LocalRunState> {
    if (memory) return memory;
    const entry = await getCache<LocalRunState>(cacheKey(date));
    return entry?.value ?? defaultLocalState();
  }

  async function writeState(date: string, state: LocalRunState): Promise<void> {
    if (isolated) {
      memory = state;
      return;
    }
    await putCache(cacheKey(date), state, now());
  }

  async function getRun(date: string): Promise<DriverRun> {
    if (options.stuckLoading) await new Promise<never>(() => undefined);
    const local = await readState(date);
    const nowMs = now();
    const currentVersion = currentPlanVersion(nowMs);
    const loaderConfirmed = isConfirmedByNow(date, confirmation, nowMs);

    const stops: DriverStop[] = baseStops().map((stop) => {
      const stopState = local.stops[stop.outletId];
      return { ...stop, arrivalAt: stopState?.arrivalAt, outcomes: stopState?.outcomes ?? {} };
    });

    return {
      runNo: 1,
      vehicle: VEHICLE,
      depot: VEHICLE.depot,
      date,
      currentVersion,
      nextPlanReleaseAt: PLAN_VERSIONS[0].releasedAt,
      downloadedVersion: local.downloadedVersion,
      acknowledgedVersion: local.acknowledgedVersion,
      loaderConfirmation: loaderConfirmed ? confirmation : null,
      departedAt: local.departedAt,
      stops,
    };
  }

  async function downloadRun(date: string, version: number, onProgress?: (done: number, total: number) => void): Promise<void> {
    if (!connectivity.isConnected()) throw new NetworkError();
    const total = baseStops().length + 1;
    const stepMs = import.meta.env.MODE === "test" ? 0 : 550;
    for (let step = 1; step <= total; step += 1) {
      await wait(stepMs);
      if (!connectivity.isConnected()) throw new NetworkError();
      onProgress?.(step, total);
    }
    if (!isolated) await request("driver.downloadRoute", { date, version });
    const local = await readState(date);
    local.downloadedVersion = version;
    await writeState(date, local);
  }

  async function acknowledgePlan(date: string, version: number): Promise<void> {
    const local = await readState(date);
    local.acknowledgedVersion = version;
    await writeState(date, local);
    if (!isolated) {
      await enqueue({
        type: "driver.ack",
        payload: { date, version },
        actor: DRIVER_ACTOR_ID,
        planVersionOnDevice: version,
      });
    }
  }

  async function startRoute(date: string): Promise<void> {
    const local = await readState(date);
    const at = formatTime(now());
    local.departedAt = at;
    await writeState(date, local);
    if (!isolated) {
      await enqueue({
        type: "driver.startRoute",
        payload: { date, at },
        actor: DRIVER_ACTOR_ID,
        planVersionOnDevice: local.acknowledgedVersion,
      });
    }
  }

  async function recordArrival(date: string, outletId: string): Promise<void> {
    const local = await readState(date);
    const at = formatTime(now());
    local.stops[outletId] = { ...(local.stops[outletId] ?? { outcomes: {} }), arrivalAt: at };
    await writeState(date, local);
    if (!isolated) {
      await enqueue({
        type: "driver.arrival",
        payload: { date, outletId, at },
        actor: DRIVER_ACTOR_ID,
        planVersionOnDevice: local.acknowledgedVersion,
        groupKey: outletId,
      });
    }
  }

  async function recordOutcome(date: string, outletId: string, perOrder: OutcomeInput[]): Promise<void> {
    const local = await readState(date);
    const at = formatTime(now());
    const stopState = local.stops[outletId] ?? { outcomes: {} };
    const outcomes = { ...stopState.outcomes };
    for (const input of perOrder) {
      outcomes[input.orderId] = { ...input, savedAt: at };
    }
    local.stops[outletId] = { ...stopState, outcomes };
    await writeState(date, local);

    if (!isolated) {
      for (const input of perOrder) {
        const blobIds = [input.photoBlobId, input.signatureBlobId].filter((id): id is string => Boolean(id));
        await enqueue({
          type: "driver.outcome",
          payload: { date, outletId, ...input, at },
          actor: DRIVER_ACTOR_ID,
          planVersionOnDevice: local.acknowledgedVersion,
          blobIds: blobIds.length > 0 ? blobIds : undefined,
          groupKey: outletId,
        });
      }
    }
  }

  return { getRun, downloadRun, acknowledgePlan, startRoute, recordArrival, recordOutcome };
}

/** The loader confirms at a fixed scenario time ("04:50"); the device date is only used for the "today" guard. */
function isConfirmedByNow(date: string, confirmation: LoaderConfirmation, nowMs: number): boolean {
  const [hours, minutes] = confirmation.at.split(":").map(Number);
  const at = new Date(`${date}T00:00:00+05:30`).getTime() + (hours * 60 + minutes) * 60_000;
  return nowMs >= at;
}
