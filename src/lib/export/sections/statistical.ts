/**
 * Export Section 3 rows (Epic 23 T4): one row per assessment matching the
 * filters. Every value comes from the stored assessment snapshot and its
 * recommendation, the same columns the assessment and recommendation pages
 * show, so the sheet matches the screen. `mapStatisticalRow` is pure.
 */

import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import type { ExportRecord } from "@/lib/export/columns";
import { resolveNextYearFees } from "@/lib/assessment/recommendation-v2";
import {
  applicationTypeLabel,
  awardFundLabel,
  codeLabels,
  flattenSiblings,
  inSystemOnly,
  num,
  parentCount,
  postcodeOutward,
  schoolLabel,
  schoolYearNumber,
  v2Only,
} from "@/lib/export/fields";
import { assessmentWhere, type AssessmentFilters } from "./filters";

export const STATISTICAL_SELECT = {
  id: true,
  calculationVersion: true,
  completedAt: true,
  assessmentSchool: true,
  entrySchoolYear: true,
  scholarshipPct: true,
  familyTypeCategory: true,
  schoolingYearsRemaining: true,
  postcode: true,
  incomeCategory: true,
  propertyCategoryDerived: true,
  propertyEquityCategory: true,
  financialEquityLabel: true,
  debtOverNdiRatio: true,
  debtStatusLabel: true,
  lifestyleSqueezeRatio: true,
  lifestyleSqueezeLabel: true,
  siblingDetails: true,
  annualFees: true,
  nextYearAnnualFees: true,
  bursaryAward: true,
  yearlyPayableFees: true,
  monthlyPayableFees: true,
  awardFundType: true,
  property: { select: { schoolAgeChildrenCount: true } },
  earners: { select: { earnerLabel: true } },
  application: {
    select: {
      applicationType: true,
      school: true,
      entryYearGroup: true,
      migrationSource: true,
      round: { select: { academicYear: true } },
    },
  },
  recommendation: {
    select: {
      scholarshipSpendBeforeVat: true,
      bursarySpendBeforeVat: true,
      netFeesBeforeVat: true,
      yearlyPayableFees: true,
      monthlyPayableFees: true,
      reasonCodes: {
        select: { reasonCode: { select: { code: true, label: true } } },
        orderBy: { reasonCode: { sortOrder: "asc" } },
      },
    },
  },
} satisfies Prisma.AssessmentSelect;

export type StatisticalSource = Prisma.AssessmentGetPayload<{ select: typeof STATISTICAL_SELECT }>;

/** One assessment → one Section 3 row. Pure. */
export function mapStatisticalRow(a: StatisticalSource): ExportRecord {
  const v = a.calculationVersion;
  const app = a.application;
  const rec = a.recommendation;
  const sib = flattenSiblings(a.siblingDetails);
  const fees = resolveNextYearFees({ nextYearAnnualFees: num(a.nextYearAnnualFees), annualFees: num(a.annualFees) });
  return {
    applicationType: applicationTypeLabel(app.applicationType),
    round: app.round.academicYear,
    completedAt: a.completedAt,
    academicYear: app.round.academicYear,
    school: schoolLabel(a.assessmentSchool ?? app.school),
    schoolYear: schoolYearNumber(app.entryYearGroup),

    entrySchoolYear: a.entrySchoolYear,
    recipientScholarship: num(a.scholarshipPct),
    familyCategory: a.familyTypeCategory,
    remainingYears: a.schoolingYearsRemaining,
    schoolAgeChildren: inSystemOnly(app.migrationSource, a.property?.schoolAgeChildrenCount ?? null),
    parents: inSystemOnly(app.migrationSource, a.earners.length ? parentCount(a.earners) : null),
    postcode: postcodeOutward(a.postcode),

    incomeCategory: v2Only(v, a.incomeCategory),
    propertyCategory: v2Only(v, a.propertyCategoryDerived),
    propertyEquityCategory: v2Only(v, a.propertyEquityCategory),
    financialEquity: v2Only(v, a.financialEquityLabel),
    debtOverNdi: v2Only(v, num(a.debtOverNdiRatio)),
    debtStatus: v2Only(v, a.debtStatusLabel),
    squeezeRatio: v2Only(v, num(a.lifestyleSqueezeRatio)),
    squeezeStatus: v2Only(v, a.lifestyleSqueezeLabel),

    sibling1School: sib[0].school,
    sibling1Fees: sib[0].payableFees,
    sibling2School: sib[1].school,
    sibling2Fees: sib[1].payableFees,
    sibling3School: sib[2].school,
    sibling3Fees: sib[2].payableFees,

    nextYearFees: fees.fees || null,
    scholarshipPct: num(a.scholarshipPct),
    scholarshipSpend: v2Only(v, num(rec?.scholarshipSpendBeforeVat)),
    // On v1 `bursaryAward` held a percentage; only v2 has a £-before-VAT figure.
    bursarySpend: v2Only(v, num(rec?.bursarySpendBeforeVat) ?? num(a.bursaryAward)),
    netFees: v2Only(v, num(rec?.netFeesBeforeVat)),
    yearlyPayable: num(rec?.yearlyPayableFees) ?? num(a.yearlyPayableFees),
    monthlyPayable: num(rec?.monthlyPayableFees) ?? num(a.monthlyPayableFees),
    reasonCodes: codeLabels((rec?.reasonCodes ?? []).map((r) => r.reasonCode)),
    awardType: awardFundLabel(a.awardFundType),
  };
}

const PAGE = 500;

/** Every assessment matching the filters, paged so a large round never loads in one query. */
export async function buildStatisticalRows(tx: Tx, filters: AssessmentFilters): Promise<ExportRecord[]> {
  const where = assessmentWhere(filters);
  const out: ExportRecord[] = [];
  for (let skip = 0; ; skip += PAGE) {
    const page = await tx.assessment.findMany({
      where,
      select: STATISTICAL_SELECT,
      orderBy: [{ application: { reference: "asc" } }, { id: "asc" }],
      skip,
      take: PAGE,
    });
    out.push(...page.map(mapStatisticalRow));
    if (page.length < PAGE) break;
  }
  return out;
}
