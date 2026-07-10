/**
 * Item 2 — the unified application close (`closeApplicationCore`).
 *
 * ONE way to close an application, replacing the divergent Decline /
 * Withdraw-account terminal paths (Story 2.3). Per the official state map
 * (D-3, resolved 2026-07-09) close is LIFECYCLE-ONLY: it never writes an
 * assessment outcome and never sends an outcome email — the school's decision
 * is external, and this records its terminal consequence.
 *
 * What one close does, in the caller's admin-context transaction:
 *   1. Guards: application exists; NOT already closed (closedAt is written
 *      exactly once — no double-close, Story 2.1); the close reason exists
 *      and is active (server-side enforcement, Story 4.1 — no close path can
 *      bypass the reason).
 *   2. Stamps `closedAt` / `closedBy` / `closeReasonId` on the application.
 *   3. Closes a live (ACTIVE) BursaryAccount the application carries —
 *      subsuming the old withdraw behaviour. Idempotent: an already-CLOSED
 *      account is left untouched (its original closedAt survives).
 *   4. If the reason's `purgeOnClose` flag is set and the application has not
 *      already been purged, runs `purgeClosedApplication` (item 10) and
 *      stamps `purgedAt`.
 *   5. Writes the APPLICATION_CLOSED audit row (and APPLICATION_PURGED when a
 *      purge ran) — inside the same transaction, so state change + audit are
 *      atomic. Auth-user deletion is external and returned to the caller to
 *      run POST-COMMIT (`deleteAuthUsersPostCommit`); its failures are
 *      non-fatal and logged, mirroring the GDPR cascade's posture.
 *
 * The per-row server action and the A4 bulk action both call this core — no
 * forked close logic anywhere.
 */

import type { Tx } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import {
  purgeClosedApplication,
  buildClosePurgeAuditMetadata,
  type ClosePurgeDeps,
} from "@/lib/retention/close-purge";

export interface CloseApplicationInput {
  applicationId: string;
  closeReasonId: string;
  /** The ADMIN performing the close (audit + closedBy). */
  actorId: string;
}

export type CloseApplicationResult =
  | {
      success: true;
      reference: string;
      closeReasonLabel: string;
      purgeRan: boolean;
      accountClosed: boolean;
      /** Auth users to delete AFTER the transaction commits (purge only). */
      authUsersToDelete: string[];
    }
  | { success: false; error: string };

/**
 * Close one application inside the caller's admin-context transaction.
 * Throws nothing for expected failures — returns `{ success: false }` with a
 * user-facing reason so the bulk path can skip-and-report per row.
 */
export async function closeApplicationCore(
  tx: Tx,
  input: CloseApplicationInput,
  deps: ClosePurgeDeps
): Promise<CloseApplicationResult> {
  const { applicationId, closeReasonId, actorId } = input;

  const application = await tx.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      reference: true,
      childName: true,
      closedAt: true,
      purgedAt: true,
      leadApplicantId: true,
      bursaryAccountId: true,
      bursaryAccount: { select: { id: true, status: true } },
      documents: { select: { id: true, storagePath: true } },
      assessment: {
        select: { id: true, recommendation: { select: { id: true } } },
      },
    },
  });
  if (!application) {
    return { success: false, error: "Application not found." };
  }
  if (application.closedAt != null) {
    return { success: false, error: "Application is already closed." };
  }

  const reason = await tx.closeReason.findUnique({
    where: { id: closeReasonId },
    select: { id: true, label: true, purgeOnClose: true, isDeprecated: true },
  });
  if (!reason) {
    return { success: false, error: "Close reason not found." };
  }
  if (reason.isDeprecated) {
    return {
      success: false,
      error: `Close reason "${reason.label}" has been deactivated — choose an active reason.`,
    };
  }

  const now = new Date();

  // 2. The single terminal state (Story 2.1) — written exactly once.
  await tx.application.update({
    where: { id: applicationId },
    data: {
      closedAt: now,
      closedById: actorId,
      closeReasonId: reason.id,
    },
  });

  // 3. A live rolling account is wound down with the application (subsumes
  //    the old withdraw path). Already-CLOSED accounts keep their original
  //    closedAt — never rewritten (withdraw's idempotency contract).
  let accountClosed = false;
  if (application.bursaryAccount?.status === "ACTIVE") {
    await tx.bursaryAccount.update({
      where: { id: application.bursaryAccount.id },
      data: { status: "CLOSED", closedAt: now },
    });
    accountClosed = true;
  }

  // 4. Reason-driven purge (item 10) — the reason's toggle is the sole driver.
  let purgeRan = false;
  let authUsersToDelete: string[] = [];
  if (reason.purgeOnClose && application.purgedAt == null) {
    const purgeResult = await purgeClosedApplication(
      tx,
      {
        id: application.id,
        reference: application.reference,
        childName: application.childName,
        leadApplicantId: application.leadApplicantId,
        bursaryAccountId: application.bursaryAccountId,
        documents: application.documents,
        assessment: application.assessment,
      },
      deps
    );
    await tx.application.update({
      where: { id: applicationId },
      data: { purgedAt: now },
    });
    purgeRan = true;
    authUsersToDelete = purgeResult.authUsersToDelete;

    await createAuditLog(tx, {
      userId: actorId,
      action: AUDIT_ACTIONS.APPLICATION_PURGED,
      entityType: AUDIT_ENTITY_TYPES.Application,
      entityId: applicationId,
      context: `Application ${application.reference} purged on close (reason: ${reason.label})`,
      metadata: {
        ...buildClosePurgeAuditMetadata(application, purgeResult),
        closeReasonId: reason.id,
        closeReasonLabel: reason.label,
      },
    });
  }

  // 5. The close itself — atomic with the state change.
  await createAuditLog(tx, {
    userId: actorId,
    action: AUDIT_ACTIONS.APPLICATION_CLOSED,
    entityType: AUDIT_ENTITY_TYPES.Application,
    entityId: applicationId,
    context: `Application ${application.reference} closed (${reason.label})`,
    metadata: {
      reference: application.reference,
      closeReasonId: reason.id,
      closeReasonLabel: reason.label,
      purgeRan,
      accountClosed,
    },
  });

  return {
    success: true,
    reference: application.reference,
    closeReasonLabel: reason.label,
    purgeRan,
    accountClosed,
    authUsersToDelete,
  };
}
