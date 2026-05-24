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
 *
 * Every other `EmailTemplateType` is toggleable.
 */
export const LOCKED_EMAIL_TEMPLATE_TYPES: ReadonlySet<EmailTemplateType> =
  new Set<EmailTemplateType>([
    EmailTemplateType.INVITATION,
    EmailTemplateType.INVITE_STAFF,
  ]);

/**
 * True when a template type may not be disabled.
 */
export function isLockedEmailTemplateType(type: EmailTemplateType): boolean {
  return LOCKED_EMAIL_TEMPLATE_TYPES.has(type);
}
