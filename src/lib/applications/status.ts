/**
 * Central status service — Epic 01 PR-3 / PR-6a.
 *
 * THE single writer of application/assessment lifecycle status. Owns the legal
 * transition tables for the three lifecycles introduced in Epic 01 (form /
 * assessment / outcome) and is the only place that mutates:
 *   - applications.form_status
 *   - applications.application_type   (set at creation only)
 *   - applications.archived_at
 *   - assessments.status
 *   - assessments.outcome
 *   - assessments.paused_until
 *
 * ──────────────────────────────────────────────────────────────────────────
 * PR-6a — fused-status cutover (legacy mirror removed)
 * ──────────────────────────────────────────────────────────────────────────
 * The deprecated fused `applications.status` enum is no longer written or read
 * by this service. PR-3 mirrored it (dual-write) so legacy readers kept working;
 * PR-6a migrates every reader/writer onto the three lifecycle columns, so the
 * dual-write is gone. The `applications.status` COLUMN still exists in the
 * schema (`@deprecated`, kept defaulted) — Epic 01 PR-6b drops it. This service
 * never touches it; the column simply holds its DB default and is unused.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * REVIEW PHASE (the application-detail "review track")
 * ──────────────────────────────────────────────────────────────────────────
 * Before PR-6a the application-detail flow (begin-review / complete / pause /
 * resume / outcome) drove the fused `applications.status` directly, while the
 * assessor workspace separately drove `assessments.status`. PR-6a unifies these:
 * the review track now operates on the SAME assessment row (creating it lazily
 * when none exists), so the assessment lifecycle is the single source of truth
 * for "where is this application in review". `deriveReviewPhase` re-projects the
 * lifecycle columns back onto the historical 7-value vocabulary the UI/queue
 * still speak (SUBMITTED → review NOT_STARTED → PAUSED → COMPLETED → outcome),
 * so the observable behaviour is unchanged.
 *
 *   - `review*` helpers own the application-detail review track (assessment
 *     status, lazily creating the row).
 *   - `assessment*` helpers own the assessor-workspace track (`assessments.status`
 *     / outcome / paused_until).
 *   - the outcome writer owns `assessments.outcome` (+ archive).
 *
 * These primitives do NOT authorise callers or write audit logs — the calling
 * server action keeps owning those (unchanged), so this stays a pure refactor.
 */

import type {
  ApplicationFormStatus,
  ApplicationType,
  AssessmentStatus,
  AssessmentOutcome,
  Prisma,
} from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";

// ───────────────────────────────────────────────────────────────────────────
// Review phase — the application-detail review-track vocabulary
// ───────────────────────────────────────────────────────────────────────────

/**
 * The 7-value "where is this application in review" vocabulary the admin UI and
 * the queue filter still speak. It is NO LONGER a stored column — it is DERIVED
 * from the three lifecycle columns by `deriveReviewPhase`. The value names match
 * the old fused `ApplicationStatus` enum verbatim so existing UI labels,
 * drill-in URLs (`?status=SUBMITTED`, `?status=PAUSED`) and gating read
 * unchanged.
 *
 *   PRE_SUBMISSION   form not yet submitted
 *   SUBMITTED        submitted, review not started (no assessment / NOT_STARTED)
 *   NOT_STARTED      review in progress (assessment IN_PROGRESS)
 *   PAUSED           assessment paused for missing documents
 *   COMPLETED        assessment completed, no outcome yet
 *   QUALIFIES        outcome AWARDED or QUALIFIES_NOT_AWARDED
 *   DOES_NOT_QUALIFY outcome DOES_NOT_QUALIFY
 */
export type ReviewPhase =
  | "PRE_SUBMISSION"
  | "SUBMITTED"
  | "NOT_STARTED"
  | "PAUSED"
  | "COMPLETED"
  | "QUALIFIES"
  | "DOES_NOT_QUALIFY";

/** The lifecycle facts `deriveReviewPhase` reasons over. */
export interface LifecycleStatusInput {
  formStatus: ApplicationFormStatus;
  assessmentStatus: AssessmentStatus | null;
  outcome: AssessmentOutcome | null;
}

