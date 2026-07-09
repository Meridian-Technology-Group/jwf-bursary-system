/**
 * Item 10 — reason-driven close purge (`purgeClosedApplication`).
 *
 * Runs when an application is closed under a close reason whose
 * `purgeOnClose` flag is set (items 2/4): personal data is anonymised and
 * uploaded documents are deleted, while the Foundation's financial record
 * survives. This is ANONYMISATION, not row deletion — the application,
 * assessment, recommendation and bursary-account rows all remain.
 *
 * Deliberate contrast with the GDPR cascade (`purgeApplication`, purge.ts):
 *
 *   |                        | GDPR cascade            | close purge (this)     |
 *   |------------------------|-------------------------|------------------------|
 *   | intent                 | forget the person       | close one application  |
 *   | assessment + financials| DELETED                 | RETAINED               |
 *   | synopsis               | deleted with assessment | retained verbatim (D-2)|
 *   | recommendation         | DELETED                 | retained, prose scrubbed|
 *   | form sections/documents| deleted                 | deleted (same)         |
 *   | contact register       | scrubbed (all children) | scrubbed (this child)  |
 *   | lead profile/auth user | always erased           | erased only when no    |
 *   |                        |                         | other live records     |
 *
 * Both routines draw every scrub value from src/lib/retention/scrub-map.ts.
 *
 * Idempotent BY CONSTRUCTION: every step re-applied to an already-purged
 * application is a no-op (re-redacting redacted fields, deleting zero rows).
 * The caller (A3's `closeApplication`) additionally gates on
 * `applications.purged_at` and stamps it inside the same transaction.
 *
 * ⚠️ APPEND-ONLY AUDIT: never deletes audit rows; `AuditLog.userId` is nulled
 * only when a Profile is genuinely erased (mirroring the GDPR cascade). The
 * summary APPLICATION_PURGED audit row is written by the caller.
 */

import type { Tx } from "@/lib/db/prisma";
import {
  getSecondaryContributorForGdpr,
  decideSecondaryProfileErasure,
} from "@/lib/db/queries/secondary-gdpr";
import {
  APPLICATION_CHILD_SCRUB,
  ASSESSMENT_FREETEXT_SCRUB,
  BURSARY_ACCOUNT_CHILD_SCRUB,
  CONTACT_SCRUB,
  RECOMMENDATION_FREETEXT_SCRUB,
  REDACTED_CHILD_NAME,
  profileScrubData,
} from "@/lib/retention/scrub-map";

/** The application + relations the close purge needs. */
export interface ClosePurgeableApplication {
  id: string;
  reference: string;
  /** Pre-scrub child name — scopes the contact-register scrub to THIS child. */
  childName: string;
  leadApplicantId: string;
  bursaryAccountId: string | null;
  documents: { id: string; storagePath: string }[];
  assessment: {
    id: string;
    recommendation: { id: string } | null;
  } | null;
}

export interface ClosePurgeResult {
  /** Non-fatal Storage delete failures keyed by document id (Story 10.3). */
  storageErrors: string[];
  /** Row counts for the caller's audit metadata (counts, never PII values). */
  counts: {
    documentsDeleted: number;
    sectionsDeleted: number;
    contactsScrubbed: number;
    invitationsDeleted: number;
  };
  /** Whether the lead profile (and auth user) was erased vs retained. */
  leadProfile: "erased" | "retained";
  /** Reason the lead profile was retained, for audit metadata. */
  leadProfileRetainedBecause: string | null;
  /** Secondary contributor handling, null for single-parent applications. */
  secondaryProfile: "erased" | "retained" | null;
  /**
   * Auth users whose Supabase accounts must be deleted AFTER the caller's
   * transaction commits (external side effect — must not run inside the tx,
   * or a rollback would strand a deleted login against retained data). Pass
   * to `deleteAuthUsersPostCommit`.
   */
  authUsersToDelete: string[];
}

/** Dependencies, DI-style — subset of the GDPR cascade's PurgeDeps. */
export interface ClosePurgeDeps {
  deleteDocument: (storagePath: string) => Promise<void>;
}

/** Auth-deletion dependency for the post-commit step. */
export interface AuthDeleteDeps {
  deleteAuthUser: (
    userId: string
  ) => Promise<{ error: { message: string } | null }>;
}

/** True when `application.childName` already carries the redaction token. */
export function isApplicationPurged(application: {
  childName: string;
}): boolean {
  return application.childName === REDACTED_CHILD_NAME;
}

