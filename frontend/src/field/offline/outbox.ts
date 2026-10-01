import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { connectivity } from "./connectivity";
import { db, type OutboxRecord } from "./db";
import { nowMs } from "./time";

export type NewRecord = {
  type: string;
  payload: unknown;
  actor: string;
  planVersionOnDevice: number | null;
  blobIds?: string[];
  /** Override for tests and for records that carry their own idempotency key. */
  clientId?: string;
  /** ISO device time. Defaults to the scenario clock now. */
  deviceTime?: string;
  groupKey?: string;
};

const WAITING: OutboxRecord["status"][] = ["waiting", "sending", "error"];

/** Called after every enqueue so the engine can send at once when the device is online. */
let onEnqueue: (() => void) | undefined;
export function setEnqueueListener(fn: (() => void) | undefined): void {
  onEnqueue = fn;
}

/** Records that have not reached the server yet. The chip and banner show this count. */
export async function countWaiting(): Promise<number> {
  const all = await db.outbox.toArray();
  return all.filter((r) => WAITING.includes(r.status)).length;
}

export async function refreshWaitingCount(): Promise<void> {
  connectivity.setWaitingCount(await countWaiting());
}

/**
 * Saves a write on the phone. Every write goes here first (PRD v3 section 15): the screen shows
 * "Saved to phone" at once and the sync engine sends it when it can. Returns the saved record.
 */
export async function enqueue(input: NewRecord): Promise<OutboxRecord> {
  const record: OutboxRecord = {
    clientId: input.clientId ?? crypto.randomUUID(),
    type: input.type,
    payload: input.payload,
    deviceTime: input.deviceTime ?? new Date(nowMs()).toISOString(),
    planVersionOnDevice: input.planVersionOnDevice,
    actor: input.actor,
    status: "waiting",
    attempts: 0,
    blobIds: input.blobIds,
    groupKey: input.groupKey,
    createdAt: nowMs(),
  };
  // A repeated clientId is the same write: keep the first one.
  const existing = await db.outbox.where("clientId").equals(record.clientId).first();
  if (existing) return existing;
  const seq = await db.outbox.add(record);
  await refreshWaitingCount();
  onEnqueue?.();
  return { ...record, seq };
}

export async function getRecord(clientId: string): Promise<OutboxRecord | undefined> {
  return db.outbox.where("clientId").equals(clientId).first();
}

/** Every record, oldest first. Accepted ones stay so screens can show history ("Synced"). */
export async function listRecords(): Promise<OutboxRecord[]> {
  return db.outbox.orderBy("seq").toArray();
}

export async function updateRecord(clientId: string, changes: Partial<OutboxRecord>): Promise<void> {
  await db.outbox.where("clientId").equals(clientId).modify(changes);
  await refreshWaitingCount();
}

/** The outbox as a hook: re-renders whenever a record is saved or its state changes. */
export function useOutbox(): OutboxRecord[] {
  const [records, setRecords] = useState<OutboxRecord[]>([]);
  useEffect(() => {
    const subscription = liveQuery(() => db.outbox.orderBy("seq").toArray()).subscribe({
      next: setRecords,
      error: () => setRecords([]),
    });
    return () => subscription.unsubscribe();
  }, []);
  return records;
}
