/**
 * Effective submission-deadline derivation (Epic 03; Item 12 adds the round
 * default).
 *
 * The Foundation grants individual applicants a later (or earlier) submit-by
 * date than the round's intake window. This single helper is the ONE source of
 * truth for "what is the real deadline for THIS application", so the parent
 * portal (Epic 05 countdown / lockout), the submit guard, and any admin display
 * all agree.
 *
 *   effective deadline =
 *     application.submissionDeadlineAt (override)
 *       ?? round.defaultSubmissionDeadline (round default)
 *       ?? round.closeDate (fallback)
 *
 * Precedence: a per-application override always wins; absent an override, the
 * round's default submission deadline applies; absent both, fall back to the
 * round close date (D-1 — the round default is the explicit, admin-visible
 * expression of what closeDate implied, so closeDate keeps meaning "there is
 * always a deadline" for rounds that never set a default).
 *
 * Granularity note. `submissionDeadlineAt` is a `timestamptz` (date+time) and is
 * used verbatim. Both `Round.defaultSubmissionDeadline` and `Round.closeDate`
 * are `@db.Date` (date-only, stored as midnight). A bare midnight fallback
 * would make the deadline land at the *start* of that day, locking applicants
 * out a day early; we therefore normalise either date-only fallback to the END
 * of that day (23:59:59.999 local) so "deadline = 30th" means "submittable
 * through the 30th". The override, being an explicit instant chosen by an
 * admin, is NOT shifted.
 *
 * This never mutates `submittedAt` and is distinct from `Assessment.pausedUntil`
 * (post-submission doc deadline, Epic 01) — see plan §3 three-clock model.
 */

export interface SubmissionDeadlineApplication {
  submissionDeadlineAt: Date | null;
}

export interface SubmissionDeadlineRound {
  closeDate: Date;
  /** Round-level default submission-by date (Item 12); null = no round default. */
  defaultSubmissionDeadline: Date | null;
}

/** Where the effective deadline came from — for provenance labelling in the UI. */
export type SubmissionDeadlineSource = "override" | "roundDefault" | "closeDate";

export interface EffectiveSubmissionDeadline {
  /** The instant the form may be submitted up to (inclusive). */
  deadline: Date;
  /**
   * True when it came from the per-application override, not the round.
   * Kept for backwards compatibility — equivalent to `source === "override"`.
   */
  isOverride: boolean;
  /** Which of the three tiers produced `deadline`. */
  source: SubmissionDeadlineSource;
}

/**
 * Returns the effective submission deadline for an application, marking
 * whether it is a per-application override, the round's default, or the
 * round's close-date fallback.
 *
 * @param application object carrying `submissionDeadlineAt` (override or null)
 * @param round       object carrying `closeDate` and `defaultSubmissionDeadline`
 */
export function effectiveSubmissionDeadline(
  application: SubmissionDeadlineApplication,
  round: SubmissionDeadlineRound
): EffectiveSubmissionDeadline {
  if (application.submissionDeadlineAt) {
    return {
      deadline: application.submissionDeadlineAt,
      isOverride: true,
      source: "override",
    };
  }
  if (round.defaultSubmissionDeadline) {
    return {
      deadline: endOfDay(round.defaultSubmissionDeadline),
      isOverride: false,
      source: "roundDefault",
    };
  }
  return { deadline: endOfDay(round.closeDate), isOverride: false, source: "closeDate" };
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
 * for both date-only fallbacks (`defaultSubmissionDeadline`, `closeDate`) so a
 * deadline that reads "the 30th" stays open through the whole of the 30th.
 */
function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}
