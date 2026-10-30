/**
 * Aggregate database queries for the admin dashboard and reports page.
 *
 * All Decimal fields are converted with Number() before returning so these
 * results are safe to pass from Server Components to Client Components.
 */

import type { Tx } from "@/lib/db/prisma";
import {
  AssessmentStatus,
  AwardFundType,
  BursaryAccountStatus,
  RoundStatus,
  School,
} from "@prisma/client";
import {
  finalEligibleSchoolYear,
  SCHOOL_HAS_FEE_TABLE,
  schoolVatRate,
} from "@/lib/schools";
import { awardFundOptionsForSchool } from "@/lib/assessment/award-fund";
import { SCHOOL_SHORT } from "@/lib/dashboard/shape";
import { getSchoolFeesForYear } from "@/lib/db/queries/reference-tables";
import { deriveCurrentYearGroupNumber } from "@/lib/assessment/schooling-years";
import { summariseGaps, type GapSummary } from "@/lib/reason-codes/gap-metrics";

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface AwardAverage {
  /** Assessed applications in the average. */
  assessed: number;
  /** Average bursary award per assessed application, in £. */
  avgBursaryAward: number;
  /**
   * Total award as a % of total annual fees before VAT, one decimal place.
   * Null when no application in the group has known fees.
   */
  avgBursaryAwardPct: number | null;
}

export interface FundAverage extends AwardAverage {
  /** Null for assessments recorded without a fund. */
  fund: AwardFundType | null;
}

export interface SchoolComparisonRow extends AwardAverage {
  school: string;
  count: number;
  avgMonthlyFees: number;
  /** The same averages per award fund, in the school's fund order. */
  funds: FundAverage[];
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
  childName: string;
  school: School;
  entryYear: number;
  /** Derived current year group (1–13), e.g. 12 = Y12, 13 = Y13. */
  currentYearGroup: number;
  /** Derived years of schooling remaining (0 or 1 for this cohort). */
  yearsRemaining: number;
  /** Latest recommended yearly payable fees across the account, if any. */
  yearlyPayableFees: number | null;
  /** Other active accounts in the same family (sibling link or lead parent). */
  siblingCount: number;
}

export interface SiblingSummaryChild {
  bursaryAccountId: string;
  childName: string;
  school: School;
  /** Position within the family: sibling-link priority first, then oldest. */
  priorityOrder: number;
  yearlyPayableFees: number | null;
  bursaryAward: number | null;
}

export interface SiblingSummaryRow {
  /** Stable key for the family: its first child's bursary account id. */
  familyKey: string;
  /** Lead parent of the family's first child. */
  leadParentName: string | null;
  childrenCount: number;
  combinedYearlyPayableFees: number;
  combinedBursaryAward: number;
  children: SiblingSummaryChild[];
}

export interface HouseholdCombinationRow {
  /** e.g. "2 awards with TS", "2 awards (OP + WS)". */
  label: string;
  households: number;
  awards: number;
  /** Combined yearly bursary award, before VAT. */
  totalBursarySupport: number;
  /** The same support with each award's school VAT added (none at OP). */
  feeSupportEquivalent: number;
}

