import { describe, expect, it } from "vitest";
import { matchesFilter, noticeLook, noticeTarget } from "../notices/noticeView";
import { mapNotice } from "./runMapper";

describe("a call-back request from Dispatch on R8", () => {
  const notice = mapNotice(
    { id: 7, tag: "call_request", title: "Dispatch asked you to call", body: "Kumari at Dispatch asked you to call about plan v4.", createdAt: "2026-09-29T03:01:00+05:30", read: false, link: null },
    new Set(),
  );

  it("is kept, not dropped as an unknown tag", () => {
    expect(notice?.kind).toBe("call_request");
    expect(notice?.title).toBe("Dispatch asked you to call");
  });

  it("files under Dispatch with a phone icon, and is information only", () => {
    expect(matchesFilter(notice!, "dispatch")).toBe(true);
    expect(noticeLook(notice!).icon).toBe("phone");
    expect(noticeTarget(notice!)).toBeNull();
  });
});
