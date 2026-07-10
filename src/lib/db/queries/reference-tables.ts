/**
 * Reference table database queries.
 * Used by the assessment form to auto-populate default values,
 * and by the admin settings page for full reference data management.
 */

import type { Tx } from "@/lib/db/prisma";
import type { School, EmailTemplateType } from "@prisma/client";
import {
  resolveFeeYearPair,
  parseAcademicYearStart,
} from "@/lib/assessment/fee-year";

// ─── Family Type Configs ──────────────────────────────────────────────────────

export interface FamilyTypeConfigRow {
  id: string;
  category: number;
  description: string;
  notionalRent: number;
  utilityCosts: number;
  foodCosts: number;
  effectiveFrom: Date;
}

/**
 * Returns the most recent FamilyTypeConfig per category (all 6 categories).
 * Ordered by category ascending.
 */
export async function getFamilyTypeConfigs(tx: Tx): Promise<FamilyTypeConfigRow[]> {
  // Fetch all configs ordered by category + effectiveFrom desc, then deduplicate.
  // The createdAt desc tie-break makes same-day edits deterministic: when two
  // rows share an effectiveFrom date, the most recently inserted row wins, so a
  // same-day edit surfaces instead of a stale version (defect plan §2.2).
  const rows = await tx.familyTypeConfig.findMany({
    orderBy: [
      { category: "asc" },
      { effectiveFrom: "desc" },
      { createdAt: "desc" },
    ],
  });

  // Keep only the most recent per category
  const seen = new Set<number>();
  const result: FamilyTypeConfigRow[] = [];
  for (const row of rows) {
    if (!seen.has(row.category)) {
      seen.add(row.category);
      result.push({
        id: row.id,
        category: row.category,
        description: row.description,
        notionalRent: Number(row.notionalRent),
        utilityCosts: Number(row.utilityCosts),
        foodCosts: Number(row.foodCosts),
        effectiveFrom: row.effectiveFrom,
      });
    }
  }

  return result;
}

// ─── School Fees ──────────────────────────────────────────────────────────────

export interface SchoolFeesRow {
  id: string;
  school: School;
  annualFees: number;
  effectiveFrom: Date;
}

/**
 * Returns the most recent SchoolFees per school.
 */
export async function getSchoolFees(tx: Tx): Promise<SchoolFeesRow[]> {
  // createdAt desc tie-break: same-day edits are deterministic — see §2.2.
  const rows = await tx.schoolFees.findMany({
    orderBy: [
      { school: "asc" },
      { effectiveFrom: "desc" },
      { createdAt: "desc" },
    ],
  });

  const seen = new Set<School>();
  const result: SchoolFeesRow[] = [];
  for (const row of rows) {
    if (!seen.has(row.school)) {
      seen.add(row.school);
      result.push({
        id: row.id,
        school: row.school,
        annualFees: Number(row.annualFees),
        effectiveFrom: row.effectiveFrom,
      });
    }
  }

  return result;
}

/**
 * Epic 07 — resolves the current-year AND next-year annual fee for one school,
 * given the assessed academic year (e.g. "2025-26").
 *
 * Unlike `getSchoolFees` (which keeps the single most-recent row per school with
 * no year dimension), this resolves the row effective FOR the assessed academic
 * year and the row for the FOLLOWING year, using `resolveFeeYearPair`. Ordering
 * is deterministic (`effectiveFrom desc, createdAt desc`) — the same tie-break
 * the settings read path uses (defect [12]); same-day fee edits resolve to the
 * most recently inserted row.
 *
 * If the academic year cannot be parsed, both figures fall back to the single
 * most-recent row (current behaviour) so nothing regresses. If no forward-dated
 * row exists, `nextYearAnnualFees` is `null` and the UI labels it "not yet set".
 */
