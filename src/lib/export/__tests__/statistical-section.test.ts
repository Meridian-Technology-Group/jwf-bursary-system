/**
 * Epic 23 T4 — Export Section 3 (statistical & external sharing): her
 * columns, no identifying fields, filters → where, and the row mapping for
 * v2 / v1 / migrated / in-system assessments.
 */
import { describe, expect, it } from "vitest";
import { IDENTIFYING_KEY_PATTERN, STATISTICAL_COLUMNS } from "../sections/statistical-columns";
import { mapStatisticalRow, type StatisticalSource } from "../sections/statistical";
import { AssessmentFiltersSchema, assessmentWhere, parseWith } from "../sections/filters";
import { findSection } from "../sections/descriptors";

/** Her EXPORTS.xlsx Section 3 (rows 88–119), in order; siblings flattened to three (D-15). */
const HER_HEADERS = [
  "Application Type",
  "Round",
  "Assessment Completion Date",
  "Academic Year",
  "School",
  "School Year",
  "Bursary award year of entry",
  "Bursary recipient's Scholarship",
  "Family category",
  "Remaining years at the school",
  "Number of schooling age children",
  "Number of parents",
  "Postcode area",
  "HOUSEHOLD'S INCOME CATEGORY IS:",
  "HOUSEHOLD'S PROPERTY CATEGORY IS:",
  "HOUSEHOLD'S PROPERTY EQUITY CATEGORY IS:",
  "HOUSEHOLD'S FINANCIAL EQUITY CATEGORY IS:",
  "DEBT OVER NET DISPOSABLE INCOME RATIO",
  "DEBT STATUS",
  "LIFESTYLE SQUEEZE AFFORDABILITY RATIO",
  "LIFESTYLE SQUEEZE AFFORDABILITY STATUS",
  "SIBLINGS' FEES ALREADY AT A JWF SCHOOL - SCHOOL (1)",
  "SIBLINGS' FEES ALREADY AT A JWF SCHOOL - PAYABLE FEES (1)",
  "SIBLINGS' FEES ALREADY AT A JWF SCHOOL - SCHOOL (2)",
  "SIBLINGS' FEES ALREADY AT A JWF SCHOOL - PAYABLE FEES (2)",
  "SIBLINGS' FEES ALREADY AT A JWF SCHOOL - SCHOOL (3)",
  "SIBLINGS' FEES ALREADY AT A JWF SCHOOL - PAYABLE FEES (3)",
  "Fees for next year (or applicable year) — before VAT",
  "Scholarship Award (%)",
  "Scholarship Spend — before VAT",
  "Bursary Award / Spend (£) — before VAT",
  "Net fees (or applicable year) — before VAT",
  "Yearly Payable fees — including VAT",
  "Monthly Payable fees — including VAT",
  "Reason codes (year-on-year)",
  "Bursary Award Type",
];

