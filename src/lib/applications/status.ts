/**
 * Central status service — Epic 01 PR-3.
 *
 * THE single writer of application/assessment lifecycle status. Owns the legal
 * transition tables for the three lifecycles introduced in Epic 01 (form /
 * assessment / outcome) and is the only place that mutates:
 *   - applications.status        (legacy fused enum — mirrored, retired in PR-6)
 *   - applications.form_status
 *   - applications.application_type   (set at creation only)
 *   - applications.archived_at
 *   - assessments.status
 *   - assessments.outcome
 *   - assessments.paused_until
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DUAL-WRITE (critical until Epic 01 PR-6)
 * ──────────────────────────────────────────────────────────────────────────
 * Most of the app still READS the legacy fused `applications.status` enum
 * (dashboard tiles, reports, queue, round cockpit, watchlist, parent status
 * page). Those readers are migrated in PR-4 and the column is dropped in PR-6.
 * Until then every transition here ALSO mirrors `applications.status` to exactly
 * the value it takes today, so staging behaviour is unchanged. This service is
 * a behaviour-preserving refactor: same observable states, one writer
 * maintaining both the new columns and the legacy mirror.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * TWO PARALLEL TRACKS (preserved from today's code, deliberately not fused)
 * ──────────────────────────────────────────────────────────────────────────
 * Today the application-detail flow drives the fused `applications.status`
 * (begin-review/complete/pause/resume/outcome) WITHOUT an assessment row in
 * scope, while the assessor workspace separately drives `assessments.status`
 * (begin/complete/pause) WITHOUT touching the application. PR-3 keeps both
 * tracks but routes every write through this service:
 *   - `application*` helpers own the fused `applications.status` (+ form_status
 *     + archive + outcome mirror).
 *   - `assessment*` helpers own `assessments.status` / outcome / paused_until.
 * Joining the two tracks into one transition is deferred (PR-4/Epic 03/06);
 * doing it here would change observable behaviour.
 *
 * These primitives do NOT authorise callers or write audit logs — the calling
 * server action keeps owning those (unchanged), so this stays a pure refactor.
 */

import type {
  ApplicationStatus,
  ApplicationFormStatus,
  ApplicationType,
  AssessmentStatus,
  AssessmentOutcome,
  Prisma,
} from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";

// ───────────────────────────────────────────────────────────────────────────
// Legal transition tables
// ───────────────────────────────────────────────────────────────────────────

/**
 * Legacy fused `applications.status` graph — copied verbatim from the previous
 * home of the transition map (src/app/(admin)/applications/[id]/actions.ts) so
 * the validation behaviour is byte-for-byte preserved. PRE_SUBMISSION →
 * SUBMITTED is owned by the applicant submit path (markSubmitted).
 */
const APPLICATION_TRANSITIONS: Partial<
  Record<ApplicationStatus, ApplicationStatus[]>
> = {
  SUBMITTED: ["NOT_STARTED"],
  NOT_STARTED: ["PAUSED", "COMPLETED"],
  PAUSED: ["NOT_STARTED"],
  COMPLETED: ["QUALIFIES", "DOES_NOT_QUALIFY"],
};

/**
 * Form lifecycle: CREATED → NOT_STARTED → IN_PROGRESS → FILLED_IN → SUBMITTED.
 * Pre-submission states are mutually reachable (derivation in PR-4 moves a draft
 * freely among them); SUBMITTED is terminal.
 */
const FORM_TRANSITIONS: Record<ApplicationFormStatus, ApplicationFormStatus[]> = {
  CREATED: ["NOT_STARTED", "IN_PROGRESS", "FILLED_IN", "SUBMITTED"],
  NOT_STARTED: ["CREATED", "IN_PROGRESS", "FILLED_IN", "SUBMITTED"],
  IN_PROGRESS: ["CREATED", "NOT_STARTED", "FILLED_IN", "SUBMITTED"],
  FILLED_IN: ["CREATED", "NOT_STARTED", "IN_PROGRESS", "SUBMITTED"],
  SUBMITTED: [],
};

