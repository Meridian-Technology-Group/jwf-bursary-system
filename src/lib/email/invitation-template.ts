// src/lib/email/invitation-template.ts
// Epic 14 B3 (CG-26, LA-3) — which of the invitation templates a send uses.
//
// Charlotte keeps five editable invitation variants: new-application and
// internal-application per school, plus one rolling-over template for both
// schools. Selection is a 3-way SITUATION choice (new / internal /
// rolling-over) made at contact creation or invite time; the school half
// resolves automatically from the contact/invitation's school. The legacy
// INVITATION template stays as the fallback whenever no situation was
// recorded (pre-B3 rows) or the situation needs a school it doesn't have.
//
// Pure module — no DB, no server-only import — shared by the three invite
// send paths and unit-tested directly.

import {
  EmailTemplateType,
  InvitationSituation,
  School,
} from "@prisma/client";

import { formatEmailDate } from "./invitation-deadline";
import type { SubmissionDeadlineApplicationType } from "@/lib/rounds/submission-deadline";

/** Shown when a rolling invitation has no round to take an opening date from. */
export const OPENING_DATE_UNKNOWN = "to be confirmed";

/**
 * Resolve the template for one invitation send.
 *
 * NULL situation (legacy invitations, contacts created before B3) falls back
 * to the generic INVITATION — never a guess at a variant.
 */
export function resolveInvitationTemplate(
  situation: InvitationSituation | null | undefined,
  school: School | null | undefined
): EmailTemplateType {
  if (!situation) return EmailTemplateType.INVITATION;
  if (situation === InvitationSituation.ROLLING_OVER) {
    return EmailTemplateType.INVITATION_ROLLING;
  }
  if (!school) return EmailTemplateType.INVITATION;
  if (situation === InvitationSituation.NEW) {
    return school === School.TRINITY
      ? EmailTemplateType.INVITATION_NEW_TS
      : EmailTemplateType.INVITATION_NEW_WS;
  }
  return school === School.TRINITY
    ? EmailTemplateType.INVITATION_INTERNAL_TS
    : EmailTemplateType.INVITATION_INTERNAL_WS;
}

/**
 * Which round default the {{deadline}} merge field uses (Epic 13 E1
 * resolver): rolling-over invitations get the round's rolling date, new and
 * internal applications the NEW date.
 */
export function deadlineTypeForSituation(
  situation: InvitationSituation | null | undefined
): SubmissionDeadlineApplicationType {
  return situation === InvitationSituation.ROLLING_OVER
    ? "ROLLING_OVER"
    : "NEW";
}

/**
 * The {{opening_date}} merge field the rolling template reads — the round's
 * portal opening date, NEVER the invitation token expiry (the CF-11 bug
 * class). Harmless to merge on every send; only INVITATION_ROLLING's body
 * references it.
 */
export function openingDateMergeField(
  round: { openDate: Date } | null | undefined
): string {
  return round?.openDate ? formatEmailDate(round.openDate) : OPENING_DATE_UNKNOWN;
}
