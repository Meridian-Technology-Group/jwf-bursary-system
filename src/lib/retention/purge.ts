/**
 * Epic 10 — shared application-erasure cascade.
 *
 * Extracted verbatim from `gdprDeleteApplicantAction` so the MANUAL GDPR delete
 * button and the AUTOMATIC retention cron run BYTE-FOR-BYTE the same erasure.
 * One cascade ⇒ one place where the GDPR/append-only-audit invariants are
 * honoured, and no risk the cron and the button diverge.
 *
 * What it does (preserving the original ordering exactly):
 *   1. Resolve the SECONDARY contributor (second parent) + the shared-profile
 *      erasure verdict (read-only, before any mutation).
 *   2. Delete Storage objects first (non-fatal per-doc).
 *   3. In ONE admin-context transaction:
 *        a. delete assessment children (earners, checklists, property)
 *        b. delete recommendation + junction rows
 *        c. delete the assessment
 *        d. delete ApplicationSection rows
 *        e. delete Document DB rows
 *        f. ANONYMISE the Application (childName/childDob) — never hard-deleted
 *        f2. scrub the lead's Contact rows + BursaryAccount child identity
 *            (item 10.5 residue-gap fix; values from scrub-map.ts)
 *        g. delete the lead's Invitation rows (by createdBy + by email)
 *        h. NULL AuditLog.userId for the lead (NEVER delete audit rows —
 *           audit_logs is append-only; deletion fails 42501 and rolls back)
 *        i. anonymise the lead Profile + role → DELETED
 *        j. dual-parent: delete contributor rows; anonymise-or-retain secondary
 *   4. Delete the lead's Supabase auth user (non-fatal).
 *   5. Delete the secondary's Supabase auth user when erasable (non-fatal).
 *
 * The caller supplies the (already RLS-bypassing) `withAdminContext` runner, the
 * Storage deleter and the Supabase admin client so this module stays free of a
 * hard dependency on request-scoped auth and can be unit-tested with fakes.
 *
 * ⚠️ APPEND-ONLY AUDIT: this cascade NEVER deletes audit rows (it only nulls
 * their userId). A unit test asserts no audit-row deletion call exists in this
 * file. The summary audit row is written by the caller (manual action:
 * GDPR_DELETION; cron: RETENTION_PURGE_CRON).
 */

import type { Tx } from "@/lib/db/prisma";
import {
  getSecondaryContributorForGdpr,
  decideSecondaryProfileErasure,
  type SecondaryContributorForGdpr,
  type SecondaryProfileLinkDecision,
} from "@/lib/db/queries/secondary-gdpr";
import {
  APPLICATION_CHILD_SCRUB,
  BURSARY_ACCOUNT_CHILD_SCRUB,
  CONTACT_SCRUB,
  profileScrubData,
} from "@/lib/retention/scrub-map";

/** The application + relations the cascade needs. Mirrors the action's fetch. */
export interface PurgeableApplication {
  id: string;
  reference: string;
  leadApplicantId: string;
  documents: { id: string; storagePath: string }[];
  assessment: {
    id: string;
    property: { id: string } | null;
    recommendation: { id: string } | null;
  } | null;
}

/** Per-secondary erasure outcome, surfaced into the caller's audit metadata. */
export interface SecondaryPurgeOutcome {
  contributor: SecondaryContributorForGdpr;
  decision: SecondaryProfileLinkDecision;
  /** True when the secondary's auth user was deleted (erased + no auth error). */
  authDeleted: boolean;
  /** Any error returned while deleting the secondary's auth user. */
  authDeleteError: string | null;
}

export interface PurgeResult {
  /** Non-fatal Storage delete failures keyed by document id. */
  storageErrors: string[];
  /** Any error returned while deleting the lead's Supabase auth user. */
  authDeleteError: string | null;
  /** Secondary-contributor handling, omitted for single-parent applications. */
  secondary: SecondaryPurgeOutcome | null;
}