/**
 * Assessment lifecycle: NOT_STARTED → IN_PROGRESS → (PAUSED ⇄ IN_PROGRESS) →
 * COMPLETED.
 *
 * PR-4 tightens PR-3's permissive table: first assessor save now drives
 * NOT_STARTED → IN_PROGRESS (`startAssessmentIfNotStarted`), so the normal path
 * always passes through IN_PROGRESS. The direct NOT_STARTED → {PAUSED,COMPLETED}
 * edges are retained ONLY as a defensive fallback for the rare case where a
 * pause/complete is requested before any save promoted the row (the form's
 * complete/pause handlers save first, so this should not happen in practice) —
 * see the NOT_STARTED tolerance in `completeAssessmentRow` / `pauseAssessmentRow`.
 * They are NOT advertised as a normal transition.
 */
const ASSESSMENT_TRANSITIONS: Record<AssessmentStatus, AssessmentStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["PAUSED", "COMPLETED"],
  PAUSED: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: [],
};

export function isLegalApplicationTransition(
  from: ApplicationStatus,
  to: ApplicationStatus
): boolean {
  return APPLICATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isLegalFormTransition(
  from: ApplicationFormStatus,
  to: ApplicationFormStatus
): boolean {
  if (from === to) return true;
  return FORM_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isLegalAssessmentTransition(
  from: AssessmentStatus,
  to: AssessmentStatus
): boolean {
  if (from === to) return true;
  return ASSESSMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Outcome may only be set from a COMPLETED assessment (legacy: COMPLETED app). */
export function canSetOutcome(from: ApplicationStatus): boolean {
  return from === "COMPLETED";
}

// ───────────────────────────────────────────────────────────────────────────
// Outcome ↔ legacy fused status mirror
// ───────────────────────────────────────────────────────────────────────────

/** The 3-value outcome lifecycle written to assessments.outcome (Epic 01). */
export type LifecycleOutcome =
  | "AWARDED"
  | "QUALIFIES_NOT_AWARDED"
  | "DOES_NOT_QUALIFY";

/**
 * Legacy mirror for an outcome. AWARDED and QUALIFIES_NOT_AWARDED both map to
 * the old fused `QUALIFIES` (the legacy enum has no "qualifies but not awarded"
 * concept); DOES_NOT_QUALIFY maps to itself. Retired in PR-6.
 */
export function legacyStatusForOutcome(
  outcome: LifecycleOutcome
): ApplicationStatus {
  return outcome === "DOES_NOT_QUALIFY" ? "DOES_NOT_QUALIFY" : "QUALIFIES";
}

/**
 * Maps the legacy binary outcome the UI still passes ("QUALIFIES" |
 * "DOES_NOT_QUALIFY") onto the 3-value lifecycle, using account presence as the
 * AWARDED signal (matches the PR-2 backfill D-note: an account exists ⇒
 * AWARDED, else QUALIFIES_NOT_AWARDED).
 */
export function lifecycleOutcomeForLegacy(
  legacy: "QUALIFIES" | "DOES_NOT_QUALIFY",
  hasBursaryAccount: boolean
): LifecycleOutcome {
  if (legacy === "DOES_NOT_QUALIFY") return "DOES_NOT_QUALIFY";
  return hasBursaryAccount ? "AWARDED" : "QUALIFIES_NOT_AWARDED";
}

// ───────────────────────────────────────────────────────────────────────────
// Form-status derivation (matches the PR-2 backfill exactly)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Required complete-section count for a pre-submission application. Mirrors the
 * PR-2 backfill: SECTION_ORDER is 10 sections; ROLLING_OVER hides FAMILY_ID
 * (HIDDEN_REASSESSMENT_SECTIONS) so requires 9. Keep in lockstep with the
 * portal SECTION_ORDER and reassessment HIDDEN_REASSESSMENT_SECTIONS; runtime
 * and backfill MUST agree.
 */
export function requiredSectionCount(applicationType: ApplicationType): number {
  return applicationType === "ROLLING_OVER" ? 9 : 10;
}

/**
 * Derives the pre-submission form status from completed-section count, using
 * the same rule as the backfill:
 *   complete >= required → FILLED_IN
 *   complete >= 1        → IN_PROGRESS
 *   complete = 0         → CREATED
 *
 * Never returns SUBMITTED (submission is an explicit terminal transition) nor
 * NOT_STARTED (CREATED vs NOT_STARTED needs login telemetry, unavailable here —
 * a zero-complete draft derives to CREATED, matching the backfill default).
 */
export function deriveFormStatusFromCounts(
  completeCount: number,
  applicationType: ApplicationType
): Exclude<ApplicationFormStatus, "SUBMITTED" | "NOT_STARTED"> {
  const required = requiredSectionCount(applicationType);
  if (completeCount >= required) return "FILLED_IN";
  if (completeCount >= 1) return "IN_PROGRESS";
  return "CREATED";
}

/**
 * Reads completed-section count (optionally scoped to one contributor — the
 * lead applicant's PRIMARY contributor on the submit path) and returns the
 * derived pre-submission form status. Does not write.
 */
export async function deriveFormStatus(
  tx: Tx,
  applicationId: string,
  applicationType: ApplicationType,
  ownerContributorId?: string
): Promise<Exclude<ApplicationFormStatus, "SUBMITTED" | "NOT_STARTED">> {
  const completeCount = await tx.applicationSection.count({
    where: {
      applicationId,
      isComplete: true,
      ...(ownerContributorId ? { ownerContributorId } : {}),
    },
  });
  return deriveFormStatusFromCounts(completeCount, applicationType);
}

/**
 * Re-derives and persists the pre-submission `form_status` from current section
 * completion (runtime counterpart to the PR-2 backfill). The single writer of
 * `form_status` during the drafting phase. NEVER overwrites a SUBMITTED form —
 * submission is terminal — so calling this after submit is a safe no-op.
 *
 * Loads the application's type itself so callers on the section-save path don't
 * have to thread it through. Returns the value written (or the unchanged
 * SUBMITTED) for logging/tests.
 */
export async function refreshFormStatus(
  tx: Tx,
  applicationId: string,
  ownerContributorId?: string
): Promise<ApplicationFormStatus> {
  const app = await tx.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { formStatus: true, applicationType: true },
  });
  // Submission is terminal — never demote a submitted form back to a draft state.
  if (app.formStatus === "SUBMITTED") return "SUBMITTED";

  const derived = await deriveFormStatus(
    tx,
    applicationId,
    app.applicationType,
    ownerContributorId
  );
  if (derived !== app.formStatus) {
    await tx.application.update({
      where: { id: applicationId },
      data: { formStatus: derived },
    });
  }
  return derived;
}

// ───────────────────────────────────────────────────────────────────────────
// Application-status writers (legacy fused enum + form_status / archive)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Initial state for a freshly created application. Mirrors today's
 * `status: "PRE_SUBMISSION"` create writes and sets the new `form_status`
 * (CREATED) and `application_type` explicitly. Spread into an
 * `application.create({ data })`.
 */
export function applicationCreateData(
  applicationType: ApplicationType
): Pick<
  Prisma.ApplicationUncheckedCreateInput,
  "status" | "formStatus" | "applicationType"
> {
  return {
    status: "PRE_SUBMISSION",
    formStatus: "CREATED",
    applicationType,
  };
}

/**
 * Submit transition data: legacy status → SUBMITTED, form_status → SUBMITTED.
 * Returned as a patch so the caller can merge submittedAt + other fields and
 * keep its existing "status update in its own transaction" ordering.
 */
export function submitApplicationData(): Pick<
  Prisma.ApplicationUncheckedUpdateInput,
  "status" | "formStatus"
> {
  return { status: "SUBMITTED", formStatus: "SUBMITTED" };
}

/**
 * User-facing message thrown when a second submission would rewrite a fixed
 * submission date. Kept as a constant so the submit path and its test agree.
 */
export const SUBMITTED_AT_IMMUTABLE_MESSAGE =
  "This application has already been submitted; its submission date cannot be changed.";

/**
 * App-level invariant for the write-once `submittedAt` (Epic 01 PR-5). Throws a
 * clean, user-facing error when an application that already has a submission
 * date set would be re-submitted — giving a friendly message BEFORE the write
 * reaches the durable Postgres trigger (`trg_submitted_at_immutable`).
 *
 * The trigger is the backstop; this guard is the nice message on the submit
 * path. First submission (submittedAt === null) passes through untouched.
 */
export function assertSubmittedAtUnset(submittedAt: Date | null | undefined): void {
  if (submittedAt != null) {
    throw new Error(SUBMITTED_AT_IMMUTABLE_MESSAGE);
  }
}

/**
 * Generic fused-status transition (begin-review, mark-complete, resume) on the
 * application-detail track. Validates against the legacy graph and writes
 * `applications.status`. form_status is intentionally untouched (these are all
 * post-submission moves, so it stays SUBMITTED). Throws on an illegal move,
 * matching the previous action's guard.
 */
export async function transitionApplicationStatus(
  tx: Tx,
  applicationId: string,
  from: ApplicationStatus,
  to: ApplicationStatus
): Promise<void> {
  if (!isLegalApplicationTransition(from, to)) {
    throw new Error(`Illegal application transition ${from} → ${to}`);
  }
  await tx.application.update({
    where: { id: applicationId },
    data: { status: to },
  });
}

/**
 * Pause the application for missing documents (application-detail track).
 * Legacy fused status → PAUSED. form_status is NOT touched — a paused
 * application stays visibly SUBMITTED/Received (the lifecycle-separation
 * payoff). Returns the persisted deadline so the MISSING_DOCS email reads the
 * same value instead of recomputing it inline.
 *
 * Note: the application-detail track has no assessment row in scope, so the
 * deadline is persisted on the assessment by the assessor-track pause
 * (`pauseAssessmentRow`). Here we only move the fused status and compute the
 * canonical deadline; persistence of `paused_until` happens wherever the
 * assessment row is available.
 */
export async function pauseApplicationStatus(
  tx: Tx,
  applicationId: string,
  from: ApplicationStatus,
  pausedUntil: Date = defaultPausedUntil()
): Promise<Date> {
  if (!isLegalApplicationTransition(from, "PAUSED")) {
    throw new Error(`Illegal application transition ${from} → PAUSED`);
  }
  await tx.application.update({
    where: { id: applicationId },
    data: { status: "PAUSED" },
  });
  // Best-effort: persist the deadline on the 1:1 assessment if one exists, so
  // the portal countdown / re-send can read a real column (email-only before).
  await tx.assessment.updateMany({
    where: { applicationId },
    data: { pausedUntil },
  });
  return pausedUntil;
}

/**
 * Persist a final outcome (application-detail track). Writes the 3-value
 * assessments.outcome (when an assessment row exists) AND mirrors the legacy
 * fused applications.status. For a NEW application that does not qualify, sets
 * archived_at (§3) when not already archived.
 *
 * The AWARDED account/schedule side effect stays with the CALLER
 * (set-outcome-core's idempotent BursaryAccount creation) behind its own
 * interface, so Epic 10 can extend the award hand-off without touching this
 * writer.
 */
export async function setApplicationOutcomeStatus(
  tx: Tx,
  applicationId: string,
  outcome: LifecycleOutcome,
  opts: { applicationType: ApplicationType; alreadyArchived: boolean }
): Promise<void> {
  const legacy = legacyStatusForOutcome(outcome);

  await tx.assessment.updateMany({
    where: { applicationId },
    data: { outcome: outcome as AssessmentOutcome },
  });

  const archive =
    outcome === "DOES_NOT_QUALIFY" &&
    opts.applicationType === "NEW" &&
    !opts.alreadyArchived;

  await tx.application.update({
    where: { id: applicationId },
    data: {
      status: legacy,
      ...(archive ? { archivedAt: new Date() } : {}),
    },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Assessment-status writers (assessor-workspace track)
// ───────────────────────────────────────────────────────────────────────────

/** Default pause window (days) — preserves today's now+14 deadline. */
export const PAUSE_WINDOW_DAYS = 14;

/** Computes the default pause deadline (now + PAUSE_WINDOW_DAYS). */
export function defaultPausedUntil(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + PAUSE_WINDOW_DAYS);
  return d;
}

/** Initial assessment row state. Mirrors today's createAssessment NOT_STARTED. */
export const ASSESSMENT_INITIAL_STATUS: AssessmentStatus = "NOT_STARTED";

/**
 * Complete an assessment row: status → COMPLETED + completedAt. Validates the
 * transition. (Assessor-workspace track — the application-detail "mark
 * complete" mirrors the fused status separately via transitionApplicationStatus.)
 */
export async function completeAssessmentRow(
  tx: Tx,
  assessmentId: string,
  from: AssessmentStatus
): Promise<void> {
  // Tolerate a NOT_STARTED source (assessment completed before any save
  // promoted it) — treat it as having passed through IN_PROGRESS. Preserves
  // the pre-PR-4 ability to complete directly.
  if (from !== "NOT_STARTED" && !isLegalAssessmentTransition(from, "COMPLETED")) {
    throw new Error(`Illegal assessment transition ${from} → COMPLETED`);
  }
  await tx.assessment.update({
    where: { id: assessmentId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}

/**
 * First assessor edit promotes a freshly-created assessment to IN_PROGRESS
 * (Epic 01 PR-4 — tightens PR-3's behaviour-preserving deviation #1). No-op
 * unless the assessment is currently NOT_STARTED, so it is safe to call on
 * every save. Returns true when it transitioned.
 */
export async function startAssessmentIfNotStarted(
  tx: Tx,
  assessmentId: string
): Promise<boolean> {
  const current = await tx.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: { status: true },
  });
  if (current.status !== "NOT_STARTED") return false;
  await tx.assessment.update({
    where: { id: assessmentId },
    data: { status: "IN_PROGRESS" },
  });
  return true;
}

/**
 * Clears the persisted pause deadline for an application's assessment (on
 * resume / applicant doc-response). No-op when no assessment row exists.
 */
export async function clearPauseDeadline(
  tx: Tx,
  applicationId: string
): Promise<void> {
  await tx.assessment.updateMany({
    where: { applicationId },
    data: { pausedUntil: null },
  });
}

/**
 * Pause an assessment row for missing documents: status → PAUSED and PERSIST
 * the deadline in paused_until (previously email-only). Does NOT touch
 * form_status. Validates the transition. Returns the persisted deadline.
 */
export async function pauseAssessmentRow(
  tx: Tx,
  assessmentId: string,
  from: AssessmentStatus,
  pausedUntil: Date = defaultPausedUntil()
): Promise<Date> {
  // Tolerate a NOT_STARTED source (paused before any save promoted it).
  if (from !== "NOT_STARTED" && !isLegalAssessmentTransition(from, "PAUSED")) {
    throw new Error(`Illegal assessment transition ${from} → PAUSED`);
  }
  await tx.assessment.update({
    where: { id: assessmentId },
    data: { status: "PAUSED", pausedUntil },
  });
  return pausedUntil;
}
