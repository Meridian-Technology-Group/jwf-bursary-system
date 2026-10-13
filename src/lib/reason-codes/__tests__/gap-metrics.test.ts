import { describe, it, expect } from "vitest";
import {
  scholarshipAdjustedGap,
  scholarshipSpendInclVat,
  mainGapReason,
  summariseGaps,
} from "../gap-metrics";
import { gapReasons } from "../../../../prisma/seed-data/gap-reasons";

describe("scholarshipAdjustedGap (Epic 21 #1)", () => {
  it("is the gap itself when there is no scholarship", () => {
    expect(scholarshipAdjustedGap(-5000, null, 20)).toBe(-5000);
    expect(scholarshipAdjustedGap(-5000, 0, 20)).toBe(-5000);
  });

  it("adds the scholarship back including VAT", () => {
    // £4,000 before VAT at 20% → £4,800 incl VAT
    expect(scholarshipSpendInclVat(4000, 20)).toBe(4800);
    expect(scholarshipAdjustedGap(-6000, 4000, 20)).toBe(-1200);
  });

  it("can turn a negative gap positive when the scholarship exceeds it", () => {
    expect(scholarshipAdjustedGap(-1000, 2500, 20)).toBe(2000);
  });

  it("treats a null VAT rate as 0%", () => {
    expect(scholarshipAdjustedGap(-6000, 4000, null)).toBe(-2000);
  });

  it("is null when there is no gap figure", () => {
    expect(scholarshipAdjustedGap(null, 4000, 20)).toBeNull();
  });

  it("rounds to pennies", () => {
    // 1234.565 × 1.2 = 1481.478 → 1481.48
    expect(scholarshipSpendInclVat(1234.565, 20)).toBe(1481.48);
    expect(scholarshipAdjustedGap(-100.005, 0, 20)).toBe(-100.01);
  });
});

describe("mainGapReason (Epic 21 #2)", () => {
  it("returns null with no linked codes", () => {
    expect(mainGapReason([])).toBeNull();
  });

  it("picks the lowest rank, regardless of display order", () => {
    // 110 Affordability (rank 4, display 13) beats 107 Bereavement (rank 6, display 8).
    const main = mainGapReason([
      { code: 107, rank: 6, sortOrder: 8 },
      { code: 110, rank: 4, sortOrder: 13 },
    ]);
    expect(main?.code).toBe(110);
  });

  it("puts unranked codes last", () => {
    const main = mainGapReason([
      { code: 3, rank: null, sortOrder: 3 },
      { code: 118, rank: 20, sortOrder: 20 },
    ]);
    expect(main?.code).toBe(118);
  });

  it("breaks ties on display order, then code", () => {
    expect(
      mainGapReason([
        { code: 115, rank: 5, sortOrder: 17 },
        { code: 114, rank: 5, sortOrder: 16 },
      ])?.code
    ).toBe(114);
    expect(
      mainGapReason([
        { code: 9, rank: null, sortOrder: 4 },
        { code: 4, rank: null, sortOrder: 4 },
      ])?.code
    ).toBe(4);
  });

  it("falls back to display order when every code is unranked (deprecated-only)", () => {
    const main = mainGapReason([
      { code: 9, rank: null, sortOrder: 9 },
      { code: 2, rank: null, sortOrder: 2 },
    ]);
    expect(main?.code).toBe(2);
  });

  it("does not mutate its input", () => {
    const linked = [
      { code: 107, rank: 6, sortOrder: 8 },
      { code: 101, rank: 1, sortOrder: 1 },
    ];
    mainGapReason(linked);
    expect(linked[0].code).toBe(107);
  });
});

