/**
 * POST /api/documents/[id]/verify
 *
 * Toggles the isVerified flag on a Document record.
 * Requires ASSESSOR role. Creates an audit log entry.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { Role } from "@prisma/client";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

interface RouteParams {
  params: { id: string };
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== Role.ASSESSOR && user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documentId = params.id;

  const result = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      // Fetch current document with application assignment context
      const document = await tx.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          isVerified: true,
          applicationId: true,
          slot: true,
          application: { select: { assignedToId: true } },
        },
      });

      if (!document) {
        return { error: "Document not found", status: 404 as const };
      }

      // ASSESSOR may only verify documents on applications assigned to them.
      // ADMIN is unrestricted (finding 2.13).
      if (
        user.role === Role.ASSESSOR &&
        document.application.assignedToId !== user.id
      ) {
        return { error: "Forbidden", status: 403 as const };
      }

      // Toggle verification
      const updated = await tx.document.update({
        where: { id: documentId },
        data: { isVerified: !document.isVerified },
        select: { id: true, isVerified: true },
      });

      // Audit log (non-blocking)
      await createAuditLog(tx, {
        userId: user.id,
        action: updated.isVerified
          ? AUDIT_ACTIONS.DOCUMENT_VERIFIED
          : AUDIT_ACTIONS.DOCUMENT_UNVERIFIED,
        entityType: AUDIT_ENTITY_TYPES.Document,
        entityId: documentId,
        context: `Slot: ${document.slot}`,
        metadata: {
          applicationId: document.applicationId,
          isVerified: updated.isVerified,
        },
      });

      return { isVerified: updated.isVerified };
    }
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ isVerified: result.isVerified });
}