export async function getSchoolFeesForYear(
  tx: Tx,
  school: School,
  academicYear: string | null | undefined
): Promise<{ currentYearAnnualFees: number | null; nextYearAnnualFees: number | null }> {
  const rows = await tx.schoolFees.findMany({
    where: { school },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  const versioned = rows.map((r) => ({
    annualFees: Number(r.annualFees),
    effectiveFrom: r.effectiveFrom,
    createdAt: r.createdAt,
  }));

  const startYear = parseAcademicYearStart(academicYear);
  if (startYear === null) {
    // No parseable year — fall back to the single most-recent row for both.
    const latest = versioned[0]?.annualFees ?? null;
    return { currentYearAnnualFees: latest, nextYearAnnualFees: null };
  }

  return resolveFeeYearPair(versioned, startYear);
}

// ─── Council Tax Default ──────────────────────────────────────────────────────

export interface CouncilTaxDefaultRow {
  id: string;
  amount: number;
  description: string;
  effectiveFrom: Date;
}

/**
 * Returns the most recent CouncilTaxDefault record.
 */
export async function getCouncilTaxDefault(tx: Tx): Promise<CouncilTaxDefaultRow | null> {
  // createdAt desc tie-break: same-day edits are deterministic — see §2.2.
  const row = await tx.councilTaxDefault.findFirst({
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  if (!row) return null;

  return {
    id: row.id,
    amount: Number(row.amount),
    description: row.description,
    effectiveFrom: row.effectiveFrom,
  };
}

// ─── Combined Config for Assessment ──────────────────────────────────────────

export interface AssessmentReferenceConfigs {
  /**
   * Current-year annual fee for the school. Back-compat name retained — this is
   * the fee in force for the assessed academic year (Epic 07). Falls back to the
   * single most-recent row when no academic year is supplied.
   */
  annualFees: number;
  /**
   * Epic 07 — next-year annual fee (the fee-uplift the family will pay across the
   * year that spans the boundary). `null` when no forward-dated row exists yet,
   * or when no academic year was supplied; the UI labels it "not yet set".
   */
  nextYearAnnualFees: number | null;
  notionalRent: number;
  utilityCosts: number;
  foodCosts: number;
  councilTax: number;
  familyTypeConfigs: FamilyTypeConfigRow[];
  schoolFeesMap: Record<School, number>;
}

/**
 * Returns all reference configs needed for an assessment form.
 * Populates annualFees for the given school, and notionalRent/utilities/food
 * for the given family type category (or the first category if not specified).
 *
 * Epic 07: when `academicYear` is supplied (from `Round.academicYear`, D5), the
 * fee is resolved per fee-year — `annualFees` is the current-year figure and
 * `nextYearAnnualFees` the following year's. When omitted, `annualFees` is the
 * single most-recent row (current behaviour) and `nextYearAnnualFees` is `null`.
 */
export async function getConfigsForAssessment(
  tx: Tx,
  school: School,
  familyTypeCategory?: number,
  academicYear?: string | null
): Promise<AssessmentReferenceConfigs> {
  const [familyTypeConfigs, schoolFees, councilTaxDefault, feeYearPair] =
    await Promise.all([
      getFamilyTypeConfigs(tx),
      getSchoolFees(tx),
      getCouncilTaxDefault(tx),
      getSchoolFeesForYear(tx, school, academicYear),
    ]);

  // Build school fees map (single most-recent per school — used elsewhere)
  const schoolFeesMap: Record<string, number> = {};
  for (const sf of schoolFees) {
    schoolFeesMap[sf.school] = sf.annualFees;
  }

  // Current-year fee: prefer the year-resolved figure; fall back to the legacy
  // single-most-recent row so the form is never left with £0 when a year is
  // supplied but the school's schedule predates it / can't be parsed.
  const annualFees =
    feeYearPair.currentYearAnnualFees ?? schoolFeesMap[school] ?? 0;
  const nextYearAnnualFees = feeYearPair.nextYearAnnualFees;
  const councilTax = councilTaxDefault?.amount ?? 2480;

  // Find the matching family type config (default to category 1)
  const category = familyTypeCategory ?? 1;
  const familyConfig =
    familyTypeConfigs.find((c) => c.category === category) ?? familyTypeConfigs[0];

  return {
    annualFees,
    nextYearAnnualFees,
    notionalRent: familyConfig?.notionalRent ?? 0,
    utilityCosts: familyConfig?.utilityCosts ?? 0,
    foodCosts: familyConfig?.foodCosts ?? 0,
    councilTax,
    familyTypeConfigs,
    schoolFeesMap: schoolFeesMap as Record<School, number>,
  };
}

// ─── Admin Settings Queries ───────────────────────────────────────────────────

/**
 * Returns ALL FamilyTypeConfig rows (all versions, all categories).
 * Ordered by category asc, effectiveFrom desc so newest per category comes first.
 */
export async function getAllFamilyTypeConfigs(tx: Tx): Promise<FamilyTypeConfigRow[]> {
  // createdAt desc tie-break keeps newest-per-category first on same-day edits.
  const rows = await tx.familyTypeConfig.findMany({
    orderBy: [
      { category: "asc" },
      { effectiveFrom: "desc" },
      { createdAt: "desc" },
    ],
  });

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    description: row.description,
    notionalRent: Number(row.notionalRent),
    utilityCosts: Number(row.utilityCosts),
    foodCosts: Number(row.foodCosts),
    effectiveFrom: row.effectiveFrom,
  }));
}

/**
 * Returns ALL SchoolFees rows (all versions, all schools).
 * Ordered by school asc, effectiveFrom desc.
 */
export async function getAllSchoolFees(tx: Tx): Promise<SchoolFeesRow[]> {
  // createdAt desc tie-break keeps newest-per-school first on same-day edits.
  const rows = await tx.schoolFees.findMany({
    orderBy: [
      { school: "asc" },
      { effectiveFrom: "desc" },
      { createdAt: "desc" },
    ],
  });

  return rows.map((row) => ({
    id: row.id,
    school: row.school,
    annualFees: Number(row.annualFees),
    effectiveFrom: row.effectiveFrom,
  }));
}

// ─── Reason Codes ─────────────────────────────────────────────────────────────

export interface ReasonCodeRow {
  id: string;
  code: number;
  label: string;
  isDeprecated: boolean;
  sortOrder: number;
  createdAt: Date;
}

/**
 * Returns ALL reason codes including deprecated ones.
 * Ordered by sortOrder ascending.
 */
export async function getAllReasonCodes(tx: Tx): Promise<ReasonCodeRow[]> {
  const rows = await tx.reasonCode.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    isDeprecated: row.isDeprecated,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  }));
}

