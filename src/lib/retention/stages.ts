/**
 * Per-application retention primitives (Epic 23 T10). NEVER the whole-parent
 * GDPR cascade (`purgeApplication`): each removes one application's data for
 * one stage of `planRetention`, inside the caller's service-role transaction.
 *
 *   purgeFormAndDocuments  rule 1 at +1y, rule 2 at the close:
 *                          documents, form sections, rejection notes. The
 *                          application shell and the named assessment stay.
 *   purgeAssessment        rule 1 at +6y, rule 2 at +6y, rule 3 at +6y:
 *                          assessment + recommendation (+ cascades), anything
 *                          left of the form, the child's identity ("XXXX"),
 *                          the contact-register row, the account's synopsis
 *                          (rule 1); the parent's profile only when nothing
 *                          else of theirs is live.
 *   anonymiseForErasure    rule 3 now: the form and documents go, the name and
 *                          reference become "XXXX", the assessment is kept
 *                          anonymous (its prose scrubbed).
 *
 * The two that anonymise also blank the child's name and reference (and the
 * parent's, when their profile goes) in the family's history trail — see
 * `audit-scrub.ts`.
 *
 * Each one re-reads the application and re-runs the planner INSIDE its
 * transaction and refuses when the stage is not due (an account reopened since
 * the cron listed it, a stage already done) — so each is idempotent. Storage
 * objects and auth users are external: their ids are RETURNED for the caller to
 * delete after the commit. Every primitive writes its own audit row.
 *
 * These run only when RETENTION_PURGE_ENABLED is "true" (the callers check).
 */

import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { CONTACT_SCRUB, RECOMMENDATION_FREETEXT_SCRUB, ASSESSMENT_FREETEXT_SCRUB, profileScrubData } from "@/lib/retention/scrub-map";
import { decideLeadProfileErasure } from "@/lib/retention/close-purge";
import { auditNeedles, scrubAuditMentions, type AuditScope } from "@/lib/retention/audit-scrub";
import { canRequestErasure, planRetention, type RetentionPlan, type RetentionRecord, type RetentionStage } from "@/lib/retention/policy";

/** What an anonymised identity reads as (her rule 3: "XXXX"). */
export const ANONYMISED = "XXXX";

export const RETENTION_RECORD_SELECT = {
  id: true,
  reference: true,
  childName: true,
  leadApplicantId: true,
  bursaryAccountId: true,
  closedAt: true,
  retentionStage: true,
  retentionStageAt: true,
  bursaryAccount: { select: { closedAt: true } },
  assessment: { select: { id: true, status: true, archivedAt: true } },
} satisfies Prisma.ApplicationSelect;

export type RetentionRow = Prisma.ApplicationGetPayload<{ select: typeof RETENTION_RECORD_SELECT }>;

export function toRetentionRecord(row: RetentionRow): RetentionRecord {
  return {
    bursaryAccount: row.bursaryAccount ? { closedAt: row.bursaryAccount.closedAt } : null,
    closedAt: row.closedAt,
    assessment: row.assessment ? { status: row.assessment.status, archivedAt: row.assessment.archivedAt } : null,
    retentionStage: row.retentionStage,
    retentionStageAt: row.retentionStageAt,
  };
}

export interface StageResult {
  applied: boolean;
  /** Why nothing was done (not due, already done, gone). */
  skipped?: string;
  plan?: RetentionPlan;
  /** Storage objects to delete after the commit. */
  storagePaths: string[];
  /** Auth users to delete after the commit (an erased parent). */
  authUsersToDelete: string[];
  counts: Record<string, number>;
}

const skipped = (reason: string, plan?: RetentionPlan): StageResult => ({
  applied: false,
  skipped: reason,
  plan,
  storagePaths: [],
  authUsersToDelete: [],
  counts: {},
});

async function loadRow(tx: Tx, applicationId: string) {
  return tx.application.findUnique({ where: { id: applicationId }, select: RETENTION_RECORD_SELECT });
}

/** Documents + form sections + rejection notes for one application. */
async function removeForm(tx: Tx, applicationId: string) {
  const docs = await tx.document.findMany({ where: { applicationId }, select: { storagePath: true } });
  const documentsDeleted = (await tx.document.deleteMany({ where: { applicationId } })).count;
  const sectionsDeleted = (await tx.applicationSection.deleteMany({ where: { applicationId } })).count;
  const rejectionNotes = (
    await tx.applicationRejection.updateMany({
      where: { replacementApplicationId: applicationId, message: { not: null } },
      data: { message: null },
    })
  ).count;
  return { storagePaths: docs.map((d) => d.storagePath), documentsDeleted, sectionsDeleted, rejectionNotes };
}

async function setStage(tx: Tx, applicationId: string, stage: RetentionStage, now: Date) {
  await tx.application.update({ where: { id: applicationId }, data: { retentionStage: stage, retentionStageAt: now } });
}

/**
 * Everything of this child's that names them, read BEFORE anything is
 * scrubbed: the contact-register rows, the invitations (an accepted invitation
 * is not linked to the application, so it is found through its contact row),
 * and the parent's own identifiers for the history-trail scrub.
 */
