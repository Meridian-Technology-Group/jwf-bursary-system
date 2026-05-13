/**
 * Audit log helper — server-side only.
 *
 * Inserts an AuditLog record via Prisma. Non-blocking: wraps in try/catch
 * so failures never bubble up to callers.
 *
 * Requires the caller to supply an RLS-aware transaction (`tx`) — either
 * from `withUserContext` or `withAdminContext`. This makes the function
 * usable both inside an existing GDPR-cascade transaction and from regular
 * request paths that wrap a single audit write.
 */

import type { Tx } from "@/lib/db/prisma";

export interface CreateAuditLogParams {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(
  tx: Tx,
  params: CreateAuditLogParams
): Promise<void> {
  try {
    await tx.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        context: params.context ?? null,
        metadata: (params.metadata ?? {}) as Parameters<typeof tx.auditLog.create>[0]["data"]["metadata"],
      },
    });
  } catch (err) {
    // Non-blocking — log to stderr but never throw.
    console.error("[audit] Failed to write audit log:", err);
  }
}
