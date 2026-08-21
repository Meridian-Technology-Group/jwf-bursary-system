import { describe, it, expect } from "vitest";
import {
  defaultRollingDeadlineFor,
  effectiveSubmissionDeadline,
  isSubmissionDeadlinePassed,
  roundDefaultForType,
  roundSubmissionDeadline,
  type SubmissionDeadlineApplicationType,
  type SubmissionDeadlineRound,
} from "@/lib/rounds/submission-deadline";

/** Both application types, for matrix cases that must behave identically. */
const BOTH_TYPES: SubmissionDeadlineApplicationType[] = ["NEW", "ROLLING_OVER"];

/** A round with no default on either clock — everything falls to closeDate. */
const noDefaults: SubmissionDeadlineRound = {
  closeDate: new Date("2026-09-30T00:00:00"),
  defaultSubmissionDeadlineNew: null,
  defaultSubmissionDeadlineRolling: null,
};

/**
 * The realistic E1 shape: new applicants submit by 20 September, rolling-over
 * holders by the earlier April date (Q4 — one global rolling date per round).
 */
const typedDefaults: SubmissionDeadlineRound = {
  closeDate: new Date("2026-09-30T00:00:00"),
  defaultSubmissionDeadlineNew: new Date("2026-09-20T00:00:00"),
  defaultSubmissionDeadlineRolling: new Date("2026-04-30T00:00:00"),
};

describe("effectiveSubmissionDeadline", () => {
  // ── Tier 3: close-date fallback (type-blind) ───────────────────────────────

  describe.each(BOTH_TYPES)("tier 3 — closeDate fallback (%s)", (type) => {
    it("falls back to the round close date (end-of-day) with no override and no round default", () => {
      const result = effectiveSubmissionDeadline(
        { submissionDeadlineAt: null, applicationType: type },
        noDefaults
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
  });

  it("does not mutate the round close date object when falling back", () => {
    const original = noDefaults.closeDate.getTime();
    effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "NEW" },
      noDefaults
    );
    expect(noDefaults.closeDate.getTime()).toBe(original);
  });

  // ── Tier 1: per-application override (type-blind) ──────────────────────────

  describe.each(BOTH_TYPES)("tier 1 — override (%s)", (type) => {
    it("uses the per-application override verbatim (later than the round)", () => {
      const override = new Date("2026-10-07T17:00:00Z");
      const result = effectiveSubmissionDeadline(
        { submissionDeadlineAt: override, applicationType: type },
        typedDefaults
      );
      expect(result.isOverride).toBe(true);
      expect(result.source).toBe("override");
      expect(result.deadline.toISOString()).toBe(override.toISOString());
    });

    it("supports an EARLIER override than the round default (symmetric case)", () => {
      const override = new Date("2026-03-15T12:00:00Z");
      const result = effectiveSubmissionDeadline(
        { submissionDeadlineAt: override, applicationType: type },
        typedDefaults
      );
      expect(result.isOverride).toBe(true);
      expect(result.source).toBe("override");
      expect(result.deadline.toISOString()).toBe(override.toISOString());
    });
  });

  // ── Tier 2: the type-aware round default (E1 / D13-8) ─────────────────────

  it("a NEW application reads defaultSubmissionDeadlineNew", () => {
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "NEW" },
      typedDefaults
    );
    expect(result.source).toBe("roundDefault");
    expect(result.deadline.getMonth()).toBe(8); // September
    expect(result.deadline.getDate()).toBe(20);
  });

  it("a ROLLING_OVER application reads defaultSubmissionDeadlineRolling", () => {
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "ROLLING_OVER" },
      typedDefaults
    );
    expect(result.source).toBe("roundDefault");
    expect(result.deadline.getMonth()).toBe(3); // April
    expect(result.deadline.getDate()).toBe(30);
  });

  it("the two types resolve to genuinely different instants on the same round", () => {
    const forNew = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "NEW" },
      typedDefaults
    ).deadline;
    const forRolling = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "ROLLING_OVER" },
      typedDefaults
    ).deadline;
    expect(forRolling.getTime()).toBeLessThan(forNew.getTime());
  });

  it("BOTH typed defaults are normalised to end-of-day, like closeDate", () => {
    for (const type of BOTH_TYPES) {
      const { deadline } = effectiveSubmissionDeadline(
        { submissionDeadlineAt: null, applicationType: type },
        typedDefaults
      );
      expect(deadline.getHours()).toBe(23);
      expect(deadline.getMinutes()).toBe(59);
      expect(deadline.getSeconds()).toBe(59);
      expect(deadline.getMilliseconds()).toBe(999);
    }
  });

  it("falls through to closeDate when only the OTHER type's default is set", () => {
    const newOnly: SubmissionDeadlineRound = {
      closeDate: new Date("2026-09-30T00:00:00"),
      defaultSubmissionDeadlineNew: new Date("2026-09-20T00:00:00"),
      defaultSubmissionDeadlineRolling: null,
    };
    const rolling = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "ROLLING_OVER" },
      newOnly
    );
    expect(rolling.source).toBe("closeDate");
    expect(rolling.deadline.getDate()).toBe(30);

    // …and the NEW side is unaffected.
    const fresh = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "NEW" },
      newOnly
    );
    expect(fresh.source).toBe("roundDefault");
    expect(fresh.deadline.getDate()).toBe(20);
  });

  it("a per-application override still wins over the typed round default", () => {
    const override = new Date("2026-09-25T17:00:00Z");
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: override, applicationType: "ROLLING_OVER" },
      typedDefaults
    );
    expect(result.isOverride).toBe(true);
    expect(result.source).toBe("override");
    expect(result.deadline.toISOString()).toBe(override.toISOString());
  });
});

