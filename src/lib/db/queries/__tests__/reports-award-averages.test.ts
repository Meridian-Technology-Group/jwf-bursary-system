import { afterEach, describe, it, expect, vi } from "vitest";
import {
  getFinalYearBursaries,
  getSchoolComparison,
  summariseHouseholdCombinations,
  type SiblingSummaryRow,
} from "../reports";
import type { Tx } from "@/lib/db/prisma";

/**
 * Charlotte, 24 Oct 2026: the school cards show the average award in £ and as
 * a % of annual fees before VAT, overall and per award fund; the sibling
 * summary becomes an anonymous table of award combinations per household; the
 * final-year sibling count uses the same families as the summary.
 */

// ─── getSchoolComparison ──────────────────────────────────────────────────────

interface FakeApp {
  school: "TRINITY" | "WHITGIFT" | "OP_PARTNER";
  fund?: "JWF" | "WSP_JWF" | "WFA" | "TBF" | null;
  award?: number | null;
  override?: number | null;
  assessed?: boolean;
}

function makeComparisonTx(apps: FakeApp[]) {
  const schoolFees = [
    { school: "TRINITY", annualFees: 25390, effectiveFrom: new Date("2026-09-01"), createdAt: new Date("2026-01-01") },
    { school: "TRINITY", annualFees: 24366.67, effectiveFrom: new Date("2025-09-01"), createdAt: new Date("2025-01-01") },
    { school: "WHITGIFT", annualFees: 26175, effectiveFrom: new Date("2026-09-01"), createdAt: new Date("2026-01-01") },
  ];
  return {
    round: { findUnique: vi.fn(async () => ({ academicYear: "2026/27" })) },
    application: {
      findMany: vi.fn(async () =>
        apps.map((a) => ({
          school: a.school,
          bursaryAccount: { annualFeesOverride: a.override ?? null },
          assessment:
            a.assessed === false
              ? null
              : {
                  bursaryAward: null,
                  monthlyPayableFees: null,
                  awardFundType: a.fund === undefined ? "JWF" : a.fund,
                  recommendation: { bursaryAward: a.award ?? null, monthlyPayableFees: 100 },
                },
        }))
      ),
    },
    schoolFees: {
      findMany: vi.fn(async ({ where }: { where: { school: string } }) =>
        schoolFees.filter((f) => f.school === where.school)
      ),
    },
  } as unknown as Tx;
}

describe("getSchoolComparison — award in £ and %", () => {
  it("divides by the school's fees for the round's year, overall and per fund", async () => {
    const tx = makeComparisonTx([
      { school: "TRINITY", fund: "JWF", award: 15000 },
      { school: "TRINITY", fund: "JWF", award: 20000 },
      { school: "TRINITY", fund: "TBF", award: 22000 },
      { school: "TRINITY", assessed: false },
    ]);

    const [trinity] = await getSchoolComparison(tx, "r1");

    expect(trinity.count).toBe(4);
    expect(trinity.assessed).toBe(3);
    expect(trinity.avgBursaryAward).toBe(19000);
    // 57,000 / (3 × 25,390) — the 2026/27 row, not 2025/26's.
    expect(trinity.avgBursaryAwardPct).toBe(74.8);
    expect(trinity.funds).toEqual([
      { fund: "JWF", assessed: 2, avgBursaryAward: 17500, avgBursaryAwardPct: 68.9 },
      { fund: "TBF", assessed: 1, avgBursaryAward: 22000, avgBursaryAwardPct: 86.6 },
    ]);
  });

  it("lists funds in the school's order, whatever order they arrive in", async () => {
    const tx = makeComparisonTx([
      { school: "WHITGIFT", fund: "WFA", award: 1 },
      { school: "WHITGIFT", fund: null, award: 1 },
      { school: "WHITGIFT", fund: "WSP_JWF", award: 1 },
      { school: "WHITGIFT", fund: "JWF", award: 1 },
    ]);

    const [whitgift] = await getSchoolComparison(tx, "r1");

    expect(whitgift.funds.map((f) => f.fund)).toEqual(["JWF", "WSP_JWF", "WFA", null]);
  });

  it("uses each account's own fees at the OP partnering school", async () => {
    const tx = makeComparisonTx([
      { school: "OP_PARTNER", award: 10000, override: 20000 },
      { school: "OP_PARTNER", award: 5000, override: 10000 },
    ]);

    const [op] = await getSchoolComparison(tx, "r1");

    expect(op.avgBursaryAward).toBe(7500);
    expect(op.avgBursaryAwardPct).toBe(50);
  });

  it("shows no % when no fees are known", async () => {
    const tx = makeComparisonTx([{ school: "OP_PARTNER", award: 10000 }]);

    const [op] = await getSchoolComparison(tx, "r1");

    expect(op.avgBursaryAward).toBe(10000);
    expect(op.avgBursaryAwardPct).toBeNull();
  });
});

