/**
 * Recommendation database queries.
 * Handles CRUD for Recommendation, ReasonCode, and RecommendationReasonCode.
 */

import type { Tx } from "@/lib/db/prisma";
import type { Recommendation, ReasonCode, GapReason } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendationWithReasonCodes = Recommendation & {
  reasonCodes: { reasonCode: ReasonCode }[];
  /** CALC-08 — reasons-for-gap junction (v2 recommendations only). */
  gapReasons: { gapReason: GapReason }[];
};

export interface UpsertRecommendationInput {
  roundId: string;
  bursaryAccountId?: string | null;
  familySynopsis?: string | null;
  accommodationStatus?: string | null;
  incomeCategory?: string | null;
  propertyCategory?: number | null;
  bursaryAward?: number | null;
  /** Distinct merit/academic scholarship award (£), Epic 08 / D9. */
  scholarshipAward?: number | null;
  yearlyPayableFees?: number | null;
  monthlyPayableFees?: number | null;
  dishonestyFlag?: boolean;
  creditRiskFlag?: boolean;
  summary?: string | null;
  reasonCodeIds?: string[];

  // ── CALC-08 — v2 min-of-three award + gap tracking (nullable/additive) ──────
  recommendedPayableFees?: number | null;
  confirmedPayableFees?: number | null;
  gapAmount?: number | null;
  lastPayableFees?: number | null;
  scholarshipValueInclVat?: number | null;
  bursarySpendBeforeVat?: number | null;
  /** Reasons-for-gap selection (required ≥1 when the gap is material — CALC-08). */
  gapReasonIds?: string[];
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the Recommendation for the given assessment, including all linked
 * reason codes. Returns null if no recommendation exists yet.
 */
export async function getRecommendation(
  tx: Tx,
  assessmentId: string
): Promise<RecommendationWithReasonCodes | null> {
  return tx.recommendation.findUnique({
    where: { assessmentId },
    include: {
      reasonCodes: {
        include: { reasonCode: true },
        orderBy: { reasonCode: { sortOrder: "asc" } },
      },
      gapReasons: {
        include: { gapReason: true },
        orderBy: { gapReason: { sortOrder: "asc" } },
      },
    },
  });
}

/**
 * Creates or updates the Recommendation for the given assessment.
 * Replaces all reason-code links in the same transaction (the caller's).
 */
export async function upsertRecommendation(
  tx: Tx,
  assessmentId: string,
  data: UpsertRecommendationInput
): Promise<RecommendationWithReasonCodes> {
  const { reasonCodeIds = [], gapReasonIds = [], ...fields } = data;

  // CALC-08 — v2 award + gap columns. Shared by create/update; every field is
  // nullable/additive, so a v1 save (which never supplies them) leaves them null.
  const v2Fields = {
    recommendedPayableFees: fields.recommendedPayableFees ?? null,
    confirmedPayableFees: fields.confirmedPayableFees ?? null,
    gapAmount: fields.gapAmount ?? null,
    lastPayableFees: fields.lastPayableFees ?? null,
    scholarshipValueInclVat: fields.scholarshipValueInclVat ?? null,
    bursarySpendBeforeVat: fields.bursarySpendBeforeVat ?? null,
  };

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
      scholarshipAward: fields.scholarshipAward ?? null,
      yearlyPayableFees: fields.yearlyPayableFees ?? null,
      monthlyPayableFees: fields.monthlyPayableFees ?? null,
      dishonestyFlag: fields.dishonestyFlag ?? false,
      creditRiskFlag: fields.creditRiskFlag ?? false,
      summary: fields.summary ?? null,
      ...v2Fields,
    },
    update: {
      familySynopsis: fields.familySynopsis ?? null,
      accommodationStatus: fields.accommodationStatus ?? null,
      incomeCategory: fields.incomeCategory ?? null,
      propertyCategory: fields.propertyCategory ?? null,
      bursaryAward: fields.bursaryAward ?? null,
      scholarshipAward: fields.scholarshipAward ?? null,
      yearlyPayableFees: fields.yearlyPayableFees ?? null,
      monthlyPayableFees: fields.monthlyPayableFees ?? null,
      dishonestyFlag: fields.dishonestyFlag ?? false,
      creditRiskFlag: fields.creditRiskFlag ?? false,
      summary: fields.summary ?? null,
      ...v2Fields,
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

  // Replace all gap-reason links (CALC-08). Same replace-in-place discipline as
  // reason codes; a v1 save passes no ids, so its junction stays empty.
  await tx.recommendationGapReason.deleteMany({
    where: { recommendationId: rec.id },
  });

  if (gapReasonIds.length > 0) {
    await tx.recommendationGapReason.createMany({
      data: gapReasonIds.map((gapReasonId) => ({
        recommendationId: rec.id,
        gapReasonId,
      })),
      skipDuplicates: true,
    });
  }

  // Return fresh record with relations
  const updated = await tx.recommendation.findUniqueOrThrow({
    where: { id: rec.id },
    include: {
      reasonCodes: {
        include: { reasonCode: true },
        orderBy: { reasonCode: { sortOrder: "asc" } },
      },
      gapReasons: {
        include: { gapReason: true },
        orderBy: { gapReason: { sortOrder: "asc" } },
      },
    },
  });

  return updated;
}

/**
 * Returns all active (non-deprecated) reason codes, sorted by sortOrder.
 */
export async function getReasonCodes(tx: Tx): Promise<ReasonCode[]> {
  return tx.reasonCode.findMany({
    where: { isDeprecated: false },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * CALC-08 — all active (non-deprecated) gap reasons, sorted by sortOrder.
 * Mirrors `getReasonCodes`; the picker never offers a retired one for a NEW
 * selection (historic ones are merged back in via `mergeHistoricReasonCodeOptions`).
 */
export async function getGapReasons(tx: Tx): Promise<GapReason[]> {
  return tx.gapReason.findMany({
    where: { isDeprecated: false },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * CALC-08 — the previous recommendation's payable-fees figures for a rolling
 * bursary account, used to pre-fill `lastPayableFees` on a re-assessment's v2
 * recommendation. Finds the most recent application on the account in a
 * DIFFERENT round that carries a recommendation. Returns `null` for a first
 * assessment (no prior recommendation). Selection of which figure to use is
 * `selectLastPayableFees` (`@/lib/assessment/recommendation-v2`).
 */
export async function getLastRecommendationPayable(
  tx: Tx,
  bursaryAccountId: string,
  currentRoundId: string
): Promise<{
  confirmedPayableFees: number | null;
  recommendedPayableFees: number | null;
  yearlyPayableFees: number | null;
} | null> {
  const previous = await tx.application.findFirst({
    where: {
      bursaryAccountId,
      roundId: { not: currentRoundId },
      assessment: { recommendation: { isNot: null } },
    },
    orderBy: { submittedAt: "desc" },
    select: {
      assessment: {
        select: {
          recommendation: {
            select: {
              confirmedPayableFees: true,
              recommendedPayableFees: true,
              yearlyPayableFees: true,
            },
          },
        },
      },
    },
  });

  const rec = previous?.assessment?.recommendation;
  if (!rec) return null;

  const toNum = (v: unknown): number | null =>
    v == null ? null : Number(v);

  return {
    confirmedPayableFees: toNum(rec.confirmedPayableFees),
    recommendedPayableFees: toNum(rec.recommendedPayableFees),
    yearlyPayableFees: toNum(rec.yearlyPayableFees),
  };
}
