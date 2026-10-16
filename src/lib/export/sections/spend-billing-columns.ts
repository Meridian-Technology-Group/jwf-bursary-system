/**
 * Export Section 2 — "ASSESSMENT DATA FOR SPEND & BILLING PURPOSES"
 * (EXPORTS.xlsx rows 26–83). Her order and wording. "All fields in part 1"
 * is every Part 1 field of the assessment form (assessment-form-v2.tsx,
 * PART 1). Siblings are flattened to three (D-15): Part 1 names them; Parts
 * 4–5 carry her name / school / payable fees block. Client-safe.
 */

import type { ColumnDef } from "@/lib/export/columns";

const ID = "Application";
const P1 = "Part 1";
const P2 = "Part 2";
const P3 = "Part 3";
const P45 = "Parts 4–5";
const AW = "Award";
const SIB = "SIBLINGS' FEES ALREADY AT A JWF SCHOOL";

const siblingsPart1: ColumnDef[] = [1, 2, 3].map((i) => ({
  key: `part1Sibling${i}`,
  header: `Bursary recipient's sibling ${i} at the school`,
  group: P1,
  width: 24,
}));

const siblingsPart45: ColumnDef[] = [1, 2, 3].flatMap((i) => [
  { key: `sibling${i}Name`, header: `${SIB} - NAME (${i})`, group: P45, width: 24 },
  { key: `sibling${i}School`, header: `${SIB} - SCHOOL (${i})`, group: P45 },
  { key: `sibling${i}Fees`, header: `${SIB} - PAYABLE FEES (${i})`, group: P45, kind: "money" as const },
]);

