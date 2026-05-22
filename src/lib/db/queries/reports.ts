/**
 * Aggregate database queries for the admin dashboard and reports page.
 *
 * All Decimal fields are converted with Number() before returning so these
 * results are safe to pass from Server Components to Client Components.
 */

import type { Tx } from "@/lib/db/prisma";
import {
  ApplicationStatus,
  AssessmentStatus,
  BursaryAccountStatus,
  RoundStatus,
  School,
} from "@prisma/client";
import { deriveCurrentYearGroupNumber } from "@/lib/assessment/schooling-years";

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

export interface FinalYearBursaryRow {
  id: string;
  reference: string;
  childName: string;
  school: School;
  entryYear: number;
  /** Derived current year group (1–13), e.g. 12 = Y12, 13 = Y13. */
  currentYearGroup: number;
  /** Derived years of schooling remaining (0 or 1 for this cohort). */
  yearsRemaining: number;
  /** Latest recommended yearly payable fees across the account, if any. */
  yearlyPayableFees: number | null;
  /** Number of linked siblings in the same family group. */
  siblingCount: number;
}

export interface SiblingSummaryChild {
  bursaryAccountId: string;
  reference: string;
  childName: string;
  school: School;
  priorityOrder: number;
  yearlyPayableFees: number | null;
  bursaryAward: number | null;
}

