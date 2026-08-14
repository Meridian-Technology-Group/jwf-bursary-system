"use server";

/**
 * Bulk "Send Email" wizard server actions (item 8).
 *
 * Kept out of the giant `applications/[id]/actions.ts` — these three actions
 * are queue-level (operate over an arbitrary set of selected application ids
 * from the Applications list bulk toolbar), not single-application actions.
 *
 * getBulkEmailTemplatesAction  — Step 1: templates offered in the picker.
 * getBulkEmailRecipientsAction — Step 2: resolves recipients + merge data.
 * bulkSendEmailAction          — Step 3: re-resolves EVERYTHING server-side
 *   (never trusts the client's step-1/2 selections) and sends.
 *
 * ADMIN-only (resolved decision D-6): the whole bulk toolbar is already
 * gated to ADMIN in `ApplicationTable` (`bulkEnabled = userRole === "ADMIN"`);
 * `requireRole` here is defense-in-depth against a crafted request, not the
 * only gate.
 */

import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, withAdminContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { getAllEmailTemplates, type EmailTemplateRow } from "@/lib/db/queries/reference-tables";
import { replaceMergeFields } from "@/lib/email/merge";
import { sendRawEmail, fromAddress } from "@/lib/email/send";
import {
  buildBulkMergeData,
  isBulkResolvable,
  type BulkMergeDataApplication,
} from "@/lib/email/bulk-merge-data";

/** Hard cap on a single bulk send — keeps one batch bounded and reviewable. */
const MAX_BULK_RECIPIENTS = 500;

/**
 * Emails matching the GDPR-anonymisation pattern written by
 * `src/lib/retention/purge.ts` (`[deleted-<id>]@removed.invalid`) are never
 * sendable — the mailbox doesn't exist.
 */
const ANONYMISED_EMAIL_SUFFIX = "@removed.invalid";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Why a recipient can't be emailed, or null when they can. Checked
 * server-side on BOTH the recipient-resolution step and the send step —
 * Step 2 pre-deselects these, but a crafted client request must still be
 * rejected at send time (Story 8.3's "unsendable" AC + Story 8.4 defence).
 */
function unsendableReason(leadApplicant: {
  email: string;
  role: Role;
}): string | null {
  if (!leadApplicant.email || leadApplicant.email.trim() === "") {
    return "No email address on file.";
  }
  if (leadApplicant.email.toLowerCase().endsWith(ANONYMISED_EMAIL_SUFFIX)) {
    return "Profile has been anonymised (GDPR deletion).";
  }
  if (leadApplicant.role === Role.DELETED) {
    return "This applicant's account has been deleted.";
  }
  return null;
}

// ─── Step 1: templates offered in the picker ───────────────────────────────────

export type GetBulkEmailTemplatesResult =
  | { success: true; templates: EmailTemplateRow[] }
  | { success: false; error: string };

/**
 * Enabled, non-deleted templates for the Step 1 picker (system + custom).
 * Whether a given template is SELECTABLE (every merge field resolvable in
 * bulk — Story 8.2) is a client-side concern via `isBulkResolvable`, re-
 * checked server-side in `bulkSendEmailAction` regardless of what the UI
 * allowed.
 */
export async function getBulkEmailTemplatesAction(): Promise<GetBulkEmailTemplatesResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const templates = await withUserContext(user.id, user.role as RlsRole, (tx) =>
      getAllEmailTemplates(tx)
    );

    return { success: true, templates: templates.filter((t) => t.enabled) };
  } catch (err) {
    console.error("[getBulkEmailTemplatesAction]", err);
    return { success: false, error: "Failed to load email templates." };
  }
}

// ─── Step 2: resolve recipients ─────────────────────────────────────────────────

export interface BulkEmailRecipient extends BulkMergeDataApplication {
  applicationId: string;
  leadApplicantName: string;
  /** Non-null means this recipient is unsendable and should be pre-deselected. */
  unsendableReason: string | null;
}

export type GetBulkEmailRecipientsResult =
  | { success: true; recipients: BulkEmailRecipient[]; fromAddress: string }
  | { success: false; error: string };

