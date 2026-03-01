/**
 * Audit log database queries.
 */

import { prisma } from "@/lib/db/prisma";
import type { AuditLog, Profile, Prisma } from "@prisma/client";

export type AuditLogWithUser = AuditLog & {
  user: Pick<Profile, "id" | "firstName" | "lastName" | "email"> | null;
};

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  startDate?: string; // ISO date string "YYYY-MM-DD"
  endDate?: string;   // ISO date string "YYYY-MM-DD"
  page: number;
  pageSize: number;
}

/**
 * Returns all audit log entries for a specific entity in chronological order.
 */
export async function getAuditLogsForEntity(
  entityType: string,
  entityId: string
): Promise<AuditLogWithUser[]> {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Returns the most recent audit log entries across all entities.
 */
export async function getRecentAuditLogs(
  limit: number
): Promise<AuditLogWithUser[]> {
  return prisma.auditLog.findMany({
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Builds a Prisma where clause from the provided filter options.
 */
function buildAuditWhereClause(
  filters: Omit<AuditLogFilters, "page" | "pageSize">
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.action) {
    where.action = { contains: filters.action, mode: "insensitive" };
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }
    if (filters.endDate) {
      where.createdAt.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
  }

  return where;
}

/**
 * Returns a paginated list of audit log entries matching the supplied filters,
 * sorted newest-first. Includes user profile info for display.
 */
export async function getFilteredAuditLogs(
  filters: AuditLogFilters
): Promise<AuditLogWithUser[]> {
  const { page, pageSize, ...rest } = filters;
  const where = buildAuditWhereClause(rest);
  const skip = (page - 1) * pageSize;

  return prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
  });
}

/**
 * Returns the total count of audit log entries matching the supplied filters.
 * Used to compute pagination metadata.
 */
export async function countFilteredAuditLogs(
  filters: Omit<AuditLogFilters, "page" | "pageSize">
): Promise<number> {
  const where = buildAuditWhereClause(filters);
  return prisma.auditLog.count({ where });
}
