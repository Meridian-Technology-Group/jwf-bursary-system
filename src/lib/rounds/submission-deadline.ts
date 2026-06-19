/**
 * Effective submission-deadline derivation (Epic 03).
 *
 * The Foundation grants individual applicants a later (or earlier) submit-by
 * date than the round's intake window. This single helper is the ONE source of
 * truth for "what is the real deadline for THIS application", so the parent
 * portal (Epic 05 countdown / lockout), the submit guard, and any admin display
 * all agree.
 *
 *   effective deadline = application.submissionDeadlineAt ?? round.closeDate
 *
 * Precedence: a per-application override always wins; absent an override, fall
 * back to the round close date.
 *
 * Granularity note. `submissionDeadlineAt` is a `timestamptz` (date+time) and is
 * used verbatim. `Round.closeDate` is `@db.Date` (date-only, stored as
 * midnight). A bare midnight fallback would make the round close at the *start*
 * of close-day, locking applicants out a day early; we therefore normalise a
 * date-only fallback to the END of close-day (23:59:59.999 local) so "close date
 * = 30th" means "submittable through the 30th". The override, being an explicit
 * instant chosen by an admin, is NOT shifted.
 *
 * This never mutates `submittedAt` and is distinct from `Assessment.pausedUntil`
 * (post-submission doc deadline, Epic 01) — see plan §3 three-clock model.
 */

export interface SubmissionDeadlineApplication {
  submissionDeadlineAt: Date | null;
}

export interface SubmissionDeadlineRound {
  closeDate: Date;
}

export interface EffectiveSubmissionDeadline {
  /** The instant the form may be submitted up to (inclusive). */
  deadline: Date;
  /** True when it came from the per-application override, not the round. */
  isOverride: boolean;
}

/**
 * Returns the effective submission deadline for an application, marking whether
 * it is a per-application override or inherited from the round.
 *
 * @param application object carrying `submissionDeadlineAt` (override or null)
 * @param round       object carrying the round-level `closeDate`
 */
export function effectiveSubmissionDeadline(
  application: SubmissionDeadlineApplication,
  round: SubmissionDeadlineRound
): EffectiveSubmissionDeadline {
  if (application.submissionDeadlineAt) {
    return { deadline: application.submissionDeadlineAt, isOverride: true };
  }
  return { deadline: endOfDay(round.closeDate), isOverride: false };
}

/**
 * Whether `now` is past the effective submission deadline (deadline is
 * inclusive — exactly-at-deadline is NOT yet missed).
 */
export function isSubmissionDeadlinePassed(
  application: SubmissionDeadlineApplication,
  round: SubmissionDeadlineRound,
  now: Date = new Date()
): boolean {
  const { deadline } = effectiveSubmissionDeadline(application, round);
  return now.getTime() > deadline.getTime();
}

/**
 * Returns a new Date at the last representable millisecond of the given date's
 * calendar day, in the server's local timezone (Europe/London in prod/CI). Used
 * only for the date-only round-close fallback so an intake window that ends "on
 * the 30th" stays open through the whole of the 30th.
 */
function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}
