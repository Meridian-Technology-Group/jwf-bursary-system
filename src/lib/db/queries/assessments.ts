/**
 * Assessment database queries.
 * Handles CRUD for Assessment, AssessmentEarner, and AssessmentProperty.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  Assessment,
  AssessmentEarner,
  AssessmentProperty,
  AssessmentChecklist,
  EarnerLabel,
  EmploymentStatus,
  AssessmentStatus,
} from "@prisma/client";

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

  // Status
  status?: AssessmentStatus;

  // Relations
  earners?: EarnerSaveInput[];
  property?: PropertySaveInput;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the full assessment for an application, including earners, property,
 * and checklists. Returns null if no assessment exists yet.
 */
export async function getAssessment(
  applicationId: string
): Promise<AssessmentWithRelations | null> {
  return prisma.assessment.findUnique({
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
 */
export async function createAssessment(
  applicationId: string,
  assessorId: string
): Promise<AssessmentWithRelations> {
  const assessment = await prisma.assessment.create({
    data: {
      applicationId,
      assessorId,
      status: "NOT_STARTED",
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
  assessmentId: string,
  data: AssessmentSaveInput
): Promise<AssessmentWithRelations> {
  const { earners, property, ...assessmentFields } = data;

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
  if (assessmentFields.status !== undefined)
    updateData.status = assessmentFields.status;

  // Run all mutations in a transaction
  await prisma.$transaction(async (tx) => {
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
  });

  // Return the updated assessment with relations
  const updated = await prisma.assessment.findUniqueOrThrow({
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
 */
export async function completeAssessment(
  assessmentId: string
): Promise<Assessment> {
  return prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}

/**
 * Marks an assessment as PAUSED.
 */
export async function pauseAssessment(
  assessmentId: string
): Promise<Assessment> {
  return prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: "PAUSED" },
  });
}
