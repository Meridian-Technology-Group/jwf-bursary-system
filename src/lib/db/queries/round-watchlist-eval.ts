/**
 * round-watchlist-eval.ts — the PURE evaluator for the Round Cockpit (#18)
 * "Needs Attention" lane.
 *
 * This file holds the rule logic, types, and threshold constants and has ZERO
 * server-only / Prisma-client imports (only the `@prisma/client` enums, which
 * are plain values). That keeps `evaluateWatchlist` unit-testable in a node
 * environment without dragging the DB-bound fetcher's module graph
 * (`server-only`, the Prisma client) into the test.
 *
 * The fetch wrapper `getRoundWatchlist(tx, roundId)` lives in
 * `round-watchlist.ts`, which re-exports everything here so consumers can keep
 * importing from a single `round-watchlist` module.
 */

import {
  ApplicationStatus,
  AssessmentStatus,
  InvitationStatus,
  RoundStatus,
  School,
} from "@prisma/client";

// ─── Thresholds (hardcoded per locked decision 5) ──────────────────────────────
//
// Exported so tests can reference them rather than hardcoding magic numbers.
// All values are in milliseconds.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const WATCHLIST_THRESHOLDS = {
  /** Rule 1 — invitation considered "aged" once pending this long. */
  invitePending: 14 * DAY_MS,
  /** Rule 2 — reassessment invite "expiring soon" window. */
  reassessExpiring: 48 * HOUR_MS,
  /** Rule 4 — paused assessment "stuck" once the pause is this old. */
  paused: 7 * DAY_MS,
  /** Rule 5 — assessment "stalled" with no audit activity for this long. */
  stalled: 5 * DAY_MS,
  /** Rule 6 — recommendation "awaiting outcome" once this old without a decision. */
  awaitingOutcome: 3 * DAY_MS,
  /** Rule 8 — round close "approaching" within this window. */
  closeApproaching: 7 * DAY_MS,
  /** Rule 8 — undecided headroom that trips the rule. */
  undecidedFloor: 10,
} as const;

export type WatchlistThresholds = typeof WATCHLIST_THRESHOLDS;

// ─── Rule identifiers ───────────────────────────────────────────────────────────

export type WatchlistRuleId =
  | "INVITES_PENDING"
  | "REASSESS_INVITE_EXPIRING"
  | "SUBMITTED_MISSING_DOCS"
  | "ASSESSMENT_PAUSED"
  | "ASSESSMENT_STALLED"
  | "RECOMMENDATION_AWAITING_OUTCOME"
  | "READY_NOT_EXPORTED"
  | "CLOSE_APPROACHING_UNDECIDED";

export type WatchlistSeverity = "warning" | "blocker";

// ─── Public output types ─────────────────────────────────────────────────────────

export interface WatchlistRule {
  id: WatchlistRuleId;
  severity: WatchlistSeverity;
  /** Final, post-dedupe count surfaced in the lane. */
  count: number;
  /** Plain-English, count-aware label. */
  label: string;
  /** Drill-in link (relative path with query). */
  drillHref: string;
  /**
   * The set of application ids this rule "claims" AFTER dedupe. For the
   * non-application-scoped rules (1, 2, 7) this is empty and `count` is the
   * scope-native count instead. Exposed so a consumer (e.g. the stage strip)
   * can correlate a rule to specific applications.
   */
  applicationIds: string[];
}

export interface WatchlistResult {
  /** Rules with count > 0, in render order (blockers first, then rule order). */
  rules: WatchlistRule[];
  /** True when every rule is clear — drives the "All clear" empty state. */
  allClear: boolean;
}

// ─── Pure-evaluator input types ──────────────────────────────────────────────────
//
// Everything `evaluateWatchlist` needs, as plain fetched data. No Prisma model
// instances, no Decimals — assembled by `getRoundWatchlist`.

export interface WatchlistInputInvitation {
  id: string;
  status: InvitationStatus;
  /** Reassessment marker — present when the invite is for an existing account. */
  bursaryAccountId: string | null;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
}