describe("seeded gap ranking (her 11 Oct 2026 order)", () => {
  it("ranks every live code 1–20 exactly once and leaves deprecated codes unranked", () => {
    const live = gapReasons.filter((g) => !g.isDeprecated);
    const ranks = live.map((g) => ("rank" in g ? g.rank : null));
    expect([...ranks].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
    expect(gapReasons.filter((g) => g.isDeprecated).every((g) => !("rank" in g))).toBe(true);
  });

  it("reproduces her precedence order", () => {
    const byRank = gapReasons
      .filter((g) => !g.isDeprecated)
      .map((g) => ({ code: g.code, rank: "rank" in g ? g.rank : 0 }))
      .sort((a, b) => a.rank - b.rank)
      .map((g) => g.code);
    expect(byRank).toEqual([
      101, 102, 103, 110, 111, 107, 108, 104, 105, 106, 119, 109, 112, 120, 113, 114, 115, 116, 117, 118,
    ]);
  });
});

describe("summariseGaps (Reports → Gap)", () => {
  const r101 = { code: 101, label: "Scholarship on place offer", rank: 1, sortOrder: 1 };
  const r107 = { code: 107, label: "Bereavement", rank: 6, sortOrder: 8 };
  const r110 = { code: 110, label: "Affordability view", rank: 4, sortOrder: 13 };

  const summary = summariseGaps([
    // Scholarship account, two codes: counted once, under 101.
    { school: "WHITGIFT", gapAmount: -10000, scholarshipSpendBeforeVat: 5000, vatRate: 20, gapReasons: [r107, r101] },
    // No scholarship; 110 outranks 107.
    { school: "TRINITY", gapAmount: -2000, scholarshipSpendBeforeVat: null, vatRate: 20, gapReasons: [r107, r110] },
    // Positive gap (family pays more than recommended).
    { school: "TRINITY", gapAmount: 500, scholarshipSpendBeforeVat: 0, vatRate: 20, gapReasons: [r107] },
    // No gap, no code.
    { school: "WHITGIFT", gapAmount: 0, scholarshipSpendBeforeVat: null, vatRate: 20, gapReasons: [] },
    // Null gap counts as £0, still one account.
    { school: "WHITGIFT", gapAmount: null, scholarshipSpendBeforeVat: 1000, vatRate: 20, gapReasons: [] },
  ]);

  it("totals the gap, scholarship incl VAT and adjusted gap", () => {
    expect(summary.totals).toEqual({
      accounts: 5,
      gap: -11500,
      scholarshipInclVat: 7200,
      adjustedGap: -4300,
      accountsWithGap: 3,
      accountsWithScholarship: 2,
    });
  });

  it("splits the same totals by school", () => {
    expect(summary.bySchool.map((s) => [s.school, s.accounts, s.gap, s.adjustedGap])).toEqual([
      ["TRINITY", 2, -1500, -1500],
      ["WHITGIFT", 3, -10000, -2800],
    ]);
  });

  it("counts each account once under its main gap code, in rank order", () => {
    expect(summary.byMainReason).toEqual([
      { code: 101, label: "Scholarship on place offer", rank: 1, accounts: 1, gap: -10000, adjustedGap: -4000 },
      { code: 110, label: "Affordability view", rank: 4, accounts: 1, gap: -2000, adjustedGap: -2000 },
      { code: 107, label: "Bereavement", rank: 6, accounts: 1, gap: 500, adjustedGap: 500 },
    ]);
  });

  it("puts accounts without a gap code in their own row", () => {
    expect(summary.noCode).toEqual({ accounts: 2, gap: 0, adjustedGap: 1200 });
  });

  it("reconciles: the reason rows plus the no-code row equal the totals", () => {
    const rows = [...summary.byMainReason, summary.noCode];
    expect(rows.reduce((n, r) => n + r.accounts, 0)).toBe(summary.totals.accounts);
    expect(rows.reduce((n, r) => n + r.gap, 0)).toBe(summary.totals.gap);
    expect(rows.reduce((n, r) => n + r.adjustedGap, 0)).toBe(summary.totals.adjustedGap);
  });

  it("is all zeros for an empty round", () => {
    const empty = summariseGaps([]);
    expect(empty.totals.accounts).toBe(0);
    expect(empty.byMainReason).toEqual([]);
    expect(empty.noCode).toEqual({ accounts: 0, gap: 0, adjustedGap: 0 });
  });
});
