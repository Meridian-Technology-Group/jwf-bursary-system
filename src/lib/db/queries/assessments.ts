/**
 * Assessment database queries.
 * Handles CRUD for Assessment, AssessmentEarner, and AssessmentProperty.
 */

import type { Tx } from "@/lib/db/prisma";
import {
  ASSESSMENT_INITIAL_STATUS,
  completeAssessmentRow,
  pauseAssessmentRow,
} from "@/lib/applications/status";
import type {
  Assessment,
  AssessmentEarner,
  AssessmentProperty,
  AssessmentChecklist,
  EarnerLabel,
  EmploymentStatus,
  AssessmentStatus,
  RentAddBackType,
  Prisma,
} from "@prisma/client";
import type {
  AssessorIncomeRecord,
  PropertyAssetsRecord,
  DebtsRecord,
} from "@/types/assessment-v2";
import {
  buildYoyFinancialsTable,
  type YoyFinancialsInputRow,
  type YoyFinancialsTableRow,
} from "@/lib/assessment/yoy-financials";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssessmentWithRelations = Assessment & {
  earners: AssessmentEarner[];
  property: AssessmentProperty | null;
  checklists: AssessmentChecklist[];
};

export interface EarnerSaveInput {
  earnerLabel: EarnerLabel;
  employmentStatus: EmploymentStatus;
  netPay: number;
  netDividends: number;
  netSelfEmployedProfit: number;
  pensionAmount: number;
  benefitsIncluded: number;
  benefitsExcluded: number;
}

export interface PropertySaveInput {
  isMortgageFree: boolean;
  additionalPropertyCount: number;
  additionalPropertyIncome: number;
  cashSavings: number;
  isasPepsShares: number;
  schoolAgeChildrenCount: number;
  derivedSavingsAnnualTotal: number;
}

/**
 * CALC-07 — one v2 earner's captured record. `incomeDetail` is the
 * status-driven JSONB (`AssessorIncomeRecord`); the legacy numeric buckets are
 * NOT written for v2 earners (they stay at their column defaults) — the v2
 * income calc reads `incomeDetail`. `employmentStatus` is retained because the
 * column is non-null; the v2 form maps the dominant declared status onto it for
 * back-compat display only.
 */
export interface EarnerV2SaveInput {
  earnerLabel: EarnerLabel;
  employmentStatus: EmploymentStatus;
  incomeDetail: AssessorIncomeRecord;
}

/**
 * CALC-07 — v2 property/savings/debt capture. `propertyAssets` and `debts` are
 * the itemised JSONB records; the savings + school-age-children columns are the
 * existing v1 columns (reused unchanged). `isMortgageFree`/`additionalProperty*`
 * are left at defaults for v2 (superseded by `rentAddBackType` + `propertyAssets`).
 */
export interface PropertyV2SaveInput {
  propertyAssets: PropertyAssetsRecord;
  debts: DebtsRecord;
  cashSavings: number;
  isasPepsShares: number;
  schoolAgeChildrenCount: number;
  derivedSavingsAnnualTotal: number;
}

export interface AssessmentSaveInput {
  // Family / fees
  familyTypeCategory?: number;
  notionalRent?: number;
  utilityCosts?: number;
  foodCosts?: number;
  annualFees?: number;
  councilTax?: number;
  schoolingYearsRemaining?: number;

  // Fees
  scholarshipPct?: number;
  vatRate?: number;

  // Manual adjustment
  manualAdjustment?: number;
  manualAdjustmentReason?: string;

  // CALC-10 — "Assessor's wizard" forward-looking note (v2 form; see
  // watch-out-notes.ts for the next-assessment read path). `null` clears it.
  watchOutNotes?: string | null;

  // Flags
  dishonestyFlag?: boolean;
  creditRiskFlag?: boolean;

  // Stage calculation results (persisted on save)
  totalHouseholdNetIncome?: number;
  netAssetsYearlyValuation?: number;
  hndiAfterNs?: number;
  requiredBursary?: number;
  grossFees?: number;
  bursaryAward?: number;
  netYearlyFees?: number;
  yearlyPayableFees?: number;
  monthlyPayableFees?: number;

  // Epic 07 — next-year fee snapshot (null when no next-year fee is in play)
  nextYearAnnualFees?: number | null;
  nextYearYearlyPayableFees?: number | null;
  nextYearMonthlyPayableFees?: number | null;

  // Status
  status?: AssessmentStatus;

