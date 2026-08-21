/**
 * Effective submission-deadline derivation (Epic 03; Item 12 added the round
 * default; Epic 13 / E1 made that default application-type-aware).
 *
 * The Foundation grants individual applicants a later (or earlier) submit-by
 * date than the round's intake window. This single helper is the ONE source of
 * truth for "what is the real deadline for THIS application", so the parent
 * portal (Epic 05 countdown / lockout), the submit guard, and any admin display
 * all agree.
 *
 *   effective deadline =
 *     application.submissionDeadlineAt                  (override)
 *       ?? round default FOR THE APPLICATION'S TYPE     (round default)
 *       ?? round.closeDate                              (fallback)
 *
 * Precedence: a per-application override always wins; absent an override, the
 * round's default submission deadline applies; absent both, fall back to the
 * round close date (D-1 — the round default is the explicit, admin-visible
 * expression of what closeDate implied, so closeDate keeps meaning "there is
 * always a deadline" for rounds that never set a default).
 *
 * Type-awareness (D13-8, CF-11/CF-12). A round runs two intakes on two clocks:
 * brand-new applicants (`applicationType = NEW`) submit against
 * `defaultSubmissionDeadlineNew`; existing holders rolling over into the annual
 * re-assessment (`ROLLING_OVER`) submit against `defaultSubmissionDeadlineRolling`,
 * conventionally an April date. Q4 (Brian, 2026-08-14): the rolling date is ONE
 * GLOBAL date per round, not per school — hence two columns and no further
 * structure. Only the MIDDLE tier is type-aware; the override and the close-date
 * fallback are type-blind by definition.
 *
 * Granularity note. `submissionDeadlineAt` is a `timestamptz` (date+time) and is
 * used verbatim. `Round.defaultSubmissionDeadlineNew`,
 * `Round.defaultSubmissionDeadlineRolling` and `Round.closeDate` are all
 * `@db.Date` (date-only, stored as midnight). A bare midnight fallback would
 * make the deadline land at the *start* of that day, locking applicants out a
 * day early; we therefore normalise EVERY date-only tier to the END of that day
 * (23:59:59.999 local) so "deadline = 30th" means "submittable through the
 * 30th". The override, being an explicit instant chosen by an admin, is NOT
 * shifted.
 *
 * This never mutates `submittedAt` and is distinct from `Assessment.pausedUntil`
 * (post-submission doc deadline, Epic 01) — see plan §3 three-clock model.
 */

/**
 * The application types that select a round default. Structurally identical to
 * Prisma's `ApplicationType` enum (prisma/schema.prisma) so a value read
 * straight off an `Application` row is assignable, without this pure module
 * having to import the client.
 */
export type SubmissionDeadlineApplicationType = "NEW" | "ROLLING_OVER";

export interface SubmissionDeadlineApplication {
  submissionDeadlineAt: Date | null;
  /**
   * Which round default applies (D13-8). Required, not optional: every caller
   * must `select: { applicationType: true }` alongside `submissionDeadlineAt`,
   * and making it optional would silently hand rolling-over families the NEW
   * deadline. `Application.applicationType` is non-null in the schema, so there
   * is nothing to default to.
   */
  applicationType: SubmissionDeadlineApplicationType;
}

export interface SubmissionDeadlineRound {
  closeDate: Date;
  /** Round-level default submit-by for NEW applications; null = no default. */
  defaultSubmissionDeadlineNew: Date | null;
  /** Round-level default submit-by for ROLLING_OVER applications; null = none. */
  defaultSubmissionDeadlineRolling: Date | null;
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
 * The round default that applies to one application type, or null when the
 * round has no default for it (⇒ the close-date fallback applies). Exported so
 * admin surfaces can show "the round default for this application" without
 * re-implementing the branch.
 */
export function roundDefaultForType(
  round: SubmissionDeadlineRound,
  applicationType: SubmissionDeadlineApplicationType
): Date | null {
  return applicationType === "ROLLING_OVER"
    ? round.defaultSubmissionDeadlineRolling
    : round.defaultSubmissionDeadlineNew;
}

/**
 * Returns the effective submission deadline for an application, marking
 * whether it is a per-application override, the round's default (for that
 * application's type), or the round's close-date fallback.
 *
 * @param application object carrying `submissionDeadlineAt` (override or null)
 *                    and `applicationType`
 * @param round       object carrying `closeDate` and both typed round defaults
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
  const roundDefault = roundDefaultForType(round, application.applicationType);
  if (roundDefault) {
    return {
      deadline: endOfDay(roundDefault),
      isOverride: false,
      source: "roundDefault",
    };
  }
  return { deadline: endOfDay(round.closeDate), isOverride: false, source: "closeDate" };
}

/**
 * The deadline a round imposes on an application type when no per-application
 * override exists — i.e. tiers 2 and 3 only. Used where there is no application
 * row yet but the date still has to be communicated: the invitation emails
 * (E1), which previously injected the invitation TOKEN EXPIRY as `{{deadline}}`.
 */
export function roundSubmissionDeadline(
  round: SubmissionDeadlineRound,
  applicationType: SubmissionDeadlineApplicationType
): Date {
  return effectiveSubmissionDeadline(
    { submissionDeadlineAt: null, applicationType },
    round
  ).deadline;
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
 * The conventional rolling-over deadline for an academic year: 30 April of the
 * year the label starts in (Q4 — "one global date per round, defaulting to
 * April"). Used to PREFILL the round create/edit dialogs; it is a suggestion an
 * admin can overwrite, never an implied value — a round with the field left
 * blank genuinely has no rolling default and falls back to the close date.
 *
 * @param academicYear the round's `YYYY/YY` label, e.g. "2026/27"
 * @returns a `yyyy-MM-dd` string for a date input, or "" when the label is not
 *          in the expected form (the caller then simply leaves the field blank)
 */
export function defaultRollingDeadlineFor(academicYear: string): string {
  const match = /^(\d{4})\/\d{2}$/.exec(academicYear.trim());
  if (!match) return "";
  return `${match[1]}-04-30`;
}

/**
 * Returns a new Date at the last representable millisecond of the given date's
 * calendar day, in the server's local timezone (Europe/London in prod/CI). Used
 * for every date-only tier (both typed round defaults and `closeDate`) so a
 * deadline that reads "the 30th" stays open through the whole of the 30th.
 */
function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}
