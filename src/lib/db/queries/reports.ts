/**
 * Aggregate database queries for the admin dashboard and reports page.
 *
 * All Decimal fields are converted with Number() before returning so these
 * results are safe to pass from Server Components to Client Components.
 */

import { prisma } from "@/lib/db/prisma";
import { ApplicationStatus, AssessmentStatus, RoundStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardCounts {
  awaitingAssessment: number; // SUBMITTED + NOT_STARTED
  inProgress: number;         // PAUSED
  awaitingRecommendation: number; // assessment COMPLETED but no recommendation
  qualifies: number;
  doesNotQualify: number;
  round: {
    id: string;
    academicYear: string;
    closeDate: Date;
    status: RoundStatus;
  } | null;
}

export interface DashboardFeedItem {
  id: string;
  action: string;
  context: string | null;
  createdAt: Date;
  entityId: string | null;
  applicationReference: string | null;
  childName: string | null;
  userName: string | null;
}

export interface AwardBand {
  label: string;
  count: number;
  pct: number;
}

export interface SchoolComparisonRow {
  school: string;
  count: number;
  avgBursaryAwardPct: number;
  avgMonthlyFees: number;
}

export interface IncomeBandRow {
  label: string;
  count: number;
  pct: number;
}

export interface PropertyCategoryRow {
  category: number;
  count: number;
  pct: number;
}

export interface ReasonCodeFrequencyRow {
  code: number;
  label: string;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the active round (most recent OPEN), falling back to the most
 * recent round of any status. Returns null when no rounds exist.
 */
export async function getActiveRound() {
  const openRound = await prisma.round.findFirst({
    where: { status: RoundStatus.OPEN },
    orderBy: { openDate: "desc" },
    select: { id: true, academicYear: true, closeDate: true, status: true },
  });

  if (openRound) return openRound;

  return prisma.round.findFirst({
    orderBy: { openDate: "desc" },
    select: { id: true, academicYear: true, closeDate: true, status: true },
  });
}

// ─── getDashboardCounts ───────────────────────────────────────────────────────

/**
 * Returns counts for all 6 dashboard tiles scoped to the given round.
 * Also includes the round's basic metadata for the Active Round tile.
 */
export async function getDashboardCounts(
  roundId: string
): Promise<DashboardCounts> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true, academicYear: true, closeDate: true, status: true },
  });

  // Fetch all application statuses for the round in one query
  const applications = await prisma.application.findMany({
    where: { roundId },
    select: {
      id: true,
      status: true,
      assessment: {
        select: {
          id: true,
          status: true,
          recommendation: { select: { id: true } },
        },
      },
    },
  });

  let awaitingAssessment = 0;
  let inProgress = 0;
  let awaitingRecommendation = 0;
  let qualifies = 0;
  let doesNotQualify = 0;

  for (const app of applications) {
    if (
      app.status === ApplicationStatus.SUBMITTED ||
      app.status === ApplicationStatus.NOT_STARTED
    ) {
      awaitingAssessment++;
    } else if (app.status === ApplicationStatus.PAUSED) {
      inProgress++;
    } else if (app.status === ApplicationStatus.QUALIFIES) {
      qualifies++;
    } else if (app.status === ApplicationStatus.DOES_NOT_QUALIFY) {
      doesNotQualify++;
    }

    // Awaiting recommendation: assessment COMPLETED but no recommendation row
    if (
      app.assessment?.status === AssessmentStatus.COMPLETED &&
      !app.assessment.recommendation
    ) {
      awaitingRecommendation++;
    }
  }

  return {
    awaitingAssessment,
    inProgress,
    awaitingRecommendation,
    qualifies,
    doesNotQualify,
    round: round
      ? {
          id: round.id,
          academicYear: round.academicYear,
          closeDate: round.closeDate,
          status: round.status,
        }
      : null,
  };
}

// ─── getDashboardFeed ─────────────────────────────────────────────────────────

/**
 * Returns the most recent workflow-relevant audit events for the given round,
 * joined with application reference and child name where possible.
 *
 * Workflow-relevant actions are those relating to application lifecycle events.
 */
