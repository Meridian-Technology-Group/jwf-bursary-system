/**
 * Names out of the history trail (Charlotte, 22 Oct 2026, retention trial).
 *
 * After an erasure on request the record read "XXXX" and search found nothing,
 * but *"if I am nosey and keep going down the history trail, I can find the
 * original name of the file still"*: audit rows written while the family was
 * live carry the child's reference in their context and metadata (Application
 * submitted, Assessor began review, the invitation from the contact register),
 * and the parent's email.
 *
 * audit_logs is append-only — rows are never deleted — but the service-role
 * transaction may UPDATE them (migration 20260522104150, the Art. 17 grant), as
 * the cascades already do to null `userId`. So the family's rows are kept, and
 * the identifying strings inside them become "XXXX". The rows touched are only
 * this family's: their entity is the application, its assessment, its account,
 * its contact-register rows or invitations; or their metadata names one of
 * those; or the parent wrote them. Within those rows, only the needles change.
 */

import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";

const REPLACEMENT = "XXXX";

/** Shorter strings risk matching ordinary words, so are never needles. */
const MIN_NEEDLE_LENGTH = 4;

export interface AuditScope {
  applicationId: string;
  assessmentId: string | null;
  bursaryAccountId: string | null;
  leadApplicantId: string;
  contactIds: string[];
  invitationIds: string[];
}

/**
 * The strings to blank, longest first so a reference containing the child's
 * name is replaced whole rather than leaving its tail behind.
 */
export function auditNeedles(values: readonly (string | null | undefined)[]): string[] {
  const unique = new Set<string>();
  for (const v of values) {
    const s = v?.trim();
    if (s && s.length >= MIN_NEEDLE_LENGTH && s !== REPLACEMENT) unique.add(s);
  }
  return Array.from(unique).sort((a, b) => b.length - a.length);
}

export function scrubText(text: string, needles: readonly string[]): string {
  let out = text;
  for (const n of needles) out = out.split(n).join(REPLACEMENT);
  return out;
}

/** Every string inside a JSON value, keys left alone. */
export function scrubJson(value: Prisma.JsonValue, needles: readonly string[]): Prisma.JsonValue {
  if (typeof value === "string") return scrubText(value, needles);
  if (Array.isArray(value)) return value.map((v) => scrubJson(v, needles));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubJson(v as Prisma.JsonValue, needles)]));
  }
  return value;
}

function scopeWhere(scope: AuditScope): Prisma.AuditLogWhereInput {
  const entityIds = [
    scope.applicationId,
    scope.assessmentId,
    scope.bursaryAccountId,
    ...scope.contactIds,
    ...scope.invitationIds,
  ].filter((id): id is string => id != null);
  const named = (key: string, ids: readonly (string | null)[]) =>
    ids.filter((id): id is string => id != null).map((id) => ({ metadata: { path: [key], equals: id } }));
  return {
    OR: [
      { entityId: { in: entityIds } },
      { userId: scope.leadApplicantId },
      ...named("applicationId", [scope.applicationId]),
      ...named("assessmentId", [scope.assessmentId]),
      ...named("accountId", [scope.bursaryAccountId]),
      ...named("bursaryAccountId", [scope.bursaryAccountId]),
      ...named("contactId", scope.contactIds),
    ],
  };
}

/** Blanks the needles in this family's audit rows. Returns the rows changed. */
export async function scrubAuditMentions(tx: Tx, scope: AuditScope, needles: readonly string[]): Promise<number> {
  if (needles.length === 0) return 0;
  const rows = await tx.auditLog.findMany({
    where: scopeWhere(scope),
    select: { id: true, context: true, metadata: true },
  });
  let changed = 0;
  for (const row of rows) {
    const context = row.context == null ? null : scrubText(row.context, needles);
    const metadata = scrubJson(row.metadata, needles);
    const metadataChanged = JSON.stringify(metadata) !== JSON.stringify(row.metadata);
    if (context === row.context && !metadataChanged) continue;
    await tx.auditLog.update({
      where: { id: row.id },
      data: { context, ...(metadataChanged ? { metadata: metadata as Prisma.InputJsonValue } : {}) },
    });
    changed += 1;
  }
  return changed;
}
