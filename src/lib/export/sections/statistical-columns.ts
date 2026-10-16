/**
 * Export Section 3 — "ASSESSMENT DATA FOR STATISTICAL PURPOSES & EXTERNAL
 * SHARING" (EXPORTS.xlsx rows 86–119). Columns in her order, her wording.
 *
 * No names, emails, references or child names: this section is shareable,
 * and a test asserts no identifying key ever enters this registry.
 * Client-safe (the field picker imports it).
 */

import type { ColumnDef } from "@/lib/export/columns";

const SIB = "SIBLINGS' FEES ALREADY AT A JWF SCHOOL";

export const STATISTICAL_COLUMNS: ColumnDef[] = [
  { key: "applicationType", header: "Application Type", group: "Application", width: 24 },
  { key: "round", header: "Round", group: "Application", width: 10 },
  { key: "completedAt", header: "Assessment Completion Date", group: "Application", kind: "date" },
  { key: "academicYear", header: "Academic Year", group: "Application", width: 14 },
  { key: "school", header: "School", group: "Application", width: 12 },
  { key: "schoolYear", header: "School Year", group: "Application", kind: "number", width: 12 },

  { key: "entrySchoolYear", header: "Bursary award year of entry", group: "Part 1", kind: "number" },
  { key: "recipientScholarship", header: "Bursary recipient's Scholarship", group: "Part 1", kind: "percent" },
  { key: "familyCategory", header: "Family category", group: "Part 1", kind: "number", width: 14 },
  { key: "remainingYears", header: "Remaining years at the school", group: "Part 1", kind: "number" },
  { key: "schoolAgeChildren", header: "Number of schooling age children", group: "Part 1", kind: "number" },
  { key: "parents", header: "Number of parents", group: "Part 1", kind: "number" },
  { key: "postcode", header: "Postcode (first part)", group: "Part 1", width: 14 },

  { key: "incomeCategory", header: "HOUSEHOLD'S INCOME CATEGORY IS:", group: "Categories and ratios", kind: "number" },
  { key: "propertyCategory", header: "HOUSEHOLD'S PROPERTY CATEGORY IS:", group: "Categories and ratios", kind: "number" },
  { key: "propertyEquityCategory", header: "HOUSEHOLD'S PROPERTY EQUITY CATEGORY IS:", group: "Categories and ratios", kind: "number" },
  { key: "financialEquity", header: "HOUSEHOLD'S FINANCIAL EQUITY CATEGORY IS:", group: "Categories and ratios", width: 28 },
  { key: "debtOverNdi", header: "DEBT OVER NET DISPOSABLE INCOME RATIO", group: "Categories and ratios", kind: "ratio" },
  { key: "debtStatus", header: "DEBT STATUS", group: "Categories and ratios", width: 36 },
  { key: "squeezeRatio", header: "LIFESTYLE SQUEEZE AFFORDABILITY RATIO", group: "Categories and ratios", kind: "ratio" },
  { key: "squeezeStatus", header: "LIFESTYLE SQUEEZE AFFORDABILITY STATUS", group: "Categories and ratios", width: 32 },

  { key: "sibling1School", header: `${SIB} - SCHOOL (1)`, group: "Siblings" },
  { key: "sibling1Fees", header: `${SIB} - PAYABLE FEES (1)`, group: "Siblings", kind: "money" },
  { key: "sibling2School", header: `${SIB} - SCHOOL (2)`, group: "Siblings" },
  { key: "sibling2Fees", header: `${SIB} - PAYABLE FEES (2)`, group: "Siblings", kind: "money" },
  { key: "sibling3School", header: `${SIB} - SCHOOL (3)`, group: "Siblings" },
  { key: "sibling3Fees", header: `${SIB} - PAYABLE FEES (3)`, group: "Siblings", kind: "money" },

  { key: "nextYearFees", header: "Fees for next year (or applicable year) — before VAT", group: "Award", kind: "money" },
  { key: "scholarshipPct", header: "Scholarship Award (%)", group: "Award", kind: "percent" },
  { key: "scholarshipSpend", header: "Scholarship Spend — before VAT", group: "Award", kind: "money" },
  { key: "bursarySpend", header: "Bursary Award / Spend (£) — before VAT", group: "Award", kind: "money" },
  { key: "netFees", header: "Net fees (or applicable year) — before VAT", group: "Award", kind: "money" },
  { key: "yearlyPayable", header: "Yearly Payable fees — including VAT", group: "Award", kind: "money" },
  { key: "monthlyPayable", header: "Monthly Payable fees — including VAT", group: "Award", kind: "money" },
  { key: "reasonCodes", header: "Reason codes (year-on-year)", group: "Award", width: 48 },
  { key: "awardType", header: "Bursary Award Type", group: "Award", width: 18 },
];

/** Keys that would identify a family; none may appear in Section 3. */
export const IDENTIFYING_KEY_PATTERN = /name|e-?mail|mobile|phone|reference|lead|address|dob|birth/i;
