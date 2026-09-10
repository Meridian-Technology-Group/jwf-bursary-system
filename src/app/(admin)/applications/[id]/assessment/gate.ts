// Plain module (NOT "use server"): a "use server" file may only export async
// functions, so the B1 gate's user-facing message constant lives here and is
// imported by both the server action and its test.

/** User-facing message when assessment is attempted on a not-yet-submitted form. */
export const NOT_SUBMITTED_GATE_MESSAGE =
  "This application has not been submitted yet — an assessment can only be " +
  "started once the applicant has submitted their form.";

// ─── Reopen / completed-lock gates (Epic 13 / C1, D13-2) ─────────────────────

/**
 * Refusal when a save is attempted against a COMPLETED assessment. This is the
 * SERVER-side half of the lock the assessor form renders client-side — the
 * browser's read-only mode is a courtesy, this is the rule.
 */
export const ASSESSMENT_COMPLETED_LOCK_MESSAGE =
  "This assessment is marked complete and cannot be edited. Reopen it first " +
  "if it needs to change.";

/**
 * Refusal when a save is attempted against an assessment that has moved PAST
 * complete into one of the Epic 18 post-assessment states.
 *
 * Found by Charlotte on 10 Sep 2026: the Kaluba assessment was locked as a new
 * award, its banner said *"the assessment can no longer be amended"*, and she
 * amended and saved it anyway. The stored row confirmed it — updated while
 * still NEW_AWARD.
 *
 * Cause: the save gate tested `status === "COMPLETED"` only, written when
 * COMPLETED was the terminal state. Epic 18 later added NEW_AWARD,
 * WAITING_LIST, CLOSED_ARCHIVED and ROLLED_OVER *beyond* it, and every one of
 * them fell straight through.
 */
export const ASSESSMENT_LOCKED_STATE_MESSAGE =
  "This assessment has been decided and cannot be edited. Reverse the decision " +
  "first if it needs to change.";

/**
 * The ONLY statuses in which an assessment's fields may be saved: it is still
 * being worked on.
 *
 * Deliberately an allowlist, not a blocklist. The bug above happened because a
 * blocklist named the one state that existed at the time, so every state added
 * later was silently editable. With an allowlist a new `AssessmentStatus`
 * member defaults to LOCKED, which is the safe direction to fail in.
 */
export const EDITABLE_ASSESSMENT_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "PAUSED",
] as const;

export type EditableAssessmentStatus = (typeof EDITABLE_ASSESSMENT_STATUSES)[number];

/**
 * Whether an assessment in this status may have its fields saved. Anything not
 * on the allowlist is locked; COMPLETED keeps its own long-standing message
 * (it has a reopen route), everything past it gets the decided-state message
 * (it has a reversal route).
 */
export function assessmentSaveLock(
  status: string
): { locked: false } | { locked: true; message: string } {
  if ((EDITABLE_ASSESSMENT_STATUSES as readonly string[]).includes(status)) {
    return { locked: false };
  }
  return {
    locked: true,
    message:
      status === "COMPLETED"
        ? ASSESSMENT_COMPLETED_LOCK_MESSAGE
        : ASSESSMENT_LOCKED_STATE_MESSAGE,
  };
}

/** Refusal when reopen is attempted on an assessment that is not COMPLETED. */
export const REOPEN_NOT_COMPLETED_MESSAGE =
  "Only a completed assessment can be reopened — this one is still open.";

/**
 * Refusal when reopen is attempted after a decision exists. THE gate on D13-2:
 * reopening is allowed only UNTIL an outcome is set, because by then the
 * decision has been emailed to the applicant and may have promoted a bursary
 * account.
 */
export const REOPEN_OUTCOME_SET_MESSAGE =
  "This application already has a recorded outcome, so its assessment can no " +
  "longer be reopened. Contact an administrator if the decision itself needs " +
  "to change.";

/** Refusal when reopen is attempted on a closed application. */
export const REOPEN_APPLICATION_CLOSED_MESSAGE =
  "This application is closed, so its assessment can no longer be reopened.";

/** Refusal when the actor is an assessor who is not assigned to the application. */
export const REOPEN_NOT_ASSIGNED_MESSAGE =
  "Only an administrator or the assessor assigned to this application can " +
  "reopen its assessment.";
