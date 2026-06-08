/**
 * Portal layout — applicant-facing shell (PR-7: unified rail).
 *
 * This layout owns the PORTAL-WIDE concerns only:
 *  - the access guard (Epic 10 / D18 portal-access revocation),
 *  - the `IdleLogoutWatcher` (Epic 11 / D20),
 *  - the ONE persistent left rail.
 *
 * The section stepper is NO LONGER fetched here. It is fed by the client
 * `StepperDataProvider` (mounted below, wrapping BOTH the rail and the content
 * column): the apply content subtree (`apply/layout.tsx`) fetches the gap data
 * and writes it into the store, and the rail's `RailStepper` reads it. The
 * Provider must sit ABOVE both the rail and `{children}` (their common
 * ancestor) so the write from the content branch reaches the reader in the rail
 * branch. This replaces the former `@stepper` parallel-route slot, which neither
 * re-ran on `router.refresh()` nor cleared on soft-nav (defects #2/#3/#4). The
 * wizard's one sticky footer lives in the `apply/` content segment, not here.
 *
 * Desktop (≥768 px): fixed 280 px left rail + scrollable main content.
 * Mobile (<768 px):  sticky header with a nav Sheet + an "All sections" Sheet.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { loadPortalAccessState } from "@/lib/bursary-accounts/access";
import { getPortalNavState } from "@/lib/db/queries/applications";
import { PortalNav } from "@/components/portal/portal-nav";
import { PortalNavMobileHeader } from "@/components/portal/portal-nav-mobile-header";
import { StepperDataProvider } from "@/components/portal/stepper-data-context";
import { PageLoader } from "@/components/shared/loading";
import { IdleLogoutWatcher } from "@/components/auth/idle-logout-watcher";

export const metadata = {
  title: {
    template: "%s | JWF Bursary System",
    default: "Bursary Portal | JWF Bursary System",
  },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Epic 10 (D18) — portal-access revocation. A parent retains access iff they
  // have an ACTIVE bursary account OR an in-flight application; otherwise their
  // bursary relationship has concluded and they are sent to a read-only closed
  // page. This is an access guard, NOT erasure (role stays APPLICANT). The DB
  // read runs under the user's RLS context.
  // PR-9 — nav badging + adaptive "My Application" target. We fold ONE narrow
  // read (formStatus + paused) into the SAME RLS context as the access guard, so
  // there is no extra context hop and no full-application fetch on every page.
  // Decision 5: NO round read is added here — the round label stays out of the
  // global nav (it lives in the stepper + dashboard only).
  let navState: Awaited<ReturnType<typeof getPortalNavState>> = null;
  if (user) {
    const { hasAccess, nav } = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => ({
        hasAccess: (await loadPortalAccessState(tx, user.id)).hasAccess,
        nav: await getPortalNavState(tx, user.id),
      })
    );
    if (!hasAccess) {
      redirect("/portal-closed");
    }
    navState = nav;
  }

  const displayName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    : "Applicant";

  // Decision 4 — "My Application": the LABEL is always stable; only the TARGET
  // adapts. Post-submit → /status (never the wizard, which would redirect to the
  // dead /submitted page). Pre-submit / no application → the wizard's first
  // section; the wizard's own redirect lands the user on the right section, so
  // we keep the layout read minimal and skip a second gap fetch here.
  const needsDocs = navState?.isPaused ?? false;
  const applicationHref =
    navState?.formStatus === "SUBMITTED" ? "/status" : "/apply/child-details";

  return (
    <div className="flex min-h-screen bg-canvas-50">
      {/* Epic 11 (D20) — optional inactivity logout, applied to the parent
          portal as well as staff. Renders nothing without an authenticated
          user or when the flag is off. */}
      {user ? <IdleLogoutWatcher /> : null}

      {/* The stepper-data bridge (replaces the `@stepper` slot). It MUST wrap
          BOTH the rail (the reader, via RailStepper) and {children} (which
          contains apply/layout.tsx, the writer) so the gap data written from the
          content branch reaches the reader in the rail branch — they are
          ancestor-side siblings, so a Provider lower in either branch could not
          bridge them. The store is the only data path from content → rail. */}
      <StepperDataProvider>
        {/* ── Desktop persistent rail (hidden on mobile) ─────────────────────
            The ONE rail: PortalNav (Home / My Application / Documents / History
            / Help + account/sign-out footer). PortalNav renders the RailStepper
            internally under "My Application"; the stepper reads the bridge store
            and is pathname-gated to /apply/*. */}
        <aside className="hidden md:flex md:flex-col md:w-[280px] md:shrink-0 md:fixed md:inset-y-0 md:left-0 md:z-30 bg-white border-r border-slate-200 shadow-xs">
          <PortalNav
            userName={displayName}
            applicationHref={applicationHref}
            needsDocs={needsDocs}
          />
        </aside>

        {/* ── Mobile sticky header (visible only on mobile) ───────────────── */}
        <div className="md:hidden sticky top-0 z-30 w-full bg-white border-b border-slate-200 shadow-xs">
          <PortalNavMobileHeader
            userName={displayName}
            applicationHref={applicationHref}
            needsDocs={needsDocs}
          />
        </div>

        {/* ── Main content column ─────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col md:ml-[280px]">
          <main
            id="main-content"
            className="flex-1 px-4 py-6 md:px-8 md:py-10 pb-24"
          >
            {/*
              The content column is full-width here; width capping lives with
              each CONSUMER, not on this wrapper. This is deliberate so the
              apply wizard's sticky footer (ApplyFooter, in apply/layout) can
              span the full work area as an anchored action bar instead of being
              trapped at max-w-4xl and rendering as a narrow floating island on
              wide monitors. Readable width is re-established below:
                • non-apply pages (Home / Status / History / Help / Documents /
                  Submitted / Respond) wrap content in <PortalPage> (max-w-3xl);
                • the apply section CARD re-caps itself — Income to the full
                  max-w-4xl, every other section back to max-w-3xl;
                • the ApplyFooter's BAR is full-width, but its Back/Continue row
                  re-caps to the active section's width (4xl Income / 3xl else),
                  centred, so the buttons stay aligned to the card edges.
              Each consumer cap is ≤ the available width, so nothing can induce
              horizontal scroll, and everything collapses to one column on mobile.
            */}
            <div className="w-full">
              <Suspense fallback={<PageLoader />}>{children}</Suspense>
            </div>
          </main>
          {/* NO footer here — the apply content segment owns the sticky footer. */}
        </div>
      </StepperDataProvider>
    </div>
  );
}
