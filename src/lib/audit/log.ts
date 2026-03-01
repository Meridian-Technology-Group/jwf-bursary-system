/**
 * Audit log helper — server-side only.
 *
 * Inserts an AuditLog record via Prisma. Non-blocking: wraps in try/catch
 * so failures never bubble up to callers.
 */

import { prisma } from "@/lib/db/prisma";

export interface CreateAuditLogParams {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(
  params: CreateAuditLogParams
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        context: params.context ?? null,
        metadata: (params.metadata ?? {}) as Parameters<typeof prisma.auditLog.create>[0]["data"]["metadata"],
      },
    });
  } catch (err) {
    // Non-blocking — log to stderr but never throw.
    console.error("[audit] Failed to write audit log:", err);
  }
}
