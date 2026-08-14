import { describe, it, expect } from "vitest";
import {
  submittedDateRangeWhere,
  effectiveDeadlineRangeWhere,
} from "@/lib/db/queries/applications";
import {
  effectiveSubmissionDeadline,
  roundDefaultForType,
  type SubmissionDeadlineApplicationType,
  type SubmissionDeadlineRound,
} from "@/lib/rounds/submission-deadline";
import { londonStartOfDayUtc, londonEndOfDayUtc } from "@/lib/datetime";
import type { Prisma } from "@prisma/client";

// ─── Shared row shape + fragment simulators (used by both the 7.2 agreement
// checks and the 7.1+7.2 composition check below) ───────────────────────────

interface DeadlineRow {
  submittedAt: Date | null;
  submissionDeadlineAt: Date | null;
  /** Selects which typed round default governs the row (E1/D13-8). */
  applicationType: SubmissionDeadlineApplicationType;
  round: SubmissionDeadlineRound;
}

/** Terse round fixture: `mkRound(close, { new: …, rolling: … })`. */
function mkRound(
  closeDate: string,
  defaults: { forNew?: string; forRolling?: string } = {}
): SubmissionDeadlineRound {
  return {
    closeDate: new Date(`${closeDate}T00:00:00.000Z`),
    defaultSubmissionDeadlineNew: defaults.forNew
      ? new Date(`${defaults.forNew}T00:00:00.000Z`)
      : null,
    defaultSubmissionDeadlineRolling: defaults.forRolling
      ? new Date(`${defaults.forRolling}T00:00:00.000Z`)
      : null,
  };
}

/** The round column `effectiveDeadlineRangeWhere` consults for a given type. */
function defaultColumnFor(type: SubmissionDeadlineApplicationType) {
  return type === "ROLLING_OVER"
    ? ("defaultSubmissionDeadlineRolling" as const)
    : ("defaultSubmissionDeadlineNew" as const);
}

/** Simulates matching `submittedDateRangeWhere`'s known `{ submittedAt: {...} }` shape. */
function matchesSubmittedFragment(
  submittedAt: Date | null,
  fragment: Prisma.ApplicationWhereInput | undefined
): boolean {
  if (!fragment) return true;
  const cmp = (fragment as { submittedAt: { gte?: Date; lte?: Date } }).submittedAt;
  if (submittedAt === null) return false;
  if (cmp.gte && submittedAt.getTime() < cmp.gte.getTime()) return false;
  if (cmp.lte && submittedAt.getTime() > cmp.lte.getTime()) return false;
  return true;
}

type Bound = { gte?: Date; lte?: Date };
/** One `applicationType`-keyed arm inside the round-default / close branches. */
type TypeArm = {
  applicationType: SubmissionDeadlineApplicationType;
  round: Record<string, Bound | null>;
};

/**
 * Simulates matching `effectiveDeadlineRangeWhere`'s known shape: a 3-branch
 * OR (override / round default / close date), where the latter two each fan
 * out into a per-application-type arm (E1/D13-8).
 */
function matchesDeadlineFragment(
  row: DeadlineRow,
  fragment: Prisma.ApplicationWhereInput | undefined
): boolean {
  if (!fragment) return true;
  const [overrideBranch, defaultBranch, closeBranch] = (
    fragment as {
      OR: [
        { submissionDeadlineAt: Bound },
        { OR: TypeArm[] },
        { OR: TypeArm[] },
      ];
    }
  ).OR;

  const inBounds = (value: number, cmp: Bound) =>
    (!cmp.gte || value >= cmp.gte.getTime()) &&
    (!cmp.lte || value <= cmp.lte.getTime());

  /** The arm of a fanned-out branch that applies to this row's type. */
  const armFor = (branch: { OR: TypeArm[] }) =>
    branch.OR.find((arm) => arm.applicationType === row.applicationType)!;

  const column = defaultColumnFor(row.applicationType);
  const roundDefault = roundDefaultForType(row.round, row.applicationType);

  const overrideMatches =
    row.submissionDeadlineAt !== null &&
    inBounds(row.submissionDeadlineAt.getTime(), overrideBranch.submissionDeadlineAt);

  const defaultArm = armFor(defaultBranch);
  const defaultMatches =
    row.submissionDeadlineAt === null &&
    roundDefault !== null &&
    inBounds(roundDefault.getTime(), defaultArm.round[column] as Bound);

  const closeArm = armFor(closeBranch);
  const closeMatches =
    row.submissionDeadlineAt === null &&
    roundDefault === null &&
    closeArm.round[column] === null &&
    inBounds(row.round.closeDate.getTime(), closeArm.round.closeDate as Bound);

  return overrideMatches || defaultMatches || closeMatches;
}

