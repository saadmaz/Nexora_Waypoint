import Dexie, { type Table } from "dexie";

/** The states of a record in the outbox. Records keep their final state so screens can show history. */
export type OutboxStatus = "waiting" | "sending" | "accepted" | "conflict" | "error";

/**
 * One write waiting to reach the server (field conventions sections 10 and 11). `clientId` is the
 * idempotency key: sending the same record twice is harmless because the server answers
 * `duplicate`. Records are never deleted when accepted.
 */
export type OutboxRecord = {
  /** Insertion order. Records are sent in this order. */
  seq?: number;
  clientId: string;
  /** For example "driver.arrival", "loader.check" (PRD v3 section 15). */
  type: string;
  payload: unknown;
  /** ISO time on the device when the user acted, from the scenario clock. */
  deviceTime: string;
  /** The plan version the device held when it recorded this, or null where no plan applies. */
  planVersionOnDevice: number | null;
  /** The PIN person for the loader, the driver ID for the driver. */
  actor: string;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  /** Photos and signatures that belong to this record. They upload after it. */
  blobIds?: string[];
  /** Epoch ms of the next automatic retry of an `error` record (30 s after the failure). */
  nextAttemptAt?: number;
  /** What the server answered, kept so a screen can show it (for example the conflict details). */
  serverPayload?: unknown;
  /** The group the handler gave this record, for example the stop it belongs to. */
  groupKey?: string;
  /** Epoch ms when the record was saved on the phone. */
  createdAt: number;
  /** Epoch ms when the server answered. */
  syncedAt?: number;
};

export type CacheEntry = { key: string; value: unknown; updatedAt: number };

export type BlobUploadStatus = "pending" | "uploaded" | "failed";

export type BlobRecord = {
  id: string;
  kind: "photo" | "signature";
  blob: Blob;
  mime: string;
  bytes: number;
  /** The outbox record this belongs to. It uploads once that record is accepted. */
  recordClientId?: string;
  uploadStatus: BlobUploadStatus;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: number;
  createdAt: number;
};

export type SettingEntry = { key: string; value: unknown };

/**
 * The phone's database, `waypoint-field` (field conventions section 11). Four tables:
 *   outbox    pending and finished writes, in the order they were made
 *   cache     dock plan, load plans, route, history: the last good copy of what the server said
 *   blobs     photos and signatures, compressed, kept until they upload
 *   settings  theme, text size, language, simulated offline, dock
 */
export class FieldDb extends Dexie {
  outbox!: Table<OutboxRecord, number>;
  cache!: Table<CacheEntry, string>;
  blobs!: Table<BlobRecord, string>;
  settings!: Table<SettingEntry, string>;

  constructor(name = "waypoint-field") {
    super(name);
    this.version(1).stores({
      outbox: "++seq, &clientId, status, type",
      cache: "key",
      blobs: "id, recordClientId, uploadStatus",
      settings: "key",
    });
  }
}

export const db = new FieldDb();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function getCache<T>(key: string): Promise<{ value: T; updatedAt: number } | undefined> {
  const row = await db.cache.get(key);
  return row ? { value: row.value as T, updatedAt: row.updatedAt } : undefined;
}

export async function putCache(key: string, value: unknown, updatedAt: number): Promise<void> {
  await db.cache.put({ key, value, updatedAt });
}
