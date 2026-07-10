import { describe, it, expect } from "vitest";
import {
  formatLondonDateString,
  londonStartOfDayUtc,
  londonEndOfDayUtc,
} from "@/lib/datetime";

describe("londonStartOfDayUtc / londonEndOfDayUtc (Item 7.1)", () => {
  it("GMT date (winter, UTC+0): start/end of day are plain UTC midnight/23:59:59.999", () => {
    const start = londonStartOfDayUtc("2026-01-15");
    const end = londonEndOfDayUtc("2026-01-15");
    expect(start.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-15T23:59:59.999Z");
  });

  it("BST date (summer, UTC+1): London midnight is the PREVIOUS day 23:00 UTC", () => {
    const start = londonStartOfDayUtc("2026-07-09");
    const end = londonEndOfDayUtc("2026-07-09");
    // 00:00 BST = 23:00 UTC the day before.
    expect(start.toISOString()).toBe("2026-07-08T23:00:00.000Z");
    // 23:59:59.999 BST = 22:59:59.999 UTC same day.
    expect(end.toISOString()).toBe("2026-07-09T22:59:59.999Z");
  });

  it("keeps the whole boundary day inside the range regardless of GMT/BST", () => {
    const start = londonStartOfDayUtc("2026-07-09");
    const end = londonEndOfDayUtc("2026-07-09");
    // A submission at 09:00 London time on the 9th must fall within [start, end].
    const midday = new Date("2026-07-09T09:00:00.000Z"); // 10:00 BST
    expect(midday.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(midday.getTime()).toBeLessThanOrEqual(end.getTime());
  });

  it("the day either side of a GMT/BST clock-change stays a full local day", () => {
    // BST → GMT clock change 2026 is the last Sunday of October (25th).
    const dayBefore = {
      start: londonStartOfDayUtc("2026-10-24"),
      end: londonEndOfDayUtc("2026-10-24"),
    };
    const dayAfter = {
      start: londonStartOfDayUtc("2026-10-26"),
      end: londonEndOfDayUtc("2026-10-26"),
    };
    // Before the change: BST (UTC+1). After: GMT (UTC+0).
    expect(dayBefore.start.toISOString()).toBe("2026-10-23T23:00:00.000Z");
    expect(dayAfter.start.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});

describe("formatLondonDateString", () => {
  it("formats a plain calendar-date string without a timezone rollover", () => {
    expect(formatLondonDateString("2026-07-09")).toBe("9 Jul 2026");
    expect(formatLondonDateString("2026-01-01")).toBe("1 Jan 2026");
  });
});