/**
 * Re-projects the three lifecycle columns onto the historical 7-value review
 * phase. This is the single mapping every fused-status reader (queue filter,
 * application-detail gating, round counts, reports) now funnels through, so the
 * intent of the old fused enum is preserved in one place.
 *
 * Mirrors the PR-2 backfill table exactly:
 *   outcome set                        → QUALIFIES / DOES_NOT_QUALIFY
 *   assessment COMPLETED               → COMPLETED
 *   assessment PAUSED                  → PAUSED
 *   assessment IN_PROGRESS             → NOT_STARTED (review in progress)
 *   form SUBMITTED, asmt NOT_STARTED/∅ → SUBMITTED (awaiting review)
 *   form not SUBMITTED                 → PRE_SUBMISSION
 */
export function deriveReviewPhase(input: LifecycleStatusInput): ReviewPhase {
  const { formStatus, assessmentStatus, outcome } = input;

  if (outcome != null) {
    return outcome === "DOES_NOT_QUALIFY" ? "DOES_NOT_QUALIFY" : "QUALIFIES";
  }
  if (assessmentStatus === "COMPLETED") return "COMPLETED";
  if (assessmentStatus === "PAUSED") return "PAUSED";
  if (assessmentStatus === "IN_PROGRESS") return "NOT_STARTED";
  if (formStatus === "SUBMITTED") return "SUBMITTED";
  return "PRE_SUBMISSION";
}

/** True when the application has a final outcome (decided). */
export function isDecided(outcome: AssessmentOutcome | null): boolean {
  return outcome != null;
}

// ───────────────────────────────────────────────────────────────────────────
// Legal transition tables
// ───────────────────────────────────────────────────────────────────────────

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

/** Outcome may only be set from a COMPLETED assessment. */
export function canSetOutcome(assessmentStatus: AssessmentStatus | null): boolean {
  return assessmentStatus === "COMPLETED";
}

// ───────────────────────────────────────────────────────────────────────────
// Outcome lifecycle
// ───────────────────────────────────────────────────────────────────────────

/** The 3-value outcome lifecycle written to assessments.outcome (Epic 01). */
export type LifecycleOutcome =
  | "AWARDED"
  | "QUALIFIES_NOT_AWARDED"
  | "DOES_NOT_QUALIFY";

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
// Application writers (form_status / archive)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Initial state for a freshly created application. Sets `form_status` (CREATED)
 * and `application_type` explicitly. The deprecated fused `status` column is no
 * longer written (PR-6a) — it falls back to its `@default(PRE_SUBMISSION)` and
 * is unused until PR-6b drops it. Spread into an `application.create({ data })`.
 */
export function applicationCreateData(
  applicationType: ApplicationType
): Pick<
  Prisma.ApplicationUncheckedCreateInput,
  "formStatus" | "applicationType"
> {
  return {
    formStatus: "CREATED",
    applicationType,
  };
}

/**
 * Submit transition data: form_status → SUBMITTED. The deprecated fused `status`
 * column is no longer written (PR-6a). Returned as a patch so the caller can
 * merge submittedAt + other fields and keep its existing ordering.
 */
export function submitApplicationData(): Pick<
  Prisma.ApplicationUncheckedUpdateInput,
  "formStatus"
