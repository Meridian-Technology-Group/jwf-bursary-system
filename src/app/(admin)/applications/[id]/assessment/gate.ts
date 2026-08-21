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
