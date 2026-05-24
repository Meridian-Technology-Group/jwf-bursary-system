// src/app/api/cron/expire-invitations/route.ts
//
// Vercel Cron handler that auto-transitions PENDING invitations to EXPIRED
// once they pass their `expiresAt` (#7). The acceptance flow already refuses
// expired tokens, but the `status` column never moved on its own, so the
// admin Invitations / Pending Staff Invitations lists showed stale PENDING
// rows indefinitely. This covers BOTH `Invitation` (applicant) and
// `StaffInvitation` (staff).
//
// Schedule: registered in vercel.json under `crons` (daily). Vercel invokes
// this route on schedule with `Authorization: Bearer ${CRON_SECRET}`.
//
// Security: CRON_SECRET is a NEW environment variable that must be set in the
// Vercel Production AND Preview scopes. Requests without a matching bearer
// token are rejected with 401. When CRON_SECRET is unset we also reject (fail
// closed) so the endpoint can't be exercised before it's configured.

import { NextRequest, NextResponse } from "next/server";
import { InvitationStatus } from "@prisma/client";
import { withAdminContext } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

// This route touches the DB and reads request headers — never statically
// optimised or cached.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth: require a matching bearer token (fail closed) ───────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    const { applicants, staff } = await withAdminContext(async (tx) => {
      const applicantResult = await tx.invitation.updateMany({
        where: {
          status: InvitationStatus.PENDING,
          expiresAt: { lt: now },
        },
        data: { status: InvitationStatus.EXPIRED },
      });

      const staffResult = await tx.staffInvitation.updateMany({
        where: {
          status: InvitationStatus.PENDING,
          expiresAt: { lt: now },
        },
        data: { status: InvitationStatus.EXPIRED },
      });

      const applicants = applicantResult.count;
      const staff = staffResult.count;

      // Only write an audit row when something actually transitioned, so the
      // nightly no-op runs don't flood the audit trail.
      if (applicants > 0 || staff > 0) {
        await createAuditLog(tx, {
          action: AUDIT_ACTIONS.EXPIRE_INVITATIONS_CRON,
          entityType: AUDIT_ENTITY_TYPES.Invitation,
          context: `Expired ${applicants} applicant and ${staff} staff invitation(s) past expiry`,
          metadata: {
            applicantInvitationsExpired: applicants,
            staffInvitationsExpired: staff,
            ranAt: now.toISOString(),
          },
        });
      }

      return { applicants, staff };
    });

    return NextResponse.json({
      ok: true,
      applicantInvitationsExpired: applicants,
      staffInvitationsExpired: staff,
      ranAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[cron/expire-invitations] error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to expire invitations" },
      { status: 500 }
    );
  }
}
