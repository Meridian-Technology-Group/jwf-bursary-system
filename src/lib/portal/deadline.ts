/**
 * Parent-portal deadline helpers — Epic 05 (plan §3.2, §5.2).
 *
 * Thin parent-facing layer over the Epic-03 single source of truth
 * `effectiveSubmissionDeadline()` (per-application override ?? round close
 * end-of-day). Used by:
 *   - the countdown banner (time remaining),
 *   - the deadline-missed lockout (presentation),
 *   - the server-side submit guard in apply/actions.ts (rejects late posts).
 *
 * It never re-derives the deadline rule — it delegates to the Epic-03 helper so
 * the parent UI, the submit guard, and any admin display all agree. The
 * "closing soon" window is a presentation concept only (does not gate submit).
 */

import {
  effectiveSubmissionDeadline,
  isSubmissionDeadlinePassed,
  type SubmissionDeadlineApplication,
  type SubmissionDeadlineRound,
} from "@/lib/rounds/submission-deadline";

/** Hours-before-deadline that the countdown switches to its "closing soon" tone. */
export const CLOSING_SOON_HOURS = 72;

export interface DeadlineStatus {
  /** The effective submit-by instant (inclusive). */
  deadline: Date;
  /** True when it came from the per-application override, not the round. */
  isOverride: boolean;
  /** True once `now` is past the deadline. */
  isPast: boolean;
  /** Whole milliseconds remaining (clamped at 0). */
  msRemaining: number;
  /** True when within CLOSING_SOON_HOURS of the deadline (and not past). */
  isClosingSoon: boolean;
}

export function getDeadlineStatus(
  application: SubmissionDeadlineApplication,
  round: SubmissionDeadlineRound,
  now: Date = new Date()
): DeadlineStatus {
  const { deadline, isOverride } = effectiveSubmissionDeadline(
    application,
    round
  );
  const isPast = isSubmissionDeadlinePassed(application, round, now);
  const msRemaining = Math.max(0, deadline.getTime() - now.getTime());
  const isClosingSoon =
    !isPast && msRemaining <= CLOSING_SOON_HOURS * 60 * 60 * 1000;
  return { deadline, isOverride, isPast, msRemaining, isClosingSoon };
}

/**
 * Whether the parent may still submit/edit this application. A draft is locked
 * out once the deadline passes (already-submitted applications are read-only for
 * a different reason — they're submitted — so this is only meaningful while the
 * form is editable).
 */
export function isSubmittable(
  application: SubmissionDeadlineApplication,
  round: SubmissionDeadlineRound,
  now: Date = new Date()
): boolean {
  return !isSubmissionDeadlinePassed(application, round, now);
}

/**
 * Humanises a remaining duration into a coarse, parent-friendly string, e.g.
 * "3 days", "5 hours", "12 minutes", "less than a minute". Pure — safe on
 * server or client.
 */
export function formatTimeRemaining(msRemaining: number): string {
  if (msRemaining <= 0) return "0 minutes";
  const totalMinutes = Math.floor(msRemaining / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days >= 1) {
    const dayPart = `${days} day${days === 1 ? "" : "s"}`;
    if (hours >= 1) {
      return `${dayPart}, ${hours} hour${hours === 1 ? "" : "s"}`;
    }
    return dayPart;
  }
  if (hours >= 1) {
    const hourPart = `${hours} hour${hours === 1 ? "" : "s"}`;
    if (minutes >= 1) {
      return `${hourPart}, ${minutes} minute${minutes === 1 ? "" : "s"}`;
    }
    return hourPart;
  }
  if (minutes >= 1) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return "less than a minute";
}
