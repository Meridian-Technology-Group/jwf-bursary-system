/**
 * Epic 23 T8 — Export Section 2 (spend & billing): her columns, every Part 1
 * field, the Part 2 totals from the v2 income JSON, the engine's rent
 * add-back, total debt, v1 / migrated blanks, gap reasons main-first.
 */
import { describe, expect, it } from "vitest";
import { SPEND_BILLING_COLUMNS } from "../sections/spend-billing-columns";
import { gapReasonsMainFirst, mapSpendBillingRow, type SpendBillingSource } from "../sections/spend-billing";
import { findSection } from "../sections/descriptors";
import { columnGroups } from "../columns";
import { calculateDerivedYearlyDebtRepayments } from "@/lib/assessment/v2/debt";
import type { ReferenceBundle } from "@/lib/assessment/v2/types";

const SIB = "SIBLINGS' FEES ALREADY AT A JWF SCHOOL";

/** Her EXPORTS.xlsx Section 2 (rows 28–83); Part 1 expanded to the form's fields; siblings ×3. */
const HER_HEADERS = [
  "Bursary account",
  "Assessment status",
  "Application Type",
  "Round",
  "Assessment Completion Date",
  "Academic Year",
  "School",
  "School Year",
  "Bursary recipient's First name",
  "Bursary recipient's Surname",
  "Bursary recipient's school",
  "Bursary award year of entry",
  "Bursary recipient's Scholarship",
  "Bursary recipient's sibling 1 at the school",
  "Bursary recipient's sibling 2 at the school",
  "Bursary recipient's sibling 3 at the school",
  "Family category",
  "Family category description",
  "Remaining years at the school",
  "Number of schooling age children",
  "Postcode (first part)",
  "Annual school fees",
  "Total parent 1",
  "Total parent 2",
  "Total Benefits",
  "Total Self-Employed Income",
  "Total PAYE Income",
  "DISPLAY ONLY - ENTER TOTAL SAVINGS",
  "DISPLAY ONLY - ENTER TOTAL CASH HELD",
  "ADD BACK IN NOTIONAL RENT APPLIED",
  "HOUSEHOLD'S NET DISPOSABLE INCOME AFTER NOTIONAL SPEND",
  "HOUSEHOLD'S INCOME CATEGORY IS:",
  "DISPLAY ONLY - TOTAL FAMILY HOME MARKET VALUE",
  "DISPLAY ONLY - TOTAL FAMILY HOME MORTGAGE BALANCE",
  "DISPLAY ONLY - TOTAL SECOND PROPERTY MARKET VALUE",
  "DISPLAY ONLY - TOTAL SECOND PROPERTY MORTGAGE BALANCE",
  "DISPLAY ONLY - TOTAL OTHER PROPERTY (IES) MARKET VALUE",
  "DISPLAY ONLY - TOTAL OTHER PROPERTY (IES) MORTGAGE BALANCE",
  "HOUSEHOLD'S PROPERTY CATEGORY IS:",
  "HOUSEHOLD'S PROPERTY EQUITY CATEGORY IS:",
  "HOUSEHOLD'S FINANCIAL EQUITY CATEGORY IS:",
  "DISPLAY ONLY - DERIVED YEARLY DEBT REPAYMENTS",
  "TOTAL DEBT ( which is 5 times the entry above)",
  "DEBT OVER NET DISPOSABLE INCOME RATIO",
  "DEBT STATUS",
  "DEBT SITUATION WITH THE FOUNDATION — DISPLAY ONLY - IS THE FAMILY BEHIND WITH THEIR SCHOOL FEES PAYMENTS?",
  "LIFESTYLE SQUEEZE AFFORDABILITY RATIO",
  "LIFESTYLE SQUEEZE AFFORDABILITY STATUS",
  ...[1, 2, 3].flatMap((i) => [`${SIB} - NAME (${i})`, `${SIB} - SCHOOL (${i})`, `${SIB} - PAYABLE FEES (${i})`]),
  "Household net income",
  "Actual remaining DI",
  "Theoretical benchmark DI",
  "Affordability-adjusted DI",
  "Fees for next year (or applicable year) — before VAT",
  "Scholarship Award (%)",
  "Scholarship Spend — before VAT",
  "Bursary Award / Spend (£) — before VAT",
  "Net fees (or applicable year) — before VAT",
  "Yearly Payable fees — including VAT",
  "Monthly Payable fees — including VAT",
  "Gap (confirmed − recommended)",
  "Scholarship adj. Gap",
  "Gap reason code(s)",
  "Reason codes (year-on-year)",
  "Bursary Award Type",
];

