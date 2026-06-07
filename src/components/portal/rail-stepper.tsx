"use client";

/**
 * RailStepper — the section progress stepper as it appears nested inside the
 * persistent portal rail, under the "My Application" nav item.
 *
 * It is a thin wrapper over the existing `PortalSidebarContent` (the leaf
 * stepper component shared with `/contribute`), pinned to the lead-applicant
 * defaults:
 *   • `basePath="/apply"`        — links/active-state target the wizard
 *   • `countSynthetic={false}`   — the synthetic Review entry is navigable but
 *                                  excluded from the "N of 10" count (Decision 9)
 *
 * IMPORTANT (non-regression): this wraps `PortalSidebarContent` DIRECTLY, NOT
 * `PortalDesktopSidebar`. `PortalDesktopSidebar`/`PortalMobileHeader` remain the
 * `/contribute`-shared stepper shell and are left untouched (Decision 6, two
 * component families). The rail and the contribute shell therefore share only
 * the leaf content component, never the shell.
 *
 * Rendered from the `@stepper` parallel slot, which fetches the data and runs
 * only on `/apply/*`. Because the slot is part of the active server subtree,
 * `router.refresh()` (PR-1) re-executes it after a save, so the stepper stays
 * live without a full reload.
 */

import {
  PortalSidebarContent,
  type SidebarSection,
} from "./portal-sidebar";

interface RailStepperProps {
  sections?: SidebarSection[];
  roundName?: string;
}

export function RailStepper({ sections, roundName }: RailStepperProps) {
  return (
    <PortalSidebarContent
      sections={sections}
      roundName={roundName}
      basePath="/apply"
      countSynthetic={false}
      chrome="bare"
    />
  );
}
