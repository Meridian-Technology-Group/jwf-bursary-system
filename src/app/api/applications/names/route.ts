/**
 * GET /api/applications/names
 *
 * Returns child name and lead applicant name for the requested application IDs.
 * Requires ASSESSOR role. Writes a NAME_REVEAL audit log entry.
 *
 * Query params: applicationIds[] — repeated query param, one per ID.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { Role } from "@prisma/client";
import { getApplicationNames } from "@/lib/db/queries/applications";
import { createAuditLog } from "@/lib/audit/log";

export async function GET(request: NextRequest) {
  // Auth check — ASSESSOR only
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== Role.ASSESSOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse application IDs from query params
  const { searchParams } = new URL(request.url);
  const applicationIds = searchParams.getAll("applicationIds[]");

  if (!applicationIds || applicationIds.length === 0) {
    return NextResponse.json({ error: "No application IDs provided" }, { status: 400 });
  }

  // Fetch names
  const names = await getApplicationNames(applicationIds);

  // Write audit log (non-blocking)
  await createAuditLog({
    userId: user.id,
    action: "NAME_REVEAL",
    entityType: "Application",
    context: "Admin queue name reveal",
    metadata: {
      applicationIds,
      count: applicationIds.length,
    },
  });

  // Return names — omit sensitive details, just what the table needs
  const result = names.map((app) => ({
    id: app.id,
    childName: app.childName,
    leadApplicantName: [
      app.leadApplicant.firstName,
      app.leadApplicant.lastName,
    ]
      .filter(Boolean)
      .join(" ") || app.leadApplicant.email,
  }));

  return NextResponse.json(result);
}
