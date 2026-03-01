/**
 * WP-13: Sibling Linking — Database Queries
 *
 * All queries relating to SiblingLink: creating family groups, searching
 * for bursary accounts to link, reordering priority, and removing links.
 */

import { prisma } from "@/lib/db/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SiblingLinkRow {
  id: string;
  familyGroupId: string;
  bursaryAccountId: string;
  priorityOrder: number;
  createdAt: Date;
  bursaryAccount: {
    id: string;
    childName: string;
    school: string;
    reference: string;
    /** yearlyPayableFees from the most recent completed assessment, or null */
    latestPayableFees: number | null;
  };
}

export interface BursaryAccountSearchResult {
  id: string;
  reference: string;
  childName: string;
  school: string;
  leadApplicantEmail: string;
}

// ─── getSiblingLinks ──────────────────────────────────────────────────────────

/**
 * Returns all sibling links for the family group that contains the given
 * bursary account. Results are ordered by priorityOrder ascending.
 *
 * Each result includes the latest completed assessment's yearlyPayableFees
 * so the assessment form can use it for sequential income absorption.
 *
 * Returns an empty array when the account has no sibling links.
 */
export async function getSiblingLinks(
  bursaryAccountId: string
): Promise<SiblingLinkRow[]> {
  // First, find the family group this account belongs to (if any)
  const ownLink = await prisma.siblingLink.findFirst({
    where: { bursaryAccountId },
    select: { familyGroupId: true },
  });

  if (!ownLink) return [];

  const links = await prisma.siblingLink.findMany({
    where: { familyGroupId: ownLink.familyGroupId },
    orderBy: { priorityOrder: "asc" },
    select: {
      id: true,
      familyGroupId: true,
      bursaryAccountId: true,
      priorityOrder: true,
      createdAt: true,
      bursaryAccount: {
        select: {
          id: true,
          childName: true,
          school: true,
          reference: true,
          applications: {
            where: {
              assessment: {
                yearlyPayableFees: { not: null },
              },
            },
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: {
              assessment: {
                select: { yearlyPayableFees: true },
              },
            },
          },
        },
      },
    },
  });

  return links.map((link) => {
    const latestApp = link.bursaryAccount.applications[0];
    const rawFees = latestApp?.assessment?.yearlyPayableFees ?? null;
    const latestPayableFees =
      rawFees !== null ? Number(rawFees) : null;

    return {
      id: link.id,
      familyGroupId: link.familyGroupId,
      bursaryAccountId: link.bursaryAccountId,
      priorityOrder: link.priorityOrder,
      createdAt: link.createdAt,
      bursaryAccount: {
        id: link.bursaryAccount.id,
        childName: link.bursaryAccount.childName,
        school: link.bursaryAccount.school,
        reference: link.bursaryAccount.reference,
        latestPayableFees,
      },
    };
  });
}

// ─── searchBursaryAccounts ────────────────────────────────────────────────────

/**
 * Searches bursary accounts by child name, account reference, or lead
 * applicant email. Returns up to 10 matches.
 *
 * Used by the sibling linker search input.
 */
export async function searchBursaryAccounts(
  query: string
): Promise<BursaryAccountSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const accounts = await prisma.bursaryAccount.findMany({
    where: {
      OR: [
        { childName: { contains: trimmed, mode: "insensitive" } },
        { reference: { contains: trimmed, mode: "insensitive" } },
        {
          leadApplicant: {
            email: { contains: trimmed, mode: "insensitive" },
          },
        },
      ],
    },
    orderBy: { childName: "asc" },
    take: 10,
    select: {
      id: true,
      reference: true,
      childName: true,
      school: true,
      leadApplicant: {
        select: { email: true },
      },
    },
  });

  return accounts.map((a) => ({
    id: a.id,
    reference: a.reference,
    childName: a.childName,
    school: a.school,
    leadApplicantEmail: a.leadApplicant.email,
  }));
}

// ─── createSiblingLink ────────────────────────────────────────────────────────

/**
 * Links two bursary accounts as siblings.
 *
 * Logic:
 *  - If either account already belongs to a family group, the other is added
 *    to that group.
 *  - If both accounts already belong to different family groups, the target's
 *    group is merged into the source's group.
 *  - If neither belongs to a group, a new family group UUID is created.
 *
 * Priority order is assigned as max(existing) + 1 for newly added accounts.
 * Returns the family group ID on success.
 */