describe("Section 2 registry", () => {
  it("is her column list, in her order", () => {
    expect(SPEND_BILLING_COLUMNS.map((c) => c.header)).toEqual(HER_HEADERS);
  });
  it("keys are unique and the picker groups by part", () => {
    const keys = SPEND_BILLING_COLUMNS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(columnGroups(SPEND_BILLING_COLUMNS).map((g) => g.group)).toEqual([
      "Application",
      "Part 1",
      "Part 2",
      "Part 3",
      "Parts 4–5",
      "Award",
    ]);
    expect(findSection("spend-billing")?.number).toBe(2);
  });
});

const REF = {
  notionalCosts: [
    { category: 3, costType: "RENT", amount: 12000 },
  ],
  familyCategoryMetas: [{ category: 3, familyMembers: 4, schoolAgeChildren: 2, description: "Two parents, two children" }],
} as unknown as ReferenceBundle;

const debts = { creditCards: 3000, loans: 5000 };

function source(over: Record<string, unknown> = {}, app: Record<string, unknown> = {}): SpendBillingSource {
  return {
    id: "as-1",
    calculationVersion: 2,
    status: "ROLLED_OVER",
    completedAt: new Date("2026-05-24T10:00:00Z"),
    assessmentSchool: "WHITGIFT",
    entrySchoolYear: 7,
    scholarshipPct: "10.00",
    familyTypeCategory: 3,
    schoolingYearsRemaining: 4,
    postcode: "cr0 2ab",
    annualFees: "21000.00",
    nextYearAnnualFees: "22000.00",
    rentAddBackType: "PARTIAL_LOWER_RENT",
    rentAddBackOverride: null,
    ndiAfterNotionalSpend: "24907.00",
    incomeCategory: 4,
    propertyCategoryDerived: 2,
    propertyEquityCategory: 1,
    financialEquityLabel: "LOW",
    derivedYearlyDebtRepayments: String(calculateDerivedYearlyDebtRepayments(debts)),
    debtOverNdiRatio: "0.0642",
    debtStatusLabel: "MANAGEABLE DEBT, LOW CREDIT RISK",
    behindOnFees: false,
    lifestyleSqueezeRatio: "1.1000",
    lifestyleSqueezeLabel: "SQUEEZED",
    siblingDetails: [{ name: "Sib One", school: "TRINITY", netPayableFees: 4000 }],
    totalHouseholdNetIncome: "61300.00",
    actualRemainingDi: "5000.00",
    theoreticalBenchmarkDi: "6000.00",
    affordabilityAdjustedDi: "5500.00",
    bursaryAward: "15000.00",
    yearlyPayableFees: "5880.00",
    monthlyPayableFees: "490.00",
    vatRate: "20.00",
    awardFundType: "WFA",
    property: {
      schoolAgeChildrenCount: 2,
      cashSavings: "3500.00",
      isasPepsShares: "12000.00",
      propertyAssets: { home: { value: 450000, mortgageBalance: 200000 }, second: { value: 0 }, other: {} },
      debts,
    },
    earners: [
      {
        earnerLabel: "PARENT_1",
        incomeDetail: { employed: { annualSalaryPaye: 40000 }, benefits: { childBenefit: 1300 }, total: 0, documentsConfirmed: true },
      },
      {
        earnerLabel: "PARENT_2",
        incomeDetail: { selfEmployed: { grossSalaried: 15000, dividends: 5000 }, total: 0, documentsConfirmed: true },
      },
    ],
    application: {
      applicationType: "ROLLING_OVER",
      school: "WHITGIFT",
      entryYearGroup: "Y9",
      migrationSource: null,
      childName: "Pupil Surname",
      childFirstName: "Pupil",
      childLastName: "Surname",
      round: { academicYear: "2026/27" },
      bursaryAccount: { status: "ACTIVE" },
      ...app,
    },
    recommendation: {
      scholarshipSpendBeforeVat: "2200.00",
      bursarySpendBeforeVat: "14900.00",
      netFeesBeforeVat: "4900.00",
      yearlyPayableFees: "5880.00",
      monthlyPayableFees: "490.00",
      gapAmount: "-1000.00",
      reasonCodes: [{ reasonCode: { code: 3, label: "Three" } }],
      gapReasons: [
        { gapReason: { code: 101, label: "Low", rank: 9, sortOrder: 1 } },
        { gapReason: { code: 115, label: "Top", rank: 1, sortOrder: 2 } },
      ],
    },
    ...over,
  } as unknown as SpendBillingSource;
}

