/**
 * Documents removed with an Application rejection (Charlotte, 17 Oct 2026:
 * "clear the documents per section"). Runs inside the rejection's
 * transaction: deletes the rows (this application's only), marks their form
 * sections incomplete and takes their ids out of the section blobs so the
 * family sees the gaps, and audits each one. The
 * caller deletes the stored files once the transaction commits.
 */

import type { Prisma } from "@prisma/client";
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

  // The form mirrors each upload's id into its section blob, and the gap
  // analysis counts an id there as an upload. Strip the removed ids, or the
  // completion figure stays at 100% (Charlotte, 21 Oct 2026).
  const removedIds = new Set(docs.map((d) => d.id));
  const rows = await tx.applicationSection.findMany({
    where: { applicationId },
    select: { id: true, data: true },
  });
  for (const row of rows) {
    const { value, changed } = withoutDocumentIds(row.data, removedIds);
    if (changed) {
      await tx.applicationSection.update({
        where: { id: row.id },
        data: { data: value as Prisma.InputJsonValue, isComplete: false },
      });
    }
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

/**
 * A section blob with every reference to `ids` taken out: an object key whose
 * value is a removed id is dropped, and removed ids are filtered out of
 * arrays. Everything else is returned as it was.
 */
export function withoutDocumentIds(
  value: unknown,
  ids: ReadonlySet<string>
): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const out: unknown[] = [];
    for (const item of value) {
      if (typeof item === "string" && ids.has(item)) {
        changed = true;
        continue;
      }
      const inner = withoutDocumentIds(item, ids);
      changed ||= inner.changed;
      out.push(inner.value);
    }
    return changed ? { value: out, changed } : { value, changed };
  }
  if (value !== null && typeof value === "object") {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "string" && ids.has(item)) {
        changed = true;
        continue;
      }
      const inner = withoutDocumentIds(item, ids);
      changed ||= inner.changed;
      out[key] = inner.value;
    }
    return changed ? { value: out, changed } : { value, changed };
  }
  return { value, changed: false };
}
