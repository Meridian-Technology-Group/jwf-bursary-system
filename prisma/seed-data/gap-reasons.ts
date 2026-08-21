// prisma/seed-data/gap-reasons.ts
// CALC-02 — 10 reasons for a gap between the recommended (min-of-three) and
// confirmed payable fees (implementation-plan.md Appendix E, workbook
// E217–E226). The workbook numbers these 1,2,3,4,5,5,6,7,8,9 with a
// duplicated "5" — renumbered 1–10 here per the appendix's own note.

export const gapReasons = [
  { code: 1, label: "Out of sync due to scholarship applied on place offer", sortOrder: 1 },
  { code: 2, label: "Original Old Assessment Benchmark (2020)", sortOrder: 2 },
  { code: 3, label: "Pastoral Exceptional Leniency - Social Services", sortOrder: 3 },
  { code: 4, label: "Pastoral Exceptional Leniency - Fostering", sortOrder: 4 },
  { code: 5, label: "Pastoral Exceptional Leniency - Homed Boarder", sortOrder: 5 },
  { code: 6, label: "Out of sync due to new scholarship offered mid cursus", sortOrder: 6 },
  { code: 7, label: "Internal Bursary Bias - Bereavement", sortOrder: 7 },
  { code: 8, label: "Internal Bursary Bias - Severe Illness", sortOrder: 8 },
  { code: 9, label: "Affordability Adjusted Calculation Preferred", sortOrder: 9 },
  { code: 10, label: "Theoretical Benchmark Calculation Preferred", sortOrder: 10 },
] as const;
