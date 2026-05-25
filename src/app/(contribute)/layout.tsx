/**
 * Contribute layout — secondary-parent shell (dual-parent feature, backlog #20).
 *
 * The second parent's restricted /contribute flow gets its OWN shell rather
 * than inheriting the applicant `(portal)` layout. That shell renders a trimmed
 * THREE-section stepper (Your Details → Your Income → Your Assets & Liabilities,
 * plus a Review step) linking to /contribute/*, with a "N of 3" progress bar
 * scoped to the secondary's owned sections.
 *
 * Why a separate route group instead of a `mode` flag on the portal layout:
 *  - The applicant sidebar (11 sections, /apply/* links, "0 of 11") is
 *    misleading and irrelevant to a second parent, who is not a lead applicant.
 *  - It is route-accurate — a person who happens to be both a lead applicant on
 *    one application AND a second parent on another always gets the right nav
 *    per URL, not per identity.
 *  - The applicant sticky bottom nav (PortalBottomNav → /apply/declaration) is
 *    not rendered here; the contribute SectionForm already shows its own
 *    Back / Continue, so this removes a duplicate, partly-dead bottom bar.
 *
 * Desktop (≥768 px): fixed 280 px left sidebar + scrollable main content.
 * Mobile (<768 px):  sticky progress header + bottom sheet for all sections.
 */

import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getSecondaryContributorContext } from "@/lib/db/queries/contributors";
import { getSectionGapStatuses } from "@/lib/portal/section-gaps";
import { PortalMobileHeader } from "@/components/portal/portal-mobile-header";
import { PortalDesktopSidebar } from "@/components/portal/portal-desktop-sidebar";
import {
  buildContributeSidebarSections,
  CONTRIBUTE_SIDEBAR_SECTIONS,
  type SidebarSection,
} from "@/components/portal/portal-sidebar-sections";
import { PageLoader } from "@/components/shared/loading";

export const metadata = {
  title: {
    template: "%s | JWF Bursary System",
    default: "Your Contribution | JWF Bursary System",
  },
};

export default async function ContributeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const displayName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    : "Parent";

  // Default to the trimmed (not-started) contribute stepper so a second parent
  // never sees the 11-section applicant nav — even on the brief render before a
  // non-contributor is redirected away by the page guard.
  let sidebarSections: SidebarSection[] = CONTRIBUTE_SIDEBAR_SECTIONS;
  let roundName: string | undefined;

  if (user) {
    const ctx = await withUserContext(
      user.id,
      user.role as RlsRole,
      (tx) => getSecondaryContributorContext(tx, user.id)
    );
    if (ctx) {
      // Owner-scoped gap analysis — only the secondary's owned sections + their
      // own documents (a SELECT under applicant RLS, never an upsert).
      const gapStatuses = await getSectionGapStatuses(
        ctx.applicationId,
        ctx.contributorId
      );
      sidebarSections = buildContributeSidebarSections(gapStatuses);
      roundName = ctx.roundYear
        ? `${ctx.roundYear} Assessment Round`
        : undefined;
    }
  }

  return (
    <div className="flex min-h-screen bg-canvas-50">
      {/* ── Desktop sidebar (hidden on mobile) ─────────────────────────── */}
      <aside className="hidden md:flex md:flex-col md:w-[280px] md:shrink-0 md:fixed md:inset-y-0 md:left-0 md:z-30 bg-white border-r border-slate-200 shadow-xs">
        <PortalDesktopSidebar
          userName={displayName}
          sections={sidebarSections}
          roundName={roundName}
          basePath="/contribute"
          countSynthetic={false}
        />
      </aside>

      {/* ── Mobile sticky header (visible only on mobile) ───────────────── */}
      <div className="md:hidden sticky top-0 z-30 w-full bg-white border-b border-slate-200 shadow-xs">
        <PortalMobileHeader
          userName={displayName}
          sections={sidebarSections}
          roundName={roundName}
          basePath="/contribute"
          countSynthetic={false}
        />
      </div>

      {/* ── Main content column ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col md:ml-[280px]">
        <main
          id="main-content"
          className="flex-1 px-4 py-6 md:px-8 md:py-10 pb-12"
        >
          {/* Content constrained to readable width */}
          <div className="mx-auto max-w-3xl">
            <Suspense fallback={<PageLoader />}>{children}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