async function fetchRecipientApplications(
  user: { id: string; role: Role },
  ids: string[]
) {
  return withUserContext(user.id, user.role as RlsRole, (tx) =>
    tx.application.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        reference: true,
        childName: true,
        school: true,
        submissionDeadlineAt: true,
        // Selects which typed round default applies (E1/D13-8).
        applicationType: true,
        round: {
          select: {
            academicYear: true,
            closeDate: true,
            defaultSubmissionDeadlineNew: true,
            defaultSubmissionDeadlineRolling: true,
          },
        },
        leadApplicant: {
          select: { firstName: true, lastName: true, email: true, role: true },
        },
      },
    })
  );
}

/**
 * Re-resolves the lead applicant + merge-data fields for an arbitrary set of
 * selected application ids (Step 2). Always fetched fresh from the server —
 * the client never assembles recipient data itself, only renders what this
 * returns.
 */
export async function getBulkEmailRecipientsAction(
  applicationIds: string[]
): Promise<GetBulkEmailRecipientsResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const ids = Array.from(new Set(applicationIds)).filter(Boolean);
    if (ids.length === 0) {
      return { success: false, error: "No applications selected." };
    }
    if (ids.length > MAX_BULK_RECIPIENTS) {
      return {
        success: false,
        error: `Cannot resolve more than ${MAX_BULK_RECIPIENTS} recipients at once.`,
      };
    }

    const applications = await fetchRecipientApplications(user, ids);

    const recipients: BulkEmailRecipient[] = applications.map((app) => ({
      applicationId: app.id,
      reference: app.reference,
      childName: app.childName,
      school: app.school,
      submissionDeadlineAt: app.submissionDeadlineAt,
      applicationType: app.applicationType,
      round: app.round,
      leadApplicant: {
        firstName: app.leadApplicant.firstName,
        lastName: app.leadApplicant.lastName,
        email: app.leadApplicant.email,
      },
      leadApplicantName:
        [app.leadApplicant.firstName, app.leadApplicant.lastName]
          .filter(Boolean)
          .join(" ") || app.leadApplicant.email,
      unsendableReason: unsendableReason(app.leadApplicant),
    }));

    return { success: true, recipients, fromAddress: fromAddress() };
  } catch (err) {
    console.error("[getBulkEmailRecipientsAction]", err);
    return { success: false, error: "Failed to resolve recipients." };
  }
}

// ─── Step 3: send ───────────────────────────────────────────────────────────────

export interface BulkEmailSendOutcome {
  applicationId: string;
  reference: string;
  email: string | null;
  outcome: "sent" | "failed" | "skipped";
  /** Failure or skip reason; absent for a successful send. */
  reason?: string;
  messageId?: string;
}

export interface BulkSendEmailResult {
  success: boolean;
  /** Top-level rejection (bad template, cap exceeded, nothing selected) — the batch never started. */
  error?: string;
  sent: number;
  failed: number;
  skipped: number;
  results: BulkEmailSendOutcome[];
}

const REJECTED: Omit<BulkSendEmailResult, "error"> = {
  success: false,
  sent: 0,
  failed: 0,
  skipped: 0,
  results: [],
};

/**
 * Sends the selected template to the selected recipients, one at a time.
 *
 * Re-resolves the template AND every recipient server-side — the client's
 * step-1 template choice and step-2 recipient list are both re-validated
 * from scratch here (Story 8.4's "never trust the client" requirement),
 * including the bulk-resolvability check (a crafted request naming a
 * template with unresolvable merge fields is rejected, not just greyed out
 * in the UI).
 *
 * The send loop itself does NOT run inside a DB transaction — each Resend
 * call is a network round trip, and holding a Postgres transaction open
 * across up to 500 sequential sends (with a rate-limit delay between each)
 * would starve the connection pool. Instead: (1) read template + recipients,
 * (2) send sequentially entirely in memory, (3) write all per-recipient audit
 * rows in one short final transaction. A per-recipient try/catch means one
 * Resend failure never aborts the batch.
 */
