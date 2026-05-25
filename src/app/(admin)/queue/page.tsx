/**
 * Application Queue — admin page.
 *
 * Server component. Requires ASSESSOR or VIEWER role.
 * Fetches the full application list and passes it to the client-side
 * ApplicationTable component for filtering/sorting.
 */

import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import {
  listApplications,
  listRounds,
  type ListApplicationsFilters,
} from "@/lib/db/queries/applications";
import { getRoundWatchlist } from "@/lib/db/queries/round-watchlist";
import { getActiveRound } from "@/lib/db/queries/reports";
import { getActiveBursaryHolders } from "@/lib/db/queries/invitations";
import { RoundStatus } from "@prisma/client";
import { listAssessors } from "@/lib/db/queries/profiles";
import type { WatchlistRuleId } from "@/lib/db/queries/round-watchlist";
import { ApplicationTable } from "@/components/admin/application-table";
import { InternalRequestDialog } from "@/components/admin/internal-request-dialog";
import { ApplicationStatus, School } from "@prisma/client";

export const metadata = {
  title: "Applications",
};

// ─── Search-param parsing helpers ──────────────────────────────────────────────

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isTruthyFlag(value: string | string[] | undefined): boolean {
  return firstValue(value) === "1";
}

const APPLICATION_STATUSES = new Set<string>(Object.values(ApplicationStatus));
const SCHOOLS = new Set<string>(Object.values(School));

function parseStatus(
  value: string | string[] | undefined
): ApplicationStatus | undefined {
  const raw = firstValue(value);
  return raw && APPLICATION_STATUSES.has(raw)
    ? (raw as ApplicationStatus)
    : undefined;
}

function parseSchool(
  value: string | string[] | undefined
): School | undefined {
  const raw = firstValue(value);
  return raw && SCHOOLS.has(raw) ? (raw as School) : undefined;
}

// Each derived flag maps to exactly one watchlist rule whose deduped `appIds`
// define the drill-in set (keeps the queue identical to the lane's count).
const DERIVED_RULE_BY_FLAG: Record<string, WatchlistRuleId> = {
  docsMissing: "SUBMITTED_MISSING_DOCS",
  stale: "ASSESSMENT_STALLED",
  awaitingOutcome: "RECOMMENDATION_AWAITING_OUTCOME",
};

