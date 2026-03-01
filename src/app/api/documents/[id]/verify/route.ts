/**
 * POST /api/documents/[id]/verify
 *
 * Toggles the isVerified flag on a Document record.
 * Requires ASSESSOR role. Creates an audit log entry.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";

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

  if (user.role !== Role.ASSESSOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documentId = params.id;

  // Fetch current document
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, isVerified: true, applicationId: true, slot: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Toggle verification
  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { isVerified: !document.isVerified },
    select: { id: true, isVerified: true },
  });

  // Audit log (non-blocking)
  await createAuditLog({
    userId: user.id,
    action: updated.isVerified ? "DOCUMENT_VERIFIED" : "DOCUMENT_UNVERIFIED",
    entityType: "Document",
    entityId: documentId,
    context: `Slot: ${document.slot}`,
    metadata: {
      applicationId: document.applicationId,
      isVerified: updated.isVerified,
    },
  });

  return NextResponse.json({ isVerified: updated.isVerified });
}
