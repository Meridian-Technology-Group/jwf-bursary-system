import { describe, it, expect } from "vitest";
import {
  getDeadlineStatus,
  isSubmittable,
  formatTimeRemaining,
  CLOSING_SOON_HOURS,
} from "@/lib/portal/deadline";

const round = { closeDate: new Date("2026-06-30T00:00:00.000Z") };

describe("getDeadlineStatus (Epic 05 §3.2)", () => {
  it("uses the per-application override when set (instant verbatim)", () => {
    const override = new Date("2026-07-10T17:00:00.000Z");
    const now = new Date("2026-07-01T00:00:00.000Z");
    const s = getDeadlineStatus({ submissionDeadlineAt: override }, round, now);
    expect(s.isOverride).toBe(true);
    expect(s.deadline.getTime()).toBe(override.getTime());
    expect(s.isPast).toBe(false);
  });

  it("falls back to round close end-of-day when no override", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    const s = getDeadlineStatus({ submissionDeadlineAt: null }, round, now);
    expect(s.isOverride).toBe(false);
    // end-of-day, so still submittable through the close day
    expect(s.isPast).toBe(false);
    expect(s.msRemaining).toBeGreaterThan(0);
  });

  it("is past once now exceeds the deadline", () => {
    const now = new Date("2026-07-01T00:00:00.000Z");
    const s = getDeadlineStatus({ submissionDeadlineAt: null }, round, now);
    expect(s.isPast).toBe(true);
    expect(s.msRemaining).toBe(0);
  });

  it("flags closing-soon within the window but not past", () => {
    const override = new Date("2026-07-10T12:00:00.000Z");
    // 1 hour before
    const now = new Date("2026-07-10T11:00:00.000Z");
    const s = getDeadlineStatus({ submissionDeadlineAt: override }, round, now);
    expect(s.isClosingSoon).toBe(true);
    expect(s.isPast).toBe(false);
  });

  it("is not closing-soon well outside the window", () => {
    const override = new Date("2026-07-10T12:00:00.000Z");
    const now = new Date(
      override.getTime() - (CLOSING_SOON_HOURS + 24) * 60 * 60 * 1000
    );
    const s = getDeadlineStatus({ submissionDeadlineAt: override }, round, now);
    expect(s.isClosingSoon).toBe(false);
  });
});

describe("isSubmittable", () => {
  it("permits submit before the deadline and rejects after", () => {
    const override = new Date("2026-07-10T12:00:00.000Z");
    expect(
      isSubmittable(
        { submissionDeadlineAt: override },
        round,
        new Date("2026-07-10T11:59:00.000Z")
      )
    ).toBe(true);
    expect(
      isSubmittable(
        { submissionDeadlineAt: override },
        round,
        new Date("2026-07-10T12:00:01.000Z")
      )
    ).toBe(false);
  });
});

describe("formatTimeRemaining", () => {
  it("formats days, hours and minutes coarsely", () => {
    expect(formatTimeRemaining(0)).toBe("0 minutes");
    expect(formatTimeRemaining(30_000)).toBe("less than a minute");
    expect(formatTimeRemaining(5 * 60_000)).toBe("5 minutes");
    expect(formatTimeRemaining(60 * 60_000)).toBe("1 hour");
    expect(formatTimeRemaining((2 * 60 + 30) * 60_000)).toBe(
      "2 hours, 30 minutes"
    );
    expect(formatTimeRemaining(3 * 24 * 60 * 60_000)).toBe("3 days");
    expect(
      formatTimeRemaining((1 * 24 * 60 + 5 * 60) * 60_000)
    ).toBe("1 day, 5 hours");
  });
});