export interface HouseholdCombinations {
  rows: HouseholdCombinationRow[];
  total: Omit<HouseholdCombinationRow, "label">;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface FamilyMember {
  id: string;
  leadApplicantId: string;
  siblingLinks: { familyGroupId: string }[];
}

/**
 * Groups accounts into families: the connected sets of accounts joined by a
 * sibling link (same FamilyGroup) or a shared lead parent. The lead-parent
 * join covers families whose siblings were never linked — the Grant Tracker
 * migration creates no SiblingLink rows (S22: sibling fees are entered by hand
 * on each assessment). Display only; it never feeds a calculation.
 */
function groupFamilies<T extends FamilyMember>(accounts: T[]): T[][] {
  // Union-find over accounts.
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  const firstBy = new Map<string, string>();
  for (const account of accounts) {
    parent.set(account.id, account.id);
  }
  for (const account of accounts) {
    const keys = [
      `lead:${account.leadApplicantId}`,
      ...account.siblingLinks.map((l) => `group:${l.familyGroupId}`),
    ];
    for (const key of keys) {
      const first = firstBy.get(key);
      if (first) union(first, account.id);
      else firstBy.set(key, account.id);
    }
  }

  const families = new Map<string, T[]>();
  for (const account of accounts) {
    const root = find(account.id);
    if (!families.has(root)) families.set(root, []);
    families.get(root)!.push(account);
  }
  return Array.from(families.values());
}

/** Her combination rows, in her order; any other combination is appended. */
const HOUSEHOLD_COMBINATION_TEMPLATE = [
  "2 awards with OP",
  "2 awards with TS",
  "2 awards with WS",
  "2 awards (OP + TS)",
  "2 awards (OP + WS)",
  "2 awards (TS + WS)",
  "3 awards with OP",
  "3 awards with TS",
  "3 awards with WS",
  "3 awards (TS + WS)",
];

const COMBINATION_SCHOOL_ORDER: School[] = ["OP_PARTNER", "TRINITY", "WHITGIFT"];

function householdCombinationLabel(schools: School[]): string {
  const distinct = COMBINATION_SCHOOL_ORDER.filter((s) => schools.includes(s));
  const codes = distinct.map((s) => SCHOOL_SHORT[s]);
  return distinct.length === 1
    ? `${schools.length} awards with ${codes[0]}`
    : `${schools.length} awards (${codes.join(" + ")})`;
}


/**
 * Returns the DEFAULT active round — the most-recent OPEN, falling back to the
 * most-recent round of any status. Returns null when no rounds exist.
 *
 * Epic 03 (concurrent rounds): more than one round may now be OPEN at once. This
 * helper deliberately returns just ONE round and is the right choice only where
 * a sensible *default* round is needed (e.g. pre-selecting a selector). It is
 * NOT "the open round" — callers that must act on a specific round (bulk
 * re-assessment) take an explicit roundId, and callers that must show all live
 * rounds (invite picker) use {@link listOpenRounds}. Do not reintroduce a
 * single-OPEN assumption on top of this.
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

/**
 * Returns ALL currently-OPEN rounds, most recent first. Epic 03: with the
 * single-OPEN guard lifted, several rounds can be live at once; the invite
 * picker and the concurrent-round selectors enumerate them through this helper
 * rather than assuming a single "the open round". Empty when none are OPEN.
 */
export async function listOpenRounds(tx: Tx) {
  return tx.round.findMany({
    where: { status: RoundStatus.OPEN },
    orderBy: { openDate: "desc" },
    select: { id: true, academicYear: true, closeDate: true, status: true },
  });
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
 * Returns per-school statistics for the given round: count, average bursary
 * award in £ and as a % of annual fees before VAT, average monthly payable
 * fees, and the award averages again per award fund.
 *
 * The % is total award ÷ total annual fees before VAT across the assessed
 * applications (Charlotte, 24 Oct 2026: "£18,451 / £25,390 (annual fees
 * excluding VAT)"). Fees are the account's own annual fees when set (always
 * so at the OP partnering school), else the school's fee-table row for the
 * round's academic year.
 */
export async function getSchoolComparison(
  tx: Tx,
  roundId: string
): Promise<SchoolComparisonRow[]> {
  const [round, applications] = await Promise.all([
    tx.round.findUnique({
      where: { id: roundId },
      select: { academicYear: true },
    }),
    tx.application.findMany({
      where: { roundId },
      select: {
        school: true,
        bursaryAccount: { select: { annualFeesOverride: true } },
        assessment: {
          select: {
            bursaryAward: true,
            monthlyPayableFees: true,
            awardFundType: true,
            // CALC-08: v2 assessments leave the legacy columns null; the
            // recommendation carries the confirmed figures instead.
            recommendation: {
              select: { bursaryAward: true, monthlyPayableFees: true },
            },
          },
        },
      },
    }),
  ]);

  const schools = Array.from(new Set(applications.map((a) => a.school)));
  const tableFees = new Map<School, number | null>();
  for (const school of schools) {
    if (!SCHOOL_HAS_FEE_TABLE[school]) continue;
    const { currentYearAnnualFees } = await getSchoolFeesForYear(
      tx,
      school,
      round?.academicYear
    );
    tableFees.set(school, currentYearAnnualFees);
  }

  interface Totals {
    assessed: number;
    totalAward: number;
    // The % uses only applications whose fees are known, award and fees alike.
    pctAward: number;
    pctFees: number;
  }
  const emptyTotals = (): Totals => ({
    assessed: 0,
    totalAward: 0,
    pctAward: 0,
    pctFees: 0,
  });
  const average = (t: Totals): AwardAverage => ({
    assessed: t.assessed,
    avgBursaryAward: t.assessed > 0 ? Math.round(t.totalAward / t.assessed) : 0,
    avgBursaryAwardPct:
      t.pctFees > 0 ? Math.round((t.pctAward / t.pctFees) * 1000) / 10 : null,
  });

  const schoolMap = new Map<
    School,
    {
      count: number;
      totalMonthly: number;
      totals: Totals;
      funds: Map<AwardFundType | null, Totals>;
    }
  >();

  for (const app of applications) {
    const school = app.school;
    if (!schoolMap.has(school)) {
      schoolMap.set(school, {
        count: 0,
        totalMonthly: 0,
        totals: emptyTotals(),
        funds: new Map(),
      });
    }
    const entry = schoolMap.get(school)!;
    entry.count++;

    if (app.assessment) {
      // CALC-08: prefer the recommendation's figures (populated for v2, and
      // for v1 once a recommendation is saved), falling back to the legacy
      // assessment columns for v1 rows without a recommendation.
      // NOTE: `bursaryAward` mixes VAT bases across engine versions — v1's is
      // the engine-derived award, v2's is the assessor-entered after-VAT
      // figure. The aggregation tolerates the mix for now; CALC-12 (outputs
      // alignment) may refine the basis.
      const awardValue =
        app.assessment.recommendation?.bursaryAward ??
        app.assessment.bursaryAward;
      const monthly =
        app.assessment.recommendation?.monthlyPayableFees ??
        app.assessment.monthlyPayableFees;
      const award = awardValue ? Number(awardValue) : 0;
      entry.totalMonthly += monthly ? Number(monthly) : 0;

      const override = app.bursaryAccount?.annualFeesOverride;
      const fees =
        override != null ? Number(override) : (tableFees.get(school) ?? null);

      const fund = app.assessment.awardFundType;
      if (!entry.funds.has(fund)) entry.funds.set(fund, emptyTotals());
      for (const t of [entry.totals, entry.funds.get(fund)!]) {
        t.assessed++;
        t.totalAward += award;
        if (fees && fees > 0) {
          t.pctAward += award;
          t.pctFees += fees;
        }
      }
    }
  }

  return Array.from(schoolMap.entries()).map(([school, data]) => {
    // The school's fund order, then any fund it does not offer, then none.
    const order = awardFundOptionsForSchool(school);
    const rank = (f: AwardFundType | null) =>
      f === null ? Number.MAX_SAFE_INTEGER : order.indexOf(f) === -1 ? order.length : order.indexOf(f);
    const funds = Array.from(data.funds.entries())
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([fund, totals]) => ({ fund, ...average(totals) }));

    return {
      school,
      count: data.count,
      ...average(data.totals),
      avgMonthlyFees:
        data.totals.assessed > 0
          ? Math.round(data.totalMonthly / data.totals.assessed)
          : 0,
      funds,
    };
  });
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

// ─── getGapSummary ─────────────────────────────────────────────────────────────

/**
 * Epic 21 #1 + #2 — the Reports "Gap" section for one round: total gap,
 * scholarship spend incl VAT, the scholarship-adjusted gap, per-school totals,
 * and the gap counted once per account under its main (highest-ranked) gap
 * code. The reduction is pure (`summariseGaps`, gap-metrics.ts).
 */
export async function getGapSummary(tx: Tx, roundId: string): Promise<GapSummary> {
  const recs = await tx.recommendation.findMany({
    where: { roundId },
    select: {
      gapAmount: true,
      scholarshipSpendBeforeVat: true,
      assessment: {
        select: {
          vatRate: true,
          application: { select: { school: true } },
        },
      },
      gapReasons: {
        select: {
          gapReason: {
            select: { code: true, label: true, rank: true, sortOrder: true },
          },
        },
      },
    },
  });

  return summariseGaps(
    recs.map((r) => ({
      school: r.assessment.application.school,
      gapAmount: r.gapAmount != null ? Number(r.gapAmount) : null,
      scholarshipSpendBeforeVat:
        r.scholarshipSpendBeforeVat != null ? Number(r.scholarshipSpendBeforeVat) : null,
      vatRate: r.assessment.vatRate != null ? Number(r.assessment.vatRate) : null,
      gapReasons: r.gapReasons.map((g) => g.gapReason),
    }))
  );
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
 * other active accounts in the same family — joined by a sibling link or a
 * shared lead parent (see `groupFamilies`).
 */
export async function getFinalYearBursaries(
  tx: Tx
): Promise<FinalYearBursaryRow[]> {
  const accounts = await tx.bursaryAccount.findMany({
    where: { status: BursaryAccountStatus.ACTIVE },
    select: {
      id: true,
      childName: true,
      school: true,
      entryYear: true,
      entryYearGroup: true,
      leadApplicantId: true,
      siblingLinks: { select: { familyGroupId: true } },
      recommendations: {
        select: { yearlyPayableFees: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    // D13-1a: the account reference this used to order by is gone; the child's
    // name is the label the report now shows, so it is what it sorts on.
    orderBy: { childName: "asc" },
  });

  // Sibling counts: the other active accounts in the same family.
  const familySize = new Map<string, number>();
  for (const members of groupFamilies(accounts)) {
    for (const member of members) familySize.set(member.id, members.length);
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
    // The last school year the bursary covers: 13, or 11 at the OP
    // partnering school (S9) — so its final-year cohort is Y10 / Y11.
    const yearsRemaining = finalEligibleSchoolYear(account.school) - currentYearGroup;

    // Final-year cohort: the last two years (0 or 1 years remaining).
    if (yearsRemaining > 1 || yearsRemaining < 0) continue;

    const siblingCount = (familySize.get(account.id) ?? 1) - 1;

    const latestRec = account.recommendations[0];

    rows.push({
      id: account.id,
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

  // Final year (Y13) first, then by child name (D13-1a — no reference left).
  return rows.sort(
    (a, b) =>
      a.yearsRemaining - b.yearsRemaining ||
      a.childName.localeCompare(b.childName)
  );
}

// ─── getSiblingBursarySummary ──────────────────────────────────────────────────

/**
 * Returns families with two or more active bursary accounts, with combined
 * totals across the siblings.
 *
 * A family is the accounts joined by a sibling link or a shared lead parent
 * (see `groupFamilies`); without the lead-parent join the report is empty for
 * every migrated family.
 *
 * Per-child yearly payable fees and bursary award are taken from the most
 * recent recommendation linked to each account. Accounts span rounds, so this
 * report is not round-scoped. Closed accounts are left out.
 */
export async function getSiblingBursarySummary(
  tx: Tx
): Promise<SiblingSummaryRow[]> {
  const accounts = await tx.bursaryAccount.findMany({
    where: { status: BursaryAccountStatus.ACTIVE },
    select: {
      id: true,
      childName: true,
      childDob: true,
      entryYear: true,
      school: true,
      leadApplicantId: true,
      leadApplicant: { select: { firstName: true, lastName: true } },
      siblingLinks: { select: { familyGroupId: true, priorityOrder: true } },
      recommendations: {
        select: { yearlyPayableFees: true, bursaryAward: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Sibling-link priority first (unlinked after), then oldest child first.
  const linkPriority = (a: (typeof accounts)[number]) =>
    a.siblingLinks.length > 0
      ? Math.min(...a.siblingLinks.map((l) => l.priorityOrder))
      : Number.MAX_SAFE_INTEGER;
  const dobTime = (a: (typeof accounts)[number]) =>
    a.childDob ? a.childDob.getTime() : Number.MAX_SAFE_INTEGER;

  const rows: SiblingSummaryRow[] = [];

  for (const members of groupFamilies(accounts)) {
    // Families with siblings: two or more accounts.
    if (members.length < 2) continue;

    members.sort(
      (a, b) =>
        linkPriority(a) - linkPriority(b) ||
        dobTime(a) - dobTime(b) ||
        a.entryYear - b.entryYear ||
        a.childName.localeCompare(b.childName)
    );

    const children: SiblingSummaryChild[] = members.map((account, i) => {
      const latestRec = account.recommendations[0];
      return {
        bursaryAccountId: account.id,
        childName: account.childName,
        school: account.school,
        priorityOrder: i + 1,
        yearlyPayableFees:
          latestRec && latestRec.yearlyPayableFees !== null
            ? Number(latestRec.yearlyPayableFees)
            : null,
        bursaryAward:
          latestRec && latestRec.bursaryAward !== null
            ? Number(latestRec.bursaryAward)
            : null,
      };
    });

    const combinedYearlyPayableFees = children.reduce(
      (sum: number, c: SiblingSummaryChild) => sum + (c.yearlyPayableFees ?? 0),
      0
    );
    const combinedBursaryAward = children.reduce(
      (sum: number, c: SiblingSummaryChild) => sum + (c.bursaryAward ?? 0),
      0
    );

    const lead = members[0].leadApplicant;
    const leadParentName =
      [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || null;

    rows.push({
      familyKey: members[0].id,
      leadParentName,
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

// ─── summariseHouseholdCombinations ───────────────────────────────────────────

/**
 * Charlotte's "Multiple Award Combinations within Same Household" table
 * (24 Oct 2026): families with two or more active awards, counted by how many
 * awards and at which schools, without naming them. Total bursary support is
 * the combined yearly award (before VAT); the fee-support equivalent adds each
 * award's school VAT back — 20% at Trinity and Whitgift, none at the OP
 * partnering school (S9).
 *
 * Her ten rows always show, in her order (zeros included); any other
 * combination is appended after them.
 */
export function summariseHouseholdCombinations(
  families: SiblingSummaryRow[]
): HouseholdCombinations {
  const byLabel = new Map<string, HouseholdCombinationRow>();
  for (const label of HOUSEHOLD_COMBINATION_TEMPLATE) {
    byLabel.set(label, {
      label,
      households: 0,
      awards: 0,
      totalBursarySupport: 0,
      feeSupportEquivalent: 0,
    });
  }

  for (const family of families) {
    const label = householdCombinationLabel(family.children.map((c) => c.school));
    if (!byLabel.has(label)) {
      byLabel.set(label, {
        label,
        households: 0,
        awards: 0,
        totalBursarySupport: 0,
        feeSupportEquivalent: 0,
      });
    }
    const row = byLabel.get(label)!;
    row.households++;
    row.awards += family.children.length;
    for (const child of family.children) {
      const award = child.bursaryAward ?? 0;
      row.totalBursarySupport += award;
      row.feeSupportEquivalent += award * (1 + schoolVatRate(child.school) / 100);
    }
  }

  const rows = Array.from(byLabel.values());
  const total = rows.reduce(
    (sum, r) => ({
      households: sum.households + r.households,
      awards: sum.awards + r.awards,
      totalBursarySupport: sum.totalBursarySupport + r.totalBursarySupport,
      feeSupportEquivalent: sum.feeSupportEquivalent + r.feeSupportEquivalent,
    }),
    { households: 0, awards: 0, totalBursarySupport: 0, feeSupportEquivalent: 0 }
  );
  return { rows, total };
}