/**
 * Independent reference answer for "is this row's effective deadline within
 * [from, to]" — computed via effectiveSubmissionDeadline() (the display
 * helper), NOT via effectiveDeadlineRangeWhere. Used to prove the where-
 * fragment agrees with the helper rather than just with itself.
 */
function referenceEffectiveInRange(
  row: DeadlineRow,
  from: string | undefined,
  to: string | undefined
): boolean {
  const { deadline, source } = effectiveSubmissionDeadline(
    {
      submissionDeadlineAt: row.submissionDeadlineAt,
      applicationType: row.applicationType,
    },
    row.round
  );
  if (source === "override") {
    const instantFrom = from ? londonStartOfDayUtc(from) : undefined;
    const instantTo = to ? londonEndOfDayUtc(to) : undefined;
    if (instantFrom && deadline.getTime() < instantFrom.getTime()) return false;
    if (instantTo && deadline.getTime() > instantTo.getTime()) return false;
    return true;
  }
  // Date-only tier: compare the SOURCE calendar date (not the endOfDay()
  // shifted instant) against from/to as plain YYYY-MM-DD strings.
  const sourceDate =
    source === "roundDefault"
      ? roundDefaultForType(row.round, row.applicationType)!
      : row.round.closeDate;
  const sourceDateStr = sourceDate.toISOString().slice(0, 10);
  if (from && sourceDateStr < from) return false;
  if (to && sourceDateStr > to) return false;
  return true;
}

describe("submittedDateRangeWhere (Item 7.1)", () => {
  it("returns undefined when neither bound is set (no filter)", () => {
    expect(submittedDateRangeWhere(undefined, undefined)).toBeUndefined();
  });

  it("from-only: inclusive lower bound, no upper bound", () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    expect(submittedDateRangeWhere(from, undefined)).toEqual({
      submittedAt: { gte: from },
    });
  });

  it("to-only: inclusive upper bound, no lower bound", () => {
    const to = new Date("2026-06-30T23:59:59.999Z");
    expect(submittedDateRangeWhere(undefined, to)).toEqual({
      submittedAt: { lte: to },
    });
  });

  it("both bounds: inclusive range", () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    const to = new Date("2026-06-30T23:59:59.999Z");
    expect(submittedDateRangeWhere(from, to)).toEqual({
      submittedAt: { gte: from, lte: to },
    });
  });

  // Prisma/SQL null-comparison semantics: a `gte`/`lte` filter on `submittedAt`
  // never matches a NULL value (unsubmitted application), so an unsubmitted
  // row is excluded automatically whenever either bound above is active — no
  // explicit `submittedAt: { not: null }` is needed in the fragment.
  it("the returned fragment relies on gte/lte alone for null exclusion (no explicit not-null clause)", () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    const fragment = submittedDateRangeWhere(from, undefined);
    expect(fragment).toEqual({ submittedAt: { gte: from } });
    expect(Object.keys(fragment!.submittedAt as object)).not.toContain("not");
  });
});