export interface WatchlistInputApplication {
  id: string;
  school: School;
  status: ApplicationStatus;
  /** Assessment id (null when no assessment row exists yet). */
  assessmentId: string | null;
  assessmentStatus: AssessmentStatus | null;
  /** Recommendation.createdAt, or null when no recommendation exists. */
  recommendationCreatedAt: Date | null;
  /**
   * Has any error-severity document gap (rule 3). Pre-computed by the fetcher
   * for SUBMITTED apps only; false for everything else.
   */
  hasMissingDocs: boolean;
  /**
   * Latest pause audit event (`ASSESSMENT_PAUSE` on the assessment, or
   * `APPLICATION_PAUSED` on the application), or null. Rule 4.
   */
  latestPauseAt: Date | null;
  /**
   * Most recent audit event for this application across its own id AND its
   * assessment id (rule 5 "stalled"). Null when there is no audit activity.
   */
  latestAnyAuditAt: Date | null;
}

export interface WatchlistInputRound {
  id: string;
  status: RoundStatus;
  closeDate: Date;
  total: number;
  qualifies: number;
  doesNotQualify: number;
}

export interface WatchlistInputExport {
  /** "TRINITY" | "WHITGIFT" | "ALL" — from RECOMMENDATION_EXPORT metadata.school. */
  school: string;
  createdAt: Date;
}

export interface WatchlistInput {
  round: WatchlistInputRound;
  invitations: WatchlistInputInvitation[];
  applications: WatchlistInputApplication[];
  exports: WatchlistInputExport[];
}

// ─── Label helpers ───────────────────────────────────────────────────────────────

