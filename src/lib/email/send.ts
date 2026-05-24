// src/lib/email/send.ts
// Core email sending functions for the JWF Bursary Assessment System.
//
// All three exported functions wrap the Resend API and return a typed result
// object; they never throw unhandled exceptions.

import { prisma, withAdminContext } from "@/lib/db/prisma";
import { resend } from "./resend";
import { replaceMergeFields } from "./merge";
import { wrapInEmailTemplate, plainTextToHtml, htmlToPlainText } from "./template";
import { hashEmail, logError, logInfo } from "@/lib/log";
import type {
  SendEmailResult,
  SendBatchResult,
  EmailMergeData,
} from "./types";
import type { EmailTemplateType } from "./types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the configured "from" address.
 * Falls back to a safe default if the env var is missing so that the module
 * does not crash during testing when the variable is not set.
 */
function fromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL ??
    "bursary@updates.meridiantech.group"
  );
}

/**
 * Pause execution for `ms` milliseconds.
 * Used to respect Resend's rate limits between batch sends.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// sendEmail
// ---------------------------------------------------------------------------

/**
 * Send a single templated email.
 *
 * Loads the `EmailTemplate` record matching `templateType` from the database,
 * applies merge-field substitution to both subject and body, wraps the body in
 * the JWF HTML email template, then dispatches via Resend.
 *
 * @param to           Recipient email address.
 * @param templateType One of the `EmailTemplateType` enum values.
 * @param mergeData    Key/value pairs for {{field_name}} placeholder replacement.
 * @returns            Result object with `success`, optional `messageId`, and
 *                     optional `error` description.
 */
export async function sendEmail(
  to: string,
  templateType: EmailTemplateType,
  mergeData: EmailMergeData
): Promise<SendEmailResult> {
  try {
    // 1. Load template from the database.
    // email_templates has RLS enabled with no public-read policy; use
    // withAdminContext so the lookup runs as service_role.
    const template = await withAdminContext((tx) =>
      tx.emailTemplate.findUnique({ where: { type: templateType } }),
    );

    if (!template) {
      return {
        success: false,
        error: `Email template not found for type: ${templateType}`,
      };
    }

    // 1a. Enforcement gate — if an admin has disabled this template type,
    // short-circuit to a success-shaped no-op so callers keep working, and
    // emit a structured, observable skip event. This single gate covers all
    // current and future send sites. Locked types (INVITATION / INVITE_STAFF)
    // can never reach enabled=false because the toggle action rejects them.
    if (!template.enabled) {
      logInfo("email.skipped", {
        templateType,
        recipientHash: hashEmail(to),
        reason: "template_disabled",
      });
      return { success: true, skipped: true };
    }

    // 2. Apply merge field substitution to subject and body.
    const subject = replaceMergeFields(template.subject, mergeData);
    const plainBody = replaceMergeFields(template.body, mergeData);

    // 3. Convert plain-text body to HTML and wrap in branded template.
    const htmlFragment = plainTextToHtml(plainBody);
    const html = wrapInEmailTemplate(htmlFragment);
    const text = plainBody;

    // 4. Send via Resend.
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to,
      subject,
      html,
      text,
    });

    if (error) {
      logError("email.failed", error, {
        templateType,
        recipientHash: hashEmail(to),
      });
      return {
        success: false,
        error: `${error.name}: ${error.message}`,
      };
    }

    logInfo("email.sent", {
      templateType,
      recipientHash: hashEmail(to),
      messageId: data?.id,
    });

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error sending email";
    logError("email.failed", err, {
      templateType,
      recipientHash: hashEmail(to),
    });
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// sendBatchEmails
// ---------------------------------------------------------------------------

/**
 * Send the same template to multiple recipients, applying per-recipient merge
 * data.
 *
 * The template is loaded once and reused for all recipients. Sends are
 * performed sequentially with a 100 ms delay between each to stay within
 * Resend's rate limits.
 *
 * @param recipients   Array of `{ email, mergeData }` objects.
 * @param templateType The template to use for all sends.
 * @returns            Aggregate counts and any error messages.
 */
