/**
 * GET /api/documents/[id]/url
 *
 * Generates a Supabase Storage pre-signed URL (5-min expiry) for a document.
 * Requires authenticated user with ownership / admin / viewer / assigned-assessor access.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { createAuditLog } from "@/lib/audit/log";

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
const EXPIRY_SECONDS = 300; // 5 minutes — once a URL leaves the app it cannot be revoked

interface RouteParams {
  params: { id: string };
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documentId = params.id;

  // Fetch document record with application ownership/assignment context
  const document = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          storagePath: true,
          filename: true,
          applicationId: true,
          application: {
            select: { leadApplicantId: true, assignedToId: true },
          },
        },
      })
  );

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = document.application.leadApplicantId === user.id;
  const isAdminRole = user.role === Role.ADMIN || user.role === Role.VIEWER;
  const isAssignedAssessor =
    user.role === Role.ASSESSOR && document.application.assignedToId === user.id;

  if (!isOwner && !isAdminRole && !isAssignedAssessor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate pre-signed URL via Supabase admin client
  const supabaseAdmin = createSupabaseAdminClient();

  // `download: <filename>` forces a Content-Disposition: attachment response
  // header on the signed URL, preventing in-browser rendering of any uploaded
  // content (defence against HTML/SVG masquerading as PDF/PNG/JPEG).
  // See docs/security-audit.md §2.10.
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(document.storagePath, EXPIRY_SECONDS, {
      download: document.filename,
    });

  if (error || !data?.signedUrl) {
    console.error("[documents/url] Failed to create signed URL:", error);
    return NextResponse.json(
      { error: "Failed to generate document URL" },
      { status: 500 }
    );
  }

  // Audit log every successful signed-URL grant (DM-04 traceability)
  await withUserContext(user.id, user.role as RlsRole, (tx) =>
    createAuditLog(tx, {
      userId: user.id,
      action: "DOCUMENT_URL_GRANTED",
      entityType: "Document",
      entityId: document.id,
      context: `Signed URL issued (${EXPIRY_SECONDS}s)`,
      metadata: {
        applicationId: document.applicationId,
        filename: document.filename,
        expiresIn: EXPIRY_SECONDS,
      },
    })
  );

  return NextResponse.json({
    url: data.signedUrl,
    filename: document.filename,
    expiresIn: EXPIRY_SECONDS,
  });
}