export async function getDashboardFeed(
  roundId: string,
  limit = 8
): Promise<DashboardFeedItem[]> {
  // Fetch recent audit logs that relate to Application entities
  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: { in: ["Application", "Assessment", "Recommendation"] },
      action: {
        in: [
          "APPLICATION_SUBMITTED",
          "ASSESSMENT_STARTED",
          "ASSESSMENT_PAUSED",
          "ASSESSMENT_COMPLETED",
          "RECOMMENDATION_SAVED",
          "OUTCOME_DECIDED",
          "APPLICATION_STATUS_CHANGED",
        ],
      },
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit * 3, // over-fetch to allow round filtering below
  });

  // Collect unique application IDs referenced in audit logs
  const entityIds = logs
    .map((l) => l.entityId)
    .filter((id): id is string => id !== null);

  // Fetch application references for these entity IDs
  const apps = await prisma.application.findMany({
    where: {
      roundId,
      id: { in: entityIds },
    },
    select: { id: true, reference: true, childName: true },
  });

  const appMap = new Map(apps.map((a) => [a.id, a]));

  // Also look up assessments — their entityId is assessmentId, parent is application
  const assessments = await prisma.assessment.findMany({
    where: { id: { in: entityIds } },
    select: {
      id: true,
      application: {
        select: { id: true, reference: true, childName: true, roundId: true },
      },
    },
  });
  const assessmentMap = new Map(assessments.map((a) => [a.id, a.application]));

  const results: DashboardFeedItem[] = [];

  for (const log of logs) {
    // Resolve application from entityId
    let app =
      log.entityId ? appMap.get(log.entityId) ?? null : null;

    // If not found directly, try via assessment lookup
    if (!app && log.entityId) {
      const fromAssessment = assessmentMap.get(log.entityId);
      if (fromAssessment && fromAssessment.roundId === roundId) {
        app = fromAssessment;
      }
    }

    // Skip events not belonging to this round
    if (!app) continue;

    const userName = log.user
      ? `${log.user.firstName ?? ""} ${log.user.lastName ?? ""}`.trim() ||
        log.user.email
      : null;

    results.push({
      id: log.id,
      action: log.action,
      context: log.context,
      createdAt: log.createdAt,
      entityId: log.entityId,
      applicationReference: app.reference,
      childName: app.childName,
      userName,
    });

    if (results.length >= limit) break;
  }

  return results;
}

// ─── getAwardDistribution ─────────────────────────────────────────────────────

/**
 * Groups recommendations by bursary award percentage bands for the given round.
 * Bands: 0%, 1-25%, 26-50%, 51-75%, 76-90%, 91-100%
 */
export async function getAwardDistribution(
  roundId: string
): Promise<AwardBand[]> {
  const recommendations = await prisma.recommendation.findMany({
    where: { roundId },
    select: { bursaryAward: true },
  });

  const BANDS = [
    { label: "0%", min: 0, max: 0 },
    { label: "1–25%", min: 1, max: 25 },
    { label: "26–50%", min: 26, max: 50 },
    { label: "51–75%", min: 51, max: 75 },
    { label: "76–90%", min: 76, max: 90 },
    { label: "91–100%", min: 91, max: 100 },
  ];

  const counts = new Array(BANDS.length).fill(0);
  const total = recommendations.length;

  for (const rec of recommendations) {
    const award = rec.bursaryAward !== null ? Number(rec.bursaryAward) : 0;
    for (let i = 0; i < BANDS.length; i++) {
      const band = BANDS[i];
      if (award >= band.min && award <= band.max) {
        counts[i]++;
        break;
      }
    }
  }

  return BANDS.map((band, i) => ({
    label: band.label,
    count: counts[i],
    pct: total > 0 ? Math.round((counts[i] / total) * 100) : 0,
  }));
}

// ─── getSchoolComparison ──────────────────────────────────────────────────────

/**
 * Returns per-school statistics for the given round.
 * Includes count, average bursary award %, and average monthly payable fees.
 */
