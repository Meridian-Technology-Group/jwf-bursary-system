// src/lib/email/template-labels.ts
// Shared display labels for email templates — single source of truth for the
// Settings template editor (item 9) and the bulk Send Email wizard (item 8)
// so the two UIs can never drift on how a template is named.

import type { EmailTemplateType } from "@prisma/client";

/** Display labels for the seeded system templates, keyed by `type`. */
export const TEMPLATE_LABELS: Record<EmailTemplateType, string> = {
  INVITATION: "Invitation (generic fallback)",
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
