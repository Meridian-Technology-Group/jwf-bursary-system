"use server";

/**
 * Epic 22 P2 (CR-002 Phase 5 #4) — send a parent's "Contact us by email"
 * question to the bursary inbox.
 *
 * - The child is chosen from options the server re-derives for this login, so
 *   a parent can only ever name their own child (D-14).
 * - The inbox is `PORTAL_ENQUIRY_INBOX`. Unset → test mode: the parent sees
 *   exactly what would be sent, nothing is sent (D-6). There is deliberately
 *   no production fallback, so a test can never reach the real fees inbox.
 * - Reply-To is the parent's login email (her rule: "We will send you our
 *   reply by email using your email address held in the system"). No copy is
 *   sent to the parent (D-7).
 * - 5 an hour, 20 a day per login, counted from audit rows (D-15).
 * - The audit row records the child and reference, never the question text.
 */

import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/roles";
import { withAdminContext } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { sendRawEmail } from "@/lib/email/send";
import { getAppUrl } from "@/lib/app-url";
import { BURSARIES_CONTACT_EMAIL } from "@/lib/portal/guidance-content";
import {
  composeEnquiry,
  enquiryThrottle,
  escapeHtml,
  ENQUIRY_BODY_MAX,
  ENQUIRY_BODY_MIN,
  ENQUIRY_SUBJECT_MAX,
  GENERAL_ENQUIRY_KEY,
} from "@/lib/portal/enquiry";
import { loadEnquiryChildOptions } from "@/lib/portal/enquiry-data";

export type SendEnquiryResult =
  | { status: "sent"; replyTo: string }
  | { status: "preview"; to: string; subject: string; text: string; replyTo: string }
  | { status: "error"; error: string };

const EnquirySchema = z.object({
  childKey: z.string().min(1, "Please choose which child this is about."),
  subject: z
    .string()
    .max(ENQUIRY_SUBJECT_MAX, `Please keep the subject under ${ENQUIRY_SUBJECT_MAX} characters.`)
    .optional(),
  body: z
    .string()
    .trim()
    .min(ENQUIRY_BODY_MIN, "Please write your question (at least a sentence).")
    .max(ENQUIRY_BODY_MAX, `Please keep your question under ${ENQUIRY_BODY_MAX} characters.`),
});

const FALLBACK = `Please email ${BURSARIES_CONTACT_EMAIL} directly.`;

export async function sendEnquiryAction(formData: FormData): Promise<SendEnquiryResult> {
  const user = await requireRole([Role.APPLICANT]);

  const parsed = EnquirySchema.safeParse({
    childKey: formData.get("childKey") ?? "",
    subject: (formData.get("subject") as string | null) ?? undefined,
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const { childKey, subject, body } = parsed.data;

  const options = await loadEnquiryChildOptions(user);
  const child =
    childKey === GENERAL_ENQUIRY_KEY
      ? null
      : (options.find((o) => o.key === childKey) ?? undefined);
  if (child === undefined) {
    return { status: "error", error: "Please choose which child this is about." };
  }

  const now = new Date();

  // D-15: count this login's enquiries (sent or previewed) over the last day.
  const recent = await withAdminContext((tx) =>
    tx.auditLog.findMany({
      where: {
        userId: user.id,
        action: {
          in: [AUDIT_ACTIONS.PORTAL_ENQUIRY_SENT, AUDIT_ACTIONS.PORTAL_ENQUIRY_PREVIEWED],
        },
        createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true },
    })
  );
  if (!enquiryThrottle(recent.map((r) => r.createdAt), now).allowed) {
    return {
      status: "error",
      error: `You have sent several questions in a short time. ${FALLBACK}`,
    };
  }

  const composed = composeEnquiry({
    parent: { firstName: user.firstName, lastName: user.lastName, email: user.email },
    child,
    subject,
    body,
    sentAt: now,
    appUrl: getAppUrl(),
  });

  const metadata = {
    childKey: child?.key ?? GENERAL_ENQUIRY_KEY,
    reference: child?.reference ?? null,
    applicationId: child?.applicationId ?? null,
  };

  const inbox = process.env.PORTAL_ENQUIRY_INBOX?.trim();
  if (!inbox) {
    await withAdminContext((tx) =>
      createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.PORTAL_ENQUIRY_PREVIEWED,
        entityType: AUDIT_ENTITY_TYPES.Profile,
        entityId: user.id,
        context: "Contact us by email — test mode, nothing sent",
        metadata,
      })
    );
    return {
      status: "preview",
      to: BURSARIES_CONTACT_EMAIL,
      subject: composed.subject,
      text: composed.text,
      replyTo: user.email,
    };
  }

  const result = await sendRawEmail(inbox, composed.subject, escapeHtml(composed.text), {
    replyTo: user.email,
  });
  if (!result.success) {
    console.error("[portal/help] sendEnquiryAction send failed:", result.error);
    return {
      status: "error",
      error: `We couldn't send your question just now. ${FALLBACK}`,
    };
  }

  await withAdminContext((tx) =>
    createAuditLog(tx, {
      userId: user.id,
      action: AUDIT_ACTIONS.PORTAL_ENQUIRY_SENT,
      entityType: AUDIT_ENTITY_TYPES.Profile,
      entityId: user.id,
      context: `Contact us by email — ${composed.subject}`,
      metadata: { ...metadata, messageId: result.messageId ?? null },
    })
  );

  return { status: "sent", replyTo: user.email };
}
