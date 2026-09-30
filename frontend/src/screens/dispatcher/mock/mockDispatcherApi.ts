import {
  ApiError,
  type AcknowledgementsView,
  type CapacityView,
  type ConflictView,
  type DecideExceptionRequest,
  type DeferStopRequest,
  type DeferStopResult,
  type DeferralsView,
  type DepotId,
  type DispatcherApi,
  type ExceptionView,
  type ForecastView,
  type InboxView,
  type LiveBoardView,
  type MoveRequest,
  type MoveResult,
  type OrderHistory,
  type PlanView,
  type QueueFilters,
  type QueueView,
} from "../../../api/DispatcherApi";
import { capacityView } from "./capacity";
import { conflictView } from "./conflict";
import { deferralsView } from "./deferrals";
import { exceptionView } from "./exception";
import { forecastView } from "./forecast";
import { ORDERS } from "./fixtures";
import { liveBoard } from "./live";
import { planView, validate, deferralSets } from "./plan";
import { orderHistory, queueView } from "./queue";
import { acknowledgements } from "./release";
import { at } from "./time";
import { SCRIPT, createWorld, milestones, type World } from "./world";

/** What a dev address can make the mock do (`?state=`): reads hang, fail or come back empty. */
export type MockMode = "normal" | "loading" | "error" | "empty";

export type MockOptions = { mode?: MockMode; calm?: boolean; delayMs?: number };

/** Dev presets (`?preset=`): decisions the design has already taken, stamped with the design's own time. */
export const PRESETS = ["swap", "store-request", "asked", "resolved", "resolved-partial", "notified", "unnotified"] as const;
export type Preset = (typeof PRESETS)[number];

export function isPreset(value: string): value is Preset {
  return (PRESETS as readonly string[]).includes(value);
}

export type MockDispatcherApi = DispatcherApi & { world: World; applyPreset(preset: Preset): void };

function requireHero(orderIds: string[]): boolean {
  return orderIds.some((id) => id === "ORD2001" || id === "ORD2002");
}

