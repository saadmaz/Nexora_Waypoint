import { describe, expect, it } from "vitest";
import { logOutWarnings } from "./logOutWarnings";

const none = { unsaved: [], waitingRecords: 0, waitingPhotos: 0 };

describe("logOutWarnings", () => {
  it("logs out at once when nothing is waiting", () => {
    expect(logOutWarnings("store", none)).toEqual([]);
    expect(logOutWarnings("driver", none)).toEqual([]);
  });

  it("passes on a screen's unsaved note", () => {
    expect(logOutWarnings("store", { ...none, unsaved: ["Your order changes are not placed yet."] })).toEqual([
      "Your order changes are not placed yet.",
    ]);
  });

  it("counts unsynced updates and photos for the field roles", () => {
    expect(logOutWarnings("driver", { ...none, waitingRecords: 3, waitingPhotos: 1 })).toEqual([
      "3 updates have not synced yet. They stay on this device and send after the next sign-in.",
      "1 photo or signature is not uploaded yet.",
    ]);
    expect(logOutWarnings("loader", { ...none, waitingRecords: 1 })).toEqual([
      "1 update has not synced yet. It stays on this device and sends after the next sign-in.",
    ]);
  });

  it("ignores the field outbox for office roles", () => {
    expect(logOutWarnings("dispatcher", { ...none, waitingRecords: 4, waitingPhotos: 2 })).toEqual([]);
    expect(logOutWarnings("store", { ...none, waitingRecords: 4 })).toEqual([]);
  });
});
