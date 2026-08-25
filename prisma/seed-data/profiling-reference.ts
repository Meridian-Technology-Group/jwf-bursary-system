// prisma/seed-data/profiling-reference.ts
//
// CALC-01 — Reference seed data for the v2 notional/profiling engine:
// NotionalCostConfig, FamilyCategoryMeta, and the six profiling band tables
// (Appendices A, B, C of docs/backlog/calculation-logic/implementation-plan.md).
// All rows use effectiveFrom 2026-09-01 (this is the first version of these
// tables — no prior placeholder rows to avoid colliding with).
//
// Band-resolution semantics (floor/ceiling inclusivity, the one
// ceiling-exclusive table, and the single financial-equity epsilon) are
// documented in `src/lib/assessment/reference-bands.ts` — read that file
// before touching these values.

const EFFECTIVE_FROM = new Date("2026-09-01");

// ─── Appendix A — notional cost configs (category 1→6) ───────────────────

export const notionalCostConfigs = [
  // RENT
  { category: 1, costType: "RENT" as const, amount: 19000 },
  { category: 2, costType: "RENT" as const, amount: 19000 },
  { category: 3, costType: "RENT" as const, amount: 22000 },
  { category: 4, costType: "RENT" as const, amount: 25000 },
  { category: 5, costType: "RENT" as const, amount: 28000 },
  { category: 6, costType: "RENT" as const, amount: 31000 },
  // COUNCIL_TAX — flat across categories (Band D Croydon)
  { category: 1, costType: "COUNCIL_TAX" as const, amount: 2480 },
  { category: 2, costType: "COUNCIL_TAX" as const, amount: 2480 },
  { category: 3, costType: "COUNCIL_TAX" as const, amount: 2480 },
  { category: 4, costType: "COUNCIL_TAX" as const, amount: 2480 },
  { category: 5, costType: "COUNCIL_TAX" as const, amount: 2480 },
  { category: 6, costType: "COUNCIL_TAX" as const, amount: 2480 },
  // ESSENTIALS — utilities + internet + food + household + eating out + sports composite
  { category: 1, costType: "ESSENTIALS" as const, amount: 8879 },
  { category: 2, costType: "ESSENTIALS" as const, amount: 13398.5 },
  { category: 3, costType: "ESSENTIALS" as const, amount: 16854 },
  { category: 4, costType: "ESSENTIALS" as const, amount: 20341.5 },
  { category: 5, costType: "ESSENTIALS" as const, amount: 23890 },
  { category: 6, costType: "ESSENTIALS" as const, amount: 27294.5 },
  // CAR — flat across categories
  { category: 1, costType: "CAR" as const, amount: 3600 },
  { category: 2, costType: "CAR" as const, amount: 3600 },
  { category: 3, costType: "CAR" as const, amount: 3600 },
  { category: 4, costType: "CAR" as const, amount: 3600 },
  { category: 5, costType: "CAR" as const, amount: 3600 },
  { category: 6, costType: "CAR" as const, amount: 3600 },
  // PUBLIC_TRANSPORT
  { category: 1, costType: "PUBLIC_TRANSPORT" as const, amount: 1800 },
  { category: 2, costType: "PUBLIC_TRANSPORT" as const, amount: 3000 },
  { category: 3, costType: "PUBLIC_TRANSPORT" as const, amount: 3600 },
  { category: 4, costType: "PUBLIC_TRANSPORT" as const, amount: 4200 },
  { category: 5, costType: "PUBLIC_TRANSPORT" as const, amount: 4800 },
  { category: 6, costType: "PUBLIC_TRANSPORT" as const, amount: 5400 },
  // JWF_ALLOWANCE — flat across categories
  { category: 1, costType: "JWF_ALLOWANCE" as const, amount: 1700 },
  { category: 2, costType: "JWF_ALLOWANCE" as const, amount: 1700 },
  { category: 3, costType: "JWF_ALLOWANCE" as const, amount: 1700 },
  { category: 4, costType: "JWF_ALLOWANCE" as const, amount: 1700 },
  { category: 5, costType: "JWF_ALLOWANCE" as const, amount: 1700 },
  { category: 6, costType: "JWF_ALLOWANCE" as const, amount: 1700 },
  // NOTIONAL_SAVINGS
  { category: 1, costType: "NOTIONAL_SAVINGS" as const, amount: 3000 },
  { category: 2, costType: "NOTIONAL_SAVINGS" as const, amount: 4500 },
  { category: 3, costType: "NOTIONAL_SAVINGS" as const, amount: 6000 },
  { category: 4, costType: "NOTIONAL_SAVINGS" as const, amount: 7500 },
  { category: 5, costType: "NOTIONAL_SAVINGS" as const, amount: 9000 },
  { category: 6, costType: "NOTIONAL_SAVINGS" as const, amount: 10500 },
  // SAVINGS_CUSHION — rounded reference values (Appendix F #2)
  { category: 1, costType: "SAVINGS_CUSHION" as const, amount: 13500 },
  { category: 2, costType: "SAVINGS_CUSHION" as const, amount: 16000 },
  { category: 3, costType: "SAVINGS_CUSHION" as const, amount: 19000 },
  { category: 4, costType: "SAVINGS_CUSHION" as const, amount: 22000 },
  { category: 5, costType: "SAVINGS_CUSHION" as const, amount: 25500 },
  { category: 6, costType: "SAVINGS_CUSHION" as const, amount: 28500 },
].map((row) => ({ ...row, effectiveFrom: EFFECTIVE_FROM }));

