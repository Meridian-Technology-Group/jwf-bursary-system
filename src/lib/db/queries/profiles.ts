/**
 * Profile database queries for admin use.
 */

import { prisma } from "@/lib/db/prisma";

// ─── listAssessors ────────────────────────────────────────────────────────────

/**
 * Returns all profiles with the ASSESSOR role, ordered by last name.
 * Used to populate the assignee select in the application detail header.
 */
export async function listAssessors() {
  return prisma.profile.findMany({
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
 * Returns all staff profiles (ADMIN, ASSESSOR, VIEWER, DELETED).
 * Includes a count of assigned applications for workload visibility.
 */
export async function listStaffUsers() {
  return prisma.profile.findMany({
    where: { role: { in: ["ADMIN", "ASSESSOR", "VIEWER", "DELETED"] } },
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
