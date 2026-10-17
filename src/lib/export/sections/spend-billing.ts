/**
 * Export Section 2 rows — spend and billing (Epic 23 T8, decision 11). One
 * row per assessment matching the shared assessment filters (as Section 3).
 *
 * D-11: values that aren't stored are computed with the engine's own
 * helpers — Part 2 totals from the v2 `incomeDetail` JSON (never
 * `AssessmentEarner.totalIncome`/`benefitsIncluded`, unreliable on v2), total
 * debt = `totalPersonalDebt`, the rent add-back = `rentAddBackFor` with the
 * reference bundle loaded once per export. Everything else reads the stored
 * v2 snapshot, as the assessment and recommendation pages do. D-9/D-10 as
 * Section 3. `mapSpendBillingRow` is pure.
 */

import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import type { ExportRecord } from "@/lib/export/columns";
import type { AssessorIncomeRecord, DebtsRecord, PropertyAssetsRecord } from "@/types/assessment-v2";
import type { ReferenceBundle } from "@/lib/assessment/v2/types";
import { resolveNextYearFees } from "@/lib/assessment/recommendation-v2";
import {
  calculateEarnerBenefits,
  calculateEarnerIncome,
  calculateEarnerPayeIncome,
  calculateEarnerSelfEmployedIncome,
} from "@/lib/assessment/v2/income";
import { totalPersonalDebt } from "@/lib/assessment/v2/debt";
import { rentAddBackFor } from "@/lib/assessment/v2/notional-spend";
import { getFamilyCategoryMeta } from "@/lib/assessment/reference-bands";
import { getReferenceBundleRows } from "@/lib/db/queries/reference-tables";
import { resolveReferenceBundle } from "@/lib/assessment/v2/reference-bundle";
import { resolveChildNameParts } from "@/lib/applications/child-name";
import { mainGapReason, scholarshipAdjustedGap } from "@/lib/reason-codes/gap-metrics";
import {
  accountStateLabel,
  applicationTypeLabel,
  assessmentStatusLabel,
  awardFundLabel,
  codeLabels,
  flattenSiblings,
  inSystemOnly,
  money,
  num,
  postcodeAreaLabel,
  schoolLabel,
  schoolYearNumber,
  v2Only,
} from "@/lib/export/fields";
import type { PostcodeAreaRow } from "@/lib/assessment/postcode-area";
import { assessmentWhere, type AssessmentFilters } from "./filters";

export const SPEND_BILLING_SELECT = {
  id: true,
  calculationVersion: true,
  status: true,
  completedAt: true,
  assessmentSchool: true,
  entrySchoolYear: true,
  scholarshipPct: true,
  familyTypeCategory: true,
  schoolingYearsRemaining: true,
  postcode: true,
  synopsis: true,
  annualFees: true,
  nextYearAnnualFees: true,
  rentAddBackType: true,
  rentAddBackOverride: true,
  ndiAfterNotionalSpend: true,
  incomeCategory: true,
  propertyCategoryDerived: true,
  propertyEquityCategory: true,
  financialEquityLabel: true,
  derivedYearlyDebtRepayments: true,
  debtOverNdiRatio: true,
  debtStatusLabel: true,
  behindOnFees: true,
  lifestyleSqueezeRatio: true,
  lifestyleSqueezeLabel: true,
  siblingDetails: true,
  totalHouseholdNetIncome: true,
  actualRemainingDi: true,
  theoreticalBenchmarkDi: true,
  affordabilityAdjustedDi: true,
  bursaryAward: true,
  yearlyPayableFees: true,
  monthlyPayableFees: true,
  vatRate: true,
  awardFundType: true,
  property: {
    select: { schoolAgeChildrenCount: true, cashSavings: true, isasPepsShares: true, propertyAssets: true, debts: true },
  },
  earners: { select: { earnerLabel: true, incomeDetail: true } },
  application: {
    select: {
      applicationType: true,
      school: true,
      entryYearGroup: true,
      migrationSource: true,
      childName: true,
      childFirstName: true,
      childLastName: true,
      round: { select: { academicYear: true } },
      bursaryAccount: { select: { status: true } },
    },
  },
  recommendation: {
    select: {
      scholarshipSpendBeforeVat: true,
      bursarySpendBeforeVat: true,
      netFeesBeforeVat: true,
      yearlyPayableFees: true,
      monthlyPayableFees: true,
      gapAmount: true,
      reasonCodes: {
        select: { reasonCode: { select: { code: true, label: true } } },
        orderBy: { reasonCode: { sortOrder: "asc" } },
      },
      gapReasons: {
        select: { gapReason: { select: { code: true, label: true, rank: true, sortOrder: true } } },
        orderBy: { gapReason: { sortOrder: "asc" } },
      },
    },
  },
} satisfies Prisma.AssessmentSelect;

