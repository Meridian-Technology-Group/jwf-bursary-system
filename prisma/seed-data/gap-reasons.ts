// prisma/seed-data/gap-reasons.ts
// CALC-02 — 10 reasons for a gap between the recommended (min-of-three) and
// confirmed payable fees (implementation-plan.md Appendix E, workbook
// E217–E226). The workbook numbers these 1,2,3,4,5,5,6,7,8,9 with a
// duplicated "5" — renumbered 1–10 here per the appendix's own note.

export const gapReasons = [
  { code: 1, label: "Out of sync due to scholarship applied on place offer", sortOrder: 1, isDeprecated: true },
  { code: 2, label: "Original Old Assessment Benchmark (2020)", sortOrder: 2, isDeprecated: true },
  { code: 3, label: "Pastoral Exceptional Leniency - Social Services", sortOrder: 3, isDeprecated: true },
  { code: 4, label: "Pastoral Exceptional Leniency - Fostering", sortOrder: 4, isDeprecated: true },
  { code: 5, label: "Pastoral Exceptional Leniency - Homed Boarder", sortOrder: 5, isDeprecated: true },
  { code: 6, label: "Out of sync due to new scholarship offered mid cursus", sortOrder: 6, isDeprecated: true },
  { code: 7, label: "Internal Bursary Bias - Bereavement", sortOrder: 7, isDeprecated: true },
  { code: 8, label: "Internal Bursary Bias - Severe Illness", sortOrder: 8, isDeprecated: true },
  { code: 9, label: "Affordability Adjusted Calculation Preferred", sortOrder: 9, isDeprecated: true },
  { code: 10, label: "Theoretical Benchmark Calculation Preferred", sortOrder: 10, isDeprecated: true },

  // --- D4 CLOSED (6 Sep 2026) — Charlotte's definitive 11-code gap list ---
  // From her reviewed "Reason & Gap Codes" listing, in her four groups:
  // 1-3 External · 4-6 Pastoral Leniency · 7-9 Internal Bursary Bias ·
  // 10-11 Contextual (grouping: src/lib/reason-codes/gap-category.ts).
  // DB codes 101-111 (display = code - 100); codes 1-10 above are
  // deprecated, never deleted.
  { code: 101, label: "Out of sync due to scholarship applied on place offer", sortOrder: 1, isDeprecated: false },
  { code: 102, label: "Out of sync due to new scholarship offered mid cursus", sortOrder: 2, isDeprecated: false },
  { code: 103, label: "Original Old Assessment Benchmark (year 2020)", sortOrder: 3, isDeprecated: false },
  { code: 104, label: "Pastoral Exceptional Leniency - Social Services/ Police", sortOrder: 4, isDeprecated: false },
  { code: 105, label: "Pastoral Exceptional Leniency - Fostering", sortOrder: 5, isDeprecated: false },
  { code: 106, label: "Pastoral Exceptional Leniency - Homed Boarder", sortOrder: 6, isDeprecated: false },
  { code: 107, label: "Internal Bursary Bias - Bereavement", sortOrder: 7, isDeprecated: false },
  { code: 108, label: "Internal Bursary Bias - Severe Illness", sortOrder: 8, isDeprecated: false },
  { code: 109, label: "Internal Bursary Bias - Family crippled with debt, top pupil", sortOrder: 9, isDeprecated: false },
  { code: 110, label: "Affordability Adjusted Calculation Preferred", sortOrder: 10, isDeprecated: false },
  { code: 111, label: "Theoretical Benchmark Calculation Preferred", sortOrder: 11, isDeprecated: false },
] as const;
