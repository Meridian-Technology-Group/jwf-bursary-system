import { describe, it, expect } from "vitest";
import {
  submittedDateRangeWhere,
  effectiveDeadlineRangeWhere,
} from "@/lib/db/queries/applications";
import { effectiveSubmissionDeadline } from "@/lib/rounds/submission-deadline";
import { londonStartOfDayUtc, londonEndOfDayUtc } from "@/lib/datetime";
import type { Prisma } from "@prisma/client";

// ─── Shared row shape + fragment simulators (used by both the 7.2 agreement
// checks and the 7.1+7.2 composition check below) ───────────────────────────

interface DeadlineRow {
  submittedAt: Date | null;
  submissionDeadlineAt: Date | null;
  round: { defaultSubmissionDeadline: Date | null; closeDate: Date };
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

/** Simulates matching `effectiveDeadlineRangeWhere`'s known 3-branch OR shape. */
function matchesDeadlineFragment(
  row: DeadlineRow,
  fragment: Prisma.ApplicationWhereInput | undefined
): boolean {
  if (!fragment) return true;
  const [overrideBranch, defaultBranch, closeBranch] = (
    fragment as {
      OR: [
        { submissionDeadlineAt: { gte?: Date; lte?: Date } },
        { round: { defaultSubmissionDeadline: { gte?: Date; lte?: Date } } },
        { round: { closeDate: { gte?: Date; lte?: Date } } },
      ];
    }
  ).OR;

  const inBounds = (value: number, cmp: { gte?: Date; lte?: Date }) =>
    (!cmp.gte || value >= cmp.gte.getTime()) &&
    (!cmp.lte || value <= cmp.lte.getTime());

  const overrideMatches =
    row.submissionDeadlineAt !== null &&
    inBounds(row.submissionDeadlineAt.getTime(), overrideBranch.submissionDeadlineAt);

  const defaultMatches =
    row.submissionDeadlineAt === null &&
    row.round.defaultSubmissionDeadline !== null &&
    inBounds(
      row.round.defaultSubmissionDeadline.getTime(),
      defaultBranch.round.defaultSubmissionDeadline
    );

  const closeMatches =
    row.submissionDeadlineAt === null &&
    row.round.defaultSubmissionDeadline === null &&
    inBounds(row.round.closeDate.getTime(), closeBranch.round.closeDate);

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
    { submissionDeadlineAt: row.submissionDeadlineAt },
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
    source === "roundDefault" ? row.round.defaultSubmissionDeadline! : row.round.closeDate;
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

  it("the round-default branch only applies when there is no override (submissionDeadlineAt: null)", () => {
    const fragment = effectiveDeadlineRangeWhere("2026-07-01", "2026-07-31") as {
      OR: [Prisma.ApplicationWhereInput, Prisma.ApplicationWhereInput, Prisma.ApplicationWhereInput];
    };
    const [, roundDefaultBranch, closeDateBranch] = fragment.OR;
    expect(roundDefaultBranch).toMatchObject({ submissionDeadlineAt: null });
    // The close-date branch additionally requires no round default, so a
    // round WITH a default never falls through to closeDate.
    expect(closeDateBranch).toMatchObject({
      submissionDeadlineAt: null,
      round: expect.objectContaining({ defaultSubmissionDeadline: null }),
    });
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
      round: { defaultSubmissionDeadline: null, closeDate: new Date("2026-07-31T00:00:00.000Z") },
    },
    overrideOnlyGmt: {
      submittedAt: null,
      submissionDeadlineAt: new Date("2026-01-15T10:00:00.000Z"),
      round: { defaultSubmissionDeadline: null, closeDate: new Date("2026-01-31T00:00:00.000Z") },
    },
    roundDefaultBst: {
      submittedAt: null,
      submissionDeadlineAt: null,
      round: {
        defaultSubmissionDeadline: new Date("2026-07-20T00:00:00.000Z"),
        closeDate: new Date("2026-07-31T00:00:00.000Z"),
      },
    },
    closeDateFallbackGmt: {
      submittedAt: null,
      submissionDeadlineAt: null,
      round: { defaultSubmissionDeadline: null, closeDate: new Date("2026-01-31T00:00:00.000Z") },
    },
    closeDateFallbackBst: {
      submittedAt: null,
      submissionDeadlineAt: null,
      round: { defaultSubmissionDeadline: null, closeDate: new Date("2026-07-31T00:00:00.000Z") },
    },
    // Round default OUT of a query range that would otherwise include closeDate
    // — must stay excluded; the default governs, closeDate is never consulted.
    defaultGovernsOverCloseDate: {
      submittedAt: null,
      submissionDeadlineAt: null,
      round: {
        defaultSubmissionDeadline: new Date("2026-07-05T00:00:00.000Z"),
        closeDate: new Date("2026-07-15T00:00:00.000Z"),
      },
    },
    // Override present alongside a round default AND close date that would
    // both put it in-range — the override alone governs.
    overrideGovernsOverDefaultAndClose: {
      submittedAt: null,
      submissionDeadlineAt: new Date("2026-08-01T00:00:00.000Z"),
      round: {
        defaultSubmissionDeadline: new Date("2026-07-20T00:00:00.000Z"),
        closeDate: new Date("2026-07-20T00:00:00.000Z"),
      },
    },
  };

  const ranges: Array<{ from?: string; to?: string }> = [
    { from: "2026-07-01", to: "2026-07-31" },
    { from: "2026-01-01", to: "2026-01-31" },
    { to: "2026-07-15" },
    { from: "2026-07-15" },
    { from: "2026-07-20", to: "2026-07-20" },
    { from: "2026-07-21", to: "2026-07-25" },
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
      round: {
        defaultSubmissionDeadline: null,
        closeDate: new Date("2026-07-31T00:00:00.000Z"), // in the deadline range
      },
    };
    expect(matchesSubmittedFragment(row.submittedAt, receivedFragment)).toBe(true);
    expect(matchesDeadlineFragment(row, deadlineFragment)).toBe(true);
  });

  it("excludes a row that satisfies the received-date range but NOT the deadline range", () => {
    const row: DeadlineRow = {
      submittedAt: new Date("2026-06-15T09:00:00.000Z"), // in June — matches alone
      submissionDeadlineAt: null,
      round: {
        defaultSubmissionDeadline: null,
        closeDate: new Date("2026-08-31T00:00:00.000Z"), // NOT in the deadline range
      },
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
      round: {
        defaultSubmissionDeadline: null,
        closeDate: new Date("2026-07-31T00:00:00.000Z"), // matches the deadline range alone
      },
    };
    const matchesReceived = matchesSubmittedFragment(row.submittedAt, receivedFragment);
    const matchesDeadline = matchesDeadlineFragment(row, deadlineFragment);
    expect(matchesReceived).toBe(false);
    expect(matchesDeadline).toBe(true);
    expect(matchesReceived && matchesDeadline).toBe(false);
  });
});