describe("mapSpendBillingRow", () => {
  it("a fully populated v2 assessment: every column filled, money as numbers", () => {
    const r = mapSpendBillingRow(source(), REF);
    expect(r).toMatchObject({
      bursaryAccount: "Active",
      assessmentStatus: "Rolled over",
      childFirstName: "Pupil",
      childLastName: "Surname",
      recipientSchool: "Whitgift",
      part1Sibling1: "Sib One",
      part1Sibling2: "",
      familyCategory: 3,
      familyCategoryDescription: "Two parents, two children",
      schoolAgeChildren: 2,
      postcode: "CR0",
      annualFees: 21000,
      parent1Total: 41300,
      parent2Total: 20000,
      totalBenefits: 1300,
      totalSelfEmployed: 20000,
      totalPaye: 40000,
      totalSavings: 12000,
      totalCash: 3500,
      rentAddBack: 3000, // a quarter of the category's 12,000 notional rent
      ndiAfterNotionalSpend: 24907,
      homeValue: 450000,
      homeMortgage: 200000,
      secondValue: 0,
      secondMortgage: null,
      otherValue: null,
      derivedYearlyDebtRepayments: 1600,
      totalDebt: 8000,
      behindOnFees: "No",
      sibling1Name: "Sib One",
      sibling1School: "Trinity",
      sibling1Fees: 4000,
      householdNetIncome: 61300,
      nextYearFees: 22000,
      bursarySpend: 14900,
      netFees: 4900,
      yearlyPayable: 5880,
      gap: -1000,
      gapReasons: "115 – Top, 101 – Low",
      awardType: "WFA bursary",
    });
    for (const [k, v] of Object.entries(r)) {
      if (/Fees|Total|Value|Income|Spend|Payable|Debt|Di$|gap/i.test(k) && v !== null && v !== "") {
        expect(typeof v === "number" || typeof v === "string", k).toBe(true);
      }
    }
    expect(typeof r.parent1Total).toBe("number");
    expect(typeof r.scholarshipAdjustedGap).toBe("number");
  });

  it("her note: total debt is 5 × the derived yearly repayments", () => {
    const r = mapSpendBillingRow(source(), REF);
    expect(r.totalDebt).toBe((r.derivedYearlyDebtRepayments as number) * 5);
  });

  it("D-10: a v1 assessment leaves v2-only columns blank", () => {
    const r = mapSpendBillingRow(source({ calculationVersion: 1, bursaryAward: "40.00" }), REF);
    for (const k of ["parent1Total", "totalBenefits", "totalPaye", "rentAddBack", "ndiAfterNotionalSpend", "homeValue", "totalDebt", "debtStatus", "gap", "bursarySpend"]) {
      expect(r[k], k).toBe(null);
    }
    expect(r.annualFees).toBe(21000);
  });

  it("D-9: migrated leaves the schooling-age children blank", () => {
    expect(mapSpendBillingRow(source({}, { migrationSource: "GRANT_TRACKER" }), REF).schoolAgeChildren).toBe(null);
  });

  it("no reference bundle row → blank description and add-back, never a throw", () => {
    const r = mapSpendBillingRow(source({ familyTypeCategory: 6 }), REF);
    expect(r.familyCategoryDescription).toBe("");
    expect(r.rentAddBack).toBe(null);
    expect(mapSpendBillingRow(source(), null).rentAddBack).toBe(null);
  });

  it("an override wins over the add-back type", () => {
    expect(mapSpendBillingRow(source({ rentAddBackOverride: "750.00" }), REF).rentAddBack).toBe(750);
  });
});

describe("gapReasonsMainFirst", () => {
  it("puts the highest-ranked reason first, then the rest in list order", () => {
    expect(
      gapReasonsMainFirst([
        { code: 1, label: "A", rank: 3, sortOrder: 1 },
        { code: 2, label: "B", rank: 1, sortOrder: 2 },
        { code: 3, label: "C", rank: null, sortOrder: 3 },
      ]),
    ).toBe("2 – B, 1 – A, 3 – C");
    expect(gapReasonsMainFirst([])).toBe("");
  });
});
