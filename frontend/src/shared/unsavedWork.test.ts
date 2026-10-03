import { afterEach, describe, expect, it } from "vitest";
import { readUnsavedWork, setUnsavedWork } from "./unsavedWork";

afterEach(() => {
  setUnsavedWork("a", null);
  setUnsavedWork("b", null);
});

describe("unsaved work", () => {
  it("is empty when no screen holds any", () => {
    expect(readUnsavedWork()).toEqual([]);
  });

  it("keeps one note per screen and replaces it on update", () => {
    setUnsavedWork("a", "first");
    setUnsavedWork("a", "second");
    setUnsavedWork("b", "other");
    expect(readUnsavedWork()).toEqual(["second", "other"]);
  });

  it("drops a screen's note when it clears it", () => {
    setUnsavedWork("a", "first");
    setUnsavedWork("a", null);
    expect(readUnsavedWork()).toEqual([]);
  });
});
