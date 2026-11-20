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

/**
 * Date-only (`@db.Date`) fixtures are built as UTC midnight, exactly as Prisma
 * returns them, and every end-of-day expectation is an explicit UTC instant for
 * 23:59:59.999 Europe/London — so this suite asserts the same thing whatever
 * the machine's TZ is (run it with `TZ=UTC` too).
 */
/** End of 30 Sep 2026 in London (BST). */
const END_30_SEP = "2026-09-30T22:59:59.999Z";
/** End of 20 Sep 2026 in London (BST). */
const END_20_SEP = "2026-09-20T22:59:59.999Z";
/** End of 30 Apr 2026 in London (BST). */
const END_30_APR = "2026-04-30T22:59:59.999Z";

/** Both application types, for matrix cases that must behave identically. */
const BOTH_TYPES: SubmissionDeadlineApplicationType[] = ["NEW", "ROLLING_OVER"];

/** A round with no default on either clock — everything falls to closeDate. */
const noDefaults: SubmissionDeadlineRound = {
  closeDate: new Date("2026-09-30T00:00:00Z"),
  defaultSubmissionDeadlineNew: null,
  defaultSubmissionDeadlineRolling: null,
  windows: [],
};

/**
 * The realistic E1 shape: new applicants submit by 20 September, rolling-over
 * holders by the earlier April date (Q4 — one global rolling date per round).
 */
const typedDefaults: SubmissionDeadlineRound = {
  closeDate: new Date("2026-09-30T00:00:00Z"),
  defaultSubmissionDeadlineNew: new Date("2026-09-20T00:00:00Z"),
  defaultSubmissionDeadlineRolling: new Date("2026-04-30T00:00:00Z"),
  windows: [],
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
      expect(result.deadline.toISOString()).toBe(END_30_SEP);
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
    expect(result.deadline.toISOString()).toBe(END_20_SEP);
  });

  it("a ROLLING_OVER application reads defaultSubmissionDeadlineRolling", () => {
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "ROLLING_OVER" },
      typedDefaults
    );
    expect(result.source).toBe("roundDefault");
    expect(result.deadline.toISOString()).toBe(END_30_APR);
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

  it("BOTH typed defaults are normalised to end-of-day in London, like closeDate", () => {
    const expected = { NEW: END_20_SEP, ROLLING_OVER: END_30_APR };
    for (const type of BOTH_TYPES) {
      const { deadline } = effectiveSubmissionDeadline(
        { submissionDeadlineAt: null, applicationType: type },
        typedDefaults
      );
      expect(deadline.toISOString()).toBe(expected[type]);
    }
  });

  // ── London, not the server's zone (Vercel runs UTC) ───────────────────────

  it("BST: a 30 April date-only deadline ends at 23:59:59.999 London (22:59:59.999Z), not 00:59 on 1 May", () => {
    const round: SubmissionDeadlineRound = {
      ...noDefaults,
      defaultSubmissionDeadlineRolling: new Date("2026-04-30T00:00:00Z"),
    };
    const { deadline } = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "ROLLING_OVER" },
      round
    );
    expect(deadline.toISOString()).toBe("2026-04-30T22:59:59.999Z");
    // 00:30 London on 1 May (23:30Z) is past it; the old code let it through.
    expect(
      isSubmissionDeadlinePassed(
        { submissionDeadlineAt: null, applicationType: "ROLLING_OVER" },
        round,
        new Date("2026-04-30T23:30:00Z")
      )
    ).toBe(true);
  });

  it("GMT: a 30 November date-only deadline ends at 23:59:59.999 London (23:59:59.999Z)", () => {
    const round: SubmissionDeadlineRound = {
      ...noDefaults,
      closeDate: new Date("2026-11-30T00:00:00Z"),
    };
    const { deadline } = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "NEW" },
      round
    );
    expect(deadline.toISOString()).toBe("2026-11-30T23:59:59.999Z");
  });

  it("falls through to closeDate when only the OTHER type's default is set", () => {
    const newOnly: SubmissionDeadlineRound = {
      closeDate: new Date("2026-09-30T00:00:00Z"),
      defaultSubmissionDeadlineNew: new Date("2026-09-20T00:00:00Z"),
      defaultSubmissionDeadlineRolling: null,
      windows: [],
    };
    const rolling = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "ROLLING_OVER" },
      newOnly
    );
    expect(rolling.source).toBe("closeDate");
    expect(rolling.deadline.toISOString()).toBe(END_30_SEP);

    // …and the NEW side is unaffected.
    const fresh = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "NEW" },
      newOnly
    );
    expect(fresh.source).toBe("roundDefault");
    expect(fresh.deadline.toISOString()).toBe(END_20_SEP);
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
    expect(roundSubmissionDeadline(typedDefaults, "NEW").toISOString()).toBe(END_20_SEP);
    expect(roundSubmissionDeadline(typedDefaults, "ROLLING_OVER").toISOString()).toBe(
      END_30_APR
    );
    expect(roundSubmissionDeadline(noDefaults, "NEW").toISOString()).toBe(END_30_SEP);
  });

  it("is end-of-day, so an invitation never advertises a midnight cut-off", () => {
    const d = roundSubmissionDeadline(typedDefaults, "ROLLING_OVER");
    expect(d.toISOString()).toBe(END_30_APR);
  });
});

