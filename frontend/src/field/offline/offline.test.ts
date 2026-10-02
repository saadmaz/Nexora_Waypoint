import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { scaledSize, saveBlob } from "./blobs";
import { connectivity } from "./connectivity";
import { db } from "./db";
import { enqueue, getRecord, listRecords, refreshWaitingCount } from "./outbox";
import {
  RETRY_AFTER_MS,
  clearSyncHandlers,
  hasWork,
  onSyncResult,
  registerBlobUploader,
  registerSyncHandler,
  runSync,
  type SyncOutcome,
} from "./sync";
import { resetTimeSource, setTimeSource } from "./time";
import { NetworkError } from "./transport";

let clock = Date.parse("2026-09-29T05:17:00+05:30");

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  connectivity.reset();
  clearSyncHandlers();
  clock = Date.parse("2026-09-29T05:17:00+05:30");
  setTimeSource(() => clock);
});

function record(type = "driver.arrival", clientId?: string) {
  return enqueue({ type, payload: { stopId: "OUT084" }, actor: "nimal", planVersionOnDevice: 4, clientId });
}

describe("outbox", () => {
  it("saves a write on the phone while offline and counts it as waiting", async () => {
    await connectivity.setSimulatedOffline(true);
    await record();
    await record("driver.outcome");
    expect(connectivity.getSnapshot().waitingCount).toBe(2);
    expect(connectivity.getSnapshot().status).toBe("offline");
    const saved = await listRecords();
    expect(saved.map((r) => r.status)).toEqual(["waiting", "waiting"]);
  });

  it("keeps a record once when the same clientId is saved twice", async () => {
    await record("driver.arrival", "same-id");
    await record("driver.arrival", "same-id");
    expect(await listRecords()).toHaveLength(1);
  });
});

describe("sync engine", () => {
  it("flushes the outbox in order when the device comes back online", async () => {
    const sent: string[] = [];
    registerSyncHandler("driver.arrival", async (r) => {
      sent.push(r.clientId);
      return { result: "accepted" };
    });
    await connectivity.setSimulatedOffline(true);
    const a = await record("driver.arrival", "a");
    const b = await record("driver.arrival", "b");

    expect(await runSync()).toBeUndefined();
    expect(sent).toEqual([]);

    await connectivity.setSimulatedOffline(false);
    const result = await runSync();
    expect(sent).toEqual([a.clientId, b.clientId]);
    expect(result?.accepted).toBe(2);
    expect(connectivity.getSnapshot().waitingCount).toBe(0);
    expect(connectivity.getSnapshot().lastSyncAt).toBe(clock);
    expect((await getRecord("a"))?.status).toBe("accepted");
  });

  it("blocks sending while Simulate offline is on", async () => {
    let calls = 0;
    registerSyncHandler("driver.arrival", async () => {
      calls += 1;
      return { result: "accepted" };
    });
    await record();
    await connectivity.setSimulatedOffline(true);
    expect(await runSync({ force: true })).toBeUndefined();
    expect(calls).toBe(0);
    expect(connectivity.getSnapshot().waitingCount).toBe(1);
  });

  it("treats a duplicate as accepted when the same clientId is sent again", async () => {
    const seen = new Set<string>();
    registerSyncHandler("driver.arrival", async (r): Promise<SyncOutcome> => {
      const duplicate = seen.has(r.clientId);
      seen.add(r.clientId);
      return { result: duplicate ? "duplicate" : "accepted" };
    });
    await record("driver.arrival", "once");
    await runSync();
    // The phone lost the answer and sends it again.
    await db.outbox.where("clientId").equals("once").modify({ status: "waiting" });
    const second = await runSync();
    expect(second?.accepted).toBe(1);
    expect((await getRecord("once"))?.status).toBe("accepted");
    expect(await listRecords()).toHaveLength(1);
  });

  it("records a conflict and never retries it", async () => {
    let calls = 0;
    registerSyncHandler("driver.outcome", async () => {
      calls += 1;
      return { result: "conflict", groupKey: "OUT084", serverPayload: { version: 5 } };
    });
    await record("driver.outcome", "c1");
    const first = await runSync();
    expect(first?.conflicts).toBe(1);
    expect(first?.groups["OUT084"]).toEqual({ accepted: 0, conflicts: 1, errors: 0 });
    clock += 10 * RETRY_AFTER_MS;
    await runSync({ force: true });
    expect(calls).toBe(1);
    const saved = await getRecord("c1");
    expect(saved?.status).toBe("conflict");
    expect(saved?.serverPayload).toEqual({ version: 5 });
  });

  it("retries an error after 30 s, or at once on Retry now", async () => {
    let calls = 0;
    registerSyncHandler("driver.arrival", async () => {
      calls += 1;
      return calls === 1 ? { result: "error", reason: "Server busy" } : { result: "accepted" };
    });
    await record("driver.arrival", "e1");
    const first = await runSync();
    expect(first?.errors).toBe(1);
    expect(connectivity.getSnapshot().status).toBe("failed");
    expect((await getRecord("e1"))?.status).toBe("error");

    // Not yet due.
    expect(await hasWork()).toBe(false);
    expect(await runSync()).toBeUndefined();
    expect(calls).toBe(1);

    clock += RETRY_AFTER_MS;
    expect(await hasWork()).toBe(true);
    const second = await runSync();
    expect(second?.accepted).toBe(1);
    expect(calls).toBe(2);
    expect(connectivity.getSnapshot().status).toBe("online");
  });

  it("puts a record back and stops when the connection drops mid-sync, losing nothing", async () => {
    const sent: string[] = [];
    registerSyncHandler("driver.arrival", async (r) => {
      if (r.clientId === "b") throw new NetworkError();
      sent.push(r.clientId);
      return { result: "accepted" };
    });
    await record("driver.arrival", "a");
    await record("driver.arrival", "b");
    await record("driver.arrival", "c");
    const result = await runSync();
    expect(result?.interrupted).toBe(true);
    expect(sent).toEqual(["a"]);
    const states = (await listRecords()).map((r) => [r.clientId, r.status]);
    expect(states).toEqual([
      ["a", "accepted"],
      ["b", "waiting"],
      ["c", "waiting"],
    ]);
    expect(connectivity.getSnapshot().status).toBe("offline");
    expect(connectivity.getSnapshot().waitingCount).toBe(2);
  });

  it("joins a run already in flight, so Send now pressed twice sends nothing twice", async () => {
    let calls = 0;
    registerSyncHandler("driver.arrival", async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { result: "accepted" };
    });
    await record();
    await Promise.all([runSync({ force: true }), runSync({ force: true }), runSync({ force: true })]);
    expect(calls).toBe(1);
  });

  it("emits a summary grouped by the key the handler supplies", async () => {
    registerSyncHandler("driver.arrival", async () => ({ result: "accepted", groupKey: "OUT084" }));
    registerSyncHandler("driver.outcome", async (r) => ({
      result: r.clientId === "o3" ? "accepted" : "conflict",
      groupKey: r.clientId === "o3" ? "OUT087" : "OUT084",
    }));
    const results: number[] = [];
    const stop = onSyncResult((summary) => results.push(summary.accepted * 100 + summary.conflicts));
    await record("driver.arrival", "a1");
    await record("driver.outcome", "o1");
    await record("driver.outcome", "o2");
    await record("driver.outcome", "o3");
    const summary = await runSync();
    stop();
    expect(summary?.accepted).toBe(2);
    expect(summary?.conflicts).toBe(2);
    expect(summary?.groups["OUT084"]).toEqual({ accepted: 1, conflicts: 2, errors: 0 });
    expect(summary?.groups["OUT087"]).toEqual({ accepted: 1, conflicts: 0, errors: 0 });
    expect(results).toEqual([202]);
  });
});