/** The dependencies the cascade needs from the caller (DI for testability). */
export interface PurgeDeps {
  /** Runs a function inside an admin-context (service_role) transaction. */
  withAdminContext: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
  /** Deletes one Storage object by path. May throw — caught per-doc. */
  deleteDocument: (storagePath: string) => Promise<void>;
  /** Deletes a Supabase auth user; returns `{ error }` like the SDK. */
  deleteAuthUser: (userId: string) => Promise<{ error: { message: string } | null }>;
}

/**
 * Erase one application's personal data (anonymise + delete), honouring the
 * dual-parent shared-profile guard and the append-only audit invariant. Does
 * NOT write the summary audit row — the caller does that with its own action.
 */
export async function purgeApplication(
  application: PurgeableApplication,
  deps: PurgeDeps
): Promise<PurgeResult> {
  const { withAdminContext, deleteDocument, deleteAuthUser } = deps;
  const applicationId = application.id;
  const leadApplicantId = application.leadApplicantId;

  // 1. Resolve the SECONDARY contributor + the shared-profile erasure verdict.
  const secondary = await withAdminContext((tx) =>
    getSecondaryContributorForGdpr(tx, applicationId)
  );
  const secondaryProfileDecision = secondary
    ? await withAdminContext((tx) =>
        decideSecondaryProfileErasure(tx, secondary.profileId, applicationId)
      )
    : null;

  // 2. Delete Storage files first (non-fatal: continue on partial failure).
  const storageErrors: string[] = [];
  for (const doc of application.documents) {
    try {
      await deleteDocument(doc.storagePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      storageErrors.push(`${doc.id}: ${msg}`);
      console.warn("[purge] Storage delete failed for", doc.id, msg);
    }
  }

  // 3. DB mutations in a single admin-context transaction (bypasses RLS).
  await withAdminContext(async (tx) => {
    // a. Delete assessment children
    if (application.assessment) {
      const assessmentId = application.assessment.id;

      await tx.assessmentEarner.deleteMany({ where: { assessmentId } });
      await tx.assessmentChecklist.deleteMany({ where: { assessmentId } });
      if (application.assessment.property) {
        await tx.assessmentProperty.delete({ where: { assessmentId } });
      }

      // b. Delete recommendation + junction rows
      if (application.assessment.recommendation) {
        const recommendationId = application.assessment.recommendation.id;
        await tx.recommendationReasonCode.deleteMany({
          where: { recommendationId },
        });
        await tx.recommendation.delete({ where: { id: recommendationId } });
      }

      // c. Delete assessment itself
      await tx.assessment.delete({ where: { id: assessmentId } });
    }

    // d. Delete ApplicationSection rows
    await tx.applicationSection.deleteMany({ where: { applicationId } });

    // e. Delete Document DB records
    await tx.document.deleteMany({ where: { applicationId } });

    // f. Anonymise Application (never hard-deleted — preserves reference lineage)
    await tx.application.update({
      where: { id: applicationId },
      data: { ...APPLICATION_CHILD_SCRUB },
    });

    // f2. Item 10.5 residue-gap fixes (previously missed by this cascade):
    //     the contact register holds a full second copy of the family's PII,
    //     and the bursary account carries the child's name/DOB. Profile-scoped
    //     intent ⇒ scrub EVERY contact and account of this lead (all children;
    //     the person is being forgotten), values from the shared scrub map.
    await tx.contact.updateMany({
      where: { profileId: leadApplicantId },
      data: { ...CONTACT_SCRUB, archivedAt: new Date() },
    });
    await tx.bursaryAccount.updateMany({
      where: { leadApplicantId },
      data: { ...BURSARY_ACCOUNT_CHILD_SCRUB },
    });

    // g. Delete Invitation records linked to this lead applicant
    await tx.invitation.deleteMany({ where: { createdBy: leadApplicantId } });
    const profile = await tx.profile.findUnique({
      where: { id: leadApplicantId },
      select: { email: true },
    });
    if (profile) {
      await tx.invitation.deleteMany({ where: { email: profile.email } });
    }

    // h. Anonymise AuditLog rows (set userId → null). NEVER delete audit rows.
    await tx.auditLog.updateMany({
      where: { userId: leadApplicantId },
      data: { userId: null },
    });

    // i. Anonymise the lead Profile (values from the shared scrub map)
    await tx.profile.update({
      where: { id: leadApplicantId },
      data: profileScrubData(leadApplicantId),
    });

    // j. Dual-parent secondary erasure.
    await tx.applicationContributor.deleteMany({ where: { applicationId } });

    if (secondary && secondaryProfileDecision) {
      if (secondaryProfileDecision.canErase) {
        await tx.invitation.deleteMany({ where: { email: secondary.email } });
        await tx.auditLog.updateMany({
          where: { userId: secondary.profileId },
          data: { userId: null },
        });
        await tx.profile.update({
          where: { id: secondary.profileId },
          data: profileScrubData(secondary.profileId),
        });
      } else {
        await tx.invitation.deleteMany({
          where: { applicationId, email: secondary.email },
        });
      }
    }
  });

  // 4. Delete the lead's Supabase auth user (GDPR Art. 17). Non-fatal.
  let authDeleteError: string | null = null;
  try {
    const { error } = await deleteAuthUser(leadApplicantId);
    if (error) {
      authDeleteError = error.message;
      console.error("[purge] auth.admin.deleteUser failed:", error);
    }
  } catch (err) {
    authDeleteError = err instanceof Error ? err.message : String(err);
    console.error("[purge] auth.admin.deleteUser threw:", err);
  }

  // 5. Delete the secondary's Supabase auth user — ONLY when erasable.
  let secondaryOutcome: SecondaryPurgeOutcome | null = null;
  if (secondary && secondaryProfileDecision) {
    let secondaryAuthDeleteError: string | null = null;
    if (secondaryProfileDecision.canErase) {
      try {
        const { error } = await deleteAuthUser(secondary.profileId);
        if (error) {
          secondaryAuthDeleteError = error.message;
          console.error(
            "[purge] secondary auth.admin.deleteUser failed:",
            error
          );
        }
      } catch (err) {
        secondaryAuthDeleteError =
          err instanceof Error ? err.message : String(err);
        console.error("[purge] secondary auth.admin.deleteUser threw:", err);
      }
    }
    secondaryOutcome = {
      contributor: secondary,
      decision: secondaryProfileDecision,
      authDeleted: secondaryProfileDecision.canErase && !secondaryAuthDeleteError,
      authDeleteError: secondaryAuthDeleteError,
    };
  }

  return { storageErrors, authDeleteError, secondary: secondaryOutcome };
}

/** Builds the audit metadata block shared by manual + cron purge audit rows. */
export function buildPurgeAuditMetadata(
  application: { reference: string },
  leadApplicantId: string,
  result: PurgeResult
): Record<string, unknown> {
  return {
    reference: application.reference,
    leadApplicantId,
    storageErrors:
      result.storageErrors.length > 0 ? result.storageErrors : undefined,
    authDeleteError: result.authDeleteError ?? undefined,
    secondary: result.secondary
      ? {
          contributorId: result.secondary.contributor.contributorId,
          profileId: result.secondary.contributor.profileId,
          profileHandling: result.secondary.decision.canErase
            ? "erased"
            : "retained",
          links: {
            otherContributorLinks:
              result.secondary.decision.otherContributorLinks,
            leadApplicantApplications:
              result.secondary.decision.leadApplicantApplications,
            bursaryAccounts: result.secondary.decision.bursaryAccounts,
          },
          authDeleted: result.secondary.authDeleted,
          authDeleteError: result.secondary.authDeleteError ?? undefined,
        }
      : undefined,
  };
}
