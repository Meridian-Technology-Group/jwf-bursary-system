// src/lib/email/bulk-merge-data.ts
// Merge-data resolution for the bulk "Send Email" wizard (item 8).
//
// Pure functions only — no DB / no "use server" — so this module is safe to
// import from both the server action that re-resolves recipients before
// sending (Story 8.4) and the client wizard that renders a live per-recipient
// preview (Story 8.3).

import type { School } from "@prisma/client";
import { contactDisplayName, schoolLabel } from "@/lib/contacts/contact-helpers";
import { effectiveSubmissionDeadline } from "@/lib/rounds/submission-deadline";
import type { EmailMergeData } from "./types";

/**
 * Merge fields resolvable for every application in a bulk send — deliberately
 * a SUBSET of every field a system template might use. Fields like
 * `registration_link` only exist in the context of a fresh invitation and
 * have no meaning for an arbitrary batch of already-registered applicants, so
 * they are NOT resolvable here.
 *
 * A template is only offered in the bulk wizard's Step 1 picker (and only
 * accepted by `bulkSendEmailAction`) when every field in its `mergeFields`
 * is a member of this list — see `isBulkResolvable()`.
 */
export const RESOLVABLE_BULK_FIELDS = [
  "applicant_name",
  "child_name",
  "reference",
  "school",
  "academic_year",
  "deadline",
] as const;

export type ResolvableBulkField = (typeof RESOLVABLE_BULK_FIELDS)[number];

const RESOLVABLE_BULK_FIELD_SET: ReadonlySet<string> = new Set(
  RESOLVABLE_BULK_FIELDS
);

/**
 * True when every merge field a template declares can be resolved for an
 * arbitrary bulk-send recipient. Templates that fail this check are shown
 * greyed out in the Step 1 picker and rejected server-side if forced anyway.
 */
export function isBulkResolvable(mergeFields: string[]): boolean {
  return mergeFields.every((field) => RESOLVABLE_BULK_FIELD_SET.has(field));
}

/** The minimal application shape needed to build one recipient's merge data. */
export interface BulkMergeDataApplication {
  reference: string;
  childName: string;
  school: School;
  submissionDeadlineAt: Date | null;
  round: {
    academicYear: string;
    closeDate: Date;
  };
  leadApplicant: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

/**
 * Builds the `{{field}}` merge-data map for one application in a bulk send.
 * Mirrors the merge-field conventions used by transactional sends elsewhere
 * (e.g. `setApplicationOutcome` — applicant_name falls back sensibly, school
 * renders as a full label, deadline is a `en-GB` short date).
 */
export function buildBulkMergeData(
  application: BulkMergeDataApplication
): EmailMergeData {
  const { deadline } = effectiveSubmissionDeadline(
    { submissionDeadlineAt: application.submissionDeadlineAt },
    { closeDate: application.round.closeDate }
  );

  return {
    applicant_name: contactDisplayName(application.leadApplicant),
    child_name: application.childName,
    reference: application.reference,
    school: schoolLabel(application.school),
    academic_year: application.round.academicYear,
    deadline: deadline.toLocaleDateString("en-GB"),
  };
}
