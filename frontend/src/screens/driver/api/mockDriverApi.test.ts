import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { connectivity } from "../../../field/offline/connectivity";
import { db } from "../../../field/offline/db";
import { saveBlob, getBlob } from "../../../field/offline/blobs";
import { listRecords } from "../../../field/offline/outbox";
import { clearSyncHandlers, registerBlobUploader, runSync } from "../../../field/offline/sync";
import { setTimeSource } from "../../../field/offline/time";
import { RUN_DATE } from "../fixtures";
import type { DriverApi } from "./DriverApi";
import { createMockDriverApi, registerDeviceNoticeSync, registerDriverHandlers, resolveConflictNow, setFailNextUpload } from "./mockDriverApi";

function at(time: string): number {
  return new Date(`${RUN_DATE}T${time}:00+05:30`).getTime();
}

let clock = at("05:10");
const now = () => clock;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  connectivity.reset();
  clearSyncHandlers();
  clock = at("05:10");
  setTimeSource(now);
  registerDriverHandlers(now);
});

async function saveDelivered(api: DriverApi, outletId: string, orderId: string, units: number): Promise<void> {
  await api.recordOutcome(RUN_DATE, outletId, [{ orderId, outcome: "Delivered", unitsDelivered: units, receiverName: "S. Fernando" }]);
}

describe("the v5 conflict rule (driver prompt 4 section 4, PRD §19)", () => {
  it("accepts an outcome recorded before v5 releases at 05:21", async () => {
    const api = createMockDriverApi(now);
    await saveDelivered(api, "OUT084", "ORD2001", 12);
    const result = await runSync();
    expect(result?.accepted).toBe(1);
    expect(result?.conflicts).toBe(0);
  });

  it("conflicts ORD2001 and ORD2002 as one group once v5 is active", async () => {
    clock = at("05:42");
    const api = createMockDriverApi(now);
    await saveDelivered(api, "OUT084", "ORD2001", 12);
    await saveDelivered(api, "OUT084", "ORD2002", 8);
    const result = await runSync();

    expect(result?.accepted).toBe(0);
    expect(result?.conflicts).toBe(2);
    expect(result?.groups.OUT084).toEqual({ accepted: 0, conflicts: 2, errors: 0 });

    const run = await api.getRun(RUN_DATE);
    const stop = run.stops.find((s) => s.outletId === "OUT084");
    expect(stop?.conflict?.serverVersion).toBe(5);
    expect(stop?.conflict?.change).toContain("Deferred · store request");
  });

  it("stops conflicting once the default 06:44 resolution has passed", async () => {
    clock = at("06:45");
    const api = createMockDriverApi(now);
    await saveDelivered(api, "OUT084", "ORD2001", 12);
    const result = await runSync();
    expect(result?.accepted).toBe(1);
    expect(result?.conflicts).toBe(0);
  });

  it("never conflicts an order outside the deferred set", async () => {
    clock = at("05:58");
    const api = createMockDriverApi(now);
    await saveDelivered(api, "OUT087", "ORD2003", 9);
    const result = await runSync();
    expect(result?.accepted).toBe(1);
    expect(result?.conflicts).toBe(0);
  });

  it("the counts on the sync result equal the outbox", async () => {
    clock = at("06:40");
    const api = createMockDriverApi(now);
    await api.recordArrival(RUN_DATE, "OUT084");
    await saveDelivered(api, "OUT084", "ORD2001", 12);
    await saveDelivered(api, "OUT084", "ORD2002", 8);
    await api.recordArrival(RUN_DATE, "OUT087");
    await saveDelivered(api, "OUT087", "ORD2003", 9);

    const result = await runSync();
    const records = await listRecords();
    expect(result?.accepted).toBe(3);
    expect(result?.conflicts).toBe(2);
    expect(records.filter((r) => r.status === "accepted")).toHaveLength(3);
    expect(records.filter((r) => r.status === "conflict")).toHaveLength(2);
  });
});

describe("duplicates", () => {
  it("returns duplicate for a record the server has already processed", async () => {
    const api = createMockDriverApi(now);
    await saveDelivered(api, "OUT087", "ORD2003", 9);
    const first = await runSync();
    expect(first?.accepted).toBe(1);

    // Simulate the record being resent, e.g. the client never saw the response.
    const [record] = await listRecords();
    await db.outbox.where("clientId").equals(record.clientId).modify({ status: "waiting" });
    const second = await runSync({ force: true });
    expect(second?.items[0]?.result).toBe("duplicate");
  });
});

