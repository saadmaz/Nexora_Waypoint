import { describe, expect, it } from "vitest";
import type { DriverNotice } from "../types";
import { matchesFilter, noticeTarget } from "./noticeView";

const notice = (kind: DriverNotice["kind"], extra: Partial<DriverNotice> = {}): DriverNotice => ({ id: kind, kind, title: kind, at: "06:40", read: false, ...extra });

describe("notification filters", () => {
  it("sorts every kind into Sync, Dispatch or Run", () => {
    expect(["synced", "photo_failed", "went_offline"].every((k) => matchesFilter(notice(k as DriverNotice["kind"]), "sync"))).toBe(true);
    expect(["resolved", "sent_for_review"].every((k) => matchesFilter(notice(k as DriverNotice["kind"]), "dispatch"))).toBe(true);
    expect(["plan_received", "orders_on_board", "plan_released"].every((k) => matchesFilter(notice(k as DriverNotice["kind"]), "run"))).toBe(true);
    expect(matchesFilter(notice("resolved"), "sync")).toBe(false);
    expect(matchesFilter(notice("resolved"), "all")).toBe(true);
  });
});

describe("where an entry leads", () => {
  it("opens R5.3, R5.1, R8.3 and the Outbox, and leaves plan and load entries as information", () => {
    expect(noticeTarget(notice("resolved", { outletId: "OUT084" }))).toEqual({ type: "path", to: "/driver/sync-result?view=resolved&stop=OUT084" });
    expect(noticeTarget(notice("sent_for_review", { outletId: "OUT084" }))).toEqual({ type: "path", to: "/driver/sync-result?view=conflict&stop=OUT084" });
    expect(noticeTarget(notice("photo_failed", { blobId: "b1" }))).toEqual({ type: "path", to: "/driver/notifications/photo/b1" });
    expect(noticeTarget(notice("synced"))).toEqual({ type: "outbox" });
    expect(noticeTarget(notice("plan_received"))).toBeNull();
    expect(noticeTarget(notice("went_offline"))).toBeNull();
    expect(noticeTarget(notice("orders_on_board"))).toBeNull();
    expect(noticeTarget(notice("plan_released"))).toBeNull();
  });
});
