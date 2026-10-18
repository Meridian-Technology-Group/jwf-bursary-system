/**
 * Documents removed with an Application rejection (Charlotte, 17 Oct 2026:
 * "clear the documents per section"). Runs inside the rejection's
 * transaction: deletes the rows (this application's only), marks their form
 * sections incomplete so the family sees the gaps, and audits each one. The
 * caller deletes the stored files once the transaction commits.
 */

import type { Tx } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { sectionForDocumentSlot } from "@/lib/documents/section-grouping";

export async function removeDocumentsWithRejection(
  tx: Tx,
  params: {
    applicationId: string;
    reference: string;
    documentIds: readonly string[];
    staffId: string;
    staffRole: string;
    rejectionId: string;
  }
): Promise<{ removed: number; storagePaths: string[] }> {
  const { applicationId } = params;
  if (params.documentIds.length === 0) return { removed: 0, storagePaths: [] };

  const docs = await tx.document.findMany({
    where: { id: { in: [...params.documentIds] }, applicationId },
    select: { id: true, slot: true, filename: true, storagePath: true },
  });
  if (docs.length === 0) return { removed: 0, storagePaths: [] };

  await tx.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });

  const sections = Array.from(
    new Set(
      docs
        .map((d) => sectionForDocumentSlot(d.slot))
        .filter((s): s is NonNullable<typeof s> => s != null)
    )
  );
  if (sections.length) {
    await tx.applicationSection.updateMany({
      where: { applicationId, section: { in: sections } },
      data: { isComplete: false },
    });
  }

  for (const d of docs) {
    await createAuditLog(tx, {
      userId: params.staffId,
      action: AUDIT_ACTIONS.DOCUMENT_DELETED,
      entityType: AUDIT_ENTITY_TYPES.Document,
      entityId: d.id,
      context: `Removed with the application rejection — slot: ${d.slot}`,
      metadata: {
        applicationId,
        reference: params.reference,
        slot: d.slot,
        filename: d.filename,
        deletedByRole: params.staffRole,
        rejectionRecordId: params.rejectionId,
      },
    });
  }

  return { removed: docs.length, storagePaths: docs.map((d) => d.storagePath) };
}