// ─── Appendix A row 1 — family-category metadata ──────────────────────────

export const familyCategoryMetas = [
  { category: 1, familyMembers: 2, schoolAgeChildren: 1, description: "Sole parent, 1 child" },
  { category: 2, familyMembers: 3, schoolAgeChildren: 1, description: "Parents, 1 child" },
  { category: 3, familyMembers: 4, schoolAgeChildren: 2, description: "Parents, 2 children" },
  { category: 4, familyMembers: 5, schoolAgeChildren: 3, description: "Parents, 3 children" },
  { category: 5, familyMembers: 6, schoolAgeChildren: 4, description: "Parents, 4 children" },
  { category: 6, familyMembers: 7, schoolAgeChildren: 5, description: "Parents, 5+ children" },
].map((row) => ({ ...row, effectiveFrom: EFFECTIVE_FROM }));

// ─── Appendix B — affordability grid (category-1 base %) ─────────────────
// Every row has real, non-null floor/ceiling. Non-uniform steps preserved
// verbatim (18→20 at £75k; 25→27→29→32→35→40→45 at the top).

export const affordabilityBands = [
  { bandFloor: 27001, bandCeiling: 29000, basePct: 0 },
  { bandFloor: 29001, bandCeiling: 32000, basePct: 1 },
  { bandFloor: 32001, bandCeiling: 35000, basePct: 2 },
  { bandFloor: 35001, bandCeiling: 38000, basePct: 3 },
  { bandFloor: 38001, bandCeiling: 40000, basePct: 4 },
  { bandFloor: 40001, bandCeiling: 43000, basePct: 5 },
  { bandFloor: 43001, bandCeiling: 45000, basePct: 6 },
  { bandFloor: 45001, bandCeiling: 47000, basePct: 7 },
  { bandFloor: 47001, bandCeiling: 50000, basePct: 8 },
  { bandFloor: 50001, bandCeiling: 53000, basePct: 9 },
  { bandFloor: 53001, bandCeiling: 55000, basePct: 10 },
  { bandFloor: 55001, bandCeiling: 57000, basePct: 11 },
  { bandFloor: 57001, bandCeiling: 60000, basePct: 12 },
  { bandFloor: 60001, bandCeiling: 63000, basePct: 13 },
  { bandFloor: 63001, bandCeiling: 65000, basePct: 14 },
  { bandFloor: 65001, bandCeiling: 67000, basePct: 15 },
  { bandFloor: 67001, bandCeiling: 70000, basePct: 16 },
  { bandFloor: 70001, bandCeiling: 73000, basePct: 17 },
  { bandFloor: 73001, bandCeiling: 75000, basePct: 18 },
  { bandFloor: 75001, bandCeiling: 78000, basePct: 20 },
  { bandFloor: 78001, bandCeiling: 80000, basePct: 21 },
  { bandFloor: 80001, bandCeiling: 83000, basePct: 22 },
  { bandFloor: 83001, bandCeiling: 85000, basePct: 23 },
  { bandFloor: 85001, bandCeiling: 88000, basePct: 24 },
  { bandFloor: 88001, bandCeiling: 90000, basePct: 25 },
  { bandFloor: 90001, bandCeiling: 93000, basePct: 27 },
  { bandFloor: 93001, bandCeiling: 95000, basePct: 29 },
  { bandFloor: 95001, bandCeiling: 98000, basePct: 32 },
  { bandFloor: 98001, bandCeiling: 100000, basePct: 35 },
  { bandFloor: 100001, bandCeiling: 103000, basePct: 40 },
  { bandFloor: 103001, bandCeiling: 105000, basePct: 45 },
].map((row) => ({ ...row, effectiveFrom: EFFECTIVE_FROM }));