export async function createSiblingLink(
  bursaryAccountId: string,
  targetBursaryAccountId: string
): Promise<{ familyGroupId: string }> {
  if (bursaryAccountId === targetBursaryAccountId) {
    throw new Error("Cannot link a bursary account to itself");
  }

  return prisma.$transaction(async (tx) => {
    const [sourceLink, targetLink] = await Promise.all([
      tx.siblingLink.findFirst({
        where: { bursaryAccountId },
        select: { familyGroupId: true },
      }),
      tx.siblingLink.findFirst({
        where: { bursaryAccountId: targetBursaryAccountId },
        select: { familyGroupId: true },
      }),
    ]);

    // Determine the family group ID to use
    let familyGroupId: string;

    if (sourceLink && targetLink) {
      if (sourceLink.familyGroupId === targetLink.familyGroupId) {
        // Already in the same group — nothing to do
        return { familyGroupId: sourceLink.familyGroupId };
      }
      // Merge: migrate all members of target's group into source's group
      familyGroupId = sourceLink.familyGroupId;
      const targetGroupMembers = await tx.siblingLink.findMany({
        where: { familyGroupId: targetLink.familyGroupId },
        orderBy: { priorityOrder: "asc" },
        select: { id: true, bursaryAccountId: true },
      });

      // Get current max priority in source group
      const maxPriority = await tx.siblingLink
        .findFirst({
          where: { familyGroupId },
          orderBy: { priorityOrder: "desc" },
          select: { priorityOrder: true },
        })
        .then((r) => r?.priorityOrder ?? 0);

      // Re-assign merged members to source group with new priority orders
      for (let i = 0; i < targetGroupMembers.length; i++) {
        await tx.siblingLink.update({
          where: { id: targetGroupMembers[i].id },
          data: {
            familyGroupId,
            priorityOrder: maxPriority + i + 1,
          },
        });
      }
    } else if (sourceLink) {
      familyGroupId = sourceLink.familyGroupId;
    } else if (targetLink) {
      familyGroupId = targetLink.familyGroupId;
    } else {
      // Generate a new family group UUID via Postgres
      const result = await tx.$queryRaw<[{ uuid: string }]>`SELECT gen_random_uuid()::text AS uuid`;
      familyGroupId = result[0].uuid;

      // Add the source account as priority 1
      await tx.siblingLink.create({
        data: { familyGroupId, bursaryAccountId, priorityOrder: 1 },
      });
    }

    // Add the account that isn't yet in the group
    const needsAdding: string[] = [];
    if (!sourceLink) needsAdding.push(bursaryAccountId);
    if (!targetLink) needsAdding.push(targetBursaryAccountId);

    for (const accountId of needsAdding) {
      // Check it's not already in the group (handles the merge path)
      const existing = await tx.siblingLink.findUnique({
        where: {
          familyGroupId_bursaryAccountId: { familyGroupId, bursaryAccountId: accountId },
        },
      });
      if (existing) continue;

      const maxPriorityRow = await tx.siblingLink.findFirst({
        where: { familyGroupId },
        orderBy: { priorityOrder: "desc" },
        select: { priorityOrder: true },
      });
      const nextOrder = (maxPriorityRow?.priorityOrder ?? 0) + 1;

      await tx.siblingLink.create({
        data: { familyGroupId, bursaryAccountId: accountId, priorityOrder: nextOrder },
      });
    }

    return { familyGroupId };
  });
}

// ─── removeSiblingLink ────────────────────────────────────────────────────────

/**
 * Removes a single SiblingLink by its ID.
 *
 * After removal, remaining members of the family group are re-ordered
 * so priority is contiguous (1, 2, 3, …). If only one member remains,
 * their link is also removed (a singleton group has no meaning).
 */
export async function removeSiblingLink(siblingLinkId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const link = await tx.siblingLink.findUnique({
      where: { id: siblingLinkId },
      select: { familyGroupId: true },
    });

    if (!link) return;

    await tx.siblingLink.delete({ where: { id: siblingLinkId } });

    // Re-order remaining members
    const remaining = await tx.siblingLink.findMany({
      where: { familyGroupId: link.familyGroupId },
      orderBy: { priorityOrder: "asc" },
      select: { id: true },
    });

    // If only one member remains, remove it too (singleton groups are meaningless)
    if (remaining.length === 1) {
      await tx.siblingLink.delete({ where: { id: remaining[0].id } });
      return;
    }

    // Re-number: 1, 2, 3 …
    for (let i = 0; i < remaining.length; i++) {
      await tx.siblingLink.update({
        where: { id: remaining[i].id },
        data: { priorityOrder: i + 1 },
      });
    }
  });
}

// ─── reorderSiblingPriority ───────────────────────────────────────────────────

/**
 * Reorders siblings within a family group.
 *
 * @param familyGroupId          The family group to reorder
 * @param orderedBursaryAccountIds  Full ordered array of bursary account IDs
 *                                 (all members must be included)
 */
export async function reorderSiblingPriority(
  familyGroupId: string,
  orderedBursaryAccountIds: string[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedBursaryAccountIds.length; i++) {
      await tx.siblingLink.updateMany({
        where: {
          familyGroupId,
          bursaryAccountId: orderedBursaryAccountIds[i],
        },
        data: { priorityOrder: i + 1 },
      });
    }
  });
}
