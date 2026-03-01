// src/lib/email/types.ts
// Shared type definitions for the JWF email service.

export { EmailTemplateType } from "@prisma/client";

/**
 * Result returned by sendEmail and sendRawEmail.
 */
export interface SendEmailResult {
  success: boolean;
  /** Resend message ID, present on success. */
  messageId?: string;
  /** Human-readable error description, present on failure. */
  error?: string;
}

/**
 * Aggregate result returned by sendBatchEmails.
 */
export interface SendBatchResult {
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * Typed merge-field data map.
 * Keys correspond to field names used in {{field_name}} template placeholders.
 * All values must be strings; callers should format dates, numbers, etc. before
 * passing them here.
 */
export type EmailMergeData = Record<string, string>;