describe("isSubmissionDeadlinePassed", () => {
  it("is not passed before the effective (end-of-day) round deadline", () => {
    const now = new Date("2026-09-30T08:00:00Z"); // 09:00 London
    expect(
      isSubmissionDeadlinePassed(
        { submissionDeadlineAt: null, applicationType: "NEW" },
        noDefaults,
        now
      )
    ).toBe(false);
  });

  it("is passed the day after the round close", () => {
    const now = new Date("2026-09-30T23:00:01Z"); // 00:00:01 London on 1 Oct
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

  // Both dates are in BST, so London midnight is 23:00Z the previous day.
  describe.each([
    ["NEW", "2026-09-20"] as const,
    ["ROLLING_OVER", "2026-04-30"] as const,
  ])(
    "endOfDay boundary on the typed round default (%s)",
    (type, ymd) => {
      const lastMillisecond = new Date(`${ymd}T22:59:59.999Z`);
      const firstMillisecondAfter = new Date(`${ymd}T23:00:00.000Z`);
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
        const startOfDeadlineDay = new Date(
          new Date(`${ymd}T00:00:00.000Z`).getTime() - 60 * 60 * 1000
        );
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
    const now = new Date("2026-05-01T08:00:00Z"); // 09:00 London
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

// ─── Epic 21 R2 — the RA-window tier (rolling-over only) ─────────────────────

describe("effectiveSubmissionDeadline — the RA window tier (Epic 21 R2)", () => {
  /** Prod's 2026/27 shape on 14 Oct 2026: close 30 Nov, no typed defaults. */
  const prodShape = (windows: SubmissionDeadlineRound["windows"]): SubmissionDeadlineRound => ({
    closeDate: new Date("2026-11-30T00:00:00Z"),
    defaultSubmissionDeadlineNew: null,
    defaultSubmissionDeadlineRolling: null,
    windows,
  });
  const RA = { scenario: "RA", submitBy: new Date("2027-05-22T00:00:00Z") };
  const NA_CURRENT = { scenario: "NA_CURRENT", submitBy: new Date("2026-09-17T00:00:00Z") };

  it("a ROLLING_OVER application with no rolling default reads the RA window (end of day)", () => {
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "ROLLING_OVER" },
      prodShape([NA_CURRENT, RA])
    );
    expect(result.source).toBe("roundWindow");
    expect(result.isOverride).toBe(false);
    expect(result.deadline.toISOString()).toBe("2027-05-22T22:59:59.999Z");
  });

  it("a NEW application keeps closeDate on a round with an NA_CURRENT window (and an RA one)", () => {
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "NEW" },
      prodShape([NA_CURRENT, RA])
    );
    expect(result.source).toBe("closeDate");
    // 30 Nov (GMT), not 17 Sep.
    expect(result.deadline.toISOString()).toBe("2026-11-30T23:59:59.999Z");
  });

  it("the rolling round default beats the window", () => {
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: null, applicationType: "ROLLING_OVER" },
      { ...prodShape([RA]), defaultSubmissionDeadlineRolling: new Date("2027-04-30T00:00:00Z") }
    );
    expect(result.source).toBe("roundDefault");
    expect(result.deadline.toISOString()).toBe("2027-04-30T22:59:59.999Z");
  });

  it("the override beats the window", () => {
    const override = new Date("2027-06-05T16:00:00.000Z");
    const result = effectiveSubmissionDeadline(
      { submissionDeadlineAt: override, applicationType: "ROLLING_OVER" },
      prodShape([RA])
    );
    expect(result).toEqual({ deadline: override, isOverride: true, source: "override" });
  });

  it("an RA window without a date, or only NA windows, falls through to closeDate", () => {
    for (const windows of [[{ scenario: "RA", submitBy: null }], [NA_CURRENT]]) {
      expect(
        effectiveSubmissionDeadline(
          { submissionDeadlineAt: null, applicationType: "ROLLING_OVER" },
          prodShape(windows)
        ).source
      ).toBe("closeDate");
    }
  });

  it("roundSubmissionDeadline (the email's tiers) reads the window too, for ROLLING_OVER only", () => {
    expect(roundSubmissionDeadline(prodShape([RA]), "ROLLING_OVER").toISOString()).toBe(
      "2027-05-22T22:59:59.999Z"
    );
    expect(roundSubmissionDeadline(prodShape([RA]), "NEW").toISOString()).toBe(
      "2026-11-30T23:59:59.999Z"
    );
  });
});