describe("roundDefaultForType", () => {
  it("selects the column matching the application type", () => {
    expect(roundDefaultForType(typedDefaults, "NEW")).toBe(
      typedDefaults.defaultSubmissionDeadlineNew
    );
    expect(roundDefaultForType(typedDefaults, "ROLLING_OVER")).toBe(
      typedDefaults.defaultSubmissionDeadlineRolling
    );
  });

  it("returns null when that type has no round default", () => {
    expect(roundDefaultForType(noDefaults, "NEW")).toBeNull();
    expect(roundDefaultForType(noDefaults, "ROLLING_OVER")).toBeNull();
  });
});

describe("roundSubmissionDeadline (no application row — invitation emails)", () => {
  it("resolves tiers 2–3 only, per application type", () => {
    expect(roundSubmissionDeadline(typedDefaults, "NEW").getDate()).toBe(20);
    expect(
      roundSubmissionDeadline(typedDefaults, "ROLLING_OVER").getMonth()
    ).toBe(3);
    expect(roundSubmissionDeadline(noDefaults, "NEW").getDate()).toBe(30);
  });

  it("is end-of-day, so an invitation never advertises a midnight cut-off", () => {
    const d = roundSubmissionDeadline(typedDefaults, "ROLLING_OVER");
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });
});

