// src/lib/email/send.ts
// Core email sending functions for the JWF Bursary Assessment System.
//
// All three exported functions wrap the Resend API and return a typed result
// object; they never throw unhandled exceptions.

import { prisma } from "@/lib/db/prisma";
import { resend } from "./resend";
import { replaceMergeFields } from "./merge";
import { wrapInEmailTemplate, plainTextToHtml, htmlToPlainText } from "./template";
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
    "jwf-bursary@resend.dev"
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
    const template = await prisma.emailTemplate.findUnique({
      where: { type: templateType },
    });

    if (!template) {
      return {
        success: false,
        error: `Email template not found for type: ${templateType}`,
      };
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
      console.error(
        `[email] Failed to send ${templateType} to ${to}:`,
        error
      );
      return {
        success: false,
        error: `${error.name}: ${error.message}`,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error sending email";
    console.error(
      `[email] Unexpected error sending ${templateType} to ${to}:`,
      err
    );
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
    const template = await prisma.emailTemplate.findUnique({
      where: { type: templateType },
    });

    if (!template) {
      const error = `Email template not found for type: ${templateType}`;
      result.failed = recipients.length;
      result.errors.push(error);
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
        console.error(`[email/batch] Failed to send to ${email}:`, error);
      } else {
        result.sent++;
        console.log(
          `[email/batch] Sent ${templateType} to ${email} (id: ${data?.id ?? "unknown"})`
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      result.failed++;
      result.errors.push(`${email}: ${message}`);
      console.error(`[email/batch] Unexpected error for ${email}:`, err);
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
      console.error(`[email] Failed to send raw email to ${to}:`, error);
      return {
        success: false,
        error: `${error.name}: ${error.message}`,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error sending email";
    console.error(`[email] Unexpected error sending raw email to ${to}:`, err);
    return { success: false, error: message };
  }
}
