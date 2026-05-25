/**
 * round-watchlist.ts — the "Needs Attention" engine for the Round Cockpit (#18).
 *
 * Surfaces the 8 watchlist rules for a single round. The rules derive several
 * "stuck/stalled" signals from `AuditLog` timestamps rather than dedicated
 * columns (no migration — see docs/engineering/round-cockpit-implementation-plan.md).
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 * The logic is split into a PURE evaluator and a thin fetch wrapper so the rule
 * logic is unit-testable without a database:
 *
 *   getRoundWatchlist(tx, roundId)  → batched fetches via `tx`, assembles a plain
 *                                     `WatchlistInput`, then delegates to →
 *   evaluateWatchlist(input, now, thresholds) → PURE. No Prisma / server-only.
 *                                     Returns the ranked, deduped `WatchlistResult`.
 *
 * The pure evaluator + all types + the threshold constants live in
 * `round-watchlist-eval.ts` (zero server imports, so tests can import it in a
 * node environment) and are re-exported here so callers use a single
 * `round-watchlist` module.
 *
 * `getRoundWatchlist` must be called inside an existing `withUserContext(...)`
 * block (staff RLS sees the whole round).
 */

import type { Tx } from "@/lib/db/prisma";
import { ApplicationStatus } from "@prisma/client";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { getSectionGapStatuses } from "@/lib/portal/section-gaps";
import {
  evaluateWatchlist,
  WATCHLIST_THRESHOLDS,
  type WatchlistInput,
  type WatchlistInputApplication,
  type WatchlistInputExport,
  type WatchlistResult,
} from "./round-watchlist-eval";

// Re-export the pure surface so consumers import from a single module.
export {
  evaluateWatchlist,
  WATCHLIST_THRESHOLDS,
} from "./round-watchlist-eval";
export type {
  WatchlistThresholds,
  WatchlistRuleId,
  WatchlistSeverity,
  WatchlistRule,
  WatchlistResult,
  WatchlistInput,
  WatchlistInputInvitation,
  WatchlistInputApplication,
  WatchlistInputRound,
  WatchlistInputExport,
} from "./round-watchlist-eval";

// ─── Fetch wrapper ───────────────────────────────────────────────────────────────

const RULE3_DOC_CHECK_CHUNK = 8;

/**
 * Fetch the round's data and evaluate the 8 watchlist rules.
 *
 * Must run inside a `withUserContext(...)` transaction (staff RLS sees the whole
 * round). Batches its reads with `Promise.all`; the audit reads are scoped to
 * the round's application + assessment ids (the table is indexed on
 * `[entityType, entityId]`), so no per-application audit query runs in a loop.
 *
 * @returns the evaluated `WatchlistResult`, or null when the round is not found.
 */
