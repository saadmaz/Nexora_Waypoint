import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { connectivity } from "../../../field/offline/connectivity";
import { db } from "../../../field/offline/db";
import { listRecords } from "../../../field/offline/outbox";
import { clearSyncHandlers, runSync } from "../../../field/offline/sync";
import { setTimeSource } from "../../../field/offline/time";
import { RUN_DATE } from "../fixtures";
import type { DriverApi } from "./DriverApi";
import { createMockDriverApi, registerDriverHandlers, resolveConflictNow } from "./mockDriverApi";

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
