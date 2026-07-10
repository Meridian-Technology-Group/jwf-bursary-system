import { describe, it, expect } from "vitest";
import {
  effectiveSubmissionDeadline,
  isSubmissionDeadlinePassed,
} from "@/lib/rounds/submission-deadline";

describe("effectiveSubmissionDeadline", () => {
  const round = {
    closeDate: new Date("2026-09-30T00:00:00"),
    defaultSubmissionDeadline: null as Date | null,
  };

  it("falls back to the round close date (end-of-day) when no override and no round default", () => {
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null },
      round
    );
    expect(result.isOverride).toBe(false);
    expect(result.source).toBe("closeDate");
    // Normalised to the last millisecond of close-day so the window stays open
    // through the whole of the 30th, not until midnight at its start.
    expect(result.deadline.getHours()).toBe(23);
    expect(result.deadline.getMinutes()).toBe(59);
    expect(result.deadline.getSeconds()).toBe(59);
    expect(result.deadline.getMilliseconds()).toBe(999);
    expect(result.deadline.getDate()).toBe(30);
  });

  it("uses the per-application override verbatim when present (later than round)", () => {
    const override = new Date("2026-10-07T17:00:00Z");
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: override },
      round
    );
    expect(result.isOverride).toBe(true);
    expect(result.source).toBe("override");
    expect(result.deadline.toISOString()).toBe(override.toISOString());
  });

  it("supports an EARLIER override than the round close (symmetric case)", () => {
    const override = new Date("2026-09-15T12:00:00Z");
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: override },
      round
    );
    expect(result.isOverride).toBe(true);
    expect(result.source).toBe("override");
    expect(result.deadline.toISOString()).toBe(override.toISOString());
  });

  it("does not mutate the round close date object when falling back", () => {
    const original = round.closeDate.getTime();
    effectiveSubmissionDeadline({ submissionDeadlineAt: null }, round);
    expect(round.closeDate.getTime()).toBe(original);
  });

  // ── Item 12: round-level default submission-by date ───────────────────────

  it("uses the round default (end-of-day) when set and no per-application override", () => {
    const roundWithDefault = {
      closeDate: new Date("2026-09-30T00:00:00"),
      defaultSubmissionDeadline: new Date("2026-09-20T00:00:00"),
    };
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null },
      roundWithDefault
    );
    expect(result.isOverride).toBe(false);
    expect(result.source).toBe("roundDefault");
    // Normalised to end-of-day, same as the closeDate fallback.
    expect(result.deadline.getDate()).toBe(20);
    expect(result.deadline.getHours()).toBe(23);
    expect(result.deadline.getMinutes()).toBe(59);
  });

  it("a per-application override still wins over the round default", () => {
    const override = new Date("2026-09-25T17:00:00Z");
    const roundWithDefault = {
      closeDate: new Date("2026-09-30T00:00:00"),
      defaultSubmissionDeadline: new Date("2026-09-20T00:00:00"),
    };
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: override },
      roundWithDefault
    );
    expect(result.isOverride).toBe(true);
    expect(result.source).toBe("override");
    expect(result.deadline.toISOString()).toBe(override.toISOString());
  });

  it("falls back to the round close date when the round default is cleared (null)", () => {
    const roundWithoutDefault = {
      closeDate: new Date("2026-09-30T00:00:00"),
      defaultSubmissionDeadline: null,
    };
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null },
      roundWithoutDefault
    );
    expect(result.source).toBe("closeDate");
    expect(result.deadline.getDate()).toBe(30);
  });
});

describe("isSubmissionDeadlinePassed", () => {
  const round = {
    closeDate: new Date("2026-09-30T00:00:00"),
    defaultSubmissionDeadline: null as Date | null,
  };

  it("is not passed before the effective (end-of-day) round deadline", () => {
    const now = new Date("2026-09-30T09:00:00");
    expect(
      isSubmissionDeadlinePassed({ submissionDeadlineAt: null }, round, now)
    ).toBe(false);
  });

  it("is passed the day after the round close", () => {
    const now = new Date("2026-10-01T00:00:01");
    expect(
      isSubmissionDeadlinePassed({ submissionDeadlineAt: null }, round, now)
    ).toBe(true);
  });

  it("respects a later override — not passed even after round close", () => {
    const override = new Date("2026-10-07T17:00:00Z");
    const now = new Date("2026-10-02T00:00:00Z");
    expect(
      isSubmissionDeadlinePassed({ submissionDeadlineAt: override }, round, now)
    ).toBe(false);
  });

  it("respects an earlier override — passed before round close", () => {
    const override = new Date("2026-09-15T12:00:00Z");
    const now = new Date("2026-09-20T00:00:00Z");
    expect(
      isSubmissionDeadlinePassed({ submissionDeadlineAt: override }, round, now)
    ).toBe(true);
  });

  it("respects the round default — passed before round close but after the earlier default", () => {
    const roundWithDefault = {
      closeDate: new Date("2026-09-30T00:00:00"),
      defaultSubmissionDeadline: new Date("2026-09-20T00:00:00"),
    };
    const now = new Date("2026-09-25T00:00:00");
    expect(
      isSubmissionDeadlinePassed(
        { submissionDeadlineAt: null },
        roundWithDefault,
        now
      )
    ).toBe(true);
  });

  it("treats exactly-at-deadline as not yet passed (inclusive)", () => {
    const override = new Date("2026-10-07T17:00:00Z");
    expect(
      isSubmissionDeadlinePassed(
        { submissionDeadlineAt: override },
        round,
        override
      )
    ).toBe(false);
  });
});