// ─── Close Reasons ────────────────────────────────────────────────────────────

export interface CloseReasonRow {
  id: string;
  label: string;
  purgeOnClose: boolean;
  isDeprecated: boolean;
  sortOrder: number;
  createdAt: Date;
}

/**
 * Returns ALL close reasons including deprecated ones.
 * Ordered by sortOrder ascending.
 */
export async function getAllCloseReasons(tx: Tx): Promise<CloseReasonRow[]> {
  const rows = await tx.closeReason.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    purgeOnClose: row.purgeOnClose,
    isDeprecated: row.isDeprecated,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  }));
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export interface EmailTemplateRow {
  id: string;
  type: EmailTemplateType | null;
  name: string | null;
  isSystem: boolean;
  subject: string;
  body: string;
  enabled: boolean;
  mergeFields: string[];
  updatedAt: Date;
}

/**
 * Returns all non-deleted email templates: system templates first (ordered by
 * type, matching the fixed EmailTemplateType enum order used elsewhere),
 * then custom templates ordered by name. Soft-deleted custom templates
 * (`deletedAt` set) are excluded — see Story 9.4.
 */
export async function getAllEmailTemplates(tx: Tx): Promise<EmailTemplateRow[]> {
  const rows = await tx.emailTemplate.findMany({
    where: { deletedAt: null },
    orderBy: [{ isSystem: "desc" }, { type: "asc" }, { name: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    isSystem: row.isSystem,
    subject: row.subject,
    body: row.body,
    enabled: row.enabled,
    mergeFields: Array.isArray(row.mergeFields) ? (row.mergeFields as string[]) : [],
    updatedAt: row.updatedAt,
  }));
}

/**
 * Returns the current council tax default (most recent effectiveFrom).
 */
export async function getCouncilTaxRate(tx: Tx): Promise<CouncilTaxDefaultRow | null> {
  return getCouncilTaxDefault(tx);
}

// ─── CALC-01 — Notional & profiling reference tables ─────────────────────
//
// NotionalCostConfig and FamilyCategoryMeta are versioned PER natural key
// (category [+ costType]), like FamilyTypeConfig above — "latest effective"
// means the newest row per key.
//
// The six band tables (AffordabilityBand, IncomeCategoryBand,
// PropertyEquityBand, FinancialEquityBand, DebtRatioBand,
// LifestyleSqueezeBand) are versioned as a WHOLE GENERATION: every row of a
// table is seeded with the same `effectiveFrom`, so "latest effective" means
// "all rows sharing the newest effectiveFrom present" — `latestGeneration`
// below implements that once and every band-table getter reuses it. Band
// RESOLUTION (value → row) is pure and lives in
// `src/lib/assessment/reference-bands.ts`; these getters only fetch rows.

/** Picks the rows belonging to the newest `effectiveFrom` in a list (a "generation"). */
function latestGeneration<T extends { effectiveFrom: Date }>(rows: readonly T[]): T[] {
  if (rows.length === 0) return [];
  const newest = rows.reduce((max, r) => (r.effectiveFrom > max ? r.effectiveFrom : max), rows[0].effectiveFrom);
  return rows.filter((r) => r.effectiveFrom.getTime() === newest.getTime());
}

export interface NotionalCostConfigRow {
  id: string;
  category: number;
  costType: import("@prisma/client").NotionalCostType;
  amount: number;
  effectiveFrom: Date;
}

/** Returns the most recent NotionalCostConfig row per (category, costType). */
export async function getNotionalCostConfigs(tx: Tx): Promise<NotionalCostConfigRow[]> {
  const rows = await tx.notionalCostConfig.findMany({
    orderBy: [{ category: "asc" }, { costType: "asc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  const seen = new Set<string>();
  const result: NotionalCostConfigRow[] = [];
  for (const row of rows) {
    const key = `${row.category}:${row.costType}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        id: row.id,
        category: row.category,
        costType: row.costType,
        amount: Number(row.amount),
        effectiveFrom: row.effectiveFrom,
      });
    }
  }
  return result;
}

export interface FamilyCategoryMetaRow {
  id: string;
  category: number;
  familyMembers: number;
  schoolAgeChildren: number;
  description: string;
  effectiveFrom: Date;
}

/** Returns the most recent FamilyCategoryMeta row per category. */
export async function getFamilyCategoryMetas(tx: Tx): Promise<FamilyCategoryMetaRow[]> {
  const rows = await tx.familyCategoryMeta.findMany({
    orderBy: [{ category: "asc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  const seen = new Set<number>();
  const result: FamilyCategoryMetaRow[] = [];
  for (const row of rows) {
    if (!seen.has(row.category)) {
      seen.add(row.category);
      result.push({
        id: row.id,
        category: row.category,
        familyMembers: row.familyMembers,
        schoolAgeChildren: row.schoolAgeChildren,
        description: row.description,
        effectiveFrom: row.effectiveFrom,
      });
    }
  }
  return result;
}

export interface AffordabilityBandRow {
  id: string;
  bandFloor: number;
  bandCeiling: number;
  basePct: number;
  effectiveFrom: Date;
}

/** Returns every row of the newest AffordabilityBand generation, floor ascending. */
export async function getAffordabilityBands(tx: Tx): Promise<AffordabilityBandRow[]> {
  const rows = await tx.affordabilityBand.findMany({ orderBy: { bandFloor: "asc" } });
  return latestGeneration(
    rows.map((r) => ({
      id: r.id,
      bandFloor: Number(r.bandFloor),
      bandCeiling: Number(r.bandCeiling),
      basePct: Number(r.basePct),
      effectiveFrom: r.effectiveFrom,
    })),
  ).sort((a, b) => a.bandFloor - b.bandFloor);
}

export interface IncomeCategoryBandRow {
  id: string;
  bandFloor: number | null;
  bandCeiling: number | null;
  category: number;
  feesBenchmarkPct: number;
  effectiveFrom: Date;
}

/** Returns every row of the newest IncomeCategoryBand generation. */
export async function getIncomeCategoryBands(tx: Tx): Promise<IncomeCategoryBandRow[]> {
  const rows = await tx.incomeCategoryBand.findMany();
  return latestGeneration(
    rows.map((r) => ({
      id: r.id,
      bandFloor: r.bandFloor === null ? null : Number(r.bandFloor),
      bandCeiling: r.bandCeiling === null ? null : Number(r.bandCeiling),
      category: r.category,
      feesBenchmarkPct: Number(r.feesBenchmarkPct),
      effectiveFrom: r.effectiveFrom,
    })),
  );
}

export interface PropertyEquityBandRow {
  id: string;
  bandFloor: number | null;
  bandCeiling: number | null;
  category: number;
  effectiveFrom: Date;
}

/** Returns every row of the newest PropertyEquityBand generation. */
export async function getPropertyEquityBands(tx: Tx): Promise<PropertyEquityBandRow[]> {
  const rows = await tx.propertyEquityBand.findMany();
  return latestGeneration(
    rows.map((r) => ({
      id: r.id,
      bandFloor: r.bandFloor === null ? null : Number(r.bandFloor),
      bandCeiling: r.bandCeiling === null ? null : Number(r.bandCeiling),
      category: r.category,
      effectiveFrom: r.effectiveFrom,
    })),
  );
}

export interface FinancialEquityBandRow {
  id: string;
  bandFloor: number | null;
  bandCeiling: number | null;
  label: string;
  effectiveFrom: Date;
}

/** Returns every row of the newest FinancialEquityBand generation. */
export async function getFinancialEquityBands(tx: Tx): Promise<FinancialEquityBandRow[]> {
  const rows = await tx.financialEquityBand.findMany();
  return latestGeneration(
    rows.map((r) => ({
      id: r.id,
      bandFloor: r.bandFloor === null ? null : Number(r.bandFloor),
      bandCeiling: r.bandCeiling === null ? null : Number(r.bandCeiling),
      label: r.label,
      effectiveFrom: r.effectiveFrom,
    })),
  );
}

export interface DebtRatioBandRow {
  id: string;
  ratioFloor: number | null;
  ratioCeiling: number | null;
  minRepaymentMonths: number | null;
  statusLabel: string;
  effectiveFrom: Date;
}

/** Returns every row of the newest DebtRatioBand generation. */
export async function getDebtRatioBands(tx: Tx): Promise<DebtRatioBandRow[]> {
  const rows = await tx.debtRatioBand.findMany();
  return latestGeneration(
    rows.map((r) => ({
      id: r.id,
      ratioFloor: r.ratioFloor === null ? null : Number(r.ratioFloor),
      ratioCeiling: r.ratioCeiling === null ? null : Number(r.ratioCeiling),
      minRepaymentMonths: r.minRepaymentMonths,
      statusLabel: r.statusLabel,
      effectiveFrom: r.effectiveFrom,
    })),
  );
}

export interface LifestyleSqueezeBandRow {
  id: string;
  ratioFloor: number | null;
  ratioCeiling: number | null;
  statusLabel: string;
  effectiveFrom: Date;
}

/** Returns every row of the newest LifestyleSqueezeBand generation. */
export async function getLifestyleSqueezeBands(tx: Tx): Promise<LifestyleSqueezeBandRow[]> {
  const rows = await tx.lifestyleSqueezeBand.findMany();
  return latestGeneration(
    rows.map((r) => ({
      id: r.id,
      ratioFloor: r.ratioFloor === null ? null : Number(r.ratioFloor),
      ratioCeiling: r.ratioCeiling === null ? null : Number(r.ratioCeiling),
      statusLabel: r.statusLabel,
      effectiveFrom: r.effectiveFrom,
    })),
  );
}