  // Relations (v1)
  earners?: EarnerSaveInput[];
  property?: PropertySaveInput;

  // ── CALC-07 — v2 notional toggles/inputs ──────────────────────────────────
  rentAddBackType?: RentAddBackType;
  multiPropertyRentAddBack?: boolean;
  councilTaxSupport?: boolean;
  usesCar?: boolean;
  usesPublicTransport?: boolean;
  feeInsuranceAnnual?: number;
  behindOnFees?: boolean;

  // ── CALC-07 — v2 snapshot columns (orchestrator output maps 1:1) ──────────
  notionalEssentials?: number;
  notionalCar?: number;
  notionalPublicTransport?: number;
  notionalJwfAllowance?: number;
  notionalSavingsBenchmark?: number;
  savingsTestNumber?: number;
  totalNotionalSpend?: number;
  ndiAfterNotionalSpend?: number;
  derivedYearlyDebtRepayments?: number;
  yearlyDebtExposure?: number;
  debtOverNdiRatio?: number;
  debtStatusLabel?: string | null;
  incomeCategory?: number | null;
  propertyCategoryDerived?: number | null;
  propertyEquityCategory?: number | null;
  financialEquityLabel?: string | null;
  lifestyleSqueezeRatio?: number | null;
  lifestyleSqueezeLabel?: string | null;
  actualRemainingDi?: number;
  theoreticalBenchmarkDi?: number;
  affordabilityAdjustedDi?: number;
  recommendedPayableFees?: number;