// ─── Appendix C.1 — income categories + fees-benchmark % ─────────────────
// Floor-inclusive, ceiling-EXCLUSIVE (the appendix's own note — see
// reference-bands.ts). The 1,2,3,4,5,6,7,7,8,7,8 category tail (7 reappears
// after 8) is the workbook's own anomaly, preserved verbatim — CALC-A1.

export const incomeCategoryBands = [
  { bandFloor: null, bandCeiling: 27000, category: 1, feesBenchmarkPct: 2 },
  { bandFloor: 27000, bandCeiling: 40000, category: 2, feesBenchmarkPct: 3 },
  { bandFloor: 40000, bandCeiling: 50000, category: 3, feesBenchmarkPct: 6 },
  { bandFloor: 50000, bandCeiling: 60000, category: 4, feesBenchmarkPct: 10 },
  { bandFloor: 60000, bandCeiling: 70000, category: 5, feesBenchmarkPct: 15 },
  { bandFloor: 70000, bandCeiling: 80000, category: 6, feesBenchmarkPct: 19 },
  { bandFloor: 80000, bandCeiling: 90000, category: 7, feesBenchmarkPct: 23 },
  // CH-39 — resolves ASSUMPTION(CALC-A1). The workbook's 7,8,7,8 tail was
  // Charlotte's own slip, confirmed 24 Aug 2026: "it should show logically and
  // incrementally from category 1 to category 11". Eleven bands, eleven
  // categories; boundaries and feesBenchmarkPct untouched.
  { bandFloor: 90000, bandCeiling: 100000, category: 8, feesBenchmarkPct: 27 },
  { bandFloor: 100000, bandCeiling: 110000, category: 9, feesBenchmarkPct: 30 },
  { bandFloor: 110000, bandCeiling: 120000, category: 10, feesBenchmarkPct: 30 },
  { bandFloor: 120000, bandCeiling: null, category: 11, feesBenchmarkPct: 30 },
].map((row) => ({ ...row, effectiveFrom: EFFECTIVE_FROM }));

// ─── Appendix C.2 — property-equity category bands ────────────────────────

export const propertyEquityBands = [
  { bandFloor: null, bandCeiling: 0, category: 1 },
  { bandFloor: 0, bandCeiling: 50000, category: 2 },
  { bandFloor: 50000, bandCeiling: 75000, category: 3 },
  { bandFloor: 75000, bandCeiling: 100000, category: 4 },
  { bandFloor: 100000, bandCeiling: 150000, category: 5 },
  { bandFloor: 150000, bandCeiling: 250000, category: 6 },
  { bandFloor: 250000, bandCeiling: 400000, category: 7 },
  { bandFloor: 400000, bandCeiling: 600000, category: 8 },
  { bandFloor: 600000, bandCeiling: 900000, category: 9 },
  { bandFloor: 900000, bandCeiling: 1200000, category: 10 },
  { bandFloor: 1200000, bandCeiling: 1600000, category: 11 },
  { bandFloor: 1600000, bandCeiling: null, category: 12 },
].map((row) => ({ ...row, effectiveFrom: EFFECTIVE_FROM }));

// ─── Appendix C.3 — financial-equity labels ───────────────────────────────
// The "in debt" row's ceiling is -0.01 (one penny below zero) so it doesn't
// collide with the "no debt, no equity" row's ceiling of exactly 0 — see the
// epsilon note in reference-bands.ts.

export const financialEquityBands = [
  { bandFloor: null, bandCeiling: -0.01, label: "in debt" },
  { bandFloor: 0, bandCeiling: 0, label: "no debt, no equity" },
  // CH-38 — Charlotte's amended first seven levels (24 Aug 2026), transcribed
  // from her table verbatim. The single 0–50,000 "some savings" band becomes
  // three, and the two above it shift label.
  { bandFloor: 0, bandCeiling: 3000, label: "negligible savings" },
  { bandFloor: 3000, bandCeiling: 20000, label: "within default cushion savings" },
  { bandFloor: 20000, bandCeiling: 50000, label: "fair savings" },
  { bandFloor: 50000, bandCeiling: 75000, label: "decent savings" },
  { bandFloor: 75000, bandCeiling: 100000, label: "comfortable savings" },
  { bandFloor: 100000, bandCeiling: 150000, label: "large savings" },
  { bandFloor: 150000, bandCeiling: 250000, label: "high savings" },
  { bandFloor: 250000, bandCeiling: 400000, label: "very high savings" },
  { bandFloor: 400000, bandCeiling: 600000, label: "extremely high savings" },
  { bandFloor: 600000, bandCeiling: 900000, label: "stratospheric savings - level 1" },
  { bandFloor: 900000, bandCeiling: 1200000, label: "stratospheric savings - level 2" },
  { bandFloor: 1200000, bandCeiling: 1600000, label: "stratospheric savings - level 3" },
  { bandFloor: 1600000, bandCeiling: null, label: "stratospheric savings - level 4" },
].map((row) => ({ ...row, effectiveFrom: EFFECTIVE_FROM }));

