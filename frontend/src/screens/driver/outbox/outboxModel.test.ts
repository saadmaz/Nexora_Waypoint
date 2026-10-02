import { describe, expect, it } from "vitest";
import type { ConnectivitySnapshot, OutboxRecord } from "../../../field/offline";
import { outboxMode, outboxRows, summarise } from "./outboxModel";

function record(clientId: string, type: string, payload: object, status: OutboxRecord["status"], groupKey?: string): OutboxRecord {
  return { clientId, type, payload, deviceTime: "", planVersionOnDevice: 4, actor: "DRV1", status, attempts: 0, createdAt: 0, groupKey };
}

function snapshot(status: ConnectivitySnapshot["status"]): ConnectivitySnapshot {
  return { status, lastSyncAt: null, lastFailureAt: null, waitingCount: 0, simulatedOffline: false, connected: status !== "offline" };
}

const HERO: OutboxRecord[] = [
  record("a", "driver.startRoute", { at: "05:10" }, "accepted"),
  record("b", "driver.ack", { version: 4 }, "waiting"),
  record("c", "driver.arrival", { outletId: "OUT084", at: "05:26" }, "waiting", "OUT084"),
  record("d", "driver.outcome", { orderId: "ORD2001", outcome: "Delivered", at: "05:42" }, "waiting", "OUT084"),
  record("e", "driver.outcome", { orderId: "ORD2002", outcome: "Delivered", at: "05:42" }, "waiting", "OUT084"),
];

describe("outboxRows", () => {
  it("lists departed, arrivals and outcomes in save order, and leaves the plan acknowledgement out", () => {
    const rows = outboxRows(HERO);
    expect(rows.map((r) => [r.time, r.kind, r.subject, r.state])).toEqual([
      ["05:10", "departed", undefined, "synced"],
      ["05:26", "arrival", "OUT084", "saved"],
      ["05:42", "outcome", "ORD2001", "saved"],
      ["05:42", "outcome", "ORD2002", "saved"],
    ]);
  });

  it("maps each device status to its pill, and an error to Saved on phone with a retry note", () => {
    const rows = outboxRows([
      record("1", "driver.arrival", { outletId: "OUT084", at: "05:26" }, "sending"),
      record("2", "driver.arrival", { outletId: "OUT087", at: "05:48" }, "error"),
      record("3", "driver.outcome", { orderId: "ORD2003", at: "05:58" }, "conflict", "OUT087"),
    ]);
    expect(rows.map((r) => r.state)).toEqual(["sending", "retrying", "review"]);
    expect(rows[2].outcomeWord).toBe("Delivered");
  });

  it("reads a conflict as Synced once Dispatch has resolved its stop", () => {
    const records = [record("d", "driver.outcome", { orderId: "ORD2001", at: "05:42" }, "conflict", "OUT084")];
    expect(outboxRows(records, new Set(["OUT084"]))[0].state).toBe("synced");
    expect(outboxRows(records, new Set(["OUT087"]))[0].state).toBe("review");
  });
});

describe("summarise and outboxMode", () => {
  const conflict = outboxRows([
    record("d", "driver.outcome", { orderId: "ORD2001", at: "05:42" }, "conflict", "OUT084"),
    record("e", "driver.outcome", { orderId: "ORD2002", at: "05:42" }, "conflict", "OUT084"),
  ]);

  it("counts two conflicting orders at one stop as 1 stop (2 orders)", () => {
    expect(summarise(conflict)).toMatchObject({ reviewStops: 1, reviewOrders: 2, pending: 0, errors: 0 });
  });

  it("counts waiting, sending and retrying records as pending", () => {
    expect(summarise(outboxRows(HERO)).pending).toBe(3);
  });

  it("picks one bar: syncing, offline, failed, review, then all synced", () => {
    const none = summarise([]);
    expect(outboxMode(snapshot("syncing"), summarise(conflict))).toBe("syncing");
    expect(outboxMode(snapshot("offline"), summarise(conflict))).toBe("offline");
    expect(outboxMode(snapshot("failed"), { ...none, errors: 1 })).toBe("failed");
    expect(outboxMode(snapshot("online"), summarise(conflict))).toBe("review");
    expect(outboxMode(snapshot("online"), none)).toBe("synced");
  });
});