export async function bulkSendEmailAction(
  applicationIds: string[],
  templateId: string
): Promise<BulkSendEmailResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const ids = Array.from(new Set(applicationIds)).filter(Boolean);
    if (ids.length === 0) {
      return { ...REJECTED, error: "No applications selected." };
    }
    if (ids.length > MAX_BULK_RECIPIENTS) {
      return {
        ...REJECTED,
        error: `Cannot send to more than ${MAX_BULK_RECIPIENTS} recipients at once.`,
      };
    }
    if (!templateId) {
      return { ...REJECTED, error: "No template selected." };
    }

    const [template, applications] = await Promise.all([
      withUserContext(user.id, user.role as RlsRole, (tx) =>
        tx.emailTemplate.findUnique({ where: { id: templateId } })
      ),
      fetchRecipientApplications(user, ids),
    ]);

    if (!template || template.deletedAt) {
      return { ...REJECTED, error: "Selected template not found." };
    }
    if (!template.enabled) {
      return { ...REJECTED, error: "Selected template is disabled." };
    }
    const mergeFields = Array.isArray(template.mergeFields)
      ? (template.mergeFields as string[])
      : [];
    if (!isBulkResolvable(mergeFields)) {
      return {
        ...REJECTED,
        error: "Selected template uses fields that can't be filled in a bulk send.",
      };
    }

    // ── Phase 1: send sequentially (network-bound, no open DB transaction) ──
    const results: BulkEmailSendOutcome[] = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < applications.length; i++) {
      const app = applications[i];
      const reason = unsendableReason(app.leadApplicant);

      if (reason) {
        skipped++;
        results.push({
          applicationId: app.id,
          reference: app.reference,
          email: app.leadApplicant.email || null,
          outcome: "skipped",
          reason,
        });
        continue;
      }

      const mergeData = buildBulkMergeData({
        reference: app.reference,
        childName: app.childName,
        school: app.school,
        submissionDeadlineAt: app.submissionDeadlineAt,
        applicationType: app.applicationType,
        round: app.round,
        leadApplicant: app.leadApplicant,
      });
      const subject = replaceMergeFields(template.subject, mergeData);
      const plainBody = replaceMergeFields(template.body, mergeData);

      try {
        const sendResult = await sendRawEmail(app.leadApplicant.email, subject, plainBody);
        if (sendResult.success) {
          sent++;
          results.push({
            applicationId: app.id,
            reference: app.reference,
            email: app.leadApplicant.email,
            outcome: "sent",
            messageId: sendResult.messageId,
          });
        } else {
          failed++;
          results.push({
            applicationId: app.id,
            reference: app.reference,
            email: app.leadApplicant.email,
            outcome: "failed",
            reason: sendResult.error,
          });
        }
      } catch (err) {
        failed++;
        results.push({
          applicationId: app.id,
          reference: app.reference,
          email: app.leadApplicant.email,
          outcome: "failed",
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }

      // Respect Resend's rate limits between sends (mirrors sendBatchEmails).
      if (i < applications.length - 1) {
        await delay(100);
      }
    }

    // ── Phase 2: one audit row per ATTEMPTED send (sent or failed) ──
    // Skipped recipients were never attempted, so no row for them — matches
    // Story 8.4 AC3 ("for every attempted send, an audit entry is written").
    const attempted = results.filter((r) => r.outcome !== "skipped");
    if (attempted.length > 0) {
      await withAdminContext(
        async (tx) => {
          for (const r of attempted) {
            await createAuditLog(tx, {
              userId: user.id,
              action: AUDIT_ACTIONS.BULK_EMAIL_SENT,
              entityType: AUDIT_ENTITY_TYPES.Application,
              entityId: r.applicationId,
              context: `Bulk email "${template.name ?? template.type}" ${
                r.outcome === "sent" ? "sent to" : "failed for"
              } ${r.reference}`,
              metadata: {
                templateId: template.id,
                templateLabel: template.name ?? template.type,
                recipientApplicationId: r.applicationId,
                reference: r.reference,
                outcome: r.outcome,
                messageId: r.messageId ?? null,
                error: r.outcome === "failed" ? (r.reason ?? null) : null,
              },
            });
          }
        },
        { timeoutMs: 30000 }
      );
    }

    return { success: true, sent, failed, skipped, results };
  } catch (err) {
    console.error("[bulkSendEmailAction]", err);
    return { ...REJECTED, error: "Failed to send bulk email." };
  }
}
