/**
 * Profile database queries for admin use.
 */

import type { Tx } from "@/lib/db/prisma";

// ─── listAssessors ────────────────────────────────────────────────────────────

/**
 * Returns all profiles with the ASSESSOR role, ordered by last name.
 * Used to populate the assignee select in the application detail header.
 */
export async function listAssessors(tx: Tx) {
  return tx.profile.findMany({
    where: { role: "ASSESSOR" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
    orderBy: { lastName: "asc" },
  });
}

// ─── listStaffUsers ──────────────────────────────────────────────────────────

/**
 * Returns all staff profiles (ADMIN, ASSESSOR, VIEWER, DELETED) that have
 * actually completed registration — i.e. they do NOT have an outstanding
 * PENDING staff invitation. Outstanding invitations live in their own
 * Pending Staff Invitations table on /users so the "Joined" column here
 * stays meaningful.
 *
 * Includes a count of assigned applications for workload visibility.
 */
export async function listStaffUsers(tx: Tx) {
  const pendingAuthUserIds = (
    await tx.staffInvitation.findMany({
      where: { status: "PENDING" },
      select: { authUserId: true },
    })
  ).map((r) => r.authUserId);

  return tx.profile.findMany({
    where: {
      role: { in: ["ADMIN", "ASSESSOR", "VIEWER", "DELETED"] },
      ...(pendingAuthUserIds.length > 0
        ? { id: { notIn: pendingAuthUserIds } }
        : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
      _count: { select: { assignedApplications: true } },
    },
    orderBy: [{ role: "asc" }, { lastName: "asc" }],
  });
}