export type SpendBillingSource = Prisma.AssessmentGetPayload<{ select: typeof SPEND_BILLING_SELECT }>;

const sumBy = (earners: readonly AssessorIncomeRecord[], f: (e: AssessorIncomeRecord) => number) =>
  money(earners.reduce((t, e) => t + f(e), 0));

function incomeOf(e: { incomeDetail: unknown }): AssessorIncomeRecord | null {
  return e.incomeDetail && typeof e.incomeDetail === "object" ? (e.incomeDetail as AssessorIncomeRecord) : null;
}

/** Gap reasons, the main one first (Epic 21 #2), as "code – label". */
export function gapReasonsMainFirst(
  reasons: readonly { code: number; label: string; rank: number | null; sortOrder: number }[],
): string {
  const main = mainGapReason(reasons);
  const ordered = main ? [main, ...reasons.filter((r) => r !== main)] : [...reasons];
  return codeLabels(ordered);
}

/** One assessment → one Section 2 row. Pure; `ref` is null when the bundle is incomplete. */
export function mapSpendBillingRow(
  a: SpendBillingSource,
  ref: ReferenceBundle | null,
  areas?: readonly PostcodeAreaRow[],
): ExportRecord {
  const v = a.calculationVersion;
  const app = a.application;
  const rec = a.recommendation;
  const sib = flattenSiblings(a.siblingDetails);
  const assets = (a.property?.propertyAssets ?? {}) as PropertyAssetsRecord;
  const debts = (a.property?.debts ?? {}) as DebtsRecord;
  const p1 = a.earners.find((e) => e.earnerLabel === "PARENT_1");
  const p2 = a.earners.find((e) => e.earnerLabel === "PARENT_2");
  const records = a.earners.map(incomeOf).filter((r): r is AssessorIncomeRecord => r != null);
  const name = resolveChildNameParts(app);
  const fees = resolveNextYearFees({ nextYearAnnualFees: num(a.nextYearAnnualFees), annualFees: num(a.annualFees) });
  const category = a.familyTypeCategory;
  const meta = ref && category != null ? getFamilyCategoryMeta(ref.familyCategoryMetas, category) : null;
  let rentAddBack: number | null = null;
  if (v === 2 && ref && category != null && a.rentAddBackType) {
    try {
      rentAddBack = money(
        rentAddBackFor(
          { familyTypeCategory: category, rentAddBackType: a.rentAddBackType, rentAddBackOverride: num(a.rentAddBackOverride) },
          ref,
        ),
      );
    } catch {
      rentAddBack = null; // no notional rent configured for the category
    }
  }
  const gapAmount = num(rec?.gapAmount);

  return {
    bursaryAccount: accountStateLabel(app.bursaryAccount?.status),
    assessmentStatus: assessmentStatusLabel(a.status),
    applicationType: applicationTypeLabel(app.applicationType),
    round: app.round.academicYear,
    completedAt: a.completedAt,
    academicYear: app.round.academicYear,
    school: schoolLabel(a.assessmentSchool ?? app.school),
    schoolYear: schoolYearNumber(app.entryYearGroup),

    childFirstName: name.firstName,
    childLastName: name.lastName,
    recipientSchool: schoolLabel(a.assessmentSchool ?? app.school),
    entrySchoolYear: a.entrySchoolYear,
    recipientScholarship: num(a.scholarshipPct),
    part1Sibling1: sib[0].name,
    part1Sibling2: sib[1].name,
    part1Sibling3: sib[2].name,
    familyCategory: category,
    familyCategoryDescription: meta?.description ?? "",
    remainingYears: a.schoolingYearsRemaining,
    schoolAgeChildren: inSystemOnly(app.migrationSource, a.property?.schoolAgeChildrenCount ?? null),
    postcode: postcodeAreaLabel(a.postcode, areas),
    annualFees: num(a.annualFees),

    parent1Total: v2Only(v, p1 && incomeOf(p1) ? money(calculateEarnerIncome(incomeOf(p1)!)) : null),
    parent2Total: v2Only(v, p2 && incomeOf(p2) ? money(calculateEarnerIncome(incomeOf(p2)!)) : null),
    totalBenefits: v2Only(v, records.length ? sumBy(records, calculateEarnerBenefits) : null),
    totalSelfEmployed: v2Only(v, records.length ? sumBy(records, calculateEarnerSelfEmployedIncome) : null),
    totalPaye: v2Only(v, records.length ? sumBy(records, calculateEarnerPayeIncome) : null),

    totalSavings: v2Only(v, num(a.property?.isasPepsShares)),
    totalCash: v2Only(v, num(a.property?.cashSavings)),
    rentAddBack,
    ndiAfterNotionalSpend: v2Only(v, num(a.ndiAfterNotionalSpend)),
    incomeCategory: v2Only(v, a.incomeCategory),

    homeValue: v2Only(v, num(assets.home?.value)),
    homeMortgage: v2Only(v, num(assets.home?.mortgageBalance)),
    secondValue: v2Only(v, num(assets.second?.value)),
    secondMortgage: v2Only(v, num(assets.second?.mortgageBalance)),
    otherValue: v2Only(v, num(assets.other?.value)),
    otherMortgage: v2Only(v, num(assets.other?.mortgageBalance)),
    propertyCategory: v2Only(v, a.propertyCategoryDerived),
    propertyEquityCategory: v2Only(v, a.propertyEquityCategory),
    financialEquity: v2Only(v, a.financialEquityLabel),
    derivedYearlyDebtRepayments: v2Only(v, num(a.derivedYearlyDebtRepayments)),
    totalDebt: v2Only(v, a.property ? money(totalPersonalDebt(debts)) : null),
    debtOverNdi: v2Only(v, num(a.debtOverNdiRatio)),
    debtStatus: v2Only(v, a.debtStatusLabel),
    behindOnFees: a.behindOnFees == null ? "" : a.behindOnFees ? "Yes" : "No",
    squeezeRatio: v2Only(v, num(a.lifestyleSqueezeRatio)),
    squeezeStatus: v2Only(v, a.lifestyleSqueezeLabel),
    sibling1Name: sib[0].name,
    sibling1School: sib[0].school,
    sibling1Fees: sib[0].payableFees,
    sibling2Name: sib[1].name,
    sibling2School: sib[1].school,
    sibling2Fees: sib[1].payableFees,
    sibling3Name: sib[2].name,
    sibling3School: sib[2].school,
    sibling3Fees: sib[2].payableFees,

    householdNetIncome: num(a.totalHouseholdNetIncome),
    actualRemainingDi: v2Only(v, num(a.actualRemainingDi)),
    theoreticalBenchmarkDi: v2Only(v, num(a.theoreticalBenchmarkDi)),
    affordabilityAdjustedDi: v2Only(v, num(a.affordabilityAdjustedDi)),
    nextYearFees: fees.fees || null,
    scholarshipPct: num(a.scholarshipPct),
    scholarshipSpend: v2Only(v, num(rec?.scholarshipSpendBeforeVat)),
    bursarySpend: v2Only(v, num(rec?.bursarySpendBeforeVat) ?? num(a.bursaryAward)),
    netFees: v2Only(v, num(rec?.netFeesBeforeVat)),
    yearlyPayable: num(rec?.yearlyPayableFees) ?? num(a.yearlyPayableFees),
    monthlyPayable: num(rec?.monthlyPayableFees) ?? num(a.monthlyPayableFees),
    gap: v2Only(v, gapAmount),
    scholarshipAdjustedGap: v2Only(
      v,
      scholarshipAdjustedGap(gapAmount, num(rec?.scholarshipSpendBeforeVat), num(a.vatRate)),
    ),
    gapReasons: gapReasonsMainFirst((rec?.gapReasons ?? []).map((g) => g.gapReason)),
    reasonCodes: codeLabels((rec?.reasonCodes ?? []).map((r) => r.reasonCode)),
    synopsis: a.synopsis ?? "",
    awardType: awardFundLabel(a.awardFundType),
  };
}

const PAGE = 300;

export async function buildSpendBillingRows(tx: Tx, filters: AssessmentFilters): Promise<ExportRecord[]> {
  // D-11: the reference bundle once per export (family category description, rent add-back).
  const resolved = resolveReferenceBundle(await getReferenceBundleRows(tx));
  const ref = resolved.bundle;
  const where = assessmentWhere(filters);
  const areas = await tx.postcodeArea.findMany({ select: { district: true, area: true } });
  const out: ExportRecord[] = [];
  for (let skip = 0; ; skip += PAGE) {
    const page = await tx.assessment.findMany({
      where,
      select: SPEND_BILLING_SELECT,
      orderBy: [{ application: { reference: "asc" } }, { id: "asc" }],
      skip,
      take: PAGE,
    });
    out.push(...page.map((a) => mapSpendBillingRow(a, ref, areas)));
    if (page.length < PAGE) break;
  }
  return out;
}