export async function sendBatchEmails(
  recipients: Array<{ email: string; mergeData: EmailMergeData }>,
  templateType: EmailTemplateType
): Promise<SendBatchResult> {
  const result: SendBatchResult = {
    sent: 0,
    failed: 0,
    errors: [],
  };

  if (recipients.length === 0) {
    return result;
  }

  // Load the template once up-front.
  let rawSubject: string;
  let rawBody: string;

  try {
    const template = await withAdminContext((tx) =>
      tx.emailTemplate.findUnique({ where: { type: templateType } }),
    );

    if (!template) {
      const error = `Email template not found for type: ${templateType}`;
      result.failed = recipients.length;
      result.errors.push(error);
      return result;
    }

    // Enforcement gate — see sendEmail. A disabled template no-ops for every
    // recipient: zero sent, zero failed, one skip log line (success-shaped).
    if (!template.enabled) {
      logInfo("email.skipped", {
        templateType,
        recipientCount: recipients.length,
        reason: "template_disabled",
      });
      return result;
    }

    rawSubject = template.subject;
    rawBody = template.body;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Database error loading template";
    result.failed = recipients.length;
    result.errors.push(message);
    return result;
  }

  // Send to each recipient sequentially.
  for (let i = 0; i < recipients.length; i++) {
    const { email, mergeData } = recipients[i];

    try {
      const subject = replaceMergeFields(rawSubject, mergeData);
      const plainBody = replaceMergeFields(rawBody, mergeData);
      const htmlFragment = plainTextToHtml(plainBody);
      const html = wrapInEmailTemplate(htmlFragment);

      const { data, error } = await resend.emails.send({
        from: fromAddress(),
        to: email,
        subject,
        html,
        text: plainBody,
      });

      if (error) {
        result.failed++;
        result.errors.push(
          `${email}: ${error.name}: ${error.message}`
        );
        logError("email.failed", error, {
          templateType,
          recipientHash: hashEmail(email),
        });
      } else {
        result.sent++;
        logInfo("email.sent", {
          templateType,
          recipientHash: hashEmail(email),
          messageId: data?.id,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      result.failed++;
      result.errors.push(`${email}: ${message}`);
      logError("email.failed", err, {
        templateType,
        recipientHash: hashEmail(email),
      });
    }

    // Pause between sends, except after the last one.
    if (i < recipients.length - 1) {
      await delay(100);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// sendRawEmail
// ---------------------------------------------------------------------------

/**
 * Send a one-off email that does not use a database template.
 *
 * The `body` parameter is treated as plain text; it will be converted to HTML
 * and wrapped in the standard JWF email template automatically. If you need
 * to send a fully custom HTML email, convert it with `wrapInEmailTemplate`
 * yourself and pass the result as the body.
 *
 * @param to      Recipient email address.
 * @param subject Email subject line.
 * @param body    Plain-text email body.
 * @returns       Result object with `success`, optional `messageId`, and
 *                optional `error` description.
 */
export async function sendRawEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendEmailResult> {
  try {
    const htmlFragment = plainTextToHtml(body);
    const html = wrapInEmailTemplate(htmlFragment);

    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to,
      subject,
      html,
      text: htmlToPlainText(html),
    });

    if (error) {
      logError("email.failed", error, {
        templateType: "RAW",
        recipientHash: hashEmail(to),
      });
      return {
        success: false,
        error: `${error.name}: ${error.message}`,
      };
    }

    logInfo("email.sent", {
      templateType: "RAW",
      recipientHash: hashEmail(to),
      messageId: data?.id,
    });

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error sending email";
    logError("email.failed", err, {
      templateType: "RAW",
      recipientHash: hashEmail(to),
    });
    return { success: false, error: message };
  }
}