describe("blobs", () => {
  it("does not fail its record when the photo upload fails, and retries the photo later", async () => {
    registerSyncHandler("driver.outcome", async () => ({ result: "accepted" }));
    let uploads = 0;
    registerBlobUploader(async () => {
      uploads += 1;
      if (uploads === 1) throw new Error("409 conflict");
      return "uploaded";
    });
    const blobId = await saveBlob({ kind: "photo", blob: new Blob(["jpeg"], { type: "image/jpeg" }), recordClientId: "o1" });
    await enqueue({ type: "driver.outcome", payload: {}, actor: "nimal", planVersionOnDevice: 4, clientId: "o1", blobIds: [blobId] });

    const first = await runSync();
    expect((await getRecord("o1"))?.status).toBe("accepted");
    expect(first?.blobFailures).toHaveLength(1);
    expect((await db.blobs.get(blobId))?.uploadStatus).toBe("failed");
    expect(connectivity.getSnapshot().status).toBe("failed");

    clock += RETRY_AFTER_MS;
    await refreshWaitingCount();
    await runSync();
    expect((await db.blobs.get(blobId))?.uploadStatus).toBe("uploaded");
    expect(uploads).toBe(2);
  });

  it("waits to upload a photo until its record has reached the server", async () => {
    let uploads = 0;
    registerBlobUploader(async () => {
      uploads += 1;
      return "uploaded";
    });
    registerSyncHandler("driver.outcome", async () => ({ result: "accepted" }));
    const blobId = await saveBlob({ kind: "photo", blob: new Blob(["x"]), recordClientId: "o2" });
    expect(await hasWork()).toBe(false);
    await enqueue({ type: "driver.outcome", payload: {}, actor: "nimal", planVersionOnDevice: 4, clientId: "o2", blobIds: [blobId] });
    await runSync();
    expect(uploads).toBe(1);
  });

  it("scales a photo down to a 1600 px longest edge and never scales up", () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("clock", () => {
  it("stamps records with the scenario time", async () => {
    const saved = await record();
    expect(Date.parse(saved.deviceTime)).toBe(clock);
    resetTimeSource();
  });
});