function pluralise(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

// ─── PURE evaluator ──────────────────────────────────────────────────────────────

/**
 * Evaluate all 8 rules against a plain `WatchlistInput`. PURE — deterministic
 * given `(input, now, thresholds)`; no I/O.
 *
 * ── Precedence / dedupe ──────────────────────────────────────────────────────
 * The per-application rules (3, 4, 5, 6, 8) dedupe against each other: an
 * application is claimed by at most ONE of them — the most-severe wins, and
 * within a severity the rule order below wins. Rules 1, 2 and 7 are scoped to
 * invitations / schools respectively, so they never dedupe against the
 * per-application rules (an aged invite or an un-exported school is a distinct
 * concern from a stuck application) — they always report their native count.
 *
 * Rule 8 is round-scoped in its *trigger* (close date) but its "claim" is the
 * set of undecided applications, so it participates in the per-application
 * dedupe: an app already flagged as paused/stalled/awaiting-outcome is the more
 * specific reason and is removed from rule 8's count.
 *
 * Render order: blockers first, then warnings; within each, the canonical rule
 * order (1→8). A rule with a final count of 0 is dropped from `rules`.
 */
export function evaluateWatchlist(
  input: WatchlistInput,
  now: Date,
  thresholds: WatchlistThresholds = WATCHLIST_THRESHOLDS,
): WatchlistResult {
  const nowMs = now.getTime();
  const roundId = input.round.id;

  // ── Rule 1 — invites pending >14d (warning, invitation-scoped) ──────────────
  const rule1Ids = input.invitations
    .filter(
      (inv) =>
        inv.status === InvitationStatus.PENDING &&
        inv.acceptedAt === null &&
        inv.expiresAt.getTime() > nowMs &&
        inv.createdAt.getTime() < nowMs - thresholds.invitePending,
    )
    .map((inv) => inv.id);

  // ── Rule 2 — reassessment invite expiring <48h (warning, invitation-scoped) ─
  const rule2Ids = input.invitations
    .filter(
      (inv) =>
        inv.status === InvitationStatus.PENDING &&
        inv.acceptedAt === null &&
        inv.bursaryAccountId !== null &&
        inv.expiresAt.getTime() > nowMs &&
        inv.expiresAt.getTime() < nowMs + thresholds.reassessExpiring,
    )
    .map((inv) => inv.id);

  // ── Per-application candidate sets (pre-dedupe) ─────────────────────────────

  const decidedStatuses: ApplicationStatus[] = [
    ApplicationStatus.QUALIFIES,
    ApplicationStatus.DOES_NOT_QUALIFY,
  ];

  // Rule 3 — submitted, missing required docs (blocker)
  const rule3Candidates = input.applications
    .filter(
      (app) =>
        app.status === ApplicationStatus.SUBMITTED && app.hasMissingDocs,
    )
    .map((app) => app.id);

  // Rule 4 — assessment paused >7d (warning)
  const rule4Candidates = input.applications
    .filter((app) => {
      const isPaused =
        app.assessmentStatus === AssessmentStatus.PAUSED ||
        app.status === ApplicationStatus.PAUSED;
      return (
        isPaused &&
        app.latestPauseAt !== null &&
        app.latestPauseAt.getTime() < nowMs - thresholds.paused
      );
    })
    .map((app) => app.id);

  // Rule 5 — assessment stalled (warning): assessment exists, not COMPLETED,
  // no audit event in >5d. Apps with no audit activity at all (latestAnyAuditAt
  // null) DO trip — an assessment that has produced zero events is the worst
  // case of stalled.
  const rule5Candidates = input.applications
    .filter((app) => {
      if (app.assessmentId === null) return false;
      if (app.assessmentStatus === AssessmentStatus.COMPLETED) return false;
      const latest = app.latestAnyAuditAt;
      return latest === null || latest.getTime() < nowMs - thresholds.stalled;
    })
    .map((app) => app.id);

  // Rule 6 — recommendation awaiting outcome >3d (blocker)
  const rule6Candidates = input.applications
    .filter(
      (app) =>
        app.recommendationCreatedAt !== null &&
        app.recommendationCreatedAt.getTime() <
          nowMs - thresholds.awaitingOutcome &&
        !decidedStatuses.includes(app.status),
    )
    .map((app) => app.id);

  // Rule 8 — close approaching with undecided (blocker). Trigger is round-scoped;
  // the claimed set is the undecided applications (so it can dedupe).
  const undecidedAppIds = input.applications
    .filter((app) => !decidedStatuses.includes(app.status))
    .map((app) => app.id);
  const closeMs = input.round.closeDate.getTime();
  const undecidedCount =
    input.round.total - input.round.qualifies - input.round.doesNotQualify;
  const rule8Fires =
    input.round.status !== RoundStatus.CLOSED &&
    closeMs > nowMs &&
    closeMs < nowMs + thresholds.closeApproaching &&
    undecidedCount > thresholds.undecidedFloor;
  const rule8Candidates = rule8Fires ? undecidedAppIds : [];

  // ── Rule 7 — ready but not exported (blocker, school-scoped) ────────────────
  //
  // Interpretation (documented): for each school, find the latest decision time
  // (max createdAt of recommendations whose application is QUALIFIES/DNQ for
  // that school). Use recommendationCreatedAt as the decision timestamp — a
  // decided application always has a recommendation. A school is FLAGGED when it
  // has ≥1 decided recommendation AND there is NO RECOMMENDATION_EXPORT for the
  // round (with metadata.school === that school OR "ALL") whose createdAt is
  // strictly AFTER that latest decision. An export taken before the most-recent
  // decision does not "cover" the newer decision, so the school re-flags.
  const latestDecisionPerSchool = new Map<School, number>();
  for (const app of input.applications) {
    if (!decidedStatuses.includes(app.status)) continue;
    if (app.recommendationCreatedAt === null) continue;
    const t = app.recommendationCreatedAt.getTime();
    const prev = latestDecisionPerSchool.get(app.school);
    if (prev === undefined || t > prev) {
      latestDecisionPerSchool.set(app.school, t);
    }
  }
  // Latest export covering each concrete school = max(createdAt) of exports whose
  // metadata.school is that school OR "ALL".
  function latestExportCovering(school: School): number {
    let max = -Infinity;
    for (const exp of input.exports) {
      if (exp.school === school || exp.school === "ALL") {
        const t = exp.createdAt.getTime();
        if (t > max) max = t;
      }
    }
    return max;
  }
  const rule7Schools: School[] = [];
  for (const [school, decisionAt] of Array.from(
    latestDecisionPerSchool.entries(),
  )) {
    if (latestExportCovering(school) <= decisionAt) {
      rule7Schools.push(school);
    }
  }

  // ── Per-application dedupe (rules 3,4,5,6,8) ────────────────────────────────
  //
  // Walk the per-application rules in precedence order (most-severe first, then
  // canonical order). Each application id is claimed by the FIRST rule that
  // wants it; later rules drop it.
  //
  // Precedence order:
  //   blockers: 3 (missing docs) → 6 (awaiting outcome) → 8 (close+undecided)
  //   warnings: 4 (paused)       → 5 (stalled)
  const claimed = new Set<string>();
  function claim(candidates: string[]): string[] {
    const out: string[] = [];
    for (const id of candidates) {
      if (claimed.has(id)) continue;
      claimed.add(id);
      out.push(id);
    }
    return out;
  }

  const rule3Ids = claim(rule3Candidates);
  const rule6Ids = claim(rule6Candidates);
  const rule8Ids = claim(rule8Candidates);
  const rule4Ids = claim(rule4Candidates);
  const rule5Ids = claim(rule5Candidates);

  // ── Assemble rule descriptors ───────────────────────────────────────────────
  const all: WatchlistRule[] = [
    {
      id: "SUBMITTED_MISSING_DOCS",
      severity: "blocker",
      count: rule3Ids.length,
      label: `${rule3Ids.length} submitted ${pluralise(
        rule3Ids.length,
        "application is",
        "applications are",
      )} missing required documents`,
      drillHref: `/queue?roundId=${roundId}&docsMissing=1`,
      applicationIds: rule3Ids,
    },
    {
      id: "RECOMMENDATION_AWAITING_OUTCOME",
      severity: "blocker",
      count: rule6Ids.length,
      label: `${rule6Ids.length} ${pluralise(
        rule6Ids.length,
        "recommendation has",
        "recommendations have",
      )} awaited an outcome for over 3 days`,
      drillHref: `/queue?roundId=${roundId}&awaitingOutcome=1`,
      applicationIds: rule6Ids,
    },
    {
      id: "READY_NOT_EXPORTED",
      severity: "blocker",
      count: rule7Schools.length,
      label: `${rule7Schools.length} ${pluralise(
        rule7Schools.length,
        "school has",
        "schools have",
      )} decided recommendations not yet exported`,
      drillHref: `/exports?roundId=${roundId}`,
      applicationIds: [],
    },
    {
      id: "CLOSE_APPROACHING_UNDECIDED",
      severity: "blocker",
      count: rule8Ids.length,
      label: `Round closes within 7 days with ${rule8Ids.length} undecided ${pluralise(
        rule8Ids.length,
        "application",
        "applications",
      )}`,
      drillHref: `/queue?roundId=${roundId}&undecided=1`,
      applicationIds: rule8Ids,
    },
    {
      id: "INVITES_PENDING",
      severity: "warning",
      count: rule1Ids.length,
      label: `${rule1Ids.length} ${pluralise(
        rule1Ids.length,
        "invitation has",
        "invitations have",
      )} been pending for over 14 days`,
      drillHref: `/invitations?status=pending&aged=14`,
      applicationIds: [],
    },
    {
      id: "REASSESS_INVITE_EXPIRING",
      severity: "warning",
      count: rule2Ids.length,
      label: `${rule2Ids.length} reassessment ${pluralise(
        rule2Ids.length,
        "invitation expires",
        "invitations expire",
      )} within 48 hours`,
      drillHref: `/invitations?type=reassessment&expiring=48h`,
      applicationIds: [],
    },
    {
      id: "ASSESSMENT_PAUSED",
      severity: "warning",
      count: rule4Ids.length,
      label: `${rule4Ids.length} ${pluralise(
        rule4Ids.length,
        "assessment has",
        "assessments have",
      )} been paused for over 7 days`,
      drillHref: `/queue?roundId=${roundId}&status=PAUSED`,
      applicationIds: rule4Ids,
    },
    {
      id: "ASSESSMENT_STALLED",
      severity: "warning",
      count: rule5Ids.length,
      label: `${rule5Ids.length} ${pluralise(
        rule5Ids.length,
        "assessment has",
        "assessments have",
      )} had no activity for over 5 days`,
      drillHref: `/queue?roundId=${roundId}&stale=1`,
      applicationIds: rule5Ids,
    },
  ];

  // Render order: blockers before warnings, then canonical rule order. `all` is
  // already in canonical order within each block (blockers 3,6,7,8; warnings
  // 1,2,4,5), and a stable sort by severity preserves that.
  const severityRank: Record<WatchlistSeverity, number> = {
    blocker: 0,
    warning: 1,
  };
  const rules = all
    .filter((r) => r.count > 0)
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return { rules, allClear: rules.length === 0 };
}