async function loadFamily(tx: Tx, row: RetentionRow) {
  const contacts = await tx.contact.findMany({
    where: {
      OR: [
        { profileId: row.leadApplicantId, childName: row.childName },
        ...(row.bursaryAccountId ? [{ bursaryAccountId: row.bursaryAccountId }] : []),
      ],
    },
    select: { id: true },
  });
  const contactIds = contacts.map((c) => c.id);
  const invitations = await tx.invitation.findMany({
    where: { OR: [{ applicationId: row.id }, ...(contactIds.length > 0 ? [{ contactId: { in: contactIds } }] : [])] },
    select: { id: true },
  });
  const lead = await tx.profile.findUnique({
    where: { id: row.leadApplicantId },
    select: { email: true, firstName: true, lastName: true },
  });
  const scope: AuditScope = {
    applicationId: row.id,
    assessmentId: row.assessment?.id ?? null,
    bursaryAccountId: row.bursaryAccountId,
    leadApplicantId: row.leadApplicantId,
    contactIds,
    invitationIds: invitations.map((i) => i.id),
  };
  return { scope, lead };
}

type Family = Awaited<ReturnType<typeof loadFamily>>;

/** The child's identity on the application, its rejection rows, contact-register rows and invitations. */
async function anonymiseIdentity(tx: Tx, row: RetentionRow, family: Family) {
  await tx.application.update({
    where: { id: row.id },
    data: { childName: ANONYMISED, childFirstName: null, childLastName: null, childDob: null, reference: ANONYMISED },
  });
  const rejections = (
    await tx.applicationRejection.updateMany({
      where: { OR: [{ replacementApplicationId: row.id }, ...(row.bursaryAccountId ? [{ bursaryAccountId: row.bursaryAccountId }] : [])] },
      data: { childName: ANONYMISED, reference: ANONYMISED, message: null },
    })
  ).count;
  const { contactIds, invitationIds } = family.scope;
  const contacts =
    contactIds.length > 0
      ? (await tx.contact.updateMany({ where: { id: { in: contactIds } }, data: { ...CONTACT_SCRUB, archivedAt: new Date() } })).count
      : 0;
  const invitations =
    invitationIds.length > 0 ? (await tx.invitation.deleteMany({ where: { id: { in: invitationIds } } })).count : 0;
  return { rejections, contacts, invitations };
}

/**
 * The history trail last, once the parent's fate is known: the child's
 * reference and name always; the parent's name and email only when their
 * profile went too (a parent with another live child is still on record).
 */
async function scrubHistory(tx: Tx, row: RetentionRow, family: Family, leadErased: boolean): Promise<number> {
  const lead = family.lead;
  const needles = auditNeedles([
    row.reference,
    row.childName,
    ...(leadErased && lead ? [lead.email, [lead.firstName, lead.lastName].filter(Boolean).join(" ")] : []),
  ]);
  return scrubAuditMentions(tx, family.scope, needles);
}

/** The parent's profile goes only when nothing else of theirs is live. */
async function maybeEraseLead(tx: Tx, row: RetentionRow): Promise<{ erased: boolean; authUserId: string | null }> {
  const decision = await decideLeadProfileErasure(tx, row.leadApplicantId, row.id, row.bursaryAccountId);
  if (!decision.canErase) return { erased: false, authUserId: null };
  await tx.auditLog.updateMany({ where: { userId: row.leadApplicantId }, data: { userId: null } });
  await tx.profile.update({ where: { id: row.leadApplicantId }, data: profileScrubData(row.leadApplicantId) });
  return { erased: true, authUserId: row.leadApplicantId };
}

/** Rule 1 at +1y, rule 2 at the close. */
export async function purgeFormAndDocuments(tx: Tx, applicationId: string, now: Date): Promise<StageResult> {
  const row = await loadRow(tx, applicationId);
  if (!row) return skipped("application not found");
  const plan = planRetention(toRetentionRecord(row), now);
  if (plan.action !== "purge-form-docs") return skipped(`plan is ${plan.action}`, plan);
  if (!plan.due) return skipped(`not due until ${plan.dueAt?.toISOString().slice(0, 10)}`, plan);

  const removed = await removeForm(tx, applicationId);
  await setStage(tx, applicationId, "FORM_DOCS_PURGED", now);
  await createAuditLog(tx, {
    action: AUDIT_ACTIONS.RETENTION_FORM_DOCS_PURGED,
    entityType: AUDIT_ENTITY_TYPES.Application,
    entityId: applicationId,
    context: `Retention (${plan.rule}): form and documents purged — ${row.reference}`,
    metadata: { rule: plan.rule, anchor: plan.anchor?.toISOString() ?? null, ...removed, storagePaths: removed.storagePaths.length },
  });
  return {
    applied: true,
    plan,
    storagePaths: removed.storagePaths,
    authUsersToDelete: [],
    counts: { documents: removed.documentsDeleted, sections: removed.sectionsDeleted, rejectionNotes: removed.rejectionNotes },
  };
}

