import { describe, expect, it, vi } from "vitest";
import { createServerClock, extrapolate } from "./serverClock";

const at = (iso: string) => Date.parse(iso);

describe("extrapolate", () => {
  const reading = { scenarioMs: at("2026-09-28T15:30:00+05:30"), rate: 1, fetchedAt: 1_000_000 };

  it("moves with the wall clock at rate 1", () => {
    expect(extrapolate(reading, 1_000_000 + 22 * 60_000)).toBe(at("2026-09-28T15:52:00+05:30"));
  });

  it("holds still when paused", () => {
    expect(extrapolate({ ...reading, rate: 0 }, 1_000_000 + 3_600_000)).toBe(reading.scenarioMs);
  });

  it("runs fast at rate 60", () => {
    expect(extrapolate({ ...reading, rate: 60 }, 1_000_000 + 60_000)).toBe(at("2026-09-28T16:30:00+05:30"));
  });
});

describe("createServerClock", () => {
  it("ticks between answers and snaps to each new answer", async () => {
    let wall = 5_000_000;
    let answer = { now: "2026-09-28T15:30:00+05:30", rate: 1 };
    const clock = createServerClock("dispatcher", { wall: () => wall, storage: null, fetchClock: async () => answer });
    expect(clock.ready()).toBe(false);
    await clock.sync();
    expect(clock.ready()).toBe(true);
    expect(clock.nowMs()).toBe(at("2026-09-28T15:30:00+05:30"));

    wall += 90_000; // a countdown changes value as time passes
    expect(clock.nowMs()).toBe(at("2026-09-28T15:31:30+05:30"));

    answer = { now: "2026-09-28T16:00:00+05:30", rate: 0 }; // the presenter jumped and paused
    await clock.sync();
    wall += 90_000;
    expect(clock.nowMs()).toBe(at("2026-09-28T16:00:00+05:30"));
    expect(clock.paused()).toBe(true);
  });

  it("keeps the last reading when the server cannot be reached", async () => {
    let wall = 0;
    let fail = false;
    const clock = createServerClock("store", {
      wall: () => wall,
      storage: null,
      fetchClock: async () => {
        if (fail) throw new Error("offline");
        return { now: "2026-09-28T15:30:00+05:30", rate: 1 };
      },
    });
    await clock.sync();
    fail = true;
    wall += 60_000;
    await clock.sync();
    expect(clock.nowMs()).toBe(at("2026-09-28T15:31:00+05:30"));
  });

  it("is ready after a failed first attempt, so an offline start does not stay blank", async () => {
    const clock = createServerClock("loader", { wall: () => 7, storage: null, fetchClock: async () => Promise.reject(new Error("offline")) });
    await clock.sync();
    expect(clock.ready()).toBe(true);
    expect(clock.nowMs()).toBe(7);
  });

  it("starts from the answer saved on the device when offline after a reload", async () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    let wall = 1_000;
    const first = createServerClock("driver", { wall: () => wall, storage, fetchClock: async () => ({ now: "2026-09-29T05:17:00+05:30", rate: 1 }) });
    await first.sync();
    wall += 120_000; // the page is reloaded two minutes later, with no network
    const second = createServerClock("driver", { wall: () => wall, storage, fetchClock: async () => Promise.reject(new Error("offline")) });
    expect(second.ready()).toBe(true);
    expect(second.nowMs()).toBe(at("2026-09-29T05:19:00+05:30"));
  });

  it("notifies subscribers on a new reading", async () => {
    const clock = createServerClock("store", { wall: () => 0, storage: null, fetchClock: async () => ({ now: "2026-09-28T15:30:00+05:30", rate: 1 }) });
    const listener = vi.fn();
    clock.subscribe(listener);
    await clock.sync();
    expect(listener).toHaveBeenCalled();
  });

  it("keeps the scenario's service date after midnight, when the server's day an order counts for has moved on", async () => {
    // Tue 02:45: an order placed now counts for Wed, but the walkthrough's service date is still Tue (the presenter's
    // morning steps are placed on it).
    const clock = createServerClock("dispatcher", {
      wall: () => 0,
      storage: null,
      fetchClock: async () => ({ now: "2026-09-29T02:45:00+05:30", rate: 1, checkpoint: "2026-09-28T15:30:00+05:30", serviceDate: "2026-09-30", runDate: "2026-09-29" }),
    });
    await clock.sync();
    expect(clock.scenarioDays()).toEqual({ planningDay: "2026-09-28", serviceDate: "2026-09-29" });
  });
});
