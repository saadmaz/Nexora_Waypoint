import { describe, expect, it } from "vitest";
import {
  HERO_DATE,
  HERO_EVENING_DATE,
  clockOptionsFromSearch,
  colomboMs,
  createFieldClock,
  createFixedClock,
  formatDate,
  formatTime,
  isoDate,
  minutesUntil,
} from "./clock";

describe("scenario clock", () => {
  it("reads and writes times in Asia/Colombo, whatever the browser's zone", () => {
    const at = colomboMs("2026-09-29", "05:26");
    expect(at).toBe(Date.parse("2026-09-29T05:26:00+05:30"));
    expect(formatTime(at)).toBe("05:26");
    expect(formatDate(at)).toBe("Tue 29 Sep");
    expect(isoDate(at)).toBe("2026-09-29");
  });

  it("keeps the Colombo date when UTC is still the day before", () => {
    // 01:00 in Colombo on Tue 29 Sep is 19:30 UTC on Mon 28 Sep.
    const at = colomboMs("2026-09-29", "01:00");
    expect(new Date(at).toISOString()).toBe("2026-09-28T19:30:00.000Z");
    expect(isoDate(at)).toBe("2026-09-29");
    expect(formatTime(at)).toBe("01:00");
  });

  it("starts a ?at= clock on the hero day unless ?date= says otherwise", () => {
    const morning = createFieldClock(clockOptionsFromSearch("?at=05:26"));
    expect(isoDate(morning.nowMs())).toBe(HERO_DATE);
    expect(formatTime(morning.nowMs())).toBe("05:26");

    const evening = createFieldClock(clockOptionsFromSearch(`?at=23:45&date=${HERO_EVENING_DATE}`));
    expect(isoDate(evening.nowMs())).toBe(HERO_EVENING_DATE);
    expect(formatTime(evening.nowMs())).toBe("23:45");
  });

  it("ignores a malformed ?at= and falls back to the role's start, then to real time", () => {
    const withStart = createFieldClock({ at: "soon", start: { date: HERO_DATE, time: "04:45" } });
    expect(formatTime(withStart.nowMs())).toBe("04:45");
    const real = createFieldClock({ at: "soon" });
    expect(Math.abs(real.nowMs() - Date.now())).toBeLessThan(1000);
  });

  it("only moves forward when advanced", () => {
    const clock = createFieldClock({ at: "05:00" });
    clock.advanceTo?.(colomboMs(HERO_DATE, "05:17"));
    expect(formatTime(clock.nowMs())).toBe("05:17");
    clock.advanceTo?.(colomboMs(HERO_DATE, "05:10"));
    expect(formatTime(clock.nowMs())).toBe("05:17");
  });

  it("freezes a gallery frame at its own moment", () => {
    const clock = createFixedClock(HERO_DATE, "05:42");
    expect(clock.fixed).toBe(true);
    expect(clock.nowMs()).toBe(clock.nowMs());
    expect(formatTime(clock.nowMs())).toBe("05:42");
  });

  it("counts minutes to a departure, rounding up so a countdown never reads 0 early", () => {
    const now = colomboMs(HERO_DATE, "04:14");
    const departs = colomboMs(HERO_DATE, "05:10");
    expect(minutesUntil(departs, now)).toBe(56);
    expect(minutesUntil(departs, now + 30_000)).toBe(56);
    expect(minutesUntil(departs, departs + 60_000)).toBe(-1);
  });
});
