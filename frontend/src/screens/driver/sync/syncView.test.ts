import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { connectivity, db, enqueue, clearSyncHandlers, registerSyncHandler, runSync, setTimeSource, type SyncResult } from "../../../field/offline";
import { consumeSyncView, getPendingSyncView, isCatchUp, kindOfResult, queueResolution, resetSyncView, startSyncViewTracking } from "./syncView";

const NOW = Date.parse("2026-09-29T06:40:00+05:30");

function result(partial: Partial<SyncResult>): SyncResult {
  return { startedAt: NOW, finishedAt: NOW, accepted: 0, conflicts: 0, errors: 0, items: [], groups: {}, blobFailures: [], interrupted: false, ...partial };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  connectivity.reset();
  clearSyncHandlers();
  resetSyncView();
  setTimeSource(() => NOW);
});

describe("isCatchUp", () => {
  const item = { clientId: "a", type: "driver.arrival", result: "accepted" as const };

  it("is a catch-up only after being offline, with something sent and nothing failed", () => {
    expect(isCatchUp(result({ items: [item], accepted: 1 }), true)).toBe(true);
    expect(isCatchUp(result({ items: [item], accepted: 1 }), false)).toBe(false);
    expect(isCatchUp(result({ items: [] }), true)).toBe(false);
    expect(isCatchUp(result({ items: [item], errors: 1 }), true)).toBe(false);
    expect(isCatchUp(result({ items: [item], interrupted: true }), true)).toBe(false);
  });

  it("calls a run with a conflict R5.1 and one without R5.2", () => {
    expect(kindOfResult(result({ conflicts: 1 }))).toBe("conflict");
    expect(kindOfResult(result({ conflicts: 0 }))).toBe("synced");
  });
});

describe("startSyncViewTracking", () => {
  async function saveAndSync(offlineFirst: boolean, outcome: "accepted" | "conflict") {
    registerSyncHandler("driver.arrival", async () => ({ result: outcome, groupKey: "OUT084" }));
    if (offlineFirst) await connectivity.setSimulatedOffline(true);
    await enqueue({ type: "driver.arrival", payload: {}, actor: "nimal", planVersionOnDevice: 4, groupKey: "OUT084" });
    await enqueue({ type: "driver.arrival", payload: {}, actor: "nimal", planVersionOnDevice: 4, groupKey: "OUT084" });
    await connectivity.setSimulatedOffline(false);
    await runSync();
  }

  it("queues R5.1 for the catch-up after being offline, listing exactly the records that went out", async () => {
    const stop = startSyncViewTracking();
    await saveAndSync(true, "conflict");
    const pending = getPendingSyncView();
    expect(pending?.kind).toBe("conflict");
    expect(pending?.clientIds).toHaveLength(2);
    stop();
  });

  it("queues R5.2 when everything is accepted", async () => {
    const stop = startSyncViewTracking();
    await saveAndSync(true, "accepted");
    expect(getPendingSyncView()?.kind).toBe("synced");
    stop();
  });

  it("stays quiet for records sent from the road, with no offline spell before them", async () => {
    const stop = startSyncViewTracking();
    await saveAndSync(false, "accepted");
    expect(getPendingSyncView()).toBeNull();
    stop();
  });
});

describe("resolutions", () => {
  it("queues R5.3 once per stop: showing it marks it seen for good", () => {
    queueResolution("OUT084", NOW);
    expect(getPendingSyncView()).toMatchObject({ kind: "resolved", outletId: "OUT084" });

    expect(consumeSyncView()?.outletId).toBe("OUT084");
    expect(getPendingSyncView()).toBeNull();

    queueResolution("OUT084", NOW);
    expect(getPendingSyncView()).toBeNull();
  });
});
