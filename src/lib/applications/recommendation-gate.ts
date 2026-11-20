/**
 * The v2 recommendation re-confirmation gate (Epic 13 / C1, D13-2), extracted
 * from `set-outcome-core.ts` so the Epic 18 post-assessment core can apply the
 * same rule without transitively importing the email module (which the new
 * lifecycle deliberately never uses — Q11).
 */

import { selectEngineVersion } from "@/lib/assessment/engine-version";
import { isMigrated, MIGRATED_LOCKED_MESSAGE } from "@/lib/applications/migration-source";

/** User-facing refusal when a recommendation's payable fees are unconfirmed. */
export const RECOMMENDATION_NOT_RECONFIRMED_MESSAGE =
  "The payable fees on this recommendation have not been confirmed against " +
  "the assessment's current figures — reopening or changing an assessment " +
  "needs a fresh confirmation. Confirm them on the recommendation screen " +
  "before setting an outcome.";

/** A money value (Decimal | number) in whole pence, for exact comparison. */
function toPence(value: unknown): number {
  return Math.round(Number(value) * 100);
}

/**
 * Re-confirmation gate (Epic 13 / C1, D13-2).
 *
 * Reopening a COMPLETED assessment clears the recommendation's
 * `confirmedPayableFees` — the assessor's sign-off on a figure derived from an
 * assessment that has since been reopened and possibly corrected. Deciding on
 * it afterwards would promote a bursary account off a number nobody has looked
 * at since the correction (`promoteToActiveAccount` walks confirmed →
 * recommended → legacy for the benchmark). So: a v2 recommendation that exists
 * but carries no confirmed figure is stale, and cannot decide anything.
 *
 * Scoped so no pre-existing flow changes:
 *   - v1 assessments never populate `confirmedPayableFees` (a CALC-08/v2
 *     field), so they are exempt outright.
 *   - An assessment with NO recommendation row is exempt — nothing was ever
 *     recorded, so there is nothing stale, and the pre-recommendation outcome
 *     paths keep working unchanged.
 *
 * Reopen is the main way to reach the blocked state, but deliberately not the
 * only one: a v2 recommendation whose payable fees were NEVER confirmed is the
 * same defect wearing different clothes, and it should not decide an award
 * either. Both clear the same way — confirm the figure and save.
 *
 * Audit 20 Nov 2026 (finding 10): a confirmation made against an OLDER
 * recommended figure is stale too. The v2 form can be confirmed while the
 * assessment is still IN_PROGRESS, and a later assessment save moves the
 * assessment's `recommendedPayableFees` without touching the confirmation —
 * so the stored gap (and the gap-reason rule) describe a figure that no longer
 * exists. When both the recommendation's stored recommended figure and the
 * assessment's current one are present and differ by a penny or more, the
 * assessor must re-confirm (which recomputes the gap and re-applies the
 * gap-reason rule). A recommendation row with no stored recommended figure
 * (pre-CALC-08 rows) is not judged stale on this ground.
 */
export function needsRecommendationReconfirmation(assessment: {
  calculationVersion: number | null;
  recommendedPayableFees?: unknown;
  recommendation: {
    confirmedPayableFees: unknown;
    recommendedPayableFees?: unknown;
  } | null;
} | null): boolean {
  if (!assessment) return false;
  if (selectEngineVersion(assessment.calculationVersion) !== "v2") return false;
  const rec = assessment.recommendation;
  if (!rec) return false;
  if (rec.confirmedPayableFees == null) return true;
  return (
    rec.recommendedPayableFees != null &&
    assessment.recommendedPayableFees != null &&
    toPence(rec.recommendedPayableFees) !== toPence(assessment.recommendedPayableFees)
  );
}

// ─── Recommendation save lock (audit 20 Nov 2026, finding 12b) ───────────────

/**
 * The ONLY assessment statuses in which a recommendation's figures may be
 * saved: the assessment is being worked on, or is stored as complete and
 * awaiting its lock. An allowlist, so any status added later defaults to
 * locked (the lesson of the 10 Sep 2026 save-gate bug).
 */
export const RECOMMENDATION_EDITABLE_ASSESSMENT_STATUSES = [
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
] as const;

export const RECOMMENDATION_DECIDED_MESSAGE =
  "This award has been decided, so its recommendation can no longer be " +
  "changed. Reverse the decision first if it needs to change.";

export const RECOMMENDATION_NOT_STARTED_MESSAGE =
  "Save the assessment before recording a recommendation.";

export const RECOMMENDATION_APPLICATION_CLOSED_MESSAGE =
  "This application has been closed, so its recommendation can no longer be changed.";

/**
 * Whether a recommendation save (confirmed payable fees, gap, scholarship %)
 * may write. A stale tab or a direct server-action call must not rewrite the
 * figures of a locked, closed or migrated award.
 */
export function recommendationSaveLock(application: {
  closedAt: Date | null;
  migrationSource: string | null;
  assessment: { status: string };
}): { locked: false } | { locked: true; message: string } {
  if (isMigrated(application)) return { locked: true, message: MIGRATED_LOCKED_MESSAGE };
  if (application.closedAt != null) {
    return { locked: true, message: RECOMMENDATION_APPLICATION_CLOSED_MESSAGE };
  }
  const status = application.assessment.status;
  if ((RECOMMENDATION_EDITABLE_ASSESSMENT_STATUSES as readonly string[]).includes(status)) {
    return { locked: false };
  }
  return {
    locked: true,
    message:
      status === "NOT_STARTED"
        ? RECOMMENDATION_NOT_STARTED_MESSAGE
        : RECOMMENDATION_DECIDED_MESSAGE,
  };
}
