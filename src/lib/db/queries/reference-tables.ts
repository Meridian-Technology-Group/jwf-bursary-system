/**
 * Reference table database queries.
 * Used by the assessment form to auto-populate default values,
 * and by the admin settings page for full reference data management.
 */

import { prisma } from "@/lib/db/prisma";
import type { School, EmailTemplateType } from "@prisma/client";

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
export async function getFamilyTypeConfigs(): Promise<FamilyTypeConfigRow[]> {
  // Fetch all configs ordered by category + effectiveFrom desc, then deduplicate
  const rows = await prisma.familyTypeConfig.findMany({
    orderBy: [{ category: "asc" }, { effectiveFrom: "desc" }],
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
export async function getSchoolFees(): Promise<SchoolFeesRow[]> {
  const rows = await prisma.schoolFees.findMany({
    orderBy: [{ school: "asc" }, { effectiveFrom: "desc" }],
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
export async function getCouncilTaxDefault(): Promise<CouncilTaxDefaultRow | null> {
  const row = await prisma.councilTaxDefault.findFirst({
    orderBy: { effectiveFrom: "desc" },
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
  annualFees: number;
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
 */
export async function getConfigsForAssessment(
  school: School,
  familyTypeCategory?: number
): Promise<AssessmentReferenceConfigs> {
  const [familyTypeConfigs, schoolFees, councilTaxDefault] = await Promise.all([
    getFamilyTypeConfigs(),
    getSchoolFees(),
    getCouncilTaxDefault(),
  ]);

  // Build school fees map
  const schoolFeesMap: Record<string, number> = {};
  for (const sf of schoolFees) {
    schoolFeesMap[sf.school] = sf.annualFees;
  }

  const annualFees = schoolFeesMap[school] ?? 0;
  const councilTax = councilTaxDefault?.amount ?? 2480;

  // Find the matching family type config (default to category 1)
  const category = familyTypeCategory ?? 1;
  const familyConfig =
    familyTypeConfigs.find((c) => c.category === category) ?? familyTypeConfigs[0];

  return {
    annualFees,
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
export async function getAllFamilyTypeConfigs(): Promise<FamilyTypeConfigRow[]> {
  const rows = await prisma.familyTypeConfig.findMany({
    orderBy: [{ category: "asc" }, { effectiveFrom: "desc" }],
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
export async function getAllSchoolFees(): Promise<SchoolFeesRow[]> {
  const rows = await prisma.schoolFees.findMany({
    orderBy: [{ school: "asc" }, { effectiveFrom: "desc" }],
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
export async function getAllReasonCodes(): Promise<ReasonCodeRow[]> {
  const rows = await prisma.reasonCode.findMany({
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

// ─── Email Templates ──────────────────────────────────────────────────────────

export interface EmailTemplateRow {
  id: string;
  type: EmailTemplateType;
  subject: string;
  body: string;
  mergeFields: string[];
  updatedAt: Date;
}

/**
 * Returns all email templates ordered by type.
 */
export async function getAllEmailTemplates(): Promise<EmailTemplateRow[]> {
  const rows = await prisma.emailTemplate.findMany({
    orderBy: { type: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    subject: row.subject,
    body: row.body,
    mergeFields: Array.isArray(row.mergeFields) ? (row.mergeFields as string[]) : [],
    updatedAt: row.updatedAt,
  }));
}

/**
 * Returns the current council tax default (most recent effectiveFrom).
 */
export async function getCouncilTaxRate(): Promise<CouncilTaxDefaultRow | null> {
  return getCouncilTaxDefault();
}
