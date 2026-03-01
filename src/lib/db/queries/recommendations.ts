/**
 * Recommendation database queries.
 * Handles CRUD for Recommendation, ReasonCode, and RecommendationReasonCode.
 */

import { prisma } from "@/lib/db/prisma";
import type { Recommendation, ReasonCode } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendationWithReasonCodes = Recommendation & {
  reasonCodes: { reasonCode: ReasonCode }[];
};

export interface UpsertRecommendationInput {
  roundId: string;
  bursaryAccountId?: string | null;
  familySynopsis?: string | null;
  accommodationStatus?: string | null;
  incomeCategory?: string | null;
  propertyCategory?: number | null;
  bursaryAward?: number | null;
  yearlyPayableFees?: number | null;
  monthlyPayableFees?: number | null;
  dishonestyFlag?: boolean;
  creditRiskFlag?: boolean;
  summary?: string | null;
  reasonCodeIds?: string[];
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the Recommendation for the given assessment, including all linked
 * reason codes. Returns null if no recommendation exists yet.
 */
export async function getRecommendation(
  assessmentId: string
): Promise<RecommendationWithReasonCodes | null> {
  return prisma.recommendation.findUnique({
    where: { assessmentId },
    include: {
      reasonCodes: {
        include: { reasonCode: true },
        orderBy: { reasonCode: { sortOrder: "asc" } },
      },
    },
  });
}

/**
 * Creates or updates the Recommendation for the given assessment.
 * Replaces all reason-code links in the same transaction.
 */
export async function upsertRecommendation(
  assessmentId: string,
  data: UpsertRecommendationInput
): Promise<RecommendationWithReasonCodes> {
  const { reasonCodeIds = [], ...fields } = data;

  const recommendation = await prisma.$transaction(async (tx) => {
    // Upsert the recommendation row
    const rec = await tx.recommendation.upsert({
      where: { assessmentId },
      create: {
        assessmentId,
        roundId: fields.roundId,
        bursaryAccountId: fields.bursaryAccountId ?? null,
        familySynopsis: fields.familySynopsis ?? null,
        accommodationStatus: fields.accommodationStatus ?? null,
        incomeCategory: fields.incomeCategory ?? null,
        propertyCategory: fields.propertyCategory ?? null,
        bursaryAward: fields.bursaryAward ?? null,
        yearlyPayableFees: fields.yearlyPayableFees ?? null,
        monthlyPayableFees: fields.monthlyPayableFees ?? null,
        dishonestyFlag: fields.dishonestyFlag ?? false,
        creditRiskFlag: fields.creditRiskFlag ?? false,
        summary: fields.summary ?? null,
      },
      update: {
        familySynopsis: fields.familySynopsis ?? null,
        accommodationStatus: fields.accommodationStatus ?? null,
        incomeCategory: fields.incomeCategory ?? null,
        propertyCategory: fields.propertyCategory ?? null,
        bursaryAward: fields.bursaryAward ?? null,
        yearlyPayableFees: fields.yearlyPayableFees ?? null,
        monthlyPayableFees: fields.monthlyPayableFees ?? null,
        dishonestyFlag: fields.dishonestyFlag ?? false,
        creditRiskFlag: fields.creditRiskFlag ?? false,
        summary: fields.summary ?? null,
      },
    });

    // Replace all reason-code links
    await tx.recommendationReasonCode.deleteMany({
      where: { recommendationId: rec.id },
    });

    if (reasonCodeIds.length > 0) {
      await tx.recommendationReasonCode.createMany({
        data: reasonCodeIds.map((reasonCodeId) => ({
          recommendationId: rec.id,
          reasonCodeId,
        })),
        skipDuplicates: true,
      });
    }

    return rec;
  });

  // Return fresh record with relations
  const updated = await prisma.recommendation.findUniqueOrThrow({
    where: { id: recommendation.id },
    include: {
      reasonCodes: {
        include: { reasonCode: true },
        orderBy: { reasonCode: { sortOrder: "asc" } },
      },
    },
  });

  return updated;
}

/**
 * Returns all active (non-deprecated) reason codes, sorted by sortOrder.
 */
export async function getReasonCodes(): Promise<ReasonCode[]> {
  return prisma.reasonCode.findMany({
    where: { isDeprecated: false },
    orderBy: { sortOrder: "asc" },
  });
}
