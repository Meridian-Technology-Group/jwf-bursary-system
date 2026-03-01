/**
 * GET /api/documents/[id]/url
 *
 * Generates a Supabase Storage pre-signed URL (60-min expiry) for a document.
 * Requires authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
const EXPIRY_SECONDS = 60 * 60; // 60 minutes

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

  // Fetch document record
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, storagePath: true, filename: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Generate pre-signed URL via Supabase admin client
  const supabaseAdmin = createSupabaseAdminClient();

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(document.storagePath, EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[documents/url] Failed to create signed URL:", error);
    return NextResponse.json(
      { error: "Failed to generate document URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    url: data.signedUrl,
    filename: document.filename,
    expiresIn: EXPIRY_SECONDS,
  });
}
