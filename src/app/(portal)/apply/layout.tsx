/**
 * Apply content-segment layout — the wizard CONTENT chrome.
 *
 * This layout owns the wizard's ONE canonical sticky footer (`ApplyFooter`) and
 * the `SectionSavingProvider` that lets that single footer reflect the section
 * form's saving state. It is scoped to `/apply/*` — so the footer + provider
 * never leak onto Home / Status / Documents / Help, which the old layout's
 * always-rendered `PortalBottomNav` did.
 *
 * It does NO data fetch — the section stepper's gap data is fetched in the
 * `@stepper` parallel slot, not here. This stays a server component; the
 * `"use client"` boundary lives in `SectionSavingProvider` / `ApplyFooter`.
 *
 * The stepper itself renders in the persistent rail (owned by the root portal
 * layout via the `@stepper` slot), not in this content column.
 */

import { ApplyFooter } from "@/components/portal/apply-footer";
import { SectionSavingProvider } from "@/components/portal/section-saving-context";

export default function ApplyContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SectionSavingProvider>
      <div className="flex min-h-[60vh] flex-col">
        <div className="flex-1">{children}</div>
        {/* The one sticky footer — scoped to the apply segment. It owns its own
            sticky chrome and renders nothing on /apply/review, so no empty bar
            shows there. */}
        <ApplyFooter />
      </div>
    </SectionSavingProvider>
  );
}
