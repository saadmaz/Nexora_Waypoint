import { describe, expect, it } from "vitest";
import { clockTime, dayLabel, weekdayShort } from "./format";
import { cutoffFor, deliveryDayFor, isPastCutoff, minutesUntilCutoff, nextOperatingDayAfter, operatingDayFor, releaseFor, toIsoDate } from "./schedule";

// Fixed instants, written with the Colombo offset. They must read the same on a machine set to any time zone: CI runs this
// file with TZ=America/New_York as well as the default (DP-26).
const at = (iso: string) => new Date(iso);

describe("times and dates are read in Asia/Colombo", () => {
  it("formats a time", () => {
    expect(clockTime(at("2026-09-29T05:42:00+05:30"))).toBe("05:42");
    expect(clockTime("2026-09-28T23:40:00+05:30")).toBe("23:40");
    expect(clockTime(at("2026-09-28T18:30:00Z"))).toBe("00:00"); // UTC evening is already the next morning in Colombo
  });

  it("labels a day", () => {
    expect(dayLabel("2026-09-29")).toBe("Tue 29 Sep");
    expect(dayLabel("2026-10-06")).toBe("Tue 6 Oct");
    expect(weekdayShort("2026-09-30")).toBe("Wed");
  });

  it("names the day an instant falls on in Colombo, not in the browser", () => {
    expect(toIsoDate(at("2026-09-29T00:10:00+05:30"))).toBe("2026-09-29");
    expect(toIsoDate(at("2026-09-28T19:00:00Z"))).toBe("2026-09-29"); // 00:30 in Colombo
    expect(toIsoDate(at("2026-09-29T23:30:00+05:30"))).toBe("2026-09-29");
  });
});

describe("the cutoff and the delivery day follow Colombo time", () => {
  it("puts the cutoff at 16:00 on the day before", () => {
    expect(cutoffFor("2026-09-29").toISOString()).toBe("2026-09-28T10:30:00.000Z");
    expect(releaseFor("2026-09-29").toISOString()).toBe("2026-09-28T18:10:00.000Z");
  });

  it("flips at 16:00 sharp", () => {
    expect(isPastCutoff("2026-09-29", at("2026-09-28T15:59:00+05:30"))).toBe(false);
    expect(isPastCutoff("2026-09-29", at("2026-09-28T16:00:00+05:30"))).toBe(true);
    expect(minutesUntilCutoff("2026-09-29", at("2026-09-28T15:30:00+05:30"))).toBe(30);
  });

  it("counts an order placed at 15:40 for tomorrow and one at 16:05 for the day after", () => {
    expect(operatingDayFor(at("2026-09-28T15:40:00+05:30"))).toBe("2026-09-29");
    expect(operatingDayFor(at("2026-09-28T16:05:00+05:30"))).toBe("2026-09-30");
  });

  it("skips Sunday", () => {
    expect(nextOperatingDayAfter("2026-10-03")).toBe("2026-10-05"); // Sat to Mon
    expect(operatingDayFor(at("2026-10-03T10:00:00+05:30"))).toBe("2026-10-05");
  });

  it("looks at today's run until 08:00, then at the next day", () => {
    expect(deliveryDayFor(at("2026-09-29T05:20:00+05:30"))).toBe("2026-09-29");
    expect(deliveryDayFor(at("2026-09-28T16:01:00+05:30"))).toBe("2026-09-29");
    expect(deliveryDayFor(at("2026-09-29T08:00:00+05:30"))).toBe("2026-09-30");
  });
});
