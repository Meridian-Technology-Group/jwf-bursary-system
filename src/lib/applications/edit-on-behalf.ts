/**
 * Edit-on-behalf phase gate (CR-001).
 *
 * Assessors/admins may amend an applicant's form data on their behalf only
 * while the review is still live. Editing is blocked once the assessment is
 * COMPLETED or an outcome is set (QUALIFIES / DOES_NOT_QUALIFY): amending the
 * source data after completion would silently desynchronise the assessment
 * figures from the form (CR-001 locked decision 4). PAUSED *is* allowed —
 * pausing is a missing-documents wait, and an on-behalf edit does NOT
 * auto-resume the assessment.
 *
 * This is a pure phase gate. Role/assignment authorisation (ADMIN, or the
 * assigned ASSESSOR) remains with the caller.
 */

import type { ReviewPhase } from "@/lib/applications/status";

/** Review phases in which on-behalf editing of form data is permitted. */
export const EDIT_ON_BEHALF_ALLOWED_PHASES: readonly ReviewPhase[] = [
  "PRE_SUBMISSION",
  "SUBMITTED",
  "NOT_STARTED",
  "PAUSED",
];

/**
 * Whether the review phase still permits editing the form on the applicant's
 * behalf (i.e. the assessment is not COMPLETED and no outcome is set).
 */
export function canEditOnBehalf(phase: ReviewPhase): boolean {
  return EDIT_ON_BEHALF_ALLOWED_PHASES.includes(phase);
}
