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

import type { Tx } from "@/lib/db/prisma";
import { ALL_DOCUMENT_SLOTS } from "@/lib/documents/slots";

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
 */
export async function getLatestMissingDocsRequest(
  tx: Tx,
  applicationId: string
): Promise<MissingDocsRequest | null> {
  const row = await tx.auditLog.findFirst({
    where: {
      entityType: "Application",
      entityId: applicationId,
      action: "APPLICATION_PAUSED",
    },
    orderBy: { createdAt: "desc" },
    select: { metadata: true, createdAt: true },
  });

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