// ─── summariseHouseholdCombinations ───────────────────────────────────────────

function family(
  children: { school: "TRINITY" | "WHITGIFT" | "OP_PARTNER"; award: number | null }[]
): SiblingSummaryRow {
  return {
    familyKey: Math.random().toString(),
    leadParentName: null,
    childrenCount: children.length,
    combinedYearlyPayableFees: 0,
    combinedBursaryAward: 0,
    children: children.map((c, i) => ({
      bursaryAccountId: `${i}`,
      childName: "",
      school: c.school,
      priorityOrder: i + 1,
      yearlyPayableFees: null,
      bursaryAward: c.award,
    })),
  };
}

describe("summariseHouseholdCombinations", () => {
  it("counts households and awards per combination, in her row order", () => {
    const { rows, total } = summariseHouseholdCombinations([
      family([{ school: "TRINITY", award: 10000 }, { school: "TRINITY", award: 5000 }]),
      family([{ school: "TRINITY", award: 1000 }, { school: "TRINITY", award: null }]),
      family([{ school: "WHITGIFT", award: 2000 }, { school: "OP_PARTNER", award: 3000 }]),
      family([
        { school: "TRINITY", award: 1 },
        { school: "TRINITY", award: 1 },
        { school: "TRINITY", award: 1 },
      ]),
    ]);

    expect(rows.map((r) => r.label)).toEqual([
      "2 awards with OP",
      "2 awards with TS",
      "2 awards with WS",
      "2 awards (OP + TS)",
      "2 awards (OP + WS)",
      "2 awards (TS + WS)",
      "3 awards with OP",
      "3 awards with TS",
      "3 awards with WS",
      "3 awards (TS + WS)",
    ]);
    const ts = rows.find((r) => r.label === "2 awards with TS")!;
    expect(ts).toMatchObject({ households: 2, awards: 4, totalBursarySupport: 16000 });
    expect(ts.feeSupportEquivalent).toBeCloseTo(19200);
    expect(rows.find((r) => r.label === "2 awards with OP")!.households).toBe(0);
    expect(total).toMatchObject({ households: 4, awards: 9, totalBursarySupport: 21003 });
  });

  it("adds VAT only where the school charges it", () => {
    const { rows } = summariseHouseholdCombinations([
      family([{ school: "OP_PARTNER", award: 3000 }, { school: "WHITGIFT", award: 2000 }]),
    ]);

    const row = rows.find((r) => r.label === "2 awards (OP + WS)")!;
    // OP fees carry no VAT (S9): 3,000 + 2,000 × 1.2.
    expect(row.feeSupportEquivalent).toBeCloseTo(5400);
  });

  it("appends a combination outside her ten rows", () => {
    const { rows } = summariseHouseholdCombinations([
      family([
        { school: "OP_PARTNER", award: 1 },
        { school: "TRINITY", award: 1 },
        { school: "WHITGIFT", award: 1 },
        { school: "WHITGIFT", award: 1 },
      ]),
    ]);

    expect(rows).toHaveLength(11);
    expect(rows[10]).toMatchObject({ label: "4 awards (OP + TS + WS)", households: 1 });
  });
});

// ─── getFinalYearBursaries — sibling count ────────────────────────────────────

describe("getFinalYearBursaries — sibling count", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts the other active accounts with the same lead parent", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
    const account = (id: string, lead: string, entryYearGroup: string) => ({
      id,
      childName: `Child ${id}`,
      school: "TRINITY",
      entryYear: 2026,
      entryYearGroup,
      leadApplicantId: lead,
      siblingLinks: [],
      recommendations: [],
    });
    const tx = {
      bursaryAccount: {
        findMany: vi.fn(async () => [
          account("a", "p1", "Y13"),
          account("b", "p1", "Y7"),
          account("c", "p1", "Y9"),
          account("d", "p2", "Y12"),
        ]),
      },
    } as unknown as Tx;

    const rows = await getFinalYearBursaries(tx);

    expect(rows.map((r) => [r.id, r.siblingCount])).toEqual([
      ["a", 2],
      ["d", 0],
    ]);
  });
});
