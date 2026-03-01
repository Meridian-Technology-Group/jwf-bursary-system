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
] as const;

export const schoolFees = [
  {
    school: "TRINITY" as const,
    annualFees: 30702,
    effectiveFrom: new Date("2026-09-01"),
  },
  {
    school: "WHITGIFT" as const,
    annualFees: 31752,
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
