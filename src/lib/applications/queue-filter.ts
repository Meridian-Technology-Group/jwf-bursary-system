/**
 * Queue review-phase filter — Epic 01 PR-6a.
 *
 * The admin queue used to filter on the deprecated fused `applications.status`
 * enum (7 values). PR-6a removes that column from the read path; this module is
 * the single place that translates the same 7-value "review phase" vocabulary
 * (preserved verbatim so existing filter UI + drill-in URLs keep working) onto
 * the THREE lifecycle columns (`form_status`, `assessments.status`,
 * `assessments.outcome`).
 *
 * Two surfaces consume it:
 *   - the server query (`listApplications`) builds a Prisma `where` from a set
 *     of selected phases via `reviewPhaseWhere`.
 *   - the client table filters already-fetched rows via `matchesReviewPhase`.
 *
 * This file has ZERO server-only / Prisma-client imports (only the
 * `Prisma`/enum *types*, which are erased), so it is safe to import from a
 * client component.
 */

import type {
  Prisma,
  ApplicationFormStatus,
  AssessmentStatus,
  AssessmentOutcome,
} from "@prisma/client";

/**
 * The 7-value review-phase vocabulary the queue filter speaks. Names match the
 * old fused `ApplicationStatus` enum verbatim so URL params (`?status=PAUSED`),
 * the multi-select labels and cockpit drill-in links read unchanged. This is a
 * DERIVED projection of the lifecycle columns, not a stored column.
 */
export type ReviewPhase =
  | "PRE_SUBMISSION"
  | "SUBMITTED"
  | "NOT_STARTED"
  | "PAUSED"
  | "COMPLETED"
  | "QUALIFIES"
  | "DOES_NOT_QUALIFY";

/** Every review phase, in canonical (old-enum) order. */
export const ALL_REVIEW_PHASES: ReviewPhase[] = [
  "PRE_SUBMISSION",
  "SUBMITTED",
  "NOT_STARTED",
  "PAUSED",
  "COMPLETED",
  "QUALIFIES",
  "DOES_NOT_QUALIFY",
];

/** Minimal lifecycle facts a row exposes for client-side phase matching. */
export interface ReviewPhaseFacts {
  formStatus: ApplicationFormStatus;
  assessmentStatus: AssessmentStatus | null;
  outcome: AssessmentOutcome | null;
}

/**
 * Client-side predicate: does this row's lifecycle state match the given review
 * phase? Mirrors `deriveReviewPhase` exactly (single source of truth for the
 * mapping is the precedence here):
 *
 *   QUALIFIES        outcome AWARDED | QUALIFIES_NOT_AWARDED
 *   DOES_NOT_QUALIFY outcome DOES_NOT_QUALIFY
 *   COMPLETED        assessment COMPLETED, no outcome
 *   PAUSED           assessment PAUSED
 *   NOT_STARTED      assessment IN_PROGRESS (review in progress)
 *   SUBMITTED        form SUBMITTED, assessment ∅ | NOT_STARTED, no outcome
 *   PRE_SUBMISSION   form not SUBMITTED
 */
export function matchesReviewPhase(
  facts: ReviewPhaseFacts,
  phase: ReviewPhase
): boolean {
  const { formStatus, assessmentStatus, outcome } = facts;

  switch (phase) {
    case "QUALIFIES":
      return outcome === "AWARDED" || outcome === "QUALIFIES_NOT_AWARDED";
    case "DOES_NOT_QUALIFY":
      return outcome === "DOES_NOT_QUALIFY";
    case "COMPLETED":
      return outcome == null && assessmentStatus === "COMPLETED";
    case "PAUSED":
      return outcome == null && assessmentStatus === "PAUSED";
    case "NOT_STARTED":
      return outcome == null && assessmentStatus === "IN_PROGRESS";
    case "SUBMITTED":
      return (
        outcome == null &&
        formStatus === "SUBMITTED" &&
        (assessmentStatus == null || assessmentStatus === "NOT_STARTED")
      );
    case "PRE_SUBMISSION":
      return formStatus !== "SUBMITTED";
  }
}

/**
 * The Prisma `Application` where-fragment that selects rows in a single review
 * phase, expressed over the lifecycle columns. Used to build the server-side
 * queue filter. Mirrors `matchesReviewPhase`.
 *
 * Note: `assessment` is a 1:1 relation, so `{ is: null }` / `{ isNot: null }`
 * test for the row's presence, and a nested `is: { ... }` matches its columns.
 */
function reviewPhaseFragment(phase: ReviewPhase): Prisma.ApplicationWhereInput {
  switch (phase) {
    case "QUALIFIES":
      return {
        assessment: {
          is: { outcome: { in: ["AWARDED", "QUALIFIES_NOT_AWARDED"] } },
        },
      };
    case "DOES_NOT_QUALIFY":
      return { assessment: { is: { outcome: "DOES_NOT_QUALIFY" } } };
    case "COMPLETED":
      return {
        assessment: { is: { outcome: null, status: "COMPLETED" } },
      };
    case "PAUSED":
      return { assessment: { is: { outcome: null, status: "PAUSED" } } };
    case "NOT_STARTED":
      return { assessment: { is: { outcome: null, status: "IN_PROGRESS" } } };
    case "SUBMITTED":
      return {
        formStatus: "SUBMITTED",
        OR: [
          { assessment: { is: null } },
          { assessment: { is: { outcome: null, status: "NOT_STARTED" } } },
        ],
      };
    case "PRE_SUBMISSION":
      return { formStatus: { not: "SUBMITTED" } };
  }
}

/**
 * Builds a Prisma `where` fragment for a set of selected review phases (OR'd).
 * Returns `undefined` for an empty/absent selection (no filter). For a single
 * phase it returns that phase's fragment directly.
 */
export function reviewPhaseWhere(
  phases: ReviewPhase[] | undefined
): Prisma.ApplicationWhereInput | undefined {
  if (!phases || phases.length === 0) return undefined;
  if (phases.length === 1) return reviewPhaseFragment(phases[0]);
  return { OR: phases.map(reviewPhaseFragment) };
}

/**
 * The Prisma where-fragment for "undecided" applications (no final outcome) —
 * the queue's `undecided` flag and the watchlist's close-approaching rule.
 * Undecided = no assessment outcome yet.
 */
export function undecidedWhere(): Prisma.ApplicationWhereInput {
  return {
    OR: [{ assessment: { is: null } }, { assessment: { is: { outcome: null } } }],
  };
}
