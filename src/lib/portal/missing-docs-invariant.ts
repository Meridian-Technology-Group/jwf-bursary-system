/**
 * Missing-document upload invariant — Epic 05 (plan §3.5, §10 acceptance).
 *
 * When a parent uploads requested documents through the portal after an
 * assessor follow-up, the SUBMISSION DATE must stay intact and the form status
 * must stay SUBMITTED/Received — only the assessment moves (PAUSED → resumes).
 * The write-once `submitted_at` trigger (Epic 01) is the durable backstop; this
 * pure helper is the app-layer assertion (unit-testable) used by the respond
 * action.
 */

export interface SubmissionInvariantSnapshot {
  submittedAt: Date | null;
  formStatus: string;
}

/**
 * Returns true when the submission invariant is preserved (submittedAt and
 * formStatus unchanged between before/after). A null after is treated as
 * "nothing to compare" → preserved (the row may not be re-readable in some
 * contexts; the trigger still guards the durable column).
 */
export function isSubmissionInvariantPreserved(
  before: SubmissionInvariantSnapshot,
  after: SubmissionInvariantSnapshot | null
): boolean {
  if (!after) return true;
  const sameDate =
    (before.submittedAt?.getTime() ?? null) ===
    (after.submittedAt?.getTime() ?? null);
  const sameStatus = before.formStatus === after.formStatus;
  return sameDate && sameStatus;
}

/** Throws a clear error when the submission invariant is broken. */
export function assertSubmissionInvariantPreserved(
  before: SubmissionInvariantSnapshot,
  after: SubmissionInvariantSnapshot | null
): void {
  if (!isSubmissionInvariantPreserved(before, after)) {
    throw new Error(
      "Document response must not change the submission date or form status."
    );
  }
}
