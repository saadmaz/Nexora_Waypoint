/**
 * What the store saved while offline, kept on the device so closing the tab does not lose it (PRD v3 section 15 Store:
 * "S1 orders queue and count only when the server returns Received").
 *
 * One queued order (S1.5 A) and one queued receipt per delivery day (S3.S), under `wp.store.queue.*`, one key each.
 * Storage is optional: a browser that blocks it keeps the queue for the life of the tab, as before. Reading never throws.
 */

const PREFIX = "wp.store.queue.";

export type QueueKey = { kind: "order"; outletId: string } | { kind: "receipt"; outletId: string; date: string };

export function queueKey(key: QueueKey): string {
  return key.kind === "order" ? `${PREFIX}order.${key.outletId}` : `${PREFIX}receipt.${key.outletId}.${key.date}`;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The saved queue, or null when there is none, it is unreadable, or it fails `isValid`. */
export function loadQueued<T>(key: QueueKey, isValid: (value: unknown) => value is T): T | null {
  const raw = storage()?.getItem(queueKey(key));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isValid(value) ? value : null;
  } catch {
    return null;
  }
}

/** Saves the queue, or clears it with `null`. A failed write leaves the in-memory queue as the only copy. */
export function saveQueued(key: QueueKey, value: unknown): void {
  const store = storage();
  if (!store) return;
  try {
    if (value === null) store.removeItem(queueKey(key));
    else store.setItem(queueKey(key), JSON.stringify(value));
  } catch {
    // Quota or blocked storage: the queue still lives in the page until it is sent.
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A queued S1 order: when it was saved and the lines (`chilled` / `dry`, units). */
export function isQueuedOrder(value: unknown): value is { at: string; lines: { kind: "chilled" | "dry"; units: number }[] } {
  return (
    isObject(value) &&
    typeof value.at === "string" &&
    Array.isArray(value.lines) &&
    value.lines.length > 0 &&
    value.lines.every((l) => isObject(l) && (l.kind === "chilled" || l.kind === "dry") && typeof l.units === "number" && l.units >= 0)
  );
}

/** A queued S3 receipt: when it was confirmed, the received count per order and an optional shortfall reason. */
export function isQueuedReceipt(value: unknown): value is { at: string; lines: { orderId: string; received: number }[]; reason?: string } {
  return (
    isObject(value) &&
    typeof value.at === "string" &&
    Array.isArray(value.lines) &&
    value.lines.length > 0 &&
    value.lines.every((l) => isObject(l) && typeof l.orderId === "string" && typeof l.received === "number") &&
    (value.reason === undefined || typeof value.reason === "string")
  );
}