describe("effectiveDeadlineRangeWhere (Item 7.2)", () => {
  it("returns undefined when neither bound is set (no filter)", () => {
    expect(effectiveDeadlineRangeWhere(undefined, undefined)).toBeUndefined();
  });

  it("returns a 3-branch OR (override / round default / close date) when a bound is set", () => {
    const fragment = effectiveDeadlineRangeWhere("2026-07-01", "2026-07-31");
    expect(fragment).toHaveProperty("OR");
    expect((fragment as { OR: unknown[] }).OR).toHaveLength(3);
  });

  it("the round-default branch only applies when there is no override, and fans out per application type", () => {
    const fragment = effectiveDeadlineRangeWhere("2026-07-01", "2026-07-31") as {
      OR: [Prisma.ApplicationWhereInput, Prisma.ApplicationWhereInput, Prisma.ApplicationWhereInput];
    };
    const [, roundDefaultBranch, closeDateBranch] = fragment.OR;
    expect(roundDefaultBranch).toMatchObject({ submissionDeadlineAt: null });
    // E1/D13-8: NEW reads default_submission_deadline_new, ROLLING_OVER reads
    // default_submission_deadline_rolling — the legacy single column is gone
    // from every branch.
    expect(roundDefaultBranch).toMatchObject({
      OR: [
        { applicationType: "NEW", round: expect.objectContaining({ defaultSubmissionDeadlineNew: expect.anything() }) },
        { applicationType: "ROLLING_OVER", round: expect.objectContaining({ defaultSubmissionDeadlineRolling: expect.anything() }) },
      ],
    });
    // The close-date branch additionally requires no round default ON THAT
    // TYPE'S CLOCK, so a round WITH a default never falls through to closeDate.
    expect(closeDateBranch).toMatchObject({
      submissionDeadlineAt: null,
      OR: [
        {
          applicationType: "NEW",
          round: expect.objectContaining({ defaultSubmissionDeadlineNew: null }),
        },
        {
          applicationType: "ROLLING_OVER",
          round: expect.objectContaining({
            defaultSubmissionDeadlineRolling: null,
          }),
        },
      ],
    });
    expect(JSON.stringify(fragment)).not.toContain('"defaultSubmissionDeadline"');
  });

  // ── Cross-check against effectiveSubmissionDeadline() ──────────────────────
  //
  // The where-fragment and the display helper must never disagree on which
  // tier governs a row or whether it falls in range. Rather than trust the
  // fragment's own logic, this independently: (a) interprets the KNOWN
  // 3-branch shape the function returns (a small "simulated Prisma engine",
  // matchesDeadlineFragment above), and (b) computes a reference answer via
  // effectiveSubmissionDeadline() plus a hand-rolled range check that does NOT
  // reuse effectiveDeadlineRangeWhere (referenceEffectiveInRange above).
  // Agreement between the two is the actual assertion.

  const rows: Record<string, DeadlineRow> = {
    overrideOnlyBst: {
      submittedAt: null,
      submissionDeadlineAt: new Date("2026-07-09T17:00:00.000Z"),
      applicationType: "NEW",
      round: mkRound("2026-07-31"),
    },
    overrideOnlyGmt: {
      submittedAt: null,
      submissionDeadlineAt: new Date("2026-01-15T10:00:00.000Z"),
      applicationType: "NEW",
      round: mkRound("2026-01-31"),
    },
    roundDefaultBst: {
      submittedAt: null,
      submissionDeadlineAt: null,
      applicationType: "NEW",
      round: mkRound("2026-07-31", { forNew: "2026-07-20" }),
    },
    closeDateFallbackGmt: {
      submittedAt: null,
      submissionDeadlineAt: null,
      applicationType: "NEW",
      round: mkRound("2026-01-31"),
    },
    closeDateFallbackBst: {
      submittedAt: null,
      submissionDeadlineAt: null,
      applicationType: "NEW",
      round: mkRound("2026-07-31"),
    },
    // Round default OUT of a query range that would otherwise include closeDate
    // — must stay excluded; the default governs, closeDate is never consulted.
    defaultGovernsOverCloseDate: {
      submittedAt: null,
      submissionDeadlineAt: null,
      applicationType: "NEW",
      round: mkRound("2026-07-15", { forNew: "2026-07-05" }),
    },
    // Override present alongside a round default AND close date that would
    // both put it in-range — the override alone governs.
    overrideGovernsOverDefaultAndClose: {
      submittedAt: null,
      submissionDeadlineAt: new Date("2026-08-01T00:00:00.000Z"),
      applicationType: "NEW",
      round: mkRound("2026-07-20", { forNew: "2026-07-20" }),
    },
    // ── E1/D13-8: the same round, filtered on the other clock ───────────────
    // Both defaults set and different: each type must be matched against its
    // OWN column, never the other's.
    rollingReadsItsOwnDefault: {
      submittedAt: null,
      submissionDeadlineAt: null,
      applicationType: "ROLLING_OVER",
      round: mkRound("2026-07-31", {
        forNew: "2026-07-20",
        forRolling: "2026-04-30",
      }),
    },
    newReadsItsOwnDefaultOnTheSameRound: {
      submittedAt: null,
      submissionDeadlineAt: null,
      applicationType: "NEW",
      round: mkRound("2026-07-31", {
        forNew: "2026-07-20",
        forRolling: "2026-04-30",
      }),
    },
    // Only the NEW default is set: a rolling-over row on this round has no
    // default on ITS clock and must fall through to closeDate.
    rollingFallsThroughWhenOnlyNewDefaultSet: {
      submittedAt: null,
      submissionDeadlineAt: null,
      applicationType: "ROLLING_OVER",
      round: mkRound("2026-07-31", { forNew: "2026-07-20" }),
    },
    // …and the mirror image.
    newFallsThroughWhenOnlyRollingDefaultSet: {
      submittedAt: null,
      submissionDeadlineAt: null,
      applicationType: "NEW",
      round: mkRound("2026-07-31", { forRolling: "2026-04-30" }),
    },
    // An override still wins on a rolling-over row.
    rollingOverrideGoverns: {
      submittedAt: null,
      submissionDeadlineAt: new Date("2026-07-09T17:00:00.000Z"),
      applicationType: "ROLLING_OVER",
      round: mkRound("2026-07-31", {
        forNew: "2026-07-20",
        forRolling: "2026-04-30",
      }),
    },
  };

  const ranges: Array<{ from?: string; to?: string }> = [
    { from: "2026-07-01", to: "2026-07-31" },
    { from: "2026-01-01", to: "2026-01-31" },
    { to: "2026-07-15" },
    { from: "2026-07-15" },
    { from: "2026-07-20", to: "2026-07-20" },
    { from: "2026-07-21", to: "2026-07-25" },
    // Straddles the April rolling deadline, so the two types diverge.
    { from: "2026-04-01", to: "2026-04-30" },
  ];

  for (const [rowName, row] of Object.entries(rows)) {
    for (const range of ranges) {
      const label = `${rowName} vs [${range.from ?? "-∞"}, ${range.to ?? "+∞"}]`;
      it(`agrees with effectiveSubmissionDeadline(): ${label}`, () => {
        const fragment = effectiveDeadlineRangeWhere(range.from, range.to);
        expect(matchesDeadlineFragment(row, fragment)).toBe(
          referenceEffectiveInRange(row, range.from, range.to)
        );
      });
    }
  }
});

