import type { IconName } from "../../../shared/ui/Icon";
import type { DriverNotice, DriverNoticeKind } from "../types";

/** The four filters on R8.1. */
export type NoticeFilter = "all" | "sync" | "dispatch" | "run";

type Category = Exclude<NoticeFilter, "all">;

/** Sync is what the phone did, Dispatch is what Dispatch decided, Run is the plan and the load. */
const CATEGORY: Record<DriverNoticeKind, Category> = {
  resolved: "dispatch",
  sent_for_review: "dispatch",
  synced: "sync",
  photo_failed: "sync",
  went_offline: "sync",
  plan_received: "run",
  orders_on_board: "run",
  plan_released: "run",
};

export type NoticeTone = "success" | "danger" | "review" | "route" | "offline";

const LOOK: Record<DriverNoticeKind, { icon: IconName; tone: NoticeTone }> = {
  resolved: { icon: "check", tone: "success" },
  sent_for_review: { icon: "alert-triangle", tone: "review" },
  synced: { icon: "refresh-cw", tone: "success" },
  photo_failed: { icon: "alert-circle", tone: "danger" },
  went_offline: { icon: "wifi-off", tone: "offline" },
  plan_received: { icon: "route", tone: "route" },
  orders_on_board: { icon: "check", tone: "success" },
  plan_released: { icon: "route", tone: "route" },
};

export function noticeLook(notice: DriverNotice): { icon: IconName; tone: NoticeTone } {
  return LOOK[notice.kind];
}

export function matchesFilter(notice: DriverNotice, filter: NoticeFilter): boolean {
  return filter === "all" || CATEGORY[notice.kind] === filter;
}

/** Where an entry leads (driver prompt 4 section 7). Plan and load entries are information only. */
export type NoticeTarget = { type: "path"; to: string } | { type: "outbox" } | null;

export function noticeTarget(notice: DriverNotice): NoticeTarget {
  switch (notice.kind) {
    case "resolved":
      return { type: "path", to: `/driver/sync-result?view=resolved${notice.outletId ? `&stop=${notice.outletId}` : ""}` };
    case "sent_for_review":
      return { type: "path", to: `/driver/sync-result?view=conflict${notice.outletId ? `&stop=${notice.outletId}` : ""}` };
    case "photo_failed":
      return notice.blobId ? { type: "path", to: `/driver/notifications/photo/${notice.blobId}` } : null;
    case "synced":
      return { type: "outbox" };
    default:
      return null;
  }
}
