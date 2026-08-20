// prisma/seed-data/reference.ts
// Reference table seed data for FamilyTypeConfig, SchoolFees, CouncilTaxDefault

export const familyTypeConfigs = [
  {
    category: 1,
    description: "Sole parent, 1 child",
    notionalRent: 13000,
    utilityCosts: 1200,
    foodCosts: 5000,
    effectiveFrom: new Date("2026-09-01"),
  },
  {
    category: 2,
    description: "Parents, 1 child",
    notionalRent: 15000,
    utilityCosts: 1500,
    foodCosts: 7500,
    effectiveFrom: new Date("2026-09-01"),
  },
  {
    category: 3,
    description: "Parents, 2 children",
    notionalRent: 18000,
    utilityCosts: 2000,
    foodCosts: 8500,
    effectiveFrom: new Date("2026-09-01"),
  },
  {
    category: 4,
    description: "Parents, 3 children",
    notionalRent: 20000,
    utilityCosts: 2500,
    foodCosts: 9500,
    effectiveFrom: new Date("2026-09-01"),
  },
  {
    category: 5,
    description: "Parents, 4 children",
    notionalRent: 23000,
    utilityCosts: 3000,
    foodCosts: 10500,
    effectiveFrom: new Date("2026-09-01"),
  },
  {
    category: 6,
    description: "Parents, 5+ children",
    notionalRent: 26000,
    utilityCosts: 3300,
    foodCosts: 12000,
    effectiveFrom: new Date("2026-09-01"),
  },
  // CALC-01 — corrected values from the client's Assessment Model workbook
  // (docs/backlog/calculation-logic/implementation-plan.md, Appendix A).
  // Seeded as NEW rows (effectiveFrom 2026-09-02 — 2026-09-01 is taken by the
  // placeholder rows above, which are left untouched). utilityCosts/foodCosts
  // stay populated for v1 back-compat: the v2 engine reads the ESSENTIALS
  // composite from NotionalCostConfig instead (see profiling-reference.ts).
  // utilityCosts = Appendix A essentials build-up "utilities" row;
  // foodCosts = £5.30/day/person × 365 × familyMembers (Appendix A build-up).
  {
    category: 1,
    description: "Sole parent, 1 child",
    notionalRent: 19000,
    utilityCosts: 1850,
    foodCosts: 3869,
    effectiveFrom: new Date("2026-09-02"),
  },
  {
    category: 2,
    description: "Parents, 1 child",
    notionalRent: 19000,
    utilityCosts: 2315,
    foodCosts: 5803.5,
    effectiveFrom: new Date("2026-09-02"),
  },
  {
    category: 3,
    description: "Parents, 2 children",
    notionalRent: 22000,
    utilityCosts: 2796,
    foodCosts: 7738,
    effectiveFrom: new Date("2026-09-02"),
  },
  {
    category: 4,
    description: "Parents, 3 children",
    notionalRent: 25000,
    utilityCosts: 3309,
    foodCosts: 9672.5,
    effectiveFrom: new Date("2026-09-02"),
  },
  {
    category: 5,
    description: "Parents, 4 children",
    notionalRent: 28000,
    utilityCosts: 3883,
    foodCosts: 11607,
    effectiveFrom: new Date("2026-09-02"),
  },
  {
    category: 6,
    description: "Parents, 5+ children",
    notionalRent: 31000,
    utilityCosts: 4313,
    foodCosts: 13541.5,
    effectiveFrom: new Date("2026-09-02"),
  },
] as const;

// Epic 15 M2 (CH-17) — the REAL pre-VAT annual fees Charlotte supplied on
// 2026-08-17, per academic year (effectiveFrom = 1 September of the start
// year, the fee-year resolver's anchor). The old placeholder rows (~5%
// uplifts) are gone; new years are entered through Settings → School Fees →
// Add year when the Foundation confirms them — never invented here.
export const schoolFees = [
  // 2025-26
  {
    school: "TRINITY" as const,
    annualFees: 24366.67,
    effectiveFrom: new Date("2025-09-01"),
  },
  {
    school: "WHITGIFT" as const,
    annualFees: 25200.0,
    effectiveFrom: new Date("2025-09-01"),
  },
  // 2026-27
  {
    school: "TRINITY" as const,
    annualFees: 25390.0,
    effectiveFrom: new Date("2026-09-01"),
  },
  {
    school: "WHITGIFT" as const,
    annualFees: 26175.0,
    effectiveFrom: new Date("2026-09-01"),
  },
] as const;

export const councilTaxDefaults = [
  {
    amount: 2480,
    description: "Band D Croydon",
    effectiveFrom: new Date("2026-04-01"),
  },
] as const;
