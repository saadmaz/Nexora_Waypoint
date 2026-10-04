import { describe, expect, it } from "vitest";
import { mapDock, readLocalState } from "./apiLoaderMapper";
import type { components } from "../../api/schema";

type DockOut = components["schemas"]["DockOut"];

const base: DockOut = { dock: "kandy", planVersion: 4, acknowledged: false, people: [], vehicles: [], requests: [] };

describe("the dock's call-back request from Dispatch", () => {
  it("carries the newest request to L1", () => {
    const view = mapDock(
      { ...base, requests: [{ id: 2, title: "Dispatch asked you to call", body: "Kumari at Dispatch asked you to call about plan v4.", at: "2026-09-29T03:01:00+05:30" }] },
      "kandy",
      readLocalState([]),
    );
    expect(view.dispatchRequest?.title).toBe("Dispatch asked you to call");
    expect(view.dispatchRequest?.body).toContain("plan v4");
    expect(view.dispatchRequest?.at).toMatch(/^\d\d:\d\d$/);
  });

  it("has no banner when Dispatch has asked nothing", () => {
    expect(mapDock(base, "kandy", readLocalState([])).dispatchRequest).toBeUndefined();
    expect(mapDock({ ...base, requests: [] }, "kandy", readLocalState([])).dispatchRequest).toBeUndefined();
  });
});
