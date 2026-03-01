/**
 * WP-13: Sibling Link — individual resource routes
 *
 * DELETE /api/siblings/[id]  — remove a sibling link by SiblingLink.id
 * PATCH  /api/siblings/[id]  — reorder siblings within a family group
 *
 * Both endpoints require ASSESSOR role.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, Role } from "@/lib/auth/roles";
import { createAuditLog } from "@/lib/audit/log";
import {
  removeSiblingLink,
  reorderSiblingPriority,
} from "@/lib/db/queries/siblings";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── DELETE /api/siblings/[id] ─────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const user = await requireRole([Role.ASSESSOR]);
  const { id: siblingLinkId } = await params;

  try {
    await removeSiblingLink(siblingLinkId);

    await createAuditLog({
      userId: user.id,
      action: "SIBLING_LINK_REMOVED",
      entityType: "SIBLING_LINK",
      entityId: siblingLinkId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/siblings/[id]] Error:", err);
    return NextResponse.json(
      { error: "Failed to remove sibling link" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/siblings/[id] — reorder ────────────────────────────────────

interface ReorderBody {
  familyGroupId: string;
  orderedIds: string[];
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const user = await requireRole([Role.ASSESSOR]);

  // The [id] segment is not used directly for reorder — the body provides
  // the familyGroupId. We still validate params to satisfy route typing.
  void (await params);

  let body: ReorderBody;
  try {
    body = (await request.json()) as ReorderBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { familyGroupId, orderedIds } = body;

  if (!familyGroupId || typeof familyGroupId !== "string") {
    return NextResponse.json(
      { error: "familyGroupId is required" },
      { status: 400 }
    );
  }
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json(
      { error: "orderedIds must be a non-empty array" },
      { status: 400 }
    );
  }

  try {
    await reorderSiblingPriority(familyGroupId, orderedIds);

    await createAuditLog({
      userId: user.id,
      action: "SIBLING_PRIORITY_REORDERED",
      entityType: "SIBLING_LINK",
      context: `Family group: ${familyGroupId}`,
      metadata: { orderedIds },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/siblings/[id]] Error:", err);
    return NextResponse.json(
      { error: "Failed to reorder sibling priority" },
      { status: 500 }
    );
  }
}
