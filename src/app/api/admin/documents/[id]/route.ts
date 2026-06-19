/**
 * DELETE /api/admin/documents/[id]
 *
 * Staff-side document deletion endpoint (CR-001 edit-on-behalf). Allows ADMIN
 * and ASSESSOR role users to delete documents on behalf of applicants,
 * bypassing the contributor ownership checks that apply to the public
 * /api/documents/[id] route.
 *
 * Deliberately has NO submitted-status guard: staff may correct documents on
 * a SUBMITTED application while editing on the applicant's behalf.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireApplicationAccess } from "@/lib/auth/roles";
import { Role } from "@prisma/client";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { deleteDocument } from "@/lib/storage/documents";
import { createAuditLog } from "@/lib/audit/log";
import { logError } from "@/lib/log";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // ── Auth: staff (ADMIN or ASSESSOR) only ─────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== Role.ADMIN && user.role !== Role.ASSESSOR) {
    return NextResponse.json(
      { error: "Forbidden — staff role required" },
      { status: 403 }
    );
  }

  const { id: documentId } = await params;

  // ── Fetch document with its application ─────────────────────────────────────
  const document = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          storagePath: true,
          slot: true,
          filename: true,
          application: {
            select: { id: true, reference: true, assignedToId: true },
          },
        },
      })
  );

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // ── Application access check (mirrors POST /api/admin/documents): ADMIN
  //    passes trivially, ASSESSOR must be assigned to the application.
  //    Redirects on failure. ─────────────────────────────────────────────────
  await requireApplicationAccess(user, document.application.id);

  // NO submitted-status guard here — deliberate (CR-001). Staff may correct
  // documents on a SUBMITTED application while editing on the applicant's
  // behalf.

  // ── Delete from Supabase Storage ───────────────────────────────────────────
  try {
    await deleteDocument(document.storagePath);
  } catch (err) {
    logError("admin/documents/DELETE.storage", err);
    // Continue to delete the DB record even if storage deletion fails —
    // orphaned storage objects are less harmful than orphaned DB records.
  }

  // ── Delete Prisma record + audit log ──────────────────────────────────────
  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      await tx.document.delete({ where: { id: documentId } });
      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.DOCUMENT_DELETED,
        entityType: AUDIT_ENTITY_TYPES.Document,
        entityId: documentId,
        context: `Staff deleted document on the applicant's behalf — slot: ${document.slot}`,
        metadata: {
          applicationId: document.application.id,
          reference: document.application.reference,
          slot: document.slot,
          filename: document.filename,
          deletedByRole: user.role,
        },
      });
    });
  } catch (err) {
    logError("admin/documents/DELETE.db", err);
    return NextResponse.json(
      { error: "Failed to delete document record" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
