/**
 * rail-stepper-data.ts — the section-stepper data fetch for the unified rail.
 *
 * After the PR-7 shell split, the section stepper renders inside the persistent
 * portal rail (owned by `(portal)/layout.tsx`) via a parallel-route `@stepper`
 * slot — but its data must still be fetched ONLY on `/apply/*`. This helper is a
 * verbatim lift of the gap-status fetch that used to live in
 * `(portal)/layout.tsx` (the lead-applicant branch), now called by both
 * `@stepper/apply/[section]/page.tsx` and `@stepper/apply/review/page.tsx` so
 * they share a single source.
 *
 * Scoping is identical to the old layout: the gap analysis is scoped to the
 * lead applicant's PRIMARY contributor (dual-parent, PR 4b) — a SELECT under
 * applicant RLS, never an upsert. For a single parent this is every section, so
 * the rail is unchanged. The secondary parent uses the separate `/contribute`
 * shell and never renders this slot.
 *
 * The fetch is naturally scoped to the wizard because it only runs from the
 * slot's `apply/` pages; every other portal route resolves the slot to
 * `@stepper/default.tsx` → null and never calls this helper.
 */

import "server-only";

import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getApplicationForUser } from "@/lib/db/queries/applications";
import { resolveOwningContributorId } from "@/lib/db/queries/contributors";
import { getSectionGapStatuses } from "@/lib/portal/section-gaps";
import {
  buildSidebarSections,
  type SidebarSection,
} from "@/components/portal/portal-sidebar-sections";

export interface RailStepperData {
  sections: SidebarSection[];
  roundName?: string;
}

/**
 * Resolve the lead applicant's in-flight application and compute the section
 * stepper state (tri-state statuses + partial progress) for the rail.
 *
 * Returns `null` when there is no authenticated user or no in-flight
 * application — in which case the slot renders nothing and the rail stays
 * nav-only. (`getApplicationForUser` already filters out SUBMITTED applications,
 * so the wizard stepper never appears post-submit.)
 */
export async function loadRailStepper(): Promise<RailStepperData | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const resolved = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const application = await getApplicationForUser(tx, user.id);
      if (!application) return null;
      const ownerContributorId = await resolveOwningContributorId(
        tx,
        application.id,
        user.id
      );
      return { application, ownerContributorId };
    }
  );

  if (!resolved?.application) return null;

  const { application, ownerContributorId } = resolved;

  const gapStatuses = ownerContributorId
    ? await getSectionGapStatuses(application.id, ownerContributorId)
    : await getSectionGapStatuses(application.id);

  const sections = buildSidebarSections(gapStatuses, {
    isReassessment: application.isReassessment,
  });

  const roundName = application.round?.academicYear
    ? `${application.round.academicYear} Assessment Round`
    : undefined;

  return { sections, roundName };
}
