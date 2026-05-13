/**
 * WP-13: Bursary Account Search API
 *
 * GET /api/siblings/search?q=<query>
 *
 * Searches bursary accounts by child name, reference, or lead applicant email.
 * Used by the SiblingLinker component's search input.
 *
 * Requires ASSESSOR role.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { searchBursaryAccounts } from "@/lib/db/queries/siblings";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  if (query.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const results = await withUserContext(user.id, user.role as RlsRole, (tx) =>
      searchBursaryAccounts(tx, query)
    );
    return NextResponse.json(results);
  } catch (err) {
    console.error("[GET /api/siblings/search] Error:", err);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
