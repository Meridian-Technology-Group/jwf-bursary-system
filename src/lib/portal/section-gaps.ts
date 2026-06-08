/**
 * section-gaps.ts — Single source of truth for portal section completeness.
 *
 * Extends the coarse DB boolean (ApplicationSection.isComplete) with
 * derived gap analysis: required-document checks (conditional on form answers)
 * and structural rules (e.g. dependent-children list constraints).
 *
 * The rule logic itself now lives in the declarative rule engine
 * (`document-rules.ts` + `section-rules.ts`); this module is a thin adapter that
 * reads the section blobs + uploaded slots from the DB, runs the engine, and
 * shapes the result into `SectionGapStatus[]` for the sidebar tri-state and the
 * Review screen. The old hand-coded `SECTION_EVALUATORS` and the magic
 * `SECTION_ITEM_TOTALS` progress table are gone — totals derive from the
 * enumerable rule list.
 *
 * Server-only. Import from Server Components and route handlers only.
 */

import "server-only";

import type { Tx } from "@/lib/db/prisma";
import { ApplicationSectionType } from "@prisma/client";
import {
  evaluateRules,
  sectionItemTotal,
  type SectionGap,
  type GapSeverity,
} from "@/lib/portal/document-rules";
import { SECTION_RULES } from "@/lib/portal/section-rules";
import { SECTION_ORDER } from "@/lib/portal/sections";

// ─── Public types ─────────────────────────────────────────────────────────────

export type SectionType = ApplicationSectionType;

// Re-exported from the rule engine so existing importers keep their imports.
export type { SectionGap, GapSeverity };

export interface SectionGapStatus {
  sectionType: SectionType;
  /** True once the applicant has saved data for this section at least once. */
  isStarted: boolean;
  /** The raw ApplicationSection.isComplete flag stored in the DB. */
  isDbComplete: boolean;
  /** Derived gap list after evaluating document + structural rules. */
  gaps: SectionGap[];
  /**
   * True only when isDbComplete AND no error-severity gaps remain.
   * Warnings do not block validity.
   */
  isFullyValid: boolean;
  /**
   * Numeric progress inputs for a partial-fill progress bar (B2 consumer).
   * total  = 1 (saved form) + applicable-rule count
   * satisfied = 1 (if isStarted) + (rules with no error-severity gap)
   * safe: if total is 0, both are 0 (callers must guard against 0/0).
   */
  progress: { satisfied: number; total: number };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns the set of slot strings that have at least one uploaded document.
 *
 * When `ownerContributorId` is provided the document set is scoped to that
 * contributor's own uploads (dual-parent, PR 4b): the primary's submit gate
 * must not count the secondary's documents and vice-versa. When omitted the
 * legacy behaviour (all of the application's documents) is preserved.
 *
 * `tx` MUST be an RLS-scoped transaction client (from `withUserContext` /
 * `withAdminContext`). The personal-data tables (`documents`,
 * `application_sections`) are under Row Level Security and the global Prisma
 * client carries NO `request.jwt.claims`, so a query off it returns ZERO rows.
 */
async function getUploadedSlots(
  tx: Tx,
  applicationId: string,
  ownerContributorId?: string
): Promise<Set<string>> {
  const rows = await tx.document.findMany({
    where: {
      applicationId,
      ...(ownerContributorId
        ? { uploadedByContributorId: ownerContributorId }
        : {}),
    },
    select: { slot: true },
  });
  return new Set(rows.map((r) => r.slot));
}

/** Safely coerce a Prisma Json field to a plain object; null on failure. */
function asBlob(data: unknown): Record<string, unknown> | null {
  if (data === null || data === undefined) return null;
  if (typeof data !== "object") return null;
  return data as Record<string, unknown>;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns a SectionGapStatus for every ApplicationSectionType, in canonical order.
 *
 * Makes 2 DB round-trips:
 *   1. Load all ApplicationSection rows for the application (data + isComplete).
 *   2. Load all Document rows (slot only) to build the uploaded-slots set.
 *
 * `tx` MUST be an RLS-scoped transaction client (from `withUserContext` for the
 * applicant/secondary, or `withAdminContext` for the admin/assessor watchlist
 * scan). The reads target `application_sections` / `documents`, both under Row
 * Level Security; the global Prisma client has no `request.jwt.claims` and
 * would return ZERO rows — silently making every section look not-started.
 *
 * `ownerContributorId` (dual-parent, PR 4b) scopes BOTH reads to a single
 * contributor's owned sections + uploaded documents. This filter is independent
 * of RLS and is what keeps the primary's submit gate isolated from the
 * secondary's rows (and vice-versa).
 */
export async function getSectionGapStatuses(
  tx: Tx,
  applicationId: string,
  ownerContributorId?: string
): Promise<SectionGapStatus[]> {
  const [sectionRows, uploadedSlots] = await Promise.all([
    tx.applicationSection.findMany({
      where: {
        applicationId,
        ...(ownerContributorId ? { ownerContributorId } : {}),
      },
      select: { section: true, data: true, isComplete: true },
    }),
    getUploadedSlots(tx, applicationId, ownerContributorId),
  ]);

  const rowMap = new Map<SectionType, { data: unknown; isComplete: boolean }>();
  for (const row of sectionRows) {
    rowMap.set(row.section, { data: row.data, isComplete: row.isComplete });
  }

  // Canonical section order comes from `@/lib/portal/sections` (single source
  // of truth, shared with the wizard / review / dashboard / sidebar).
  return SECTION_ORDER.map((sectionType) => {
    const row = rowMap.get(sectionType);
    const isStarted = row !== undefined;
    const isDbComplete = row?.isComplete ?? false;
    const blob = asBlob(row?.data ?? null);

    const rules = SECTION_RULES[sectionType] ?? [];
    const gaps = evaluateRules(sectionType, rules, blob, uploadedSlots);

    const errorGaps = gaps.filter((g) => g.severity === "error");
    const isFullyValid = isDbComplete && errorGaps.length === 0;

    const total = sectionItemTotal(rules, blob);
    const satisfied = isStarted ? Math.max(0, total - errorGaps.length) : 0;

    return {
      sectionType,
      isStarted,
      isDbComplete,
      gaps,
      isFullyValid,
      progress: { satisfied, total },
    };
  });
}
