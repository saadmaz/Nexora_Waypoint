import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isQueuedOrder, isQueuedReceipt, loadQueued, queueKey, saveQueued } from "./queue";

/**
 * The store's offline queue on the device (PRD v3 section 15 Store). An order or receipt saved offline must survive the
 * tab closing, and blocked or full storage must never break the page.
 */

function fakeStorage(options: { failWrites?: boolean } = {}) {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (options.failWrites) throw new Error("QuotaExceededError");
      map.set(key, value);
    },
    removeItem: (key: string) => void map.delete(key),
  };
}

function install(store: ReturnType<typeof fakeStorage> | (() => never)): void {
  const descriptor = typeof store === "function" ? { get: store } : { value: store };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.defineProperty({}, "localStorage", { configurable: true, ...descriptor }),
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

const ORDER = { kind: "order", outletId: "OUT084" } as const;
const RECEIPT = { kind: "receipt", outletId: "OUT084", date: "2026-09-29" } as const;
const queuedOrder = { at: "15:52", lines: [{ kind: "chilled", units: 12 }, { kind: "dry", units: 8 }] };
const queuedReceipt = { at: "07:30", lines: [{ orderId: "ORD2001", received: 10 }], reason: "Missing" };

describe("the store's offline queue", () => {
  let store: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    store = fakeStorage();
    install(store);
  });

  it("keeps one queued order per outlet and one receipt per outlet and day, under wp.store.queue.*", () => {
    expect(queueKey(ORDER)).toBe("wp.store.queue.order.OUT084");
    expect(queueKey(RECEIPT)).toBe("wp.store.queue.receipt.OUT084.2026-09-29");
  });

  it("restores what was saved, as it was saved, after the page is gone", () => {
    saveQueued(ORDER, queuedOrder);
    saveQueued(RECEIPT, queuedReceipt);
    expect(loadQueued(ORDER, isQueuedOrder)).toEqual(queuedOrder);
    expect(loadQueued(RECEIPT, isQueuedReceipt)).toEqual(queuedReceipt);
  });

  it("forgets the queue once it is sent", () => {
    saveQueued(ORDER, queuedOrder);
    saveQueued(ORDER, null);
    expect(loadQueued(ORDER, isQueuedOrder)).toBeNull();
    expect(store.map.size).toBe(0);
  });

  it("ignores a stored value that is not a queue of its kind, or is not JSON", () => {
    store.map.set(queueKey(ORDER), JSON.stringify({ at: "15:52", lines: [] }));
    expect(loadQueued(ORDER, isQueuedOrder)).toBeNull();
    store.map.set(queueKey(ORDER), JSON.stringify(queuedReceipt));
    expect(loadQueued(ORDER, isQueuedOrder)).toBeNull();
    store.map.set(queueKey(RECEIPT), "{not json");
    expect(loadQueued(RECEIPT, isQueuedReceipt)).toBeNull();
  });

  it("never throws when storage is full or blocked", () => {
    install(fakeStorage({ failWrites: true }));
    expect(() => saveQueued(ORDER, queuedOrder)).not.toThrow();
    expect(loadQueued(ORDER, isQueuedOrder)).toBeNull();
    install(() => {
      throw new Error("SecurityError");
    });
    expect(() => saveQueued(ORDER, queuedOrder)).not.toThrow();
    expect(loadQueued(ORDER, isQueuedOrder)).toBeNull();
  });
});