describe("received + submission-by filters compose (Item 7.1 + 7.2, AND)", () => {
  const receivedFragment = submittedDateRangeWhere(
    londonStartOfDayUtc("2026-06-01"),
    londonEndOfDayUtc("2026-06-30")
  );
  const deadlineFragment = effectiveDeadlineRangeWhere("2026-07-25", "2026-07-31");

  it("matches a row that satisfies BOTH the received-date and deadline ranges", () => {
    const row: DeadlineRow = {
      submittedAt: new Date("2026-06-15T09:00:00.000Z"), // in June
      submissionDeadlineAt: null,
      applicationType: "NEW",
      round: mkRound("2026-07-31"), // close date in the deadline range
    };
    expect(matchesSubmittedFragment(row.submittedAt, receivedFragment)).toBe(true);
    expect(matchesDeadlineFragment(row, deadlineFragment)).toBe(true);
  });

  it("excludes a row that satisfies the received-date range but NOT the deadline range", () => {
    const row: DeadlineRow = {
      submittedAt: new Date("2026-06-15T09:00:00.000Z"), // in June — matches alone
      submissionDeadlineAt: null,
      applicationType: "NEW",
      round: mkRound("2026-08-31"), // close date NOT in the deadline range
    };
    const matchesReceived = matchesSubmittedFragment(row.submittedAt, receivedFragment);
    const matchesDeadline = matchesDeadlineFragment(row, deadlineFragment);
    expect(matchesReceived).toBe(true);
    expect(matchesDeadline).toBe(false);
    // AND composition (how `and.push()` combines fragments in listApplications)
    // must exclude this row even though one side alone matches.
    expect(matchesReceived && matchesDeadline).toBe(false);
  });

  it("excludes a row that satisfies the deadline range but NOT the received-date range", () => {
    const row: DeadlineRow = {
      submittedAt: new Date("2026-05-01T09:00:00.000Z"), // NOT in June
      submissionDeadlineAt: null,
      applicationType: "NEW",
      round: mkRound("2026-07-31"), // matches the deadline range alone
    };
    const matchesReceived = matchesSubmittedFragment(row.submittedAt, receivedFragment);
    const matchesDeadline = matchesDeadlineFragment(row, deadlineFragment);
    expect(matchesReceived).toBe(false);
    expect(matchesDeadline).toBe(true);
    expect(matchesReceived && matchesDeadline).toBe(false);
  });
});
