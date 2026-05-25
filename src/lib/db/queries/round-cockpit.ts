/**
 * round-cockpit.ts — the data bundle for the Round Cockpit (#18) Stage D
 * landing surface (`/rounds/[id]`).
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 * Same PURE / fetch split as the watchlist:
 *
 *   getRoundCockpit(tx, roundId, now?)  → fetches `getRound` + `getRoundWatchlist`
 *                                         ONCE, plus a few small tx-scoped reads,
 *                                         then delegates the math to the PURE
 *                                         derivations in →
 *   round-cockpit-eval.ts  → deriveTimeProgress / deriveStageStrip /
 *                            deriveExportReadiness. No Prisma / server-only, so
 *                            the derivations unit-test in a node environment.
 *
 * The page consumes `CockpitData` and must NOT call `getRound` or
 * `getRoundWatchlist` again — both are passed through on the bundle.
 *
 * Must run inside an existing `withUserContext(...)` block (staff RLS sees the
 * whole round), same contract as `getRoundWatchlist`.
 */

import type { Tx } from "@/lib/db/prisma";
import { ApplicationStatus, InvitationStatus, School } from "@prisma/client";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { getRound, type RoundDetail } from "./rounds";
import { getRoundWatchlist } from "./round-watchlist";
import type { WatchlistResult } from "./round-watchlist-eval";
import {
  deriveExportReadiness,
  deriveStageStrip,
  deriveTimeProgress,
  type ExportReadiness,
  type StageNode,
  type TimeProgress,
} from "./round-cockpit-eval";

// Re-export the pure surface so consumers import from a single module.
export {
  deriveTimeProgress,
  deriveStageStrip,
  deriveExportReadiness,
} from "./round-cockpit-eval";
export type {
  TimeProgress,
  TimeProgressInput,
  StageKey,
  StageState,
  StageNode,
  StageStripCounts,
  StageActivity,
  ExportReadiness,
  ExportReadinessInput,
} from "./round-cockpit-eval";

// ─── Public output types ─────────────────────────────────────────────────────────

export interface PipelineTile {
  count: number;
  /** Drill-in link (relative path with query), or null when no sensible filter. */
  drillHref: string | null;
}

export interface CockpitPipeline {
  invited: PipelineTile;
  submitted: PipelineTile;
  inAssessment: PipelineTile;
  decided: PipelineTile;
}

export interface CockpitOutcomes {
  qualifies: number;
  doesNotQualify: number;
}

export interface CockpitData {
  /** Passthrough from `getRound` — the page does NOT call getRound again. */
  round: RoundDetail;
  /** Passthrough from `getRoundWatchlist` — the page does NOT call it again. */
  watchlist: WatchlistResult;
  pipeline: CockpitPipeline;
  timeProgress: TimeProgress;
  outcomes: CockpitOutcomes;
  exportReadiness: ExportReadiness[];
  stageStrip: StageNode[];
}

// ─── Fetch wrapper ───────────────────────────────────────────────────────────────

const DECIDED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.QUALIFIES,
  ApplicationStatus.DOES_NOT_QUALIFY,
];

/**
 * Assemble the cockpit data bundle for a round.
 *
 * Must run inside a `withUserContext(...)` transaction. Fetches `getRound` and
 * `getRoundWatchlist` (each issues its own batched reads), plus three small
 * tx-scoped reads:
 *
 *   1. invitedPending — PENDING + un-accepted invitations for the round
 *      (drives the "Invited" pipeline tile).
 *   2. decided-with-recommendation + latest export per school — reuses the
 *      applications' assessment→recommendation facts and the round's
 *      RECOMMENDATION_EXPORT audit rows for export readiness.
 *   3. decisionsToDate — count of APPLICATION_OUTCOME_SET audit events across
 *      the round's applications (drives decisions/day actual).
 *
 * @returns the assembled `CockpitData`, or null when the round is not found.
 */
