import type { OutboxRecord } from "../../../field/offline";
import type { ConnectivitySnapshot } from "../../../field/offline";

/** What a row's pill says (R4: "Saved on phone", "Sending", "Synced", "Sent for review"). */
export type OutboxRowState = "saved" | "sending" | "synced" | "review" | "retrying";

export type OutboxRow = {
  clientId: string;
  /** HH:MM from the record's own payload, as the driver saw it when they acted. */
  time: string;
  kind: "departed" | "arrival" | "outcome";
  /** The outlet or order ID that follows the word ("OUT084", "ORD2001"). */
  subject?: string;
  /** The word for an outcome row: "Delivered", "Damaged", "Refused" … */
  outcomeWord?: string;
  state: OutboxRowState;
  /** The outlet this record belongs to, to count stops in conflict. */
  groupKey?: string;
};

type Payload = { at?: string; outletId?: string; orderId?: string; outcome?: string };

const PENDING: OutboxRecord["status"][] = ["waiting", "sending", "error"];

export function isPending(record: OutboxRecord): boolean {
  return PENDING.includes(record.status);
}

function rowState(record: OutboxRecord, resolved: ReadonlySet<string>): OutboxRowState {
  switch (record.status) {
    case "waiting":
      return "saved";
    case "sending":
      return "sending";
    case "error":
      return "retrying";
    case "conflict":
      return record.groupKey && resolved.has(record.groupKey) ? "synced" : "review";
    default:
      return "synced";
  }
}

/**
 * The driver's own records as the R4 rows, in the order they were saved. Only the three the driver
 * thinks of as events are listed (departed, arrival, delivery outcome); the plan acknowledgement
 * is not drawn. A conflict whose stop Dispatch has since resolved reads Synced again.
 */
export function outboxRows(records: readonly OutboxRecord[], resolvedStops: ReadonlySet<string> = new Set()): OutboxRow[] {
  const rows: OutboxRow[] = [];
  for (const record of records) {
    const payload = (record.payload ?? {}) as Payload;
    const base = { clientId: record.clientId, time: payload.at ?? "--:--", state: rowState(record, resolvedStops), groupKey: record.groupKey };
    if (record.type === "driver.startRoute") rows.push({ ...base, kind: "departed" });
    else if (record.type === "driver.arrival") rows.push({ ...base, kind: "arrival", subject: payload.outletId });
    else if (record.type === "driver.outcome") rows.push({ ...base, kind: "outcome", subject: payload.orderId, outcomeWord: payload.outcome ?? "Delivered" });
  }
  return rows;
}

export type OutboxSummary = {
  pending: number;
  errors: number;
  reviewStops: number;
  reviewOrders: number;
};

export function summarise(rows: readonly OutboxRow[]): OutboxSummary {
  const review = rows.filter((r) => r.state === "review");
  return {
    pending: rows.filter((r) => r.state === "saved" || r.state === "sending" || r.state === "retrying").length,
    errors: rows.filter((r) => r.state === "retrying").length,
    reviewStops: new Set(review.map((r) => r.groupKey ?? r.clientId)).size,
    reviewOrders: review.length,
  };
}

/** The bar above the rows. One mode at a time, in this order: syncing, offline, failed, review, all synced. */
export type OutboxMode = "syncing" | "offline" | "failed" | "review" | "synced";

export function outboxMode(connectivity: ConnectivitySnapshot, summary: OutboxSummary): OutboxMode {
  if (connectivity.status === "syncing") return "syncing";
  if (connectivity.status === "offline") return "offline";
  if (summary.errors > 0) return "failed";
  if (summary.reviewOrders > 0) return "review";
  return "synced";
}