/**
 * The lead-profile guard (close-purge analogue of the secondary's
 * shared-profile guard): the lead's Profile + auth user are erased ONLY when
 * this application is their last live record — no other non-purged
 * applications and no other bursary accounts. Otherwise the parent keeps
 * their portal access and the profile is retained.
 */
async function decideLeadProfileErasure(
  tx: Tx,
  leadApplicantId: string,
  applicationId: string,
  bursaryAccountId: string | null
): Promise<{ canErase: boolean; reason: string | null }> {
  const otherApplications = await tx.application.count({
    where: {
      leadApplicantId,
      id: { not: applicationId },
      // An already-purged sibling application is not a reason to keep the
      // profile — mirror the retention cron's purged-row detection.
      childName: { not: REDACTED_CHILD_NAME },
    },
  });
  if (otherApplications > 0) {
    return {
      canErase: false,
      reason: `lead has ${otherApplications} other live application(s)`,
    };
  }

  const otherAccounts = await tx.bursaryAccount.count({
    where: {
      leadApplicantId,
      ...(bursaryAccountId ? { id: { not: bursaryAccountId } } : {}),
    },
  });
  if (otherAccounts > 0) {
    return {
      canErase: false,
      reason: `lead holds ${otherAccounts} other bursary account(s)`,
    };
  }

  return { canErase: true, reason: null };
}

/**
 * Anonymise one closed application: PII out, financial record retained.
 * Runs entirely inside the caller's transaction `tx` (the close and the purge
 * succeed or fail together — Story 10.1), EXCEPT Storage deletion, which is
 * external to Postgres and handled first, non-fatally per document, exactly
 * like the GDPR cascade (a failed object delete is surfaced in the result and
 * the caller's audit row, never silently swallowed — Story 10.3).
 */
