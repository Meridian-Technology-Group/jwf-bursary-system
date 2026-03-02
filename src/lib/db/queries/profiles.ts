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