  // ── CALC-07 — v2 relations ────────────────────────────────────────────────
  earnersV2?: EarnerV2SaveInput[];
  propertyV2?: PropertyV2SaveInput;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the full assessment for an application, including earners, property,
 * and checklists. Returns null if no assessment exists yet.
 */
export async function getAssessment(
  tx: Tx,
  applicationId: string
): Promise<AssessmentWithRelations | null> {
  return tx.assessment.findUnique({
    where: { applicationId },
    include: {
      earners: { orderBy: { earnerLabel: "asc" } },
      property: true,
      checklists: { orderBy: { tab: "asc" } },
    },
  });
}

/**
 * Creates a new Assessment record with NOT_STARTED status.
 * Initialises empty earner records for PARENT_1 and PARENT_2.
 *
 * CALC-07: `calculationVersion` dispatches the engine — `1` = the abridged
 * 4-stage calculator (v1 form/engine, untouched), `2` = the full notional
 * model (v2 form + engine).
 *
 * CALC-08 CUTOVER: the default is now `2`. The recommendation screen became
 * v2-aware in this package (it branches on `calculationVersion` and reads the
 * v2 snapshot columns), so every NEW assessment is v2 end-to-end. In-flight
 * v1 assessments keep their `1` stamp and recompute/render identically. The
 * explicit parameter stays so tests can still exercise the v1 path directly.
 */
export async function createAssessment(
  tx: Tx,
  applicationId: string,
  assessorId: string,
  calculationVersion: number = 2
): Promise<AssessmentWithRelations> {
  const assessment = await tx.assessment.create({
    data: {
      applicationId,
      assessorId,
      calculationVersion,
      status: ASSESSMENT_INITIAL_STATUS,
      scholarshipPct: 0,
      vatRate: 20,
      manualAdjustment: 0,
    },
    include: {
      earners: true,
      property: true,
      checklists: true,
    },
  });

  return assessment;
}

/**
 * Saves assessment data including upserted earners and property.
 * Only updates fields that are explicitly provided (partial update).
 */
export async function saveAssessment(
  tx: Tx,
  assessmentId: string,
  data: AssessmentSaveInput
): Promise<AssessmentWithRelations> {
  const { earners, property, earnersV2, propertyV2, ...assessmentFields } = data;

  // Build the update payload — only defined fields
  const updateData: Record<string, unknown> = {};

  if (assessmentFields.familyTypeCategory !== undefined)
    updateData.familyTypeCategory = assessmentFields.familyTypeCategory;
  if (assessmentFields.notionalRent !== undefined)
    updateData.notionalRent = assessmentFields.notionalRent;
  if (assessmentFields.utilityCosts !== undefined)
    updateData.utilityCosts = assessmentFields.utilityCosts;
  if (assessmentFields.foodCosts !== undefined)
    updateData.foodCosts = assessmentFields.foodCosts;
  if (assessmentFields.annualFees !== undefined)
    updateData.annualFees = assessmentFields.annualFees;
  if (assessmentFields.councilTax !== undefined)
    updateData.councilTax = assessmentFields.councilTax;
  if (assessmentFields.schoolingYearsRemaining !== undefined)
    updateData.schoolingYearsRemaining = assessmentFields.schoolingYearsRemaining;
  if (assessmentFields.scholarshipPct !== undefined)
    updateData.scholarshipPct = assessmentFields.scholarshipPct;
  if (assessmentFields.vatRate !== undefined)
    updateData.vatRate = assessmentFields.vatRate;
  if (assessmentFields.manualAdjustment !== undefined)
    updateData.manualAdjustment = assessmentFields.manualAdjustment;
  if (assessmentFields.manualAdjustmentReason !== undefined)
    updateData.manualAdjustmentReason = assessmentFields.manualAdjustmentReason;
  if (assessmentFields.watchOutNotes !== undefined)
    updateData.watchOutNotes = assessmentFields.watchOutNotes;
  if (assessmentFields.dishonestyFlag !== undefined)
    updateData.dishonestyFlag = assessmentFields.dishonestyFlag;
  if (assessmentFields.creditRiskFlag !== undefined)
    updateData.creditRiskFlag = assessmentFields.creditRiskFlag;
  if (assessmentFields.totalHouseholdNetIncome !== undefined)
    updateData.totalHouseholdNetIncome = assessmentFields.totalHouseholdNetIncome;
  if (assessmentFields.netAssetsYearlyValuation !== undefined)
    updateData.netAssetsYearlyValuation = assessmentFields.netAssetsYearlyValuation;
  if (assessmentFields.hndiAfterNs !== undefined)
    updateData.hndiAfterNs = assessmentFields.hndiAfterNs;
  if (assessmentFields.requiredBursary !== undefined)
    updateData.requiredBursary = assessmentFields.requiredBursary;
  if (assessmentFields.grossFees !== undefined)
    updateData.grossFees = assessmentFields.grossFees;
  if (assessmentFields.bursaryAward !== undefined)
    updateData.bursaryAward = assessmentFields.bursaryAward;
  if (assessmentFields.netYearlyFees !== undefined)
    updateData.netYearlyFees = assessmentFields.netYearlyFees;
  if (assessmentFields.yearlyPayableFees !== undefined)
    updateData.yearlyPayableFees = assessmentFields.yearlyPayableFees;
  if (assessmentFields.monthlyPayableFees !== undefined)
    updateData.monthlyPayableFees = assessmentFields.monthlyPayableFees;
  // Epic 07 — next-year fee snapshot (explicit null is a valid "clear" write).
  if (assessmentFields.nextYearAnnualFees !== undefined)
    updateData.nextYearAnnualFees = assessmentFields.nextYearAnnualFees;
  if (assessmentFields.nextYearYearlyPayableFees !== undefined)
    updateData.nextYearYearlyPayableFees = assessmentFields.nextYearYearlyPayableFees;
  if (assessmentFields.nextYearMonthlyPayableFees !== undefined)
    updateData.nextYearMonthlyPayableFees = assessmentFields.nextYearMonthlyPayableFees;
  if (assessmentFields.status !== undefined)
    updateData.status = assessmentFields.status;

  // ── CALC-07 — v2 toggles + snapshot columns ───────────────────────────────
  // Every field is written only when explicitly provided (partial update), the
  // same discipline as the v1 fields above. A v1 save never sets any of these,
  // so v1 rows are byte-identical to before. `null` is a valid clear for the
  // nullable label/category fields.
  const v2ScalarKeys = [
    "rentAddBackType",
    "multiPropertyRentAddBack",
    "councilTaxSupport",
    "usesCar",
    "usesPublicTransport",
    "feeInsuranceAnnual",
    "behindOnFees",
    "notionalEssentials",
    "notionalCar",
    "notionalPublicTransport",
    "notionalJwfAllowance",
    "notionalSavingsBenchmark",
    "savingsTestNumber",
    "totalNotionalSpend",
    "ndiAfterNotionalSpend",
    "derivedYearlyDebtRepayments",
    "yearlyDebtExposure",
    "debtOverNdiRatio",
    "debtStatusLabel",
    "incomeCategory",
    "propertyCategoryDerived",
    "propertyEquityCategory",
    "financialEquityLabel",
    "lifestyleSqueezeRatio",
    "lifestyleSqueezeLabel",
    "actualRemainingDi",
    "theoreticalBenchmarkDi",
    "affordabilityAdjustedDi",
    "recommendedPayableFees",
  ] as const;
  for (const key of v2ScalarKeys) {
    const value = (assessmentFields as Record<string, unknown>)[key];
    if (value !== undefined) updateData[key] = value;
  }

  // All mutations execute within the caller's RLS-aware transaction.
  // Update assessment fields
  await tx.assessment.update({
    where: { id: assessmentId },
    data: updateData,
  });

  // Upsert earners
  if (earners && earners.length > 0) {
    for (const earner of earners) {
      const totalIncome =
        earner.netPay +
        earner.netDividends +
        earner.netSelfEmployedProfit +
        earner.pensionAmount +
        earner.benefitsIncluded;

      await tx.assessmentEarner.upsert({
        where: {
          assessmentId_earnerLabel: {
            assessmentId,
            earnerLabel: earner.earnerLabel,
          },
        },
        update: {
          employmentStatus: earner.employmentStatus,
          netPay: earner.netPay,
          netDividends: earner.netDividends,
          netSelfEmployedProfit: earner.netSelfEmployedProfit,
          pensionAmount: earner.pensionAmount,
          benefitsIncluded: earner.benefitsIncluded,
          benefitsExcluded: earner.benefitsExcluded,
          totalIncome,
        },
        create: {
          assessmentId,
          earnerLabel: earner.earnerLabel,
          employmentStatus: earner.employmentStatus,
          netPay: earner.netPay,
          netDividends: earner.netDividends,
          netSelfEmployedProfit: earner.netSelfEmployedProfit,
          pensionAmount: earner.pensionAmount,
          benefitsIncluded: earner.benefitsIncluded,
          benefitsExcluded: earner.benefitsExcluded,
          totalIncome,
        },
      });
    }
  }

  // Upsert property
  if (property) {
    await tx.assessmentProperty.upsert({
      where: { assessmentId },
      update: {
        isMortgageFree: property.isMortgageFree,
        additionalPropertyCount: property.additionalPropertyCount,
        additionalPropertyIncome: property.additionalPropertyIncome,
        cashSavings: property.cashSavings,
        isasPepsShares: property.isasPepsShares,
        schoolAgeChildrenCount: property.schoolAgeChildrenCount,
        derivedSavingsAnnualTotal: property.derivedSavingsAnnualTotal,
      },
      create: {
        assessmentId,
        isMortgageFree: property.isMortgageFree,
        additionalPropertyCount: property.additionalPropertyCount,
        additionalPropertyIncome: property.additionalPropertyIncome,
        cashSavings: property.cashSavings,
        isasPepsShares: property.isasPepsShares,
        schoolAgeChildrenCount: property.schoolAgeChildrenCount,
        derivedSavingsAnnualTotal: property.derivedSavingsAnnualTotal,
      },
    });
  }

  // ── CALC-07 — v2 earners (status-driven JSONB) ────────────────────────────
  // Writes `incomeDetail` per earner. The legacy numeric buckets are left at
  // their column defaults for v2 earners (the v2 income calc reads the JSONB);
  // `totalIncome` is set from the JSONB sum for a sensible back-compat display.
  if (earnersV2 && earnersV2.length > 0) {
    for (const earner of earnersV2) {
      const incomeDetailJson = earner.incomeDetail as unknown as Prisma.InputJsonValue;
      const totalIncome = Number(earner.incomeDetail.total ?? 0);
      await tx.assessmentEarner.upsert({
        where: {
          assessmentId_earnerLabel: {
            assessmentId,
            earnerLabel: earner.earnerLabel,
          },
        },
        update: {
          employmentStatus: earner.employmentStatus,
          incomeDetail: incomeDetailJson,
          totalIncome,
        },
        create: {
          assessmentId,
          earnerLabel: earner.earnerLabel,
          employmentStatus: earner.employmentStatus,
          incomeDetail: incomeDetailJson,
          totalIncome,
        },
      });
    }
  }

  // ── CALC-07 — v2 property/debt (itemised JSONB) ───────────────────────────
  if (propertyV2) {
    await tx.assessmentProperty.upsert({
      where: { assessmentId },
      update: {
        propertyAssets: propertyV2.propertyAssets as unknown as Prisma.InputJsonValue,
        debts: propertyV2.debts as unknown as Prisma.InputJsonValue,
        cashSavings: propertyV2.cashSavings,
        isasPepsShares: propertyV2.isasPepsShares,
        schoolAgeChildrenCount: propertyV2.schoolAgeChildrenCount,
        derivedSavingsAnnualTotal: propertyV2.derivedSavingsAnnualTotal,
      },
      create: {
        assessmentId,
        propertyAssets: propertyV2.propertyAssets as unknown as Prisma.InputJsonValue,
        debts: propertyV2.debts as unknown as Prisma.InputJsonValue,
        cashSavings: propertyV2.cashSavings,
        isasPepsShares: propertyV2.isasPepsShares,
        schoolAgeChildrenCount: propertyV2.schoolAgeChildrenCount,
        derivedSavingsAnnualTotal: propertyV2.derivedSavingsAnnualTotal,
      },
    });
  }

  // Return the updated assessment with relations
  const updated = await tx.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    include: {
      earners: { orderBy: { earnerLabel: "asc" } },
      property: true,
      checklists: { orderBy: { tab: "asc" } },
    },
  });

  return updated;
}