describe("Section 3 registry", () => {
  it("is her column list, in her order", () => {
    expect(STATISTICAL_COLUMNS.map((c) => c.header)).toEqual(HER_HEADERS);
  });
  it("keys are unique", () => {
    const keys = STATISTICAL_COLUMNS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("carries no identifying field (it is shared externally)", () => {
    expect(STATISTICAL_COLUMNS.filter((c) => IDENTIFYING_KEY_PATTERN.test(c.key)).map((c) => c.key)).toEqual([]);
    expect(STATISTICAL_COLUMNS.some((c) => /name|e-?mail|mobile|reference/i.test(c.header))).toBe(false);
  });
  it("is registered as section 3", () => {
    expect(findSection("statistical")?.number).toBe(3);
  });
});

function source(over: Record<string, unknown> = {}, app: Record<string, unknown> = {}): StatisticalSource {
  return {
    id: "as-1",
    calculationVersion: 2,
    completedAt: new Date("2026-05-24T10:00:00Z"),
    assessmentSchool: "TRINITY",
    entrySchoolYear: 7,
    scholarshipPct: "10.00",
    familyTypeCategory: 3,
    schoolingYearsRemaining: 5,
    postcode: "CR0 1AB",
    incomeCategory: 4,
    propertyCategoryDerived: 2,
    propertyEquityCategory: 1,
    financialEquityLabel: "LOW",
    debtOverNdiRatio: "0.3500",
    debtStatusLabel: "MANAGEABLE",
    lifestyleSqueezeRatio: "1.2000",
    lifestyleSqueezeLabel: "SQUEEZED",
    siblingDetails: [{ name: "Sib", school: "WHITGIFT", netPayableFees: 4000 }],
    annualFees: "21000.00",
    nextYearAnnualFees: "22000.00",
    bursaryAward: "15000.00",
    yearlyPayableFees: "4800.00",
    monthlyPayableFees: "400.00",
    awardFundType: "TBF",
    property: { schoolAgeChildrenCount: 2 },
    earners: [{ earnerLabel: "PARENT_1" }, { earnerLabel: "PARENT_2" }],
    application: {
      applicationType: "ROLLING_OVER",
      school: "WHITGIFT",
      entryYearGroup: "Y8",
      migrationSource: null,
      round: { academicYear: "2026/27" },
      ...app,
    },
    recommendation: {
      scholarshipSpendBeforeVat: "2200.00",
      bursarySpendBeforeVat: "15800.00",
      netFeesBeforeVat: "4000.00",
      yearlyPayableFees: "4800.00",
      monthlyPayableFees: "400.00",
      reasonCodes: [{ reasonCode: { code: 3, label: "Three" } }, { reasonCode: { code: 12, label: "Twelve" } }],
    },
    ...over,
  } as unknown as StatisticalSource;
}

describe("mapStatisticalRow", () => {
  it("postcode with its area name (17 Oct 2026)", () => {
    expect(mapStatisticalRow(source(), [{ district: "CR0", area: "CROYDON" }]).postcode).toBe("CR0-CROYDON");
  });
  it("an in-system v2 assessment: every column filled, money as numbers", () => {
    const r = mapStatisticalRow(source());
    expect(r).toMatchObject({
      applicationType: "Rolling-Over Application",
      round: "2026/27",
      academicYear: "2026/27",
      school: "Trinity", // D-6: the assessment's school wins
      schoolYear: 8,
      entrySchoolYear: 7,
      recipientScholarship: 10,
      familyCategory: 3,
      remainingYears: 5,
      schoolAgeChildren: 2,
      parents: 2,
      postcode: "CR0",
      incomeCategory: 4,
      propertyCategory: 2,
      propertyEquityCategory: 1,
      financialEquity: "LOW",
      debtOverNdi: 0.35,
      debtStatus: "MANAGEABLE",
      squeezeRatio: 1.2,
      squeezeStatus: "SQUEEZED",
      sibling1School: "Whitgift",
      sibling1Fees: 4000,
      sibling2School: "",
      sibling3Fees: null,
      nextYearFees: 22000,
      scholarshipPct: 10,
      scholarshipSpend: 2200,
      bursarySpend: 15800,
      netFees: 4000,
      yearlyPayable: 4800,
      monthlyPayable: 400,
      reasonCodes: "3 – Three, 12 – Twelve",
      awardType: "TBF bursary",
    });
    expect(r.completedAt).toBeInstanceOf(Date);
    for (const k of Object.keys(r)) expect(IDENTIFYING_KEY_PATTERN.test(k)).toBe(false);
  });

  it("D-9: a migrated application leaves both household counts blank", () => {
    const r = mapStatisticalRow(source({}, { migrationSource: "GRANT_TRACKER" }));
    expect(r.schoolAgeChildren).toBe(null);
    expect(r.parents).toBe(null);
    expect(r.incomeCategory).toBe(4); // everything else unaffected
  });

  it("D-10: a v1 assessment leaves v2-only columns blank, never zero", () => {
    const r = mapStatisticalRow(source({ calculationVersion: 1, bursaryAward: "40.00" }));
    for (const k of ["incomeCategory", "propertyCategory", "debtOverNdi", "debtStatus", "squeezeRatio", "scholarshipSpend", "bursarySpend", "netFees"]) {
      expect(r[k]).toBe(null);
    }
    expect(r.yearlyPayable).toBe(4800);
  });

  it("falls back to the application's school, and current fees when no next-year figure", () => {
    const r = mapStatisticalRow(source({ assessmentSchool: null, nextYearAnnualFees: null }));
    expect(r.school).toBe("Whitgift");
    expect(r.nextYearFees).toBe(21000);
  });

  it("no recommendation yet: award figures blank, payable from the assessment", () => {
    const r = mapStatisticalRow(source({ recommendation: null, bursaryAward: null }));
    expect(r.scholarshipSpend).toBe(null);
    expect(r.bursarySpend).toBe(null);
    expect(r.yearlyPayable).toBe(4800);
    expect(r.reasonCodes).toBe("");
  });
});

describe("assessment filters", () => {
  const parse = (q: string) => parseWith(AssessmentFiltersSchema, new URLSearchParams(q));
  it("no filters = everything", () => {
    const p = parse("");
    expect(p.ok && assessmentWhere(p.filters)).toEqual({});
    const all = parse("school=__all__&account=");
    expect(all.ok && assessmentWhere(all.filters)).toEqual({});
  });
  it("rejects bad values and a reversed date range", () => {
    expect(parse("school=ETON").ok).toBe(false);
    expect(parse("completedFrom=24/05/2026").ok).toBe(false);
    expect(parse("completedFrom=2026-06-01&completedTo=2026-05-01").ok).toBe(false);
  });
  it("builds the where: account, school fallback (D-6), academic year (D-7), date range", () => {
    const p = parse("account=NONE&school=TRINITY&academicYear=2026/27&completedFrom=2026-05-01&completedTo=2026-05-31&assessmentStatus=ROLLED_OVER");
    expect(p.ok).toBe(true);
    const w = p.ok ? assessmentWhere(p.filters) : {};
    expect(w).toEqual({
      AND: [
        { application: { round: { academicYear: "2026/27" }, bursaryAccountId: null } },
        { status: "ROLLED_OVER" },
        { completedAt: { gte: new Date("2026-05-01T00:00:00.000Z"), lte: new Date("2026-05-31T23:59:59.999Z") } },
        { OR: [{ assessmentSchool: "TRINITY" }, { assessmentSchool: null, application: { school: "TRINITY" } }] },
      ],
    });
    const active = parse("account=ACTIVE");
    expect(active.ok && assessmentWhere(active.filters)).toEqual({ AND: [{ application: { bursaryAccount: { status: "ACTIVE" } } }] });
  });
});