export function createMockDispatcherApi(now: () => Date, options: MockOptions = {}): MockDispatcherApi {
  const mode = options.mode ?? "normal";
  const delay = options.delayMs ?? 140;
  const world = createWorld(now, options.calm ?? false);

  /** A read: waits a beat, then serves (or hangs, fails or comes back empty, for a dev preview). */
  async function read<T>(serve: () => T, empty?: () => T): Promise<T> {
    if (mode === "loading") return new Promise<T>(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (mode === "error") throw new ApiError("unavailable", "The server could not answer just now.");
    if (mode === "empty" && empty) return empty();
    return serve();
  }

  async function write<T>(run: () => T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return run();
  }

  const m = () => milestones(world);

  const api: MockDispatcherApi = {
    world,

    getQueue({ depot, filters, search }) {
      return read<QueueView>(
        () => queueView(world, m(), { depot, ...(filters ? { filters } : {}), ...(search ? { search } : {}) }),
        () => ({ ...queueView(world, m(), { depot }), groups: [], shown: 0, carryOvers: 0, atRisk: 0 }),
      );
    },

    getOrderHistory(orderId): Promise<OrderHistory> {
      return read(() => orderHistory(world, m(), orderId));
    },

    getCapacity({ depot }): Promise<CapacityView> {
      return read(
        () => capacityView(world, m(), depot),
        () => ({ ...capacityView(world, m(), depot), plan: null }),
      );
    },

    getPlan({ depot, version }): Promise<PlanView> {
      return read(
        () => planView(world, m(), depot, version),
        () => ({ ...planView(world, m(), depot, version), lanes: [], deferred: [], deferredTotal: 0 }),
      );
    },

    redraftPlan() {
      return write(() => {
        world.moves = [];
        return planView(world, m(), "peliyagoda");
      });
    },

    validateMove(request: MoveRequest): Promise<MoveResult> {
      return read(() => validate(world, m(), request));
    },

    saveMoves({ moves }) {
      return write(() => {
        const mm = m();
        if (mm.releasedAt) throw new ApiError("read_only", "Plan v3 is released. Changes now happen in Live and create a new version.");
        for (const move of moves) {
          const result = validate(world, m(), move);
          if (!result.ok) throw new ApiError("illegal_move", result.violations.map((v) => v.text).join(" "));
          world.moves.push(move);
        }
        world.movesSavedAt = now();
        return planView(world, m(), "peliyagoda");
      });
    },

    listDeferrals({ depot }): Promise<DeferralsView> {
      return read(
        () => deferralsView(world, m(), depot),
        () => {
          const v = deferralsView(world, m(), depot);
          return {
            ...v,
            headline: "No deferrals",
            counts: { total: 0, capacity: 0, policy: 0, storeRequest: 0 },
            capacity: [],
            policy: [],
            policyMore: 0,
            storeRequest: [],
            protected: [],
            banner: { tone: "success", title: "Nothing is deferred.", text: "Every confirmed order has a vehicle." },
          };
        },
      );
    },

    notifyDeferrals() {
      return write(() => {
        const mm = m();
        if (!mm.noticesAt) world.noticesAt = now();
        const sets = deferralSets(world, m(), "peliyagoda");
        return { sent: sets.capacity.length + sets.policy.length };
      });
    },

    releasePlan({ sendNotices }) {
      return write(() => {
        const mm = m();
        if (!mm.v1) throw new ApiError("not_ready", "There is no plan to release yet. The first draft appears at 16:05.");
        if (mm.releasedAt) throw new ApiError("already_released", "This plan is already released.");
        world.released = now();
        world.sendNotices = sendNotices;
        if (sendNotices) world.noticesAt = now();
        return planView(world, m(), "peliyagoda");
      });
    },

    listAcknowledgements({ version }): Promise<AcknowledgementsView> {
      return read(() => acknowledgements(m(), version));
    },

    getLiveBoard({ depot }): Promise<LiveBoardView> {
      return read(() => liveBoard(world, m(), { depot }));
    },

    deferStop(request: DeferStopRequest): Promise<DeferStopResult> {
      return write(() => {
        const mm = m();
        if (!mm.releasedAt) throw new ApiError("not_released", "Stops can be deferred once a plan is released.");
        if (!requireHero(request.orderIds)) {
          throw new ApiError("not_supported", "Only the stops the scenario follows can be deferred here.");
        }
        if (mm.storeRequestAt) throw new ApiError("already_deferred", "That stop is already deferred in plan v5.");
        world.storeRequestAt = now();
        return { plan: 5, deferred: request.orderIds };
      });
    },

    getInbox(): Promise<InboxView> {
      return read(() => ({ items: liveBoard(world, m(), { depot: "both" }).decisions }));
    },

    getConflict(id): Promise<ConflictView> {
      return read(
        () => {
          const mm = m();
          if (!mm.conflictAt) throw new ApiError("not_found", `Conflict ${id} was not found.`);
          return conflictView(world, mm, id);
        },
        () => {
          throw new ApiError("not_found", `Conflict ${id} was not found.`);
        },
      );
    },

    askStore(id) {
      return write(() => {
        if (!m().conflictOpen) throw new ApiError("not_open", "This conflict is not waiting for a decision.");
        world.askedAt = now();
        return conflictView(world, m(), id);
      });
    },

    resolveConflict(id, resolution) {
      return write(() => {
        const mm = m();
        if (!mm.conflictOpen) throw new ApiError("not_open", "This conflict is not waiting for a decision.");
        const reported = world.askedAt !== undefined && now().getTime() >= SCRIPT.storeReport.getTime();
        if (resolution === "keep as partial" && !reported) {
          throw new ApiError("no_shortage", "Partial needs the store's shortage report first.");
        }
        world.resolved = { outcome: resolution === "keep as partial" ? "Partial" : "Delivered", at: now() };
        return conflictView(world, m(), id);
      });
    },

    getExceptionForReview(id): Promise<ExceptionView> {
      return read(
        () => {
          if (!m().held) throw new ApiError("not_found", `Exception ${id} was not found.`);
          return exceptionView(world, m(), id);
        },
        () => {
          throw new ApiError("not_found", `Exception ${id} was not found.`);
        },
      );
    },

    decideException(id, request: DecideExceptionRequest) {
      return write(() => {
        const mm = m();
        if (mm.swapAt) throw new ApiError("already_decided", "This exception is already decided.");
        const view = exceptionView(world, mm, id);
        const picked = view.candidates.filter((c) => request.deferOrderIds.includes(c.orderId));
        if (picked.some((c) => c.protected)) throw new ApiError("protected", "OUT012 is protected: deferred yesterday. Pick another order.");
        const kg = picked.reduce((a, c) => a + c.kg, 0);
        const m3 = picked.reduce((a, c) => a + c.m3, 0);
        if (kg < view.need.kg || m3 < view.need.m3) {
          throw new ApiError("still_over", `Still over by ${Math.max(0, view.need.kg - kg)} kg / ${Math.max(0, view.need.m3 - m3).toFixed(1)} m³. Pick orders to defer.`);
        }
        world.swapAt = now();
        world.swapDeferred = picked.map((c) => c.orderId);
        return exceptionView(world, m(), id);
      });
    },

    getForecast({ depot }): Promise<ForecastView> {
      return read(
        () => forecastView(depot),
        () => ({ ...forecastView(depot), weeks: [] }),
      );
    },

    applyPreset(preset) {
      switch (preset) {
        case "swap":
          world.swapAt = SCRIPT.swap;
          world.swapDeferred = ["ORD1002"];
          break;
        case "store-request":
          world.swapAt ??= SCRIPT.swap;
          world.storeRequestAt = SCRIPT.storeRequest;
          break;
        case "asked":
          world.swapAt ??= SCRIPT.swap;
          world.storeRequestAt ??= SCRIPT.storeRequest;
          world.askedAt = at("06:45", true);
          break;
        case "resolved":
          world.swapAt ??= SCRIPT.swap;
          world.storeRequestAt ??= SCRIPT.storeRequest;
          world.resolved = { outcome: "Delivered", at: at("06:44", true) };
          break;
        case "resolved-partial":
          world.swapAt ??= SCRIPT.swap;
          world.storeRequestAt ??= SCRIPT.storeRequest;
          world.askedAt = at("06:45", true);
          world.resolved = { outcome: "Partial", at: at("07:05", true) };
          break;
        case "notified":
          world.noticesAt = at("23:41");
          break;
        case "unnotified":
          world.sendNotices = false;
          break;
      }
    },
  };

  // Keep the fixtures in sync with the types the gallery and screens read.
  void ORDERS;
  void (undefined as unknown as QueueFilters);
  void (undefined as unknown as DepotId);
  return api;
}