/**
 * Marks an assessment as COMPLETED and records the completion timestamp.
 * Routed through the central status service (validates the transition + owns
 * the write); returns the updated row to preserve the existing signature.
 */
export async function completeAssessment(
  tx: Tx,
  assessmentId: string
): Promise<Assessment> {
  const current = await tx.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: { status: true },
  });
  await completeAssessmentRow(tx, assessmentId, current.status);
  return tx.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
}

/**
 * Marks an assessment as PAUSED, persisting the default missing-docs deadline
 * (paused_until). Routed through the central status service; returns the
 * updated row to preserve the existing signature.
 */
export async function pauseAssessment(
  tx: Tx,
  assessmentId: string
): Promise<Assessment> {
  const current = await tx.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: { status: true },
  });
  await pauseAssessmentRow(tx, assessmentId, current.status);
  return tx.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
}

// ─── getYoyFinancialsRows (CALC-10) ─────────────────────────────────────────────

function decimalToNumber(
  value: Prisma.Decimal | string | number | null | undefined
): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : parseFloat(value.toString());
  return Number.isNaN(n) ? null : n;
}

/**
 * CALC-10 — YoY financials history table (read-only projection, no new write
 * path; implementation-plan.md §CALC-10). Loads every COMPLETED assessment
 * for the bursary account across applications/rounds and projects them
 * through the pure `buildYoyFinancialsTable`
 * (src/lib/assessment/yoy-financials.ts). Works for both
 * `calculationVersion` 1 and 2 rows — v1 rows simply carry null
 * property-equity/debt-exposure/squeeze-label cells (that module's
 * null-safety notes).
 */