export async function getSchoolComparison(
  roundId: string
): Promise<SchoolComparisonRow[]> {
  const applications = await prisma.application.findMany({
    where: { roundId },
    select: {
      school: true,
      assessment: {
        select: {
          bursaryAward: true,
          monthlyPayableFees: true,
        },
      },
    },
  });

  const schoolMap = new Map<
    string,
    { count: number; totalAward: number; totalMonthly: number; assessed: number }
  >();

  for (const app of applications) {
    const school = app.school;
    if (!schoolMap.has(school)) {
      schoolMap.set(school, {
        count: 0,
        totalAward: 0,
        totalMonthly: 0,
        assessed: 0,
      });
    }
    const entry = schoolMap.get(school)!;
    entry.count++;

    if (app.assessment) {
      entry.assessed++;
      entry.totalAward += app.assessment.bursaryAward
        ? Number(app.assessment.bursaryAward)
        : 0;
      entry.totalMonthly += app.assessment.monthlyPayableFees
        ? Number(app.assessment.monthlyPayableFees)
        : 0;
    }
  }

  return Array.from(schoolMap.entries()).map(([school, data]) => ({
    school,
    count: data.count,
    avgBursaryAwardPct:
      data.assessed > 0
        ? Math.round(data.totalAward / data.assessed)
        : 0,
    avgMonthlyFees:
      data.assessed > 0
        ? Math.round(data.totalMonthly / data.assessed)
        : 0,
  }));
}

// ─── getIncomeBandDistribution ────────────────────────────────────────────────

/**
 * Groups assessments by household net income bands for the given round.
 * Bands: Under £25k, £25–40k, £40–60k, £60–80k, £80–100k, Over £100k
 */
export async function getIncomeBandDistribution(
  roundId: string
): Promise<IncomeBandRow[]> {
  const assessments = await prisma.assessment.findMany({
    where: {
      application: { roundId },
      totalHouseholdNetIncome: { not: null },
    },
    select: { totalHouseholdNetIncome: true },
  });

  const BANDS = [
    { label: "Under £25k", max: 25_000 },
    { label: "£25k–£40k", max: 40_000 },
    { label: "£40k–£60k", max: 60_000 },
    { label: "£60k–£80k", max: 80_000 },
    { label: "£80k–£100k", max: 100_000 },
    { label: "Over £100k", max: Infinity },
  ];

  const counts = new Array(BANDS.length).fill(0);
  const total = assessments.length;

  for (const assessment of assessments) {
    const income = Number(assessment.totalHouseholdNetIncome ?? 0);
    for (let i = 0; i < BANDS.length; i++) {
      const prevMax = i === 0 ? 0 : BANDS[i - 1].max;
      if (income > prevMax && income <= BANDS[i].max) {
        counts[i]++;
        break;
      }
    }
  }

  return BANDS.map((band, i) => ({
    label: band.label,
    count: counts[i],
    pct: total > 0 ? Math.round((counts[i] / total) * 100) : 0,
  }));
}

// ─── getPropertyCategoryDistribution ─────────────────────────────────────────

/**
 * Groups assessments by property category for the given round.
 */
export async function getPropertyCategoryDistribution(
  roundId: string
): Promise<PropertyCategoryRow[]> {
  const assessments = await prisma.assessment.findMany({
    where: {
      application: { roundId },
      propertyCategory: { not: null },
    },
    select: { propertyCategory: true },
  });

  const categoryMap = new Map<number, number>();

  for (const assessment of assessments) {
    const cat = assessment.propertyCategory!;
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
  }

  const total = assessments.length;
  const entries = Array.from(categoryMap.entries()).sort(([a], [b]) => a - b);

  return entries.map(([category, count]) => ({
    category,
    count,
    pct: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

// ─── getReasonCodeFrequency ───────────────────────────────────────────────────

/**
 * Returns a ranked list of reason codes by usage frequency for the given round.
 */
export async function getReasonCodeFrequency(
  roundId: string
): Promise<ReasonCodeFrequencyRow[]> {
  const links = await prisma.recommendationReasonCode.findMany({
    where: {
      recommendation: { roundId },
    },
    select: {
      reasonCode: {
        select: { code: true, label: true },
      },
    },
  });

  const freqMap = new Map<
    number,
    { code: number; label: string; count: number }
  >();

  for (const link of links) {
    const { code, label } = link.reasonCode;
    if (freqMap.has(code)) {
      freqMap.get(code)!.count++;
    } else {
      freqMap.set(code, { code, label, count: 1 });
    }
  }

  return Array.from(freqMap.values()).sort((a, b) => b.count - a.count);
}