> {
  return { formStatus: "SUBMITTED" };
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

// ───────────────────────────────────────────────────────────────────────────
// Review-track writers (application-detail flow over the assessment row)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Returns the id + status of the application's 1:1 assessment row, creating it
 * (NOT_STARTED) if none exists. The review-track actions (begin / pause /
 * resume / complete) previously drove the fused `applications.status` WITHOUT an
 * assessment in scope; PR-6a unifies them onto the assessment lifecycle, so they
 * need the row to exist. `assessorId` is the staff member performing the action
 * (used only when creating). Idempotent — never overwrites an existing row.
 */
async function ensureAssessmentRow(
  tx: Tx,
  applicationId: string,
  assessorId: string
): Promise<{ id: string; status: AssessmentStatus }> {
  const existing = await tx.assessment.findUnique({
    where: { applicationId },
    select: { id: true, status: true },
  });
  if (existing) return existing;

  const created = await tx.assessment.create({
    data: {
      applicationId,
      assessorId,
      status: ASSESSMENT_INITIAL_STATUS,
      scholarshipPct: 0,
      vatRate: 20,
      manualAdjustment: 0,
    },
    select: { id: true, status: true },
  });
  return created;
}

/**
 * Begin review on the application-detail track: assessment → IN_PROGRESS
 * (creating the row if needed). Equivalent to the old fused SUBMITTED →
 * NOT_STARTED ("review in progress") move. `form_status` is untouched (the form
 * stays SUBMITTED). Returns the assessment id for audit metadata.
 */
export async function beginReview(
  tx: Tx,
  applicationId: string,
  assessorId: string
): Promise<string> {
  const assessment = await ensureAssessmentRow(tx, applicationId, assessorId);
  if (assessment.status !== "IN_PROGRESS") {
    if (!isLegalAssessmentTransition(assessment.status, "IN_PROGRESS")) {
      throw new Error(
        `Illegal assessment transition ${assessment.status} → IN_PROGRESS`
      );
    }
    await tx.assessment.update({
      where: { id: assessment.id },
      data: { status: "IN_PROGRESS" },
    });
  }
  return assessment.id;
}

/**
 * Resume review after a pause: assessment PAUSED → IN_PROGRESS and clear the
 * persisted deadline. Equivalent to the old fused PAUSED → NOT_STARTED move.
 */
export async function resumeReview(
  tx: Tx,
  applicationId: string,
  assessorId: string
): Promise<string> {
  const assessment = await ensureAssessmentRow(tx, applicationId, assessorId);
  if (
    assessment.status !== "IN_PROGRESS" &&
    !isLegalAssessmentTransition(assessment.status, "IN_PROGRESS")
  ) {
    throw new Error(
      `Illegal assessment transition ${assessment.status} → IN_PROGRESS`
    );
  }
  await tx.assessment.update({
    where: { id: assessment.id },
    data: { status: "IN_PROGRESS", pausedUntil: null },
  });
  return assessment.id;
}

/**
 * Mark the review complete on the application-detail track: assessment →
 * COMPLETED + completedAt. Equivalent to the old fused NOT_STARTED → COMPLETED
 * move. Tolerates a NOT_STARTED source (treated as having passed through
 * IN_PROGRESS), preserving the historical "mark complete" reachability.
 */
export async function markReviewComplete(
  tx: Tx,
  applicationId: string,
  assessorId: string
): Promise<string> {
  const assessment = await ensureAssessmentRow(tx, applicationId, assessorId);
  await completeAssessmentRow(tx, assessment.id, assessment.status);
  return assessment.id;
}

/**
 * Pause the review for missing documents (application-detail track): assessment
 * → PAUSED and persist the 14-day deadline (previously email-only). `form_status`
 * is NOT touched — a paused application stays visibly SUBMITTED/Received (the
 * lifecycle-separation payoff). Returns the persisted deadline so the
 * MISSING_DOCS email reads the same value instead of recomputing it inline.
 */
export async function pauseReviewForDocs(
  tx: Tx,
  applicationId: string,
  assessorId: string,
  pausedUntil: Date = defaultPausedUntil()
): Promise<Date> {
  const assessment = await ensureAssessmentRow(tx, applicationId, assessorId);
  return pauseAssessmentRow(tx, assessment.id, assessment.status, pausedUntil);
}

/**
 * Persist a final outcome. Writes the 3-value `assessments.outcome`. For a NEW
 * application that does not qualify, sets `archived_at` (§3) when not already
 * archived. The fused `applications.status` is no longer mirrored (PR-6a).
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
  await tx.assessment.updateMany({
    where: { applicationId },
    data: { outcome: outcome as AssessmentOutcome },
  });

  const archive =
    outcome === "DOES_NOT_QUALIFY" &&
    opts.applicationType === "NEW" &&
    !opts.alreadyArchived;

  if (archive) {
    await tx.application.update({
      where: { id: applicationId },
      data: { archivedAt: new Date() },
    });
  }
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
 * transition. Used by both the assessor-workspace track and the
 * application-detail review track (`markReviewComplete`).
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
