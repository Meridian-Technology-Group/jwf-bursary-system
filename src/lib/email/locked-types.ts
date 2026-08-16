// src/lib/email/locked-types.ts
// Single source of truth for which email template types may NOT be disabled.
//
// These types carry functional onboarding links rather than just tone /
// policy content, so turning them off would break a flow rather than merely
// suppress a notification. They are rendered as locked in the admin UI and
// rejected (defense-in-depth) by the toggle server action.
//
// This module is intentionally free of any `server-only` import so it can be
// shared by both the client-side settings UI and the server action.

import { EmailTemplateType } from "@prisma/client";

/**
 * Email template types that are non-disableable ("locked").
 *
 * - INVITATION    — carries the applicant registration link.
 * - INVITE_STAFF  — carries the staff onboarding registration link.
 * - APPLICATION_RESTART_REQUIRED — carries the restart link and is the ONLY
 *   notice a rejected applicant gets that their submission was voided and a
 *   fresh application awaits (the old application is hard-deleted). Disabling it
 *   would silently strand them, so it is locked.
 *
 * Every other `EmailTemplateType` is toggleable.
 */
export const LOCKED_EMAIL_TEMPLATE_TYPES: ReadonlySet<EmailTemplateType> =
  new Set<EmailTemplateType>([
    EmailTemplateType.INVITATION,
    // B3 — every invitation variant carries the registration link, so they
    // are locked for the same reason the generic INVITATION is.
    EmailTemplateType.INVITATION_NEW_TS,
    EmailTemplateType.INVITATION_NEW_WS,
    EmailTemplateType.INVITATION_INTERNAL_TS,
    EmailTemplateType.INVITATION_INTERNAL_WS,
    EmailTemplateType.INVITATION_ROLLING,
    EmailTemplateType.INVITE_STAFF,
    EmailTemplateType.APPLICATION_RESTART_REQUIRED,
  ]);

/**
 * True when a template type may not be disabled.
 */
export function isLockedEmailTemplateType(type: EmailTemplateType): boolean {
  return LOCKED_EMAIL_TEMPLATE_TYPES.has(type);
}
