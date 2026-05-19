/**
 * Portal layout — applicant-facing shell.
 *
 * Desktop (≥768 px): fixed 280 px left sidebar + scrollable main content.
 * Mobile (<768 px):  sticky progress header + bottom sheet to reveal all sections.
 *
 * The sticky bottom navigation bar ("Back" / "Save and Continue") is rendered
 * inside the main scrollable area so it stays above the fold on all viewports.
 */

import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/roles";
import { withAdminContext, withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getApplicationForUser } from "@/lib/db/queries/applications";
import { getOrAcceptLatestInvitationForUser } from "@/lib/db/queries/invitations";
import { getSectionGapStatuses } from "@/lib/portal/section-gaps";
import { PortalMobileHeader } from "@/components/portal/portal-mobile-header";
import { PortalDesktopSidebar } from "@/components/portal/portal-desktop-sidebar";
import { PortalBottomNav } from "@/components/portal/portal-bottom-nav";
import {
  buildSidebarSections,
  type SidebarSection,
} from "@/components/portal/portal-sidebar-sections";
import { PageLoader } from "@/components/shared/loading";

export const metadata = {
  title: {
    template: "%s | JWF Bursary System",
    default: "My Application | JWF Bursary System",
  },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const displayName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    : "Applicant";

  // Load real section-completion state so the sidebar progress bar reflects
  // the user's actual progress (not a hardcoded placeholder).
  let sidebarSections: SidebarSection[] | undefined;
  let roundName: string | undefined;
  if (user) {
    const application = await withUserContext(
      user.id,
      user.role as RlsRole,
      (tx) => getApplicationForUser(tx, user.id)
    );
    if (application) {
      const gapStatuses = await getSectionGapStatuses(application.id);
      sidebarSections = buildSidebarSections(gapStatuses);
      roundName = application.round?.academicYear
        ? `${application.round.academicYear} Assessment Round`
        : undefined;
    } else {
      // No application yet — sidebar still shows the academic year derived
      // from the user's invitation so the label is correct on the
      // onboarding card / pre-section pages.
      const invitation = await withAdminContext((tx) =>
        getOrAcceptLatestInvitationForUser(tx, user.id)
      );
      if (invitation?.roundId) {
        const round = await withAdminContext((tx) =>
          tx.round.findUnique({
            where: { id: invitation.roundId! },
            select: { academicYear: true },
          })
        );
        roundName = round?.academicYear
          ? `${round.academicYear} Assessment Round`
          : undefined;
      }
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
        />
      </aside>

      {/* ── Mobile sticky header (visible only on mobile) ───────────────── */}
      <div className="md:hidden sticky top-0 z-30 w-full bg-white border-b border-slate-200 shadow-xs">
        <PortalMobileHeader
          userName={displayName}
          sections={sidebarSections}
          roundName={roundName}
        />
      </div>

      {/* ── Main content column ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col md:ml-[280px]">
        <main
          id="main-content"
          className="flex-1 px-4 py-6 md:px-8 md:py-10 pb-24"
        >
          {/* Content constrained to readable width */}
          <div className="mx-auto max-w-3xl">
            <Suspense fallback={<PageLoader />}>{children}</Suspense>
          </div>
        </main>

        {/* ── Sticky bottom navigation ────────────────────────────────── */}
        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white shadow-md">
          <PortalBottomNav />
        </div>
      </div>
    </div>
  );
}