export async function getYoyFinancialsRows(
  tx: Tx,
  bursaryAccountId: string
): Promise<YoyFinancialsTableRow[]> {
  const applications = await tx.application.findMany({
    where: {
      bursaryAccountId,
      assessment: { status: "COMPLETED" },
    },
    select: {
      id: true,
      reference: true,
      round: { select: { academicYear: true } },
      assessment: {
        select: {
          completedAt: true,
          totalHouseholdNetIncome: true,
          yearlyDebtExposure: true,
          lifestyleSqueezeLabel: true,
          property: {
            select: {
              cashSavings: true,
              isasPepsShares: true,
              propertyAssets: true,
            },
          },
        },
      },
    },
  });

  const rows: YoyFinancialsInputRow[] = applications
    .filter(
      (app): app is typeof app & { assessment: NonNullable<typeof app.assessment> } =>
        app.assessment !== null
    )
    .map((app) => ({
      applicationId: app.id,
      applicationReference: app.reference,
      academicYear: app.round.academicYear,
      completedAt: app.assessment.completedAt,
      totalHouseholdNetIncome: decimalToNumber(app.assessment.totalHouseholdNetIncome),
      cashSavings: decimalToNumber(app.assessment.property?.cashSavings ?? null),
      isasPepsShares: decimalToNumber(app.assessment.property?.isasPepsShares ?? null),
      propertyAssets:
        (app.assessment.property?.propertyAssets ?? null) as PropertyAssetsRecord | null,
      yearlyDebtExposure: decimalToNumber(app.assessment.yearlyDebtExposure),
      lifestyleSqueezeLabel: app.assessment.lifestyleSqueezeLabel,
    }));

  return buildYoyFinancialsTable(rows);
}