// ─── Appendix C.4 — debt-over-NDI ratio bands ─────────────────────────────
// Normalised to non-overlapping ranges per assumption CALC-A3 (the workbook's
// own 0.1–1/0.3–1/0.5–1/0.8–1 all shared upper bound 1). minRepaymentMonths
// is null only for the zero-debt "n/a" row; "<1mo" is stored as 0.

export const debtRatioBands = [
  { ratioFloor: null, ratioCeiling: 0, minRepaymentMonths: null, statusLabel: "ZERO DEBT, NO CREDIT RISK" },
  { ratioFloor: 0, ratioCeiling: 0.1, minRepaymentMonths: 0, statusLabel: "SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK - level 1" },
  { ratioFloor: 0.1, ratioCeiling: 0.3, minRepaymentMonths: 1, statusLabel: "SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK - level 2" },
  { ratioFloor: 0.3, ratioCeiling: 0.5, minRepaymentMonths: 3, statusLabel: "MANAGEABLE DEBT, LOW CREDIT RISK - level 1" },
  { ratioFloor: 0.5, ratioCeiling: 0.8, minRepaymentMonths: 6, statusLabel: "MANAGEABLE DEBT, LOW CREDIT RISK - level 2" },
  { ratioFloor: 0.8, ratioCeiling: 1, minRepaymentMonths: 9, statusLabel: "MANAGEABLE DEBT, MEDIUM CREDIT RISK - level 1" },
  { ratioFloor: 1, ratioCeiling: 2, minRepaymentMonths: 12, statusLabel: "MANAGEABLE DEBT, MEDIUM CREDIT RISK - level 2" },
  { ratioFloor: 2, ratioCeiling: 3, minRepaymentMonths: 24, statusLabel: "MATERIAL DEBT IMPACT, FAIR CREDIT RISK - level 1" },
  { ratioFloor: 3, ratioCeiling: 4, minRepaymentMonths: 36, statusLabel: "MATERIAL DEBT IMPACT, FAIR CREDIT RISK - level 2" },
  { ratioFloor: 4, ratioCeiling: 5, minRepaymentMonths: 48, statusLabel: "HEAVILY IN DEBT, HIGH CREDIT RISK - level 1" },
  { ratioFloor: 5, ratioCeiling: 6, minRepaymentMonths: 60, statusLabel: "HEAVILY IN DEBT, HIGH CREDIT RISK - level 2" },
  { ratioFloor: 6, ratioCeiling: 7, minRepaymentMonths: 72, statusLabel: "HEAVILY IN DEBT, HIGH CREDIT RISK - level 3" },
  { ratioFloor: 7, ratioCeiling: 8, minRepaymentMonths: 84, statusLabel: "VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK - level 1" },
  { ratioFloor: 8, ratioCeiling: 9, minRepaymentMonths: 96, statusLabel: "VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK - level 2" },
  { ratioFloor: 9, ratioCeiling: 10, minRepaymentMonths: 108, statusLabel: "VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK - level 3" },
  { ratioFloor: 10, ratioCeiling: null, minRepaymentMonths: 120, statusLabel: "VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK - level 4" },
].map((row) => ({ ...row, effectiveFrom: EFFECTIVE_FROM }));

// ─── Appendix C.5 — lifestyle-squeeze ratio bands ─────────────────────────
// Stored as percentage points (100 = 100%) to match the appendix's own labels.

export const lifestyleSqueezeBands = [
  { ratioFloor: null, ratioCeiling: 100, statusLabel: "AFFORDABLE, NO IMPACT" },
  { ratioFloor: 100, ratioCeiling: 120, statusLabel: "SMALL LIFESTYLE SQUEEZE, LITTLE IMPACT" },
  { ratioFloor: 120, ratioCeiling: 140, statusLabel: "NOTICEABLE LIFESTYLE SQUEEZE, SOME IMPACT" },
  { ratioFloor: 140, ratioCeiling: 150, statusLabel: "IMPORTANT LIFESTYLE SQUEEZE, WILL STRUGGLE" },
  { ratioFloor: 150, ratioCeiling: 170, statusLabel: "VERY HIGH LIFESTYLE SQUEEZE, WON'T MANAGE OVER TIME" },
  { ratioFloor: 170, ratioCeiling: null, statusLabel: "SEVERE LIFESTYLE SQUEEZE, SET TO FAIL QUICKLY" },
].map((row) => ({ ...row, effectiveFrom: EFFECTIVE_FROM }));