describe("isSubmissionDeadlinePassed", () => {
  it("is not passed before the effective (end-of-day) round deadline", () => {
    const now = new Date("2026-09-30T09:00:00");
    expect(
      isSubmissionDeadlinePassed(
        { submissionDeadlineAt: null, applicationType: "NEW" },
        noDefaults,
        now
      )
    ).toBe(false);
  });

  it("is passed the day after the round close", () => {
    const now = new Date("2026-10-01T00:00:01");
    expect(
      isSubmissionDeadlinePassed(
        { submissionDeadlineAt: null, applicationType: "NEW" },
        noDefaults,
        now
      )
    ).toBe(true);
  });

  it("respects a later override — not passed even after round close", () => {
    const override = new Date("2026-10-07T17:00:00Z");
    const now = new Date("2026-10-02T00:00:00Z");
    expect(
      isSubmissionDeadlinePassed(
        { submissionDeadlineAt: override, applicationType: "NEW" },
        noDefaults,
        now
      )
    ).toBe(false);
  });

  it("respects an earlier override — passed before round close", () => {
    const override = new Date("2026-09-15T12:00:00Z");
    const now = new Date("2026-09-20T00:00:00Z");
    expect(
      isSubmissionDeadlinePassed(
        { submissionDeadlineAt: override, applicationType: "NEW" },
        noDefaults,
        now
      )
    ).toBe(true);
  });

  it("treats exactly-at-deadline as not yet passed (inclusive)", () => {
    const override = new Date("2026-10-07T17:00:00Z");
    expect(
      isSubmissionDeadlinePassed(
        { submissionDeadlineAt: override, applicationType: "NEW" },
        noDefaults,
        override
      )
    ).toBe(false);
  });

  // ── The endOfDay boundary, per type ───────────────────────────────────────
  // The regression this guards: reading a date-only column raw puts the
  // deadline at 00:00:00.000, so a parent submitting at any point during the
  // deadline DAY is rejected — locked out a full day early.

  describe.each([
    ["NEW", 8, 20] as const, // September 20th
    ["ROLLING_OVER", 3, 30] as const, // April 30th
  ])(
    "endOfDay boundary on the typed round default (%s)",
    (type, month, day) => {
      const lastMillisecond = new Date(2026, month, day, 23, 59, 59, 999);
      const firstMillisecondAfter = new Date(2026, month, day + 1, 0, 0, 0, 0);
      const app = {
        submissionDeadlineAt: null,
        applicationType: type as SubmissionDeadlineApplicationType,
      };

      it("allows a submission at 23:59:59.999 on the deadline date", () => {
        expect(
          isSubmissionDeadlinePassed(app, typedDefaults, lastMillisecond)
        ).toBe(false);
      });

      it("allows a submission at 00:00 on the deadline date (not locked out a day early)", () => {
        const startOfDeadlineDay = new Date(2026, month, day, 0, 0, 0, 0);
        expect(
          isSubmissionDeadlinePassed(app, typedDefaults, startOfDeadlineDay)
        ).toBe(false);
      });

      it("rejects the very next millisecond", () => {
        expect(
          isSubmissionDeadlinePassed(app, typedDefaults, firstMillisecondAfter)
        ).toBe(true);
      });
    }
  );

  it("a rolling-over application is locked out while a new one is still open", () => {
    // 1 May 2026: past the April rolling deadline, well before the September
    // one. The single-column model could not express this at all.
    const now = new Date(2026, 4, 1, 9, 0, 0);
    expect(
      isSubmissionDeadlinePassed(
        { submissionDeadlineAt: null, applicationType: "ROLLING_OVER" },
        typedDefaults,
        now
      )
    ).toBe(true);
    expect(
      isSubmissionDeadlinePassed(
        { submissionDeadlineAt: null, applicationType: "NEW" },
        typedDefaults,
        now
      )
    ).toBe(false);
  });
});

describe("defaultRollingDeadlineFor", () => {
  it("suggests 30 April of the academic year's starting calendar year", () => {
    expect(defaultRollingDeadlineFor("2026/27")).toBe("2026-04-30");
    expect(defaultRollingDeadlineFor("2030/31")).toBe("2030-04-30");
  });

  it("tolerates surrounding whitespace", () => {
    expect(defaultRollingDeadlineFor("  2026/27 ")).toBe("2026-04-30");
  });

  it("returns an empty string for a year that is not yet well-formed", () => {
    // The create dialog calls this on every keystroke, so a half-typed year
    // must simply produce no suggestion rather than a bogus date.
    expect(defaultRollingDeadlineFor("")).toBe("");
    expect(defaultRollingDeadlineFor("2026")).toBe("");
    expect(defaultRollingDeadlineFor("2026/2027")).toBe("");
    expect(defaultRollingDeadlineFor("not-a-year")).toBe("");
  });
});
