/**
 * DELETE /api/documents/[id]
 *
 * Deletes a document:
 *   1. Requires authenticated user.
 *   2. Verifies the document belongs to the user's application.
 *   3. Only allows deletion if the application is not yet submitted.
 *   4. Removes from Supabase Storage then deletes the Prisma record.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { deleteDocument } from "@/lib/storage/documents";
import { createAuditLog } from "@/lib/audit/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: documentId } = await params;

  // ── Fetch document with application ownership data ─────────────────────────
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      storagePath: true,
      slot: true,
      filename: true,
      application: {
        select: {
          id: true,
          leadApplicantId: true,
          status: true,
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // ── Ownership check ────────────────────────────────────────────────────────
  if (document.application.leadApplicantId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Submission guard ───────────────────────────────────────────────────────
  if (document.application.status === "SUBMITTED") {
    return NextResponse.json(
      { error: "Cannot delete documents from a submitted application" },
      { status: 409 }
    );
  }

  // ── Delete from Supabase Storage ───────────────────────────────────────────
  try {
    await deleteDocument(document.storagePath);
  } catch (err) {
    console.error("[documents/DELETE] Storage deletion failed:", err);
    // Continue to delete the DB record even if storage deletion fails —
    // orphaned storage objects are less harmful than orphaned DB records.
  }

  // ── Delete Prisma record ───────────────────────────────────────────────────
  try {
    await prisma.document.delete({ where: { id: documentId } });
  } catch (err) {
    console.error("[documents/DELETE] DB deletion failed:", err);
    return NextResponse.json(
      { error: "Failed to delete document record" },
      { status: 500 }
    );
  }

  // ── Audit log (non-blocking) ───────────────────────────────────────────────
  await createAuditLog({
    userId: user.id,
    action: "DOCUMENT_DELETED",
    entityType: "Document",
    entityId: documentId,
    context: `Slot: ${document.slot}`,
    metadata: {
      applicationId: document.application.id,
      filename: document.filename,
    },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
