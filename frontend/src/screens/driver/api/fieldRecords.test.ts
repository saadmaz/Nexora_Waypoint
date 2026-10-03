import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { connectivity } from "../../../field/offline/connectivity";
import { db } from "../../../field/offline/db";
import { listRecords } from "../../../field/offline/outbox";
import { clearSyncHandlers, runSync } from "../../../field/offline/sync";
import { setTimeSource } from "../../../field/offline/time";
import { RUN_DATE } from "../fixtures";
import { runDistance } from "../finish/runDistance";
import { durationBetween } from "../history/historyView";
import { problemThreads } from "../issues/problemThreads";
import type { ProblemRecord } from "../types";
import { createMockDriverApi, registerDriverHandlers } from "./mockDriverApi";

/**
 * R6 problems, R7 history and R9 finish run on the phone (PRD v3 section 3 R6, R7, R9; V40; A24; A34). Everything saves
 * offline first and reaches the server as an outbox record.
 */

function at(time: string): number {
  return new Date(`${RUN_DATE}T${time}:00+05:30`).getTime();
}

let clock = at("05:50");
const now = () => clock;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  connectivity.reset();
  clearSyncHandlers();
  clock = at("05:50");
  setTimeSource(now);
  registerDriverHandlers(now);
});

describe("R6 problems", () => {
  it("saves a problem offline, queues driver.problem, and shows it as waiting for Dispatch once it has synced", async () => {
    const api = createMockDriverApi(now);
    await connectivity.setSimulatedOffline(true);
    const saved = await api.recordProblem(RUN_DATE, { type: "Can't reach the store", stopId: "OUT087", orderIds: ["ORD2003"], note: "Gate locked" });
    expect(saved.savedAt).toBe("05:50");

    const [record] = await listRecords();
    expect(record).toMatchObject({ clientId: saved.clientId, type: "driver.problem", status: "waiting" });
    expect(record?.payload).toMatchObject({ date: RUN_DATE, type: "Can't reach the store", stopId: "OUT087", orderIds: ["ORD2003"], note: "Gate locked" });
    expect((await api.listProblems(RUN_DATE)).map((t) => t.state)).toEqual(["saved"]);

    await connectivity.setSimulatedOffline(false);
    const result = await runSync();
    expect(result?.accepted).toBe(1);
    expect((await api.listProblems(RUN_DATE)).map((t) => t.state)).toEqual(["sent"]);
  });

  it("keeps an update in its problem's thread (V40)", async () => {
    const api = createMockDriverApi(now);
    const first = await api.recordProblem(RUN_DATE, { type: "Running late", orderIds: [], note: "Traffic at Peradeniya" });
    clock = at("06:05");
    await api.recordProblem(RUN_DATE, { type: "Running late", orderIds: [], note: "Moving again", updatesClientId: first.clientId });
    const threads = await api.listProblems(RUN_DATE);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.updates.map((u) => u.note)).toEqual(["Moving again"]);
    const records = await listRecords();
    expect(records.at(-1)?.payload).toMatchObject({ updatesClientId: first.clientId });
  });

  it("lists the newest thread first and counts a thread sent only when every record in it has reached the server", () => {
    const rec = (clientId: string, savedAt: string, updatesClientId?: string): ProblemRecord => ({
      clientId, savedAt, type: "Vehicle problem", orderIds: [], note: "", ...(updatesClientId ? { updatesClientId } : {}),
    });
    const records = [rec("a", "05:40"), rec("b", "05:45"), rec("c", "06:10", "a")];
    const status = new Map([["a", "accepted"], ["b", "accepted"], ["c", "waiting"]] as const);
    const threads = problemThreads(records, (id) => status.get(id as "a" | "b" | "c"));
    expect(threads.map((t) => [t.parent.clientId, t.state])).toEqual([["a", "saved"], ["b", "sent"]]);
  });
});

describe("R9 finish run", () => {
  it("closes the hero run with the A24 legs and queues driver.finishRun with the distance and fuel", async () => {
    const api = createMockDriverApi(now);
    clock = at("06:45");
    const finished = await api.finishRun(RUN_DATE);
    expect(finished.at).toBe("06:45");
    expect(finished.distance).toMatchObject({ source: "gps", legsKm: [8.3, 3.1, 8.0], totalKm: 19.4, fuelL: 3.9, plannedKm: 19 });
    const records = await listRecords();
    expect(records.map((r) => r.type)).toEqual(["driver.finishRun"]);
    expect(records[0]?.payload).toMatchObject({ date: RUN_DATE, gpsKm: 19.4, gpsGapFilledKm: 0, fuelLEst: 3.9 });
    // Closing twice keeps the first close and queues nothing more.
    expect(await api.finishRun(RUN_DATE)).toEqual(finished);
    expect(await listRecords()).toHaveLength(1);
  });

  it("uses the planned distance when no legs were tracked (DP-14)", () => {
    expect(runDistance({ trackedLegsKm: null, plannedKm: 19, kmPerL: 5 })).toMatchObject({ source: "planned", totalKm: 19, gapFilledKm: 19, fuelL: 3.8 });
  });
});

describe("R7 history", () => {
  it("shows today from the phone once the run has started, then the A34 runs", async () => {
    const api = createMockDriverApi(now);
    expect((await api.getHistory(RUN_DATE)).map((d) => d.label)).toEqual(["Mon 28 Sep", "Sun 27 Sep", "Sat 26 Sep", "Fri 25 Sep", "Thu 24 Sep"]);
    clock = at("05:10");
    await api.startRoute(RUN_DATE);
    clock = at("06:45");
    await api.finishRun(RUN_DATE);
    const [today] = await api.getHistory(RUN_DATE);
    expect(today).toMatchObject({ label: "Today", run: { kind: "run", start: "05:10", end: "06:45", km: 19.4, duration: "1 h 35 min" } });
  });

  it("writes a duration as hours and minutes", () => {
    expect(durationBetween("05:09", "06:31")).toBe("1 h 22 min");
    expect(durationBetween("05:10", "05:52")).toBe("42 min");
  });
});