export const SPEND_BILLING_COLUMNS: ColumnDef[] = [
  { key: "bursaryAccount", header: "Bursary account", group: ID, width: 16 },
  { key: "assessmentStatus", header: "Assessment status", group: ID, width: 18 },
  { key: "applicationType", header: "Application Type", group: ID, width: 24 },
  { key: "round", header: "Round", group: ID, width: 10 },
  { key: "completedAt", header: "Assessment Completion Date", group: ID, kind: "date" },
  { key: "academicYear", header: "Academic Year", group: ID, width: 14 },
  { key: "school", header: "School", group: ID, width: 12 },
  { key: "schoolYear", header: "School Year", group: ID, kind: "number", width: 12 },

  { key: "childFirstName", header: "Bursary recipient's First name", group: P1, width: 20 },
  { key: "childLastName", header: "Bursary recipient's Surname", group: P1, width: 20 },
  { key: "recipientSchool", header: "Bursary recipient's school", group: P1, width: 14 },
  { key: "entrySchoolYear", header: "Bursary award year of entry", group: P1, kind: "number" },
  { key: "recipientScholarship", header: "Bursary recipient's Scholarship", group: P1, kind: "percent" },
  ...siblingsPart1,
  { key: "familyCategory", header: "Family category", group: P1, kind: "number", width: 14 },
  { key: "familyCategoryDescription", header: "Family category description", group: P1, width: 40 },
  { key: "remainingYears", header: "Remaining years at the school", group: P1, kind: "number" },
  { key: "schoolAgeChildren", header: "Number of schooling age children", group: P1, kind: "number" },
  { key: "postcode", header: "Postcode (first part)", group: P1, width: 14 },
  { key: "annualFees", header: "Annual school fees", group: P1, kind: "money" },

  { key: "parent1Total", header: "Total parent 1", group: P2, kind: "money" },
  { key: "parent2Total", header: "Total parent 2", group: P2, kind: "money" },
  { key: "totalBenefits", header: "Total Benefits", group: P2, kind: "money" },
  { key: "totalSelfEmployed", header: "Total Self-Employed Income", group: P2, kind: "money" },
  { key: "totalPaye", header: "Total PAYE Income", group: P2, kind: "money" },

  { key: "totalSavings", header: "DISPLAY ONLY - ENTER TOTAL SAVINGS", group: P3, kind: "money" },
  { key: "totalCash", header: "DISPLAY ONLY - ENTER TOTAL CASH HELD", group: P3, kind: "money" },
  { key: "rentAddBack", header: "ADD BACK IN NOTIONAL RENT APPLIED", group: P3, kind: "money" },
  { key: "ndiAfterNotionalSpend", header: "HOUSEHOLD'S NET DISPOSABLE INCOME AFTER NOTIONAL SPEND", group: P3, kind: "money" },
  { key: "incomeCategory", header: "HOUSEHOLD'S INCOME CATEGORY IS:", group: P3, kind: "number" },

  { key: "homeValue", header: "DISPLAY ONLY - TOTAL FAMILY HOME MARKET VALUE", group: P45, kind: "money" },
  { key: "homeMortgage", header: "DISPLAY ONLY - TOTAL FAMILY HOME MORTGAGE BALANCE", group: P45, kind: "money" },
  { key: "secondValue", header: "DISPLAY ONLY - TOTAL SECOND PROPERTY MARKET VALUE", group: P45, kind: "money" },
  { key: "secondMortgage", header: "DISPLAY ONLY - TOTAL SECOND PROPERTY MORTGAGE BALANCE", group: P45, kind: "money" },
  { key: "otherValue", header: "DISPLAY ONLY - TOTAL OTHER PROPERTY (IES) MARKET VALUE", group: P45, kind: "money" },
  { key: "otherMortgage", header: "DISPLAY ONLY - TOTAL OTHER PROPERTY (IES) MORTGAGE BALANCE", group: P45, kind: "money" },
  { key: "propertyCategory", header: "HOUSEHOLD'S PROPERTY CATEGORY IS:", group: P45, kind: "number" },
  { key: "propertyEquityCategory", header: "HOUSEHOLD'S PROPERTY EQUITY CATEGORY IS:", group: P45, kind: "number" },
  { key: "financialEquity", header: "HOUSEHOLD'S FINANCIAL EQUITY CATEGORY IS:", group: P45, width: 28 },
  { key: "derivedYearlyDebtRepayments", header: "DISPLAY ONLY - DERIVED YEARLY DEBT REPAYMENTS", group: P45, kind: "money" },
  { key: "totalDebt", header: "TOTAL DEBT ( which is 5 times the entry above)", group: P45, kind: "money" },
  { key: "debtOverNdi", header: "DEBT OVER NET DISPOSABLE INCOME RATIO", group: P45, kind: "ratio" },
  { key: "debtStatus", header: "DEBT STATUS", group: P45, width: 36 },
  {
    key: "behindOnFees",
    header: "DEBT SITUATION WITH THE FOUNDATION — DISPLAY ONLY - IS THE FAMILY BEHIND WITH THEIR SCHOOL FEES PAYMENTS?",
    group: P45,
    width: 20,
  },
  { key: "squeezeRatio", header: "LIFESTYLE SQUEEZE AFFORDABILITY RATIO", group: P45, kind: "ratio" },
  { key: "squeezeStatus", header: "LIFESTYLE SQUEEZE AFFORDABILITY STATUS", group: P45, width: 32 },
  ...siblingsPart45,

  { key: "householdNetIncome", header: "Household net income", group: AW, kind: "money" },
  { key: "actualRemainingDi", header: "Actual remaining DI", group: AW, kind: "money" },
  { key: "theoreticalBenchmarkDi", header: "Theoretical benchmark DI", group: AW, kind: "money" },
  { key: "affordabilityAdjustedDi", header: "Affordability-adjusted DI", group: AW, kind: "money" },
  { key: "nextYearFees", header: "Fees for next year (or applicable year) — before VAT", group: AW, kind: "money" },
  { key: "scholarshipPct", header: "Scholarship Award (%)", group: AW, kind: "percent" },
  { key: "scholarshipSpend", header: "Scholarship Spend — before VAT", group: AW, kind: "money" },
  { key: "bursarySpend", header: "Bursary Award / Spend (£) — before VAT", group: AW, kind: "money" },
  { key: "netFees", header: "Net fees (or applicable year) — before VAT", group: AW, kind: "money" },
  { key: "yearlyPayable", header: "Yearly Payable fees — including VAT", group: AW, kind: "money" },
  { key: "monthlyPayable", header: "Monthly Payable fees — including VAT", group: AW, kind: "money" },
  { key: "gap", header: "Gap (confirmed − recommended)", group: AW, kind: "money" },
  { key: "scholarshipAdjustedGap", header: "Scholarship adj. Gap", group: AW, kind: "money" },
  { key: "gapReasons", header: "Gap reason code(s)", group: AW, width: 48 },
  { key: "reasonCodes", header: "Reason codes (year-on-year)", group: AW, width: 48 },
  { key: "awardType", header: "Bursary Award Type", group: AW, width: 18 },
];