export async function purgeClosedApplication(
  tx: Tx,
  application: ClosePurgeableApplication,
  deps: ClosePurgeDeps
): Promise<ClosePurgeResult> {
  const applicationId = application.id;
  const leadApplicantId = application.leadApplicantId;

  // Storage objects first (non-fatal per doc; DB rows go below in-tx).
  const storageErrors: string[] = [];
  for (const doc of application.documents) {
    try {
      await deps.deleteDocument(doc.storagePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      storageErrors.push(`${doc.id}: ${msg}`);
      console.warn("[close-purge] Storage delete failed for", doc.id, msg);
    }
  }

  // Shared-profile verdicts (read-only) before any mutation.
  const secondary = await getSecondaryContributorForGdpr(tx, applicationId);
  const secondaryDecision = secondary
    ? await decideSecondaryProfileErasure(tx, secondary.profileId, applicationId)
    : null;
  const leadDecision = await decideLeadProfileErasure(
    tx,
    leadApplicantId,
    applicationId,
    application.bursaryAccountId
  );

  // Documents + form sections: deleted (wholly personal; the financial
  // record lives on the retained Assessment, not in the files/JSONB).
  const documentsDeleted = (
    await tx.document.deleteMany({ where: { applicationId } })
  ).count;
  const sectionsDeleted = (
    await tx.applicationSection.deleteMany({ where: { applicationId } })
  ).count;

  // Application: child identity scrubbed, row retained.
  await tx.application.update({
    where: { id: applicationId },
    data: { ...APPLICATION_CHILD_SCRUB },
  });

  // Assessment + recommendation: RETAINED; non-synopsis prose scrubbed.
  if (application.assessment) {
    await tx.assessment.update({
      where: { id: application.assessment.id },
      data: { ...ASSESSMENT_FREETEXT_SCRUB },
    });
    // Legacy checklist tabs are free-text notes with no financial value.
    await tx.assessmentChecklist.deleteMany({
      where: { assessmentId: application.assessment.id },
    });
    if (application.assessment.recommendation) {
      await tx.recommendation.update({
        where: { id: application.assessment.recommendation.id },
        data: { ...RECOMMENDATION_FREETEXT_SCRUB },
      });
    }
  }

  // Contact register: scrub THIS child's rows (per-child identity key —
  // siblings' contacts belong to their own applications). Matched by the
  // pre-scrub child name under the lead profile, or by the account link.
  const contactWhere = {
    OR: [
      { profileId: leadApplicantId, childName: application.childName },
      ...(application.bursaryAccountId
        ? [{ bursaryAccountId: application.bursaryAccountId }]
        : []),
    ],
  };
  const contactsScrubbed = (
    await tx.contact.updateMany({
      where: contactWhere,
      data: { ...CONTACT_SCRUB, archivedAt: new Date() },
    })
  ).count;

  // Bursary account: child identity scrubbed; reference/figures retained.
  if (application.bursaryAccountId) {
    await tx.bursaryAccount.update({
      where: { id: application.bursaryAccountId },
      data: { ...BURSARY_ACCOUNT_CHILD_SCRUB },
    });
  }

  // Invitations for this application (they carry name/child fields).
  let invitationsDeleted = (
    await tx.invitation.deleteMany({ where: { applicationId } })
  ).count;

  // Contributor join rows for this application.
  await tx.applicationContributor.deleteMany({ where: { applicationId } });

  // Secondary profile: erase only when the shared-profile guard allows.
  let secondaryProfile: ClosePurgeResult["secondaryProfile"] = null;
  if (secondary && secondaryDecision) {
    if (secondaryDecision.canErase) {
      invitationsDeleted += (
        await tx.invitation.deleteMany({ where: { email: secondary.email } })
      ).count;
      await tx.auditLog.updateMany({
        where: { userId: secondary.profileId },
        data: { userId: null },
      });
      await tx.profile.update({
        where: { id: secondary.profileId },
        data: profileScrubData(secondary.profileId),
      });
      secondaryProfile = "erased";
    } else {
      secondaryProfile = "retained";
    }
  }

  // Lead profile: erase only when this was their last live record.
  if (leadDecision.canErase) {
    const profile = await tx.profile.findUnique({
      where: { id: leadApplicantId },
      select: { email: true },
    });
    if (profile) {
      invitationsDeleted += (
        await tx.invitation.deleteMany({ where: { email: profile.email } })
      ).count;
    }
    invitationsDeleted += (
      await tx.invitation.deleteMany({ where: { createdBy: leadApplicantId } })
    ).count;
    await tx.auditLog.updateMany({
      where: { userId: leadApplicantId },
      data: { userId: null },
    });
    await tx.profile.update({
      where: { id: leadApplicantId },
      data: profileScrubData(leadApplicantId),
    });
  }

  // Auth-user deletion is EXTERNAL to Postgres — collected here, executed by
  // the caller after the transaction commits (see authUsersToDelete docs).
  const authUsersToDelete: string[] = [];
  if (leadDecision.canErase) authUsersToDelete.push(leadApplicantId);
  if (secondary && secondaryDecision?.canErase) {
    authUsersToDelete.push(secondary.profileId);
  }

  return {
    storageErrors,
    counts: {
      documentsDeleted,
      sectionsDeleted,
      contactsScrubbed,
      invitationsDeleted,
    },
    leadProfile: leadDecision.canErase ? "erased" : "retained",
    leadProfileRetainedBecause: leadDecision.reason,
    secondaryProfile,
    authUsersToDelete,
  };
}

/**
 * Post-commit auth-user deletion (non-fatal per user, mirroring the GDPR
 * cascade). Call ONLY after the transaction that ran `purgeClosedApplication`
 * has committed. Returns error messages for the caller's audit metadata.
 */
export async function deleteAuthUsersPostCommit(
  userIds: string[],
  deps: AuthDeleteDeps
): Promise<string[]> {
  const errors: string[] = [];
  for (const userId of userIds) {
    try {
      const { error } = await deps.deleteAuthUser(userId);
      if (error) {
        errors.push(`${userId}: ${error.message}`);
        console.error("[close-purge] auth delete failed:", userId, error);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${userId}: ${msg}`);
      console.error("[close-purge] auth delete threw:", userId, err);
    }
  }
  return errors;
}

/**
 * Audit metadata for the caller's APPLICATION_PURGED row — references and
 * counts only, never scrubbed personal values (Story 10.4).
 */
export function buildClosePurgeAuditMetadata(
  application: { reference: string },
  result: ClosePurgeResult,
  authDeleteErrors: string[] = []
): Record<string, unknown> {
  return {
    reference: application.reference,
    counts: result.counts,
    leadProfile: result.leadProfile,
    leadProfileRetainedBecause: result.leadProfileRetainedBecause ?? undefined,
    storageErrors:
      result.storageErrors.length > 0 ? result.storageErrors : undefined,
    authDeleteErrors: authDeleteErrors.length > 0 ? authDeleteErrors : undefined,
    secondaryProfile: result.secondaryProfile ?? undefined,
  };
}
