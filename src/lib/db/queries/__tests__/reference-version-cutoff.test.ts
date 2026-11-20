/**
 * Audit 20 Nov 2026 (finding 11) — the cutoff the assessment page passes to
 * the v2 reference loaders: versions must take effect before the FOLLOWING
 * academic year starts (1 September), so in-year corrections apply and
 * next-year versions do not.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { referenceVersionCutoff } from "../reference-tables";

afterEach(() => {
  vi.useRealTimers();
});

describe("referenceVersionCutoff", () => {
  it.each([
    ["2026/27", "2027-09-01"],
    ["2026-27", "2027-09-01"],
    ["2027/28", "2028-09-01"],
  ])("%s → before %s", (academicYear, iso) => {
    expect(referenceVersionCutoff(academicYear).toISOString()).toBe(`${iso}T00:00:00.000Z`);
  });

  it("falls back to now when the year can't be read", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T10:00:00.000Z"));
    expect(referenceVersionCutoff(null).toISOString()).toBe("2026-11-20T10:00:00.000Z");
    expect(referenceVersionCutoff("next year").toISOString()).toBe("2026-11-20T10:00:00.000Z");
  });
});
