import { describe, expect, it } from "vitest";
import { ApiError, NetworkError } from "../../../api/DispatcherApi";
import { presenterFailure } from "./presenterFailure";

describe("the presenter control's failure message", () => {
  it("names the missing presenter routes, which is the one failure a variable fixes", () => {
    // Every /demo route answers 404 when the API runs without DEMO_MODE=true, and the panel used to look dead.
    expect(presenterFailure(new ApiError("not_found", "Not Found"))).toContain("DEMO_MODE=true");
  });

  it("says the clock did not move when there was no answer", () => {
    expect(presenterFailure(new NetworkError())).toContain("clock is where it was");
  });

  it("prints the server's own reason for a refused jump", () => {
    const refusal = "The clock only moves forward. Use Reset demo to start again.";
    expect(presenterFailure(new ApiError("clock_backwards", refusal))).toBe(refusal);
  });

  it("falls back to a plain sentence for something it does not know", () => {
    expect(presenterFailure(new TypeError("boom"))).toContain("failed");
  });
});
