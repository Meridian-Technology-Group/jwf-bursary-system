/**
 * Apply content-segment layout — the wizard CONTENT chrome + stepper data source.
 *
 * This layout owns the wizard's ONE canonical sticky footer (`ApplyFooter`) and
 * the `SectionSavingProvider` that lets that single footer reflect the section
 * form's saving state. It is scoped to `/apply/*` — so the footer + provider
 * never leak onto Home / Status / Documents / Help, which the old layout's
 * always-rendered `PortalBottomNav` did.
 *
 * It is ALSO the section stepper's data source. It fetches the gap data via
 * `loadRailStepper()` and hands it to the client `StepperDataWriter`, which
 * writes it into the shared stepper-data store (Provider in the ROOT portal
 * layout). The rail's `RailStepper` — an ancestor-side sibling that cannot
 * receive this data through prop flow — reads the same store.
 *
 * WHY THIS LAYOUT (and not a parallel slot): this is a NORMAL server layout in
 * the `children` tree, so `router.refresh()` (called by the section form after a
 * save) re-executes it, re-runs `loadRailStepper()` against the freshly
 * `revalidatePath`-ed data, and the writer pushes the new sections into the
 * store — keeping the rail's progress + tri-state icons live. The former
 * `@stepper` parallel slot did NOT re-run on `router.refresh()`, which is the
 * root cause of defects #2/#3 (and its soft-nav stale-retention caused #4).
 *
 * NOTE on persistence: as a persistent layout, a bare section→section `push`
 * alone won't re-run this layout — but the section form always calls
 * `router.refresh()` BEFORE the push, which does force the re-run.
 *
 * This stays a server component; the `"use client"` boundaries live in
 * `SectionSavingProvider` / `ApplyFooter` / `StepperDataWriter`.
 */

import { ApplyFooter } from "@/components/portal/apply-footer";
import { SectionSavingProvider } from "@/components/portal/section-saving-context";
import { StepperDataWriter } from "@/components/portal/stepper-data-writer";
import { loadRailStepper } from "@/lib/portal/rail-stepper-data";

export default async function ApplyContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch the section-stepper gap data here (the apply content subtree), then
  // bridge it to the rail via the client writer. `loadRailStepper()` returns
  // null when there is no in-flight application; pass through so the rail stays
  // nav-only in that case. This is the same fetch the old `@stepper` slot ran.
  const stepperData = await loadRailStepper();

  return (
    <SectionSavingProvider>
      {/* Writes the freshly-fetched gap data into the shared store so the rail's
          RailStepper (read side) renders live progress + tri-state icons.
          Renders nothing itself. */}
      <StepperDataWriter
        sections={stepperData?.sections ?? null}
        roundName={stepperData?.roundName}
      />
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
