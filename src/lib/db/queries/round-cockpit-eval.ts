/**
 * round-cockpit-eval.ts — the PURE derivations for the Round Cockpit (#18)
 * Stage D landing surface.
 *
 * Mirrors the split used by the watchlist: this file holds the deterministic
 * derivation logic + types with ZERO server-only / Prisma-client imports (only
 * the `@prisma/client` enums, which are plain values). That keeps it
 * unit-testable in a node environment without dragging the DB-bound fetcher's
 * module graph (`server-only`, the Prisma client) into the test.
 *
 * The fetch wrapper `getRoundCockpit(tx, roundId)` lives in `round-cockpit.ts`,
 * which re-exports everything here so consumers import from a single module.
 */

import { RoundStatus, School } from "@prisma/client";
import type {
  WatchlistResult,
  WatchlistRuleId,
} from "./round-watchlist-eval";

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Time-progress ────────────────────────────────────────────────────────────

export interface TimeProgressInput {
  openDate: Date;
  closeDate: Date;
  status: RoundStatus;
}

export interface TimeProgress {
  /** 1-based day index into the open→close window, clamped to [1, totalDays]. */
  dayN: number;
  /** Total inclusive days from open to close (>= 1). */
  totalDays: number;
  /** Whole days remaining until close; 0 once closed or past the close date. */
  daysToClose: number;
  /** Applications not yet decided. */
  undecided: number;
  /**
   * Decisions/day needed to clear `undecided` before close. 0 when nothing is
   * left to decide, when the round is CLOSED, or when there are no days left.
   */
  decisionsPerDayRequired: number;
  /** Decisions/day achieved so far ≈ decisionsToDate / max(dayN, 1). */
  decisionsPerDayActual: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Derive the time/progress gauge numbers.
 *
 * Clamping rules:
 *   - `totalDays` is at least 1 (guards a same-day or inverted open/close).
 *   - `dayN` is clamped to [1, totalDays] (before open → 1, after close →
 *     totalDays) so the gauge never shows "day 0" or overflows.
 *   - `daysToClose` is 0 once the round is CLOSED or `now` is at/after close;
 *     otherwise the whole-day ceiling of the remaining window.
 *   - `decisionsPerDayRequired` is 0 when there is nothing left to decide, the
 *     round is CLOSED, or `daysToClose` is 0 (avoids divide-by-zero / negatives).
 *   - `decisionsPerDayActual` divides by `max(dayN, 1)` so an open round on its
 *     first day never divides by zero.
 */
export function deriveTimeProgress(
  input: TimeProgressInput,
  decided: number,
  total: number,
  decisionsToDate: number,
  now: Date = new Date(),
): TimeProgress {
  const nowMs = now.getTime();
  const openMs = input.openDate.getTime();
  const closeMs = input.closeDate.getTime();

  // Total inclusive span, never below 1 day.
  const spanDays = Math.ceil((closeMs - openMs) / DAY_MS);
  const totalDays = Math.max(1, spanDays);

  // Elapsed days since open (1-based), clamped into the window.
  const elapsed = Math.ceil((nowMs - openMs) / DAY_MS);
  const dayN = Math.min(totalDays, Math.max(1, elapsed));

  const isClosed = input.status === RoundStatus.CLOSED;
  const pastClose = nowMs >= closeMs;
  const daysToClose =
    isClosed || pastClose ? 0 : Math.max(0, Math.ceil((closeMs - nowMs) / DAY_MS));

  const undecided = Math.max(0, total - decided);

  const decisionsPerDayRequired =
    isClosed || daysToClose <= 0 || undecided <= 0
      ? 0
      : round1(undecided / daysToClose);

  const decisionsPerDayActual = round1(
    Math.max(0, decisionsToDate) / Math.max(dayN, 1),
  );

  return {
    dayN,
    totalDays,
    daysToClose,
    undecided,
    decisionsPerDayRequired,
    decisionsPerDayActual,
  };
}

// ─── Stage strip ────────────────────────────────────────────────────────────────

export type StageKey =
  | "setup"
  | "invitations"
  | "submissions"
  | "assessment"
  | "decision"
  | "export"
  | "closed";

export type StageState = "not_yet" | "live" | "complete" | "blocked";

export interface StageNode {
  key: StageKey;
  label: string;
  state: StageState;
}

/** Counts shape passed through from `getRound` (`RoundDetail.counts`). */
export interface StageStripCounts {
  preSubmission: number;
  submitted: number;
  inProgress: number;
  complete: number;
  total: number;
}

export interface StageActivity {
  /** At least one invitation exists for the round. */
  hasInvitations: boolean;
  /** At least one assessment row exists. */
  hasAssessments: boolean;
  /** At least one recommendation exists. */
  hasRecommendations: boolean;
  /** At least one RECOMMENDATION_EXPORT has been written for the round. */
  hasExports: boolean;
}

/**
 * Which watchlist rule ids "touch" each stage. A node turns `blocked` when the
 * live watchlist surfaces any of its rules with count > 0. Rule ids are the
 * canonical ones from `round-watchlist-eval.ts`.
 */
const STAGE_RULE_MAP: Partial<Record<StageKey, WatchlistRuleId[]>> = {
  invitations: ["INVITES_PENDING", "REASSESS_INVITE_EXPIRING"],
  assessment: ["SUBMITTED_MISSING_DOCS", "ASSESSMENT_PAUSED", "ASSESSMENT_STALLED"],
  decision: ["RECOMMENDATION_AWAITING_OUTCOME", "CLOSE_APPROACHING_UNDECIDED"],
  export: ["READY_NOT_EXPORTED"],
};

const STAGE_LABELS: Record<StageKey, string> = {
  setup: "Setup",
  invitations: "Invitations Sent",
  submissions: "Submissions Open",
  assessment: "Assessment",
  decision: "Decision",
  export: "Export",
  closed: "Closed",
};

/**
 * Derive the 7-node stage strip.
 *
 * Two layers:
 *
 *   1. A `blocked` overlay — if any watchlist rule mapped to a stage has
 *      count > 0, that node is `blocked` regardless of its progress state. This
 *      is the "red rule lights the stage" requirement; it takes precedence over
 *      not_yet/live/complete because an open block is the thing the operator
 *      must act on.
 *
 *   2. A base progress state from round status + counts + activity flags:
 *
 *      - setup        → DRAFT ⇒ `live` (still being set up); any other status
 *                       ⇒ `complete` (the round has moved past setup).
 *      - invitations  → no invitations yet ⇒ `not_yet`; DRAFT with invitations
 *                       ⇒ `live`; otherwise (OPEN/CLOSED with invitations)
 *                       ⇒ `complete` (the send happened).
 *      - submissions  → OPEN ⇒ `live` (window is open); CLOSED ⇒ `complete`;
 *                       DRAFT ⇒ `not_yet`.
 *      - assessment   → no assessments yet ⇒ `not_yet`; all decided
 *                       (complete === total, total > 0) ⇒ `complete`;
 *                       otherwise ⇒ `live`.
 *      - decision     → nothing decided yet (complete === 0) ⇒ `not_yet`;
 *                       every application decided ⇒ `complete`; otherwise
 *                       ⇒ `live`.
 *      - export       → no exports yet ⇒ `not_yet`; CLOSED with exports
 *                       ⇒ `complete`; otherwise (exports underway) ⇒ `live`.
 *      - closed       → CLOSED ⇒ `complete`; otherwise ⇒ `not_yet`. Never
 *                       `blocked` (no rule maps to it).
 *
 * `complete` here uses the round's "complete" bucket = QUALIFIES + DNQ +
 * COMPLETED (see rounds.ts buildCounts); "decided" for the decision node is
 * the same bucket because a decided application is in it.
 */
export function deriveStageStrip(
  status: RoundStatus,
  counts: StageStripCounts,
  watchlist: WatchlistResult,
  activity: StageActivity,
): StageNode[] {
  const blockedRuleIds = new Set<WatchlistRuleId>(
    watchlist.rules.filter((r) => r.count > 0).map((r) => r.id),
  );

  const isDraft = status === RoundStatus.DRAFT;
  const isOpen = status === RoundStatus.OPEN;
  const isClosed = status === RoundStatus.CLOSED;
  const total = counts.total;
  const allDecided = total > 0 && counts.complete === total;

  function base(key: StageKey): StageState {
    switch (key) {
      case "setup":
        return isDraft ? "live" : "complete";
      case "invitations":
        if (!activity.hasInvitations) return "not_yet";
        return isDraft ? "live" : "complete";
      case "submissions":
        if (isOpen) return "live";
        if (isClosed) return "complete";
        return "not_yet";
      case "assessment":
        if (!activity.hasAssessments) return "not_yet";
        return allDecided ? "complete" : "live";
      case "decision":
        if (counts.complete === 0) return "not_yet";
        return allDecided ? "complete" : "live";
      case "export":
        if (!activity.hasExports) return "not_yet";
        return isClosed ? "complete" : "live";
      case "closed":
        return isClosed ? "complete" : "not_yet";
    }
  }

  const keys: StageKey[] = [
    "setup",
    "invitations",
    "submissions",
    "assessment",
    "decision",
    "export",
    "closed",
  ];

  return keys.map((key) => {
    const rulesForStage = STAGE_RULE_MAP[key] ?? [];
    const blocked = rulesForStage.some((id) => blockedRuleIds.has(id));
    return {
      key,
      label: STAGE_LABELS[key],
      state: blocked ? "blocked" : base(key),
    };
  });
}

// ─── Export readiness ────────────────────────────────────────────────────────────

export interface ExportReadinessInput {
  school: School;
  /** Decided applications (QUALIFIES + DNQ) for this school that have a recommendation. */
  decided: number;
  /** Latest decision (recommendation.createdAt) for this school, or null. */
  latestDecisionAt: Date | null;
  /** Latest RECOMMENDATION_EXPORT covering this school (school or "ALL"), or null. */
  lastExportedAt: Date | null;
}

export interface ExportReadiness {
  school: School;
  decided: number;
  lastExportedAt: Date | null;
  /**
   * True when there are decided recommendations AND an export covers the latest
   * decision (lastExportedAt strictly after latestDecisionAt). Mirrors the
   * watchlist rule-7 "covered by export" notion: an export taken before the
   * newest decision does not count.
   */
  allExported: boolean;
}

/**
 * Derive per-school export readiness. `allExported` is false whenever a school
 * has decided recommendations but no covering export, matching the watchlist
 * READY_NOT_EXPORTED rule so the panel and the lane never disagree.
 */
export function deriveExportReadiness(
  rows: ExportReadinessInput[],
): ExportReadiness[] {
  return rows.map((row) => {
    const hasDecided = row.decided > 0;
    const covered =
      row.lastExportedAt !== null &&
      (row.latestDecisionAt === null ||
        row.lastExportedAt.getTime() > row.latestDecisionAt.getTime());
    return {
      school: row.school,
      decided: row.decided,
      lastExportedAt: row.lastExportedAt,
      allExported: hasDecided && covered,
    };
  });
}
