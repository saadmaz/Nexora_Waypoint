import { describe, expect, it } from "vitest";
import { askDispatchFlag, askDispatchNote } from "./askDispatch";

describe("ask Dispatch to call", () => {
  it("opens the vehicle's flag sheet as an Other flag with the request filled in", () => {
    const ask = askDispatchFlag("VEH003", 1);
    expect(ask.to).toBe("/loader/vehicles/VEH003/trips/1/flag");
    expect(ask.state).toEqual({ type: "Other", note: "Please call the dock about VEH003." });
  });

  it("writes a note long enough for the flag sheet to send (three characters or more)", () => {
    expect(askDispatchNote("VEH039").trim().length).toBeGreaterThanOrEqual(3);
  });
});
