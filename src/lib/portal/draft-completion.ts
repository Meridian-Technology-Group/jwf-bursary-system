/**
 * Epic 22 — a draft's completion (D-4) and whether it can be submitted, as the
 * wizard rail computes them. Shared by My Bursary Application(s) (P1) and My
 * Application(s) Schedule (P5) so both show the rail's figure.
 *
 * `tx` must be the parent's own RLS context: the gap analysis reads
 * application_sections / documents.
 */

import "server-only";

import type { Tx } from "@/lib/db/prisma";
import { resolveOwningContributorId } from "@/lib/db/queries/contributors";
import { getSectionGapStatuses } from "@/lib/portal/section-gaps";
import { buildSidebarSections } from "@/components/portal/portal-sidebar-sections";
import { applicationCompletion } from "@/lib/portal/application-completion";
import { canSubmitFromSections } from "@/lib/portal/my-applications";

export interface DraftCompletionResult {
  percent: number;
  canSubmit: boolean;
}

export async function draftCompletion(
  tx: Tx,
  app: { id: string; isReassessment: boolean },
  userId: string
): Promise<DraftCompletionResult> {
  const ownerContributorId = await resolveOwningContributorId(tx, app.id, userId);
  const gaps = await getSectionGapStatuses(tx, app.id, ownerContributorId ?? undefined);
  const sections = buildSidebarSections(gaps, { isReassessment: app.isReassessment });
  return {
    percent: applicationCompletion(sections),
    canSubmit: canSubmitFromSections(sections),
  };
}
