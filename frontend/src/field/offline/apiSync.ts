import type { components } from "../../api/schema";
import { getSetting, setSetting, type BlobRecord, type OutboxRecord } from "./db";
import { roleOfOp, type FieldRole, type SyncIn, type SyncOut, type UploadBlobPayload } from "./fetchTransport";
import { registerBlobUploader, registerSyncHandler, type BlobUploader, type SyncHandler, type SyncOutcome } from "./sync";
import { request } from "./transport";

type DeviceRecordType = components["schemas"]["DeviceRecordType"];
type SyncResultOut = components["schemas"]["SyncResultOut"];
type AttachmentOut = components["schemas"]["AttachmentOut"];

/** The record types the backend accepts (`DeviceRecordType`). Anything else would be rejected with a 422, so it is refused here with a reason. */
export const DEVICE_RECORD_TYPES: readonly DeviceRecordType[] = [
  "driver.ack",
  "driver.startRoute",
  "driver.arrival",
  "driver.outcome",
  "driver.problem",
  "driver.finishRun",
  "loader.ack",
  "loader.check",
  "loader.confirmLoaded",
  "loader.exception",
];

const DEVICE_ID_KEY = "deviceId";

/** One id per phone or tablet, kept in the settings table, sent with every sync (`SyncIn.deviceId`). */
export async function getDeviceId(): Promise<string> {
  const existing = await getSetting<string | null>(DEVICE_ID_KEY, null);
  if (existing) return existing;
  const created = `dev-${crypto.randomUUID()}`;
  await setSetting(DEVICE_ID_KEY, created);
  return created;
}

function isDeviceRecordType(type: string): type is DeviceRecordType {
  return (DEVICE_RECORD_TYPES as readonly string[]).includes(type);
}

/** An outbox record as `POST /sync` wants it. The `clientId` goes through untouched: it is what makes a replay a `duplicate`. */
export function toSyncRecord(record: OutboxRecord): SyncIn["records"][number] {
  const payload = typeof record.payload === "object" && record.payload !== null && !Array.isArray(record.payload) ? (record.payload as Record<string, unknown>) : {};
  return {
    clientId: record.clientId,
    type: record.type as DeviceRecordType,
    payload,
    deviceTime: record.deviceTime,
    planVersionOnDevice: record.planVersionOnDevice,
    actor: record.actor,
    blobIds: record.blobIds ?? [],
  };
}

/**
 * Reads the server's verdict on one record. A conflict keeps what the server said, with its `conflictId` inside, so a screen
 * can show it (R1.7). A missing answer is an error to retry, never a silent accept.
 */
export function outcomeFromResult(result: SyncResultOut | undefined, groupKey?: string): SyncOutcome {
  if (!result) return { result: "error", reason: "The server did not answer for this record", groupKey };
  switch (result.result) {
    case "accepted":
    case "duplicate":
      return { result: result.result, serverPayload: result.serverPayload ?? undefined, groupKey };
    case "conflict":
      return { result: "conflict", serverPayload: { ...(result.serverPayload ?? {}), conflictId: result.conflictId ?? null }, reason: result.reason ?? undefined, groupKey };
    case "error":
      return { result: "error", reason: result.reason ?? "The server could not take this record", groupKey };
  }
}

/** Sends one outbox record through the role's `sync` op. Thrown NetworkErrors and ApiErrors reach the engine unchanged. */
export function createApiSyncHandler(role: FieldRole): SyncHandler {
  return async (record) => {
    if (!isDeviceRecordType(record.type)) return { result: "error", reason: `The server has no record type ${record.type}` };
    const body: SyncIn = { deviceId: await getDeviceId(), records: [toSyncRecord(record)] };
    const out = await request<SyncOut>(`${role}.sync`, body);
    return outcomeFromResult(
      out.results.find((r) => r.clientId === record.clientId),
      record.groupKey,
    );
  };
}

/** Registers the real sync handler for each record type of a role, replacing the mock's. */
export function registerApiSyncHandlers(role: FieldRole, types: readonly string[] = DEVICE_RECORD_TYPES.filter((type) => type.startsWith(`${role}.`))): void {
  const handler = createApiSyncHandler(role);
  for (const type of types) registerSyncHandler(type, handler);
}

let uploadGuard: ((role: FieldRole) => void) | undefined;

/** A hook that runs before every real upload and may throw to fail it. The driver's "Fail next photo upload" demo control uses it. */
export function setUploadGuard(guard: ((role: FieldRole) => void) | undefined): void {
  uploadGuard = guard;
}

/** The role a photo's upload goes out as: the role of the record it belongs to, else the one role that is on the API. */
function uploadRole(record: OutboxRecord | undefined, fallback: FieldRole): FieldRole {
  const owner = record ? roleOfOp(record.type) : undefined;
  return owner === "driver" || owner === "loader" ? owner : fallback;
}

/**
 * Uploads a photo or signature through `<role>.uploadBlob`. The engine has one uploader for both roles, so this one picks the
 * role from the record the blob belongs to. The op goes through the routing transport, so a role still on the mock is answered
 * by its mock. The blob's own id is the idempotency key: a replay comes back `duplicate: true` and counts as uploaded.
 */
export function createApiBlobUploader(fallbackRole: FieldRole = "driver"): BlobUploader {
  return async (blob: BlobRecord, record) => {
    const role = uploadRole(record, fallbackRole);
    uploadGuard?.(role);
    const payload: UploadBlobPayload = { clientId: blob.id, kind: blob.kind, blob: blob.blob, id: blob.id, bytes: blob.bytes };
    const out = await request<AttachmentOut | { ok: true }>(`${role}.uploadBlob`, payload);
    return "duplicate" in out && out.duplicate ? "duplicate" : "uploaded";
  };
}

export function registerApiBlobUploader(fallbackRole?: FieldRole): void {
  registerBlobUploader(createApiBlobUploader(fallbackRole));
}
