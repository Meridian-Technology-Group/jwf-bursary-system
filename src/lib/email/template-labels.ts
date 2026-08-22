// src/lib/email/template-labels.ts
// Shared display labels for email templates — single source of truth for the
// Settings template editor (item 9) and the bulk Send Email wizard (item 8)
// so the two UIs can never drift on how a template is named.

import type { EmailTemplateType } from "@prisma/client";

/** Display labels for the seeded system templates, keyed by `type`. */
export const TEMPLATE_LABELS: Record<EmailTemplateType, string> = {
  // CH-28 (Charlotte, 2026-08-22): she asked for per-situation invitation
  // templates that already existed, because the picker listed this legacy
  // fallback FIRST and the five real variants last — so she never saw them and
  // was editing a template no live send uses. The label now says so outright.
  INVITATION: "Invitation — legacy fallback (not used for new sends)",
  INVITATION_NEW_TS: "Invitation — New Application, Trinity",
  INVITATION_NEW_WS: "Invitation — New Application, Whitgift",
  INVITATION_INTERNAL_TS: "Invitation — Internal Application, Trinity",
  INVITATION_INTERNAL_WS: "Invitation — Internal Application, Whitgift",
  INVITATION_ROLLING: "Invitation — Rolling Over (both schools)",
  CONFIRMATION: "Submission Confirmation",
  MISSING_DOCS: "Missing Documents",
  OUTCOME_QUALIFIES: "Outcome — Qualifies (legacy)",
  OUTCOME_DNQ: "Outcome — Declined",
  OUTCOME_AWARDED: "Outcome — Awarded",
  OUTCOME_QUALIFIES_NOT_AWARDED: "Outcome — Qualifies, Not Awarded",
  REASSESSMENT: "Reassessment",
  REMINDER: "Reminder",
  INVITE_STAFF: "Staff Invitation",
  MISSING_DOCS_RESPONDED: "Missing Documents — Applicant Responded",
  SECONDARY_PARENT_INVITE: "Second Parent — Invitation",
  SECONDARY_PARENT_REMINDER: "Second Parent — Reminder",
  SECONDARY_PARENT_RECEIVED: "Second Parent — Information Received",
  APPLICATION_RESTART_REQUIRED: "Application Rejected — Restart Required",
  APPLICATION_EDITED_ON_BEHALF: "Application Edited on Your Behalf",
};

/**
 * The invitation templates a real send can resolve to (`resolveInvitationTemplate`),
 * in the order the settings picker groups them: the five situation × school
 * variants that actually go out, then the legacy fallback last.
 *
 * CH-28: keeping this list here — beside the labels — means the picker's
 * "Invitations" group and the resolver can't drift into disagreeing about which
 * templates are invitation templates.
 */
export const INVITATION_TEMPLATE_TYPES: EmailTemplateType[] = [
  "INVITATION_NEW_TS",
  "INVITATION_NEW_WS",
  "INVITATION_INTERNAL_TS",
  "INVITATION_INTERNAL_WS",
  "INVITATION_ROLLING",
  "INVITATION",
] as EmailTemplateType[];

/**
 * True for the legacy generic invitation. `resolveInvitationTemplate` only
 * returns it when a row has NO recorded situation (pre-Epic-14 contacts and
 * invitations) or a situation that needs a school and has none — never for an
 * invitation created through the current UI, where situation is mandatory.
 */
export function isLegacyInvitationFallback(
  type: EmailTemplateType | null | undefined
): boolean {
  return type === "INVITATION";
}

/**
 * Display label for a template row, whether it's a system template (keyed by
 * the fixed `EmailTemplateType` enum) or a custom, admin-created one (keyed
 * by `name`).
 */
export function emailTemplateLabel(tpl: {
  isSystem: boolean;
  type: EmailTemplateType | null;
  name: string | null;
}): string {
  if (tpl.isSystem && tpl.type) {
    return TEMPLATE_LABELS[tpl.type] ?? tpl.type;
  }
  return tpl.name ?? "Untitled template";
}
