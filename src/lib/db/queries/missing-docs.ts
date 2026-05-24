/**
 * Missing-documents request queries.
 *
 * When an assessor clicks "Request Missing Documents" the
 * `pauseApplication` server action pauses the application and records the
 * request — which document slots were asked for, plus an optional
 * free-text message — in the metadata of an `APPLICATION_PAUSED` audit-log
 * row (see `src/app/(admin)/applications/[id]/actions.ts`). There is no
 * dedicated table for the request, so the applicant-facing "respond"
 * page reads the most recent such audit row to learn what was requested.
 */

import { withAdminContext } from "@/lib/db/prisma";
import { ALL_DOCUMENT_SLOTS } from "@/lib/documents/slots";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

export interface MissingDocsRequest {
  /** Document slot identifiers the assessor asked the applicant to provide. */
  requestedSlots: string[];
  /** Optional free-text message the assessor appended to the request. */
  customMessage: string | null;
  /** When the request was made. */
  requestedAt: Date;
}

/**
 * Returns the most recent missing-documents request for an application, read
 * from the latest `APPLICATION_PAUSED` audit-log entry, or `null` if none
 * exists. Slot values that are not part of the known slot registry are
 * dropped defensively so the page never renders an unrecognised upload.
 *
 * SECURITY: the request lives in the metadata of the assessor-owned
 * `APPLICATION_PAUSED` audit row, whose `user_id` is the ASSESSOR. Under the
 * applicant's RLS context `audit_logs_select` only exposes rows where
 * `user_id = current_user_id()`, so the applicant could never read it. We
 * therefore read this single row under `withAdminContext` (service role).
 *
 * The caller MUST have already verified that the logged-in user owns
 * `applicationId` (its `leadApplicantId`) and that the application is PAUSED
 * before calling this — see `src/app/(portal)/respond/page.tsx`. That keeps
 * the service-role read scoped to the applicant's own application only; we do
 * NOT widen the `audit_logs` RLS policy.
 */
export async function getLatestMissingDocsRequest(
  applicationId: string
): Promise<MissingDocsRequest | null> {
  const row = await withAdminContext((tx) =>
    tx.auditLog.findFirst({
      where: {
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: applicationId,
        action: AUDIT_ACTIONS.APPLICATION_PAUSED,
      },
      orderBy: { createdAt: "desc" },
      select: { metadata: true, createdAt: true },
    })
  );

  if (!row) return null;

  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const rawSlots = metadata.missingDocumentSlots;
  const knownSlots = new Set<string>(ALL_DOCUMENT_SLOTS);

  const requestedSlots = Array.isArray(rawSlots)
    ? rawSlots.filter(
        (s): s is string => typeof s === "string" && knownSlots.has(s)
      )
    : [];

  const customMessage =
    typeof metadata.customMessage === "string" && metadata.customMessage.trim()
      ? (metadata.customMessage as string)
      : null;

  return {
    requestedSlots,
    customMessage,
    requestedAt: row.createdAt,
  };
}