export interface SiblingSummaryRow {
  familyGroupId: string;
  childrenCount: number;
  combinedYearlyPayableFees: number;
  combinedBursaryAward: number;
  children: SiblingSummaryChild[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The number of school year groups from entry to leaving (Y13 is the last).
 * "Final year" cohort = current year group of Y12 or Y13 (yearsRemaining 0/1).
 */
const FINAL_SCHOOL_YEAR = 13;

/**
 * Returns the active round (most recent OPEN), falling back to the most
 * recent round of any status. Returns null when no rounds exist.
 */
export async function getActiveRound(tx: Tx) {
  const openRound = await tx.round.findFirst({
    where: { status: RoundStatus.OPEN },
    orderBy: { openDate: "desc" },
    select: { id: true, academicYear: true, closeDate: true, status: true },
  });

  if (openRound) return openRound;

  return tx.round.findFirst({
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
  tx: Tx,
  roundId: string
): Promise<DashboardCounts> {
  const round = await tx.round.findUnique({
    where: { id: roundId },
    select: { id: true, academicYear: true, closeDate: true, status: true },
  });

  // Fetch all application statuses for the round in one query
  const applications = await tx.application.findMany({
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
  tx: Tx,
  roundId: string,
  limit = 8
): Promise<DashboardFeedItem[]> {
  // Fetch recent audit logs that relate to Application entities
  const logs = await tx.auditLog.findMany({
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
  const apps = await tx.application.findMany({
    where: {
      roundId,
      id: { in: entityIds },
    },
    select: { id: true, reference: true, childName: true },
  });

  const appMap = new Map(apps.map((a) => [a.id, a]));

  // Also look up assessments — their entityId is assessmentId, parent is application
  const assessments = await tx.assessment.findMany({
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
  tx: Tx,
  roundId: string
): Promise<AwardBand[]> {
  const recommendations = await tx.recommendation.findMany({
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
  tx: Tx,
  roundId: string
): Promise<SchoolComparisonRow[]> {
  const applications = await tx.application.findMany({
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
  tx: Tx,
  roundId: string
): Promise<IncomeBandRow[]> {
  const assessments = await tx.assessment.findMany({
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
 * Groups recommendations by property category for the given round.
 *
 * Property category is recorded on the Recommendation (the Recommendation tab),
 * not the Assessment — Assessment.propertyCategory stays null. Read from
 * recommendations so the report reflects assessor-entered categories.
 */
export async function getPropertyCategoryDistribution(
  tx: Tx,
  roundId: string
): Promise<PropertyCategoryRow[]> {
  const recommendations = await tx.recommendation.findMany({
    where: {
      roundId,
      propertyCategory: { not: null },
    },
    select: { propertyCategory: true },
  });

  const categoryMap = new Map<number, number>();

  for (const recommendation of recommendations) {
    const cat = recommendation.propertyCategory!;
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
  }

  const total = recommendations.length;
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
  tx: Tx,
  roundId: string
): Promise<ReasonCodeFrequencyRow[]> {
  const links = await tx.recommendationReasonCode.findMany({
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

// ─── getFinalYearBursaries ─────────────────────────────────────────────────────

/**
 * Returns ACTIVE bursary accounts whose holders are in their final school years
 * (Y12 / Y13), so the foundation can plan succession.
 *
 * "Final year" is derived from the account's entry year using the same formula
 * as the assessment form: an account is in the final-year cohort when its
 * current year group is Y12 or Y13 (i.e. yearsRemaining of 1 or 0). Accounts
 * span rounds, so this report is not round-scoped.
 *
 * The latest recommended yearly payable fees (most recent recommendation linked
 * to the account) is surfaced per the guide. Sibling count is the number of
 * other accounts sharing any of the account's family groups.
 */
export async function getFinalYearBursaries(
  tx: Tx
): Promise<FinalYearBursaryRow[]> {
  const accounts = await tx.bursaryAccount.findMany({
    where: { status: BursaryAccountStatus.ACTIVE },
    select: {
      id: true,
      reference: true,
      childName: true,
      school: true,
      entryYear: true,
      entryYearGroup: true,
      siblingLinks: { select: { familyGroupId: true } },
      recommendations: {
        select: { yearlyPayableFees: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { reference: "asc" },
  });

  // Sibling counts: how many distinct accounts share each family group.
  const familyGroupIds = Array.from(
    new Set(
      accounts.flatMap((a) => a.siblingLinks.map((l) => l.familyGroupId))
    )
  );
  const groupSize = new Map<string, number>();
  if (familyGroupIds.length > 0) {
    const links = await tx.siblingLink.findMany({
      where: { familyGroupId: { in: familyGroupIds } },
      select: { familyGroupId: true, bursaryAccountId: true },
    });
    const perGroup = new Map<string, Set<string>>();
    for (const link of links) {
      if (!perGroup.has(link.familyGroupId)) {
        perGroup.set(link.familyGroupId, new Set());
      }
      perGroup.get(link.familyGroupId)!.add(link.bursaryAccountId);
    }
    for (const [groupId, accountSet] of Array.from(perGroup.entries())) {
      groupSize.set(groupId, accountSet.size);
    }
  }

  const rows: FinalYearBursaryRow[] = [];

  for (const account of accounts) {
    // Current year-group is derived from the entry year-group (source of truth)
    // plus the entry calendar year. Accounts without a year-group can't be
    // classified, so they're excluded from the final-year cohort.
    const currentYearGroup = deriveCurrentYearGroupNumber(
      account.entryYearGroup,
      account.entryYear
    );
    if (currentYearGroup === null) continue;
    const yearsRemaining = FINAL_SCHOOL_YEAR - currentYearGroup;

    // Final-year cohort: Y12 / Y13 (0 or 1 years remaining).
    if (yearsRemaining > 1 || yearsRemaining < 0) continue;

    // Distinct sibling accounts in the same family group(s), excluding self.
    const accountFamilyGroups = Array.from(
      new Set(account.siblingLinks.map((l) => l.familyGroupId))
    );
    let siblingCount = 0;
    for (const groupId of accountFamilyGroups) {
      siblingCount += Math.max(0, (groupSize.get(groupId) ?? 1) - 1);
    }

    const latestRec = account.recommendations[0];

    rows.push({
      id: account.id,
      reference: account.reference,
      childName: account.childName,
      school: account.school,
      entryYear: account.entryYear,
      currentYearGroup,
      yearsRemaining,
      yearlyPayableFees:
        latestRec && latestRec.yearlyPayableFees !== null
          ? Number(latestRec.yearlyPayableFees)
          : null,
      siblingCount,
    });
  }

  // Final year (Y13) first, then by reference.
  return rows.sort(
    (a, b) =>
      a.yearsRemaining - b.yearsRemaining ||
      a.reference.localeCompare(b.reference)
  );
}

// ─── getSiblingBursarySummary ──────────────────────────────────────────────────

/**
 * Returns families (FamilyGroups) with two or more linked bursary accounts,
 * with combined totals across the linked siblings.
 *
 * Per-child yearly payable fees and bursary award are taken from the most
 * recent recommendation linked to each account. Accounts span rounds, so this
 * report is not round-scoped. Single-child family groups are excluded — the
 * report is about families with siblings.
 */
export async function getSiblingBursarySummary(
  tx: Tx
): Promise<SiblingSummaryRow[]> {
  const links = await tx.siblingLink.findMany({
    select: {
      familyGroupId: true,
      priorityOrder: true,
      bursaryAccount: {
        select: {
          id: true,
          reference: true,
          childName: true,
          school: true,
          recommendations: {
            select: { yearlyPayableFees: true, bursaryAward: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ familyGroupId: "asc" }, { priorityOrder: "asc" }],
  });

  const groups = new Map<string, SiblingSummaryChild[]>();

  for (const link of links) {
    const account = link.bursaryAccount;
    const latestRec = account.recommendations[0];

    const child: SiblingSummaryChild = {
      bursaryAccountId: account.id,
      reference: account.reference,
      childName: account.childName,
      school: account.school,
      priorityOrder: link.priorityOrder,
      yearlyPayableFees:
        latestRec && latestRec.yearlyPayableFees !== null
          ? Number(latestRec.yearlyPayableFees)
          : null,
      bursaryAward:
        latestRec && latestRec.bursaryAward !== null
          ? Number(latestRec.bursaryAward)
          : null,
    };

    if (!groups.has(link.familyGroupId)) {
      groups.set(link.familyGroupId, []);
    }
    groups.get(link.familyGroupId)!.push(child);
  }

  const rows: SiblingSummaryRow[] = [];

  for (const [familyGroupId, children] of Array.from(groups.entries())) {
    // Families with siblings: two or more linked accounts.
    if (children.length < 2) continue;

    const combinedYearlyPayableFees = children.reduce(
      (sum: number, c: SiblingSummaryChild) => sum + (c.yearlyPayableFees ?? 0),
      0
    );
    const combinedBursaryAward = children.reduce(
      (sum: number, c: SiblingSummaryChild) => sum + (c.bursaryAward ?? 0),
      0
    );

    rows.push({
      familyGroupId,
      childrenCount: children.length,
      combinedYearlyPayableFees,
      combinedBursaryAward,
      children,
    });
  }

  // Highest combined bursary award first.
  return rows.sort(
    (a, b) => b.combinedBursaryAward - a.combinedBursaryAward
  );
}