export async function getRoundCockpit(
  tx: Tx,
  roundId: string,
  now: Date = new Date(),
): Promise<CockpitData | null> {
  // ── 1. The two big reusable queries + the round's applications (for export
  //       readiness facts and the decisions-to-date audit scope). ─────────────
  const [round, watchlist, applications, invitedPending, invitationsTotal] =
    await Promise.all([
      getRound(tx, roundId),
      getRoundWatchlist(tx, roundId, now),
      tx.application.findMany({
        where: { roundId },
        select: {
          id: true,
          school: true,
          status: true,
          assessment: {
            select: { recommendation: { select: { createdAt: true } } },
          },
        },
      }),
      tx.invitation.count({
        where: {
          roundId,
          status: InvitationStatus.PENDING,
          acceptedAt: null,
        },
      }),
      tx.invitation.count({ where: { roundId } }),
    ]);

  if (!round || !watchlist) return null;

  const applicationIds = applications.map((a) => a.id);

  // ── 2. Export audit rows (round-scoped) + decisions-to-date audit count. ────
  const [exportRows, decisionsToDate] = await Promise.all([
    tx.auditLog.findMany({
      where: {
        action: AUDIT_ACTIONS.RECOMMENDATION_EXPORT,
        entityType: AUDIT_ENTITY_TYPES.Round,
        entityId: roundId,
      },
      select: { createdAt: true, metadata: true },
    }),
    applicationIds.length > 0
      ? tx.auditLog.count({
          where: {
            action: AUDIT_ACTIONS.APPLICATION_OUTCOME_SET,
            entityType: AUDIT_ENTITY_TYPES.Application,
            entityId: { in: applicationIds },
          },
        })
      : Promise.resolve(0),
  ]);

  // ── 3. Per-school decided + latest decision time. ───────────────────────────
  //
  // "Decided" = QUALIFIES/DNQ AND has a recommendation (a decided application
  // always carries one via assessment→recommendation). Latest decision time =
  // max(recommendation.createdAt) for that school.
  const decidedPerSchool = new Map<School, number>();
  const latestDecisionPerSchool = new Map<School, Date>();
  for (const app of applications) {
    if (!DECIDED_STATUSES.includes(app.status)) continue;
    const recAt = app.assessment?.recommendation?.createdAt ?? null;
    if (recAt === null) continue;
    decidedPerSchool.set(app.school, (decidedPerSchool.get(app.school) ?? 0) + 1);
    const prev = latestDecisionPerSchool.get(app.school);
    if (prev === undefined || recAt.getTime() > prev.getTime()) {
      latestDecisionPerSchool.set(app.school, recAt);
    }
  }

  // Latest export covering a concrete school = max(createdAt) over export rows
  // whose metadata.school is that school OR "ALL".
  function latestExportCovering(school: School): Date | null {
    let max: Date | null = null;
    for (const row of exportRows) {
      const meta = (row.metadata ?? {}) as { school?: unknown };
      const exportSchool =
        typeof meta.school === "string" ? meta.school : "ALL";
      if (exportSchool === school || exportSchool === "ALL") {
        if (max === null || row.createdAt.getTime() > max.getTime()) {
          max = row.createdAt;
        }
      }
    }
    return max;
  }

  // Build readiness rows for every school that has decided applications.
  const exportReadiness = deriveExportReadiness(
    Array.from(decidedPerSchool.keys()).map((school) => ({
      school,
      decided: decidedPerSchool.get(school) ?? 0,
      latestDecisionAt: latestDecisionPerSchool.get(school) ?? null,
      lastExportedAt: latestExportCovering(school),
    })),
  );

  // ── 4. Pipeline tiles. ──────────────────────────────────────────────────────
  const decidedCount =
    round.statusBreakdown.qualifies + round.statusBreakdown.doesNotQualify;

  const pipeline: CockpitPipeline = {
    // Invited → un-accepted pending invitations.
    invited: {
      count: invitedPending,
      drillHref: `/invitations?roundId=${roundId}`,
    },
    // Submitted → applications waiting to be picked up.
    submitted: {
      count: round.counts.submitted,
      drillHref: `/queue?roundId=${roundId}&status=SUBMITTED`,
    },
    // In assessment → in-progress work (NOT_STARTED + PAUSED, per
    // rounds.ts buildCounts `inProgress`). Drill to the round queue rather than
    // a single status so both buckets are visible; `paused=1` is the closest
    // single derived filter PR C added but it would hide NOT_STARTED, so we use
    // the broad round queue here. Documented as a deliberate choice.
    inAssessment: {
      count: round.counts.inProgress,
      drillHref: `/queue?roundId=${roundId}`,
    },
    // Decided → QUALIFIES + DNQ. No single queue status covers both, so the
    // tile drills to the round queue (the operator filters from there) rather
    // than a too-narrow single-status link. Documented.
    decided: {
      count: decidedCount,
      drillHref: `/queue?roundId=${roundId}`,
    },
  };

  // ── 5. Pure derivations. ─────────────────────────────────────────────────────
  const timeProgress = deriveTimeProgress(
    { openDate: round.openDate, closeDate: round.closeDate, status: round.status },
    decidedCount,
    round.counts.total,
    decisionsToDate,
    now,
  );

  const stageStrip = deriveStageStrip(
    round.status,
    round.counts,
    watchlist,
    {
      hasInvitations: invitationsTotal > 0,
      hasAssessments: applications.some(
        (a) => a.assessment != null,
      ),
      hasRecommendations: applications.some(
        (a) => a.assessment?.recommendation != null,
      ),
      hasExports: exportRows.length > 0,
    },
  );

  return {
    round,
    watchlist,
    pipeline,
    timeProgress,
    outcomes: {
      qualifies: round.statusBreakdown.qualifies,
      doesNotQualify: round.statusBreakdown.doesNotQualify,
    },
    exportReadiness,
    stageStrip,
  };
}