/** Rules 1–3 at +6y: the assessment, what is left of the form, the identity. */
export async function purgeAssessment(tx: Tx, applicationId: string, now: Date): Promise<StageResult> {
  const row = await loadRow(tx, applicationId);
  if (!row) return skipped("application not found");
  const plan = planRetention(toRetentionRecord(row), now);
  if (plan.action !== "purge-assessment") return skipped(`plan is ${plan.action}`, plan);
  if (!plan.due) return skipped(`not due until ${plan.dueAt?.toISOString().slice(0, 10)}`, plan);

  const removed = await removeForm(tx, applicationId);
  const assessmentsDeleted = (await tx.assessment.deleteMany({ where: { applicationId } })).count;
  let synopsisEntries = 0;
  if (plan.rule === "account-closed" && row.bursaryAccountId) {
    synopsisEntries = (await tx.accountSynopsisEntry.deleteMany({ where: { bursaryAccountId: row.bursaryAccountId } })).count;
    await tx.bursaryAccount.update({ where: { id: row.bursaryAccountId }, data: { childName: ANONYMISED, childDob: null } });
  }
  const family = await loadFamily(tx, row);
  const identity = await anonymiseIdentity(tx, row, family);
  await setStage(tx, applicationId, "ASSESSMENT_PURGED", now);
  const lead = await maybeEraseLead(tx, row);
  const historyRows = await scrubHistory(tx, row, family, lead.erased);
  await createAuditLog(tx, {
    action: AUDIT_ACTIONS.RETENTION_ASSESSMENT_PURGED,
    entityType: AUDIT_ENTITY_TYPES.Application,
    entityId: applicationId,
    // No reference: the name was just scrubbed from the history trail.
    context: `Retention (${plan.rule}): assessment purged`,
    metadata: {
      rule: plan.rule,
      anchor: plan.anchor?.toISOString() ?? null,
      assessmentsDeleted,
      documentsDeleted: removed.documentsDeleted,
      sectionsDeleted: removed.sectionsDeleted,
      synopsisEntries,
      ...identity,
      historyRows,
      leadProfile: lead.erased ? "erased" : "retained",
    },
  });
  return {
    applied: true,
    plan,
    storagePaths: removed.storagePaths,
    authUsersToDelete: lead.authUserId ? [lead.authUserId] : [],
    counts: { assessments: assessmentsDeleted, documents: removed.documentsDeleted, sections: removed.sectionsDeleted, synopsisEntries },
  };
}

/** Rule 3 now: the parent asked for erasure at the new-application stage. */
export async function anonymiseForErasure(tx: Tx, applicationId: string, now: Date, requestedBy: string): Promise<StageResult> {
  const row = await loadRow(tx, applicationId);
  if (!row) return skipped("application not found");
  const gate = canRequestErasure(toRetentionRecord(row));
  if (!gate.ok) return skipped(gate.reason);

  const removed = await removeForm(tx, applicationId);
  if (row.assessment) {
    await tx.assessment.update({ where: { id: row.assessment.id }, data: { ...ASSESSMENT_FREETEXT_SCRUB, synopsis: null, watchOutNotes: null, siblingDetails: [] } });
    await tx.assessmentChecklist.deleteMany({ where: { assessmentId: row.assessment.id } });
    await tx.recommendation.updateMany({ where: { assessmentId: row.assessment.id }, data: { ...RECOMMENDATION_FREETEXT_SCRUB } });
  }
  const family = await loadFamily(tx, row);
  const identity = await anonymiseIdentity(tx, row, family);
  await setStage(tx, applicationId, "ANONYMISED", now);
  const lead = await maybeEraseLead(tx, row);
  const historyRows = await scrubHistory(tx, row, family, lead.erased);
  await createAuditLog(tx, {
    userId: requestedBy,
    action: AUDIT_ACTIONS.RETENTION_ERASURE_REQUEST,
    entityType: AUDIT_ENTITY_TYPES.Application,
    entityId: applicationId,
    context: `Erasure request: application anonymised; the anonymous assessment is kept 6 years`,
    metadata: {
      documentsDeleted: removed.documentsDeleted,
      sectionsDeleted: removed.sectionsDeleted,
      ...identity,
      historyRows,
      leadProfile: lead.erased ? "erased" : "retained",
      assessmentKept: row.assessment != null,
    },
  });
  return {
    applied: true,
    storagePaths: removed.storagePaths,
    authUsersToDelete: lead.authUserId ? [lead.authUserId] : [],
    counts: { documents: removed.documentsDeleted, sections: removed.sectionsDeleted },
  };
}

/** After the commit: the storage objects a stage removed the rows of (non-fatal per object). */
export async function deleteStorageObjectsPostCommit(
  paths: readonly string[],
  deleteDocument: (storagePath: string) => Promise<void>,
): Promise<string[]> {
  const errors: string[] = [];
  for (const p of paths) {
    try {
      await deleteDocument(p);
    } catch (err) {
      errors.push(`${p}: ${err instanceof Error ? err.message : String(err)}`);
      console.warn("[retention] storage delete failed", p, err);
    }
  }
  return errors;
}