describe("resolution", () => {
  it("resolveConflictNow clears the conflict and updates the stop", async () => {
    clock = at("05:42");
    const api = createMockDriverApi(now);
    await saveDelivered(api, "OUT084", "ORD2001", 12);
    await runSync();

    let run = await api.getRun(RUN_DATE);
    expect(run.stops.find((s) => s.outletId === "OUT084")?.conflict).toBeDefined();

    await resolveConflictNow(RUN_DATE, "OUT084", now, "keep_delivery");
    run = await api.getRun(RUN_DATE);
    const stop = run.stops.find((s) => s.outletId === "OUT084");
    expect(stop?.conflict).toBeUndefined();
    expect(stop?.resolution?.decision).toBe("keep_delivery");
  });

  it("getRun applies the default 06:44 resolution once it is due", async () => {
    clock = at("05:42");
    const api = createMockDriverApi(now);
    await saveDelivered(api, "OUT084", "ORD2001", 12);
    await runSync();

    clock = at("06:44");
    await api.getNotices(RUN_DATE);
    const run = await api.getRun(RUN_DATE);
    const stop = run.stops.find((s) => s.outletId === "OUT084");
    expect(stop?.resolution?.decision).toBe("keep_delivery");
    expect(stop?.conflict).toBeUndefined();
  });
});

describe("photos (driver prompt 4 section 4)", () => {
  async function savePhotoOutcome(api: DriverApi): Promise<string> {
    const photoBlobId = await saveBlob({ kind: "photo", blob: new Blob(["jpeg"], { type: "image/jpeg" }) });
    await api.recordOutcome(RUN_DATE, "OUT084", [{ orderId: "ORD2001", outcome: "Delivered", unitsDelivered: 12, receiverName: "S. Fernando", photoBlobId }]);
    return photoBlobId;
  }

  it("ties the photo to the stop's first record before it is queued, so it cannot go ahead of its delivery", async () => {
    const api = createMockDriverApi(now);
    const photoBlobId = await savePhotoOutcome(api);
    const [record] = await listRecords();
    expect((await getBlob(photoBlobId))?.recordClientId).toBe(record.clientId);
  });

  it("uploads the photo only after its record has reached the server", async () => {
    const api = createMockDriverApi(now);
    await savePhotoOutcome(api);
    const ownerWhenUploaded: (string | undefined)[] = [];
    registerBlobUploader(async (_blob, owner) => {
      ownerWhenUploaded.push(owner?.status);
      return "uploaded";
    });
    await runSync();
    expect(ownerWhenUploaded).toEqual(["accepted"]);
  });

  it("a failed upload keeps the record Synced, keeps the photo on the phone and retries it", async () => {
    registerDeviceNoticeSync(RUN_DATE, now);
    const api = createMockDriverApi(now);
    const photoBlobId = await savePhotoOutcome(api);

    setFailNextUpload(true);
    const first = await runSync();
    expect(first?.accepted).toBe(1);
    expect(first?.blobFailures).toHaveLength(1);
    expect((await listRecords())[0].status).toBe("accepted");
    const failed = await getBlob(photoBlobId);
    expect(failed?.uploadStatus).toBe("failed");
    expect(failed?.lastAttemptAt).toBe(clock);

    // The retry waits 30 s, or goes at once on "Retry now".
    const retried = await runSync({ force: true });
    expect(retried?.blobFailures).toHaveLength(0);
    expect((await getBlob(photoBlobId))?.uploadStatus).toBe("uploaded");
  });

  it("raises one notice per failed photo, naming its stop, however many times the phone retries", async () => {
    registerDeviceNoticeSync(RUN_DATE, now);
    const api = createMockDriverApi(now);
    await savePhotoOutcome(api);
    setFailNextUpload(true);
    await runSync();
    setFailNextUpload(true);
    await runSync({ force: true });

    const failures = (await api.getNotices(RUN_DATE)).filter((n) => n.kind === "photo_failed");
    expect(failures).toHaveLength(1);
    expect(failures[0].body).toBe("Couldn't send photo of stop 1. Kept on phone.");
    expect(failures[0].outletId).toBe("OUT084");
    expect(failures[0].reference).toBe("WP-SYNC-409");
  });
});