export async function getRoundWatchlist(
  tx: Tx,
  roundId: string,
  now: Date = new Date(),
): Promise<WatchlistResult | null> {
  // ── 1. Round + its applications (with assessment + recommendation facts) ────
  const [round, applications, invitations] = await Promise.all([
    tx.round.findUnique({
      where: { id: roundId },
      select: { id: true, status: true, closeDate: true },
    }),
    tx.application.findMany({
      where: { roundId },
      select: {
        id: true,
        school: true,
        status: true,
        assessment: {
          select: {
            id: true,
            status: true,
            recommendation: { select: { createdAt: true } },
          },
        },
      },
    }),
    tx.invitation.findMany({
      where: { roundId },
      select: {
        id: true,
        status: true,
        bursaryAccountId: true,
        createdAt: true,
        expiresAt: true,
        acceptedAt: true,
      },
    }),
  ]);

  if (!round) return null;

  const applicationIds = applications.map((a) => a.id);
  const assessmentIds = applications
    .map((a) => a.assessment?.id)
    .filter((id): id is string => id != null);
  const auditEntityIds = [...applicationIds, ...assessmentIds];

  // ── 2. Audit-derived facts (rules 4 & 5) + export rows (rule 7) ─────────────
  //
  // - latest audit event per entity id (rule 5 "stalled")  → groupBy max
  // - latest pause event per entity id (rule 4 "paused")   → groupBy max,
  //   filtered to the pause actions. Pause is recorded as ASSESSMENT_PAUSE on
  //   the Assessment (entityId = assessmentId) AND/OR APPLICATION_PAUSED on the
  //   Application (entityId = applicationId), so we group across both ids.
  // - RECOMMENDATION_EXPORT rows for the round (rule 7).
  const [latestAnyByEntity, latestPauseByEntity, exportRows] = await Promise.all(
    [
      auditEntityIds.length > 0
        ? tx.auditLog.groupBy({
            by: ["entityId"],
            where: {
              entityType: {
                in: [
                  AUDIT_ENTITY_TYPES.Application,
                  AUDIT_ENTITY_TYPES.Assessment,
                ],
              },
              entityId: { in: auditEntityIds },
            },
            _max: { createdAt: true },
          })
        : Promise.resolve(
            [] as Array<{ entityId: string | null; _max: { createdAt: Date | null } }>,
          ),
      auditEntityIds.length > 0
        ? tx.auditLog.groupBy({
            by: ["entityId"],
            where: {
              action: {
                in: [
                  AUDIT_ACTIONS.ASSESSMENT_PAUSE,
                  AUDIT_ACTIONS.APPLICATION_PAUSED,
                ],
              },
              entityId: { in: auditEntityIds },
            },
            _max: { createdAt: true },
          })
        : Promise.resolve(
            [] as Array<{ entityId: string | null; _max: { createdAt: Date | null } }>,
          ),
      tx.auditLog.findMany({
        where: {
          action: AUDIT_ACTIONS.RECOMMENDATION_EXPORT,
          entityType: AUDIT_ENTITY_TYPES.Round,
          entityId: roundId,
        },
        select: { createdAt: true, metadata: true },
      }),
    ],
  );

  const latestAnyMap = new Map<string, Date>();
  for (const row of latestAnyByEntity) {
    if (row.entityId && row._max.createdAt) {
      latestAnyMap.set(row.entityId, row._max.createdAt);
    }
  }
  const latestPauseMap = new Map<string, Date>();
  for (const row of latestPauseByEntity) {
    if (row.entityId && row._max.createdAt) {
      latestPauseMap.set(row.entityId, row._max.createdAt);
    }
  }

  // ── 3. Rule 3 doc-completeness (bounded concurrency) ────────────────────────
  //
  // Perf decision: `getSectionGapStatuses` is reused as-is (it is the single
  // source of truth for doc-completeness, so a leaner batched re-implementation
  // would risk drifting from the submit gate). It makes 2 DB round-trips per
  // application, so we run it ONLY over SUBMITTED apps (the only ones the rule
  // can fire on) and cap concurrency at RULE3_DOC_CHECK_CHUNK so a large round
  // can't open hundreds of connections at once. With ~100–200 apps/round and a
  // far smaller SUBMITTED subset this stays well within the request budget under
  // `force-dynamic`; revisit with a set-wise doc-slot query only if it shows up
  // slow in practice.
  const submittedIds = applications
    .filter((a) => a.status === ApplicationStatus.SUBMITTED)
    .map((a) => a.id);

  const missingDocsSet = new Set<string>();
  for (let i = 0; i < submittedIds.length; i += RULE3_DOC_CHECK_CHUNK) {
    const chunk = submittedIds.slice(i, i + RULE3_DOC_CHECK_CHUNK);
    const results = await Promise.all(
      chunk.map(async (appId) => {
        const statuses = await getSectionGapStatuses(appId);
        const hasError = statuses.some((s) =>
          s.gaps.some((g) => g.severity === "error"),
        );
        return { appId, hasError };
      }),
    );
    for (const r of results) {
      if (r.hasError) missingDocsSet.add(r.appId);
    }
  }

  // ── 4. Assemble the pure input ──────────────────────────────────────────────
  const inputApplications: WatchlistInputApplication[] = applications.map(
    (app) => {
      const assessmentId = app.assessment?.id ?? null;
      // Latest "any" audit across the application id and its assessment id.
      let latestAnyAuditAt: Date | null = latestAnyMap.get(app.id) ?? null;
      if (assessmentId) {
        const assAny = latestAnyMap.get(assessmentId);
        if (assAny && (!latestAnyAuditAt || assAny > latestAnyAuditAt)) {
          latestAnyAuditAt = assAny;
        }
      }
      // Latest pause across the application id and its assessment id.
      let latestPauseAt: Date | null = latestPauseMap.get(app.id) ?? null;
      if (assessmentId) {
        const assPause = latestPauseMap.get(assessmentId);
        if (assPause && (!latestPauseAt || assPause > latestPauseAt)) {
          latestPauseAt = assPause;
        }
      }

      return {
        id: app.id,
        school: app.school,
        status: app.status,
        assessmentId,
        assessmentStatus: app.assessment?.status ?? null,
        recommendationCreatedAt:
          app.assessment?.recommendation?.createdAt ?? null,
        hasMissingDocs: missingDocsSet.has(app.id),
        latestPauseAt,
        latestAnyAuditAt,
      };
    },
  );

  // Round counts (mirror rounds.ts / getDashboardCounts conventions).
  const total = applications.length;
  const qualifies = applications.filter(
    (a) => a.status === ApplicationStatus.QUALIFIES,
  ).length;
  const doesNotQualify = applications.filter(
    (a) => a.status === ApplicationStatus.DOES_NOT_QUALIFY,
  ).length;

  const exports: WatchlistInputExport[] = exportRows.map((row) => {
    const meta = (row.metadata ?? {}) as { school?: unknown };
    const school = typeof meta.school === "string" ? meta.school : "ALL";
    return { school, createdAt: row.createdAt };
  });

  const input: WatchlistInput = {
    round: {
      id: round.id,
      status: round.status,
      closeDate: round.closeDate,
      total,
      qualifies,
      doesNotQualify,
    },
    invitations: invitations.map((inv) => ({
      id: inv.id,
      status: inv.status,
      bursaryAccountId: inv.bursaryAccountId,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
    })),
    applications: inputApplications,
    exports,
  };

  return evaluateWatchlist(input, now, WATCHLIST_THRESHOLDS);
}
