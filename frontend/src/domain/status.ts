import type { IconName } from "../shared/ui/Icon";

/**
 * The 11 order statuses (PRD v2 section 4b). Everything else is a tag.
 * This union is shared by all four roles, so do not add a twelfth here without
 * changing the spec first.
 */
export type OrderStatus =
  | "Ordered"
  | "Confirmed"
  | "Planned"
  | "Deferred"
  | "Loaded"
  | "Departed"
  | "Delivered"
  | "Partial"
  | "Issue"
  | "Pending sync"
  | "Conflict";

export type Role = "store" | "dispatcher" | "loader" | "driver";

/** How a status pill is painted. "Conflict" has its own outlined amber style. */
export type PillKind =
  | "neutral"
  | "info"
  | "live"
  | "success"
  | "warning"
  | "danger"
  | "offline"
  | "deferred"
  | "conflict";

type StatusStyle = { kind: PillKind; icon: IconName };

const STATUS_STYLE: Record<OrderStatus, StatusStyle> = {
  Ordered: { kind: "neutral", icon: "clock" },
  Confirmed: { kind: "neutral", icon: "lock" },
  Planned: { kind: "info", icon: "route" },
  Deferred: { kind: "deferred", icon: "calendar-clock" },
  Loaded: { kind: "success", icon: "check" },
  Departed: { kind: "live", icon: "truck" },
  Delivered: { kind: "success", icon: "check" },
  Partial: { kind: "warning", icon: "alert-triangle" },
  Issue: { kind: "danger", icon: "alert-circle" },
  "Pending sync": { kind: "offline", icon: "cloud" },
  Conflict: { kind: "conflict", icon: "alert-triangle" },
};

export function statusStyle(status: OrderStatus): StatusStyle {
  return STATUS_STYLE[status];
}

/**
 * The label a given role sees for a status. Role-specific wording lives here and
 * nowhere else.
 *
 * Stores never see the word "Conflict": they see "Under review", with a
 * "Why you're seeing this" card next to it (PRD v2 V4 and section 4b).
 */
export function statusLabel(status: OrderStatus, role: Role): string {
  if (status === "Conflict" && role === "store") return "Under review";
  return status;
}

/** The three deferral types. Every store deferral notice names one. */
export type DeferralType = "capacity" | "policy" | "store request";

/**
 * A Deferred pill reads "Deferred · <type> → <next run>", for example
 * "Deferred · policy → Wed".
 */
export function deferredLabel(type: DeferralType, nextRunShort?: string): string {
  const base = `Deferred · ${type}`;
  return nextRunShort ? `${base} → ${nextRunShort}` : base;
}
