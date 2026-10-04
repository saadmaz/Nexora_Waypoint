import { describe, expect, it } from "vitest";
import { PROBLEM_TYPES } from "../types";
import { askDispatchHref, cantReachStoreHref } from "./problemLinks";

function params(href: string): URLSearchParams {
  const [path, query] = href.split("?");
  expect(path).toBe("/driver/issues/new");
  return new URLSearchParams(query);
}

describe("problem links", () => {
  it("asks Dispatch to call with a vehicle-wide problem and the reason as the note", () => {
    const p = params(askDispatchHref("Please call me. My route didn't download."));
    expect(p.get("type")).toBe("Something else");
    expect(p.get("note")).toBe("Please call me. My route didn't download.");
    expect(p.get("stop")).toBeNull();
  });

  it("opens Can't reach the store on the stop", () => {
    const p = params(cantReachStoreHref("OUT084"));
    expect(p.get("type")).toBe("Can't reach the store");
    expect(p.get("stop")).toBe("OUT084");
  });

  it("only uses types the problem screen accepts", () => {
    for (const href of [askDispatchHref("x"), cantReachStoreHref("OUT084")]) {
      expect(PROBLEM_TYPES).toContain(params(href).get("type"));
    }
  });
});