export default async function QueuePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const profile = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const params: SearchParams = searchParams ? await searchParams : {};

  // Simple, column-backed filters.
  const roundId = firstValue(params.roundId);
  const status = parseStatus(params.status);
  const school = parseSchool(params.school);
  const undecided = isTruthyFlag(params.undecided);
  // Re-assessment-eligible drill-in: ADMIN-only. Shows the prior-round winning
  // applications linked to bursary holders who are eligible to be invited into
  // the open round (cross-round is intended).
  const reassessEligible =
    profile.role === Role.ADMIN && isTruthyFlag(params.reassessEligible);

  // Derived, round-scoped flags (resolved against the stage-B watchlist).
  const activeDerivedFlags = Object.keys(DERIVED_RULE_BY_FLAG).filter((flag) =>
    isTruthyFlag(params[flag])
  );

  const applicationFilters: ListApplicationsFilters =
    profile.role === Role.ASSESSOR ? { assignedToId: profile.id } : {};

  if (roundId) applicationFilters.roundId = roundId;
  if (status) applicationFilters.status = status;
  if (school) applicationFilters.school = school;
  if (undecided) applicationFilters.undecided = true;

  const { applications, rounds, assessors, reassessRoundYear } =
    await withUserContext(
    profile.id,
    profile.role as RlsRole,
    async (tx) => {
      // Re-assessment-eligible filter: resolve the OPEN round, then scope the
      // queue to the applications linked to its eligible bursary holders. No
      // open round → show nothing (empty bursaryAccountIds set).
      let reassessRoundYear: string | null = null;
      if (reassessEligible) {
        const round = await getActiveRound(tx);
        if (round && round.status === RoundStatus.OPEN) {
          reassessRoundYear = round.academicYear;
          const holders = await getActiveBursaryHolders(tx, round.id);
          applicationFilters.bursaryAccountIds = holders.map((h) => h.id);
        } else {
          applicationFilters.bursaryAccountIds = [];
        }
      }

      // Resolve derived flags against the watchlist so the queue shows EXACTLY
      // the applications the lane counted. Only meaningful when a round is
      // scoped (the watchlist is per-round).
      if (activeDerivedFlags.length > 0 && roundId) {
        const watchlist = await getRoundWatchlist(tx, roundId);
        // Intersect across flags (normally only one arrives).
        let ids: string[] | null = null;
        for (const flag of activeDerivedFlags) {
          const ruleId = DERIVED_RULE_BY_FLAG[flag];
          const rule = watchlist?.rules.find((r) => r.id === ruleId);
          const ruleIds = rule?.applicationIds ?? [];
          ids =
            ids === null
              ? ruleIds
              : ids.filter((id) => ruleIds.includes(id));
        }
        applicationFilters.ids = ids ?? [];
      } else if (activeDerivedFlags.length > 0) {
        // Derived flag without a round → nothing to scope against; show none.
        applicationFilters.ids = [];
      }

      // Assessor list only needed for the ADMIN bulk-assign dropdown.
      const [applications, rounds, assessors] = await Promise.all([
        listApplications(tx, applicationFilters),
        listRounds(tx),
        profile.role === Role.ADMIN ? listAssessors(tx) : Promise.resolve([]),
      ]);
      return { applications, rounds, assessors, reassessRoundYear };
    }
  );

  // Seed values for the client table UI (simple filters only).
  const initialRound = roundId;
  const initialSchool = school;
  const initialStatuses = status ? [status] : undefined;

  // Plain-English descriptor of the active filter for the dismissible banner.
  // The re-assessment-eligible drill-in owns the banner when active (it is the
  // dominant, cross-round descriptor).
  const activeFilter = reassessEligible
    ? {
        label:
          "Re-assessment eligible" +
          (reassessRoundYear
            ? ` · → ${reassessRoundYear}`
            : " · no open round"),
        clearHref: "/queue",
      }
    : describeActiveFilter({
        roundId,
        status,
        school,
        undecided,
        activeDerivedFlags,
        rounds,
      });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">
            Applications
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and assess submitted bursary applications.
          </p>
        </div>
        <InternalRequestDialog rounds={rounds} />
      </div>

      {/* Data table */}
      <ApplicationTable
        applications={applications}
        rounds={rounds}
        assessors={assessors}
        userRole={profile.role}
        initialRound={initialRound}
        initialSchool={initialSchool}
        initialStatuses={initialStatuses}
        activeFilter={activeFilter}
        reassessEligibleActive={reassessEligible}
        reassessTargetRound={reassessRoundYear}
      />
    </div>
  );
}

// ─── Active-filter description ──────────────────────────────────────────────────

const DERIVED_LABELS: Record<string, string> = {
  docsMissing: "Submitted applications missing required documents",
  stale: "Assessments with no activity for over 5 days",
  awaitingOutcome: "Awaiting outcome",
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PRE_SUBMISSION: "Pre-submission",
  SUBMITTED: "Submitted",
  NOT_STARTED: "Not started",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  QUALIFIES: "Qualifies",
  DOES_NOT_QUALIFY: "Does not qualify",
};

const SCHOOL_LABELS: Record<School, string> = {
  TRINITY: "Trinity",
  WHITGIFT: "Whitgift",
};

function describeActiveFilter({
  roundId,
  status,
  school,
  undecided,
  activeDerivedFlags,
  rounds,
}: {
  roundId: string | undefined;
  status: ApplicationStatus | undefined;
  school: School | undefined;
  undecided: boolean;
  activeDerivedFlags: string[];
  rounds: { id: string; academicYear: string }[];
}): { label: string; clearHref: string } | undefined {
  const parts: string[] = [];

  const roundLabel = roundId
    ? rounds.find((r) => r.id === roundId)?.academicYear
    : undefined;
  if (roundLabel) parts.push(`Round ${roundLabel}`);

  // A derived flag is the dominant descriptor when present.
  if (activeDerivedFlags.length > 0) {
    for (const flag of activeDerivedFlags) {
      if (DERIVED_LABELS[flag]) parts.push(DERIVED_LABELS[flag]);
    }
  } else {
    if (undecided) parts.push("Undecided");
    if (status) parts.push(STATUS_LABELS[status]);
  }

  if (school) parts.push(SCHOOL_LABELS[school]);

  if (parts.length === 0) return undefined;

  return { label: parts.join(" · "), clearHref: "/queue" };
}
