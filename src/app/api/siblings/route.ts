/**
 * WP-13: Sibling Links API
 *
 * GET  /api/siblings?bursaryAccountId=xxx  — list siblings for a bursary account
 * POST /api/siblings                        — create a sibling link
 *
 * Both endpoints require ASSESSOR role.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, Role } from "@/lib/auth/roles";
import { createAuditLog } from "@/lib/audit/log";
import {
  getSiblingLinks,
  createSiblingLink,
} from "@/lib/db/queries/siblings";

// ─── GET /api/siblings?bursaryAccountId=xxx ────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await requireRole([Role.ASSESSOR, Role.VIEWER]);
  void user; // auth checked — user not needed beyond gate

  const { searchParams } = new URL(request.url);
  const bursaryAccountId = searchParams.get("bursaryAccountId");

  if (!bursaryAccountId) {
    return NextResponse.json(
      { error: "bursaryAccountId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const links = await getSiblingLinks(bursaryAccountId);
    return NextResponse.json(links);
  } catch (err) {
    console.error("[GET /api/siblings] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch sibling links" },
      { status: 500 }
    );
  }
}

// ─── POST /api/siblings ────────────────────────────────────────────────────

interface CreateSiblingLinkBody {
  bursaryAccountId: string;
  targetBursaryAccountId: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await requireRole([Role.ASSESSOR]);

  let body: CreateSiblingLinkBody;
  try {
    body = (await request.json()) as CreateSiblingLinkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { bursaryAccountId, targetBursaryAccountId } = body;

  if (!bursaryAccountId || typeof bursaryAccountId !== "string") {
    return NextResponse.json(
      { error: "bursaryAccountId is required" },
      { status: 400 }
    );
  }
  if (!targetBursaryAccountId || typeof targetBursaryAccountId !== "string") {
    return NextResponse.json(
      { error: "targetBursaryAccountId is required" },
      { status: 400 }
    );
  }
  if (bursaryAccountId === targetBursaryAccountId) {
    return NextResponse.json(
      { error: "Cannot link a bursary account to itself" },
      { status: 422 }
    );
  }

  try {
    const result = await createSiblingLink(bursaryAccountId, targetBursaryAccountId);

    await createAuditLog({
      userId: user.id,
      action: "SIBLING_LINK_CREATED",
      entityType: "SIBLING_LINK",
      context: `Family group: ${result.familyGroupId}`,
      metadata: { bursaryAccountId, targetBursaryAccountId },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create sibling link";
    console.error("[POST /api/siblings] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
