/**
 * DELETE /api/documents/[id]
 *
 * Deletes a document:
 *   1. Requires authenticated user.
 *   2. Verifies the caller is allowed to delete this document (contributor-aware).
 *   3. Only allows deletion if the application is not yet submitted.
 *   4. Removes from Supabase Storage then deletes the Prisma record.
 *
 * Contributor-aware authorization (dual-parent, PR 4b — this route is the
 * enforcing layer, storage RLS is only a backstop):
 *   - The lead applicant (PRIMARY) may delete documents on their application
 *     EXCEPT those uploaded by the SECONDARY contributor.
 *   - A SECONDARY contributor may delete ONLY documents they uploaded.
 * (Staff deletion is handled elsewhere; this applicant-facing route never
 * deleted staff-side, matching prior behaviour.)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { deleteDocument } from "@/lib/storage/documents";
import { createAuditLog } from "@/lib/audit/log";
import { logError } from "@/lib/log";
import { ApplicationContributorRole } from "@prisma/client";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

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

  // ── Fetch document with application ownership + uploading-contributor data ──
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
          uploadedBy: true,
          uploadedByContributor: { select: { role: true, profileId: true } },
          application: {
            select: {
              id: true,
              leadApplicantId: true,
              status: true,
            },
          },
        },
      })
  );

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // ── Contributor-aware ownership check ──────────────────────────────────────
  const isSecondaryOwnedDoc =
    document.uploadedByContributor?.role ===
    ApplicationContributorRole.SECONDARY;

  const isLeadApplicant = document.application.leadApplicantId === user.id;
  // Lead applicant may delete their application's documents EXCEPT secondary uploads.
  const leadMayDelete = isLeadApplicant && !isSecondaryOwnedDoc;
  // Secondary may delete ONLY documents they uploaded.
  const secondaryMayDelete =
    isSecondaryOwnedDoc &&
    document.uploadedByContributor?.profileId === user.id &&
    document.uploadedBy === user.id;

  if (!leadMayDelete && !secondaryMayDelete) {
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
    logError("documents/DELETE.storage", err);
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
        context: `Slot: ${document.slot}`,
        metadata: {
          applicationId: document.application.id,
          filename: document.filename,
        },
      });
    });
  } catch (err) {
    logError("documents/DELETE.db", err);
    return NextResponse.json(
      { error: "Failed to delete document record" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
