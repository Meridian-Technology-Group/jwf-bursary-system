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
 * DATA & ROUTE SCOPING (replaces the old `@stepper` parallel slot)
 * ---------------------------------------------------------------
 * `sections`/`roundName` are READ from the shared `useStepperData()` store —
 * written from the apply content subtree via `StepperDataWriter`. After a save,
 * `router.refresh()` re-runs `apply/layout.tsx`, which re-fetches and re-writes
 * the store, so the rail stays live (fixes #2/#3).
 *
 * The stepper is GATED on the pathname: it renders only under `/apply/*`. This
 * is the correctness guarantee for #4 — even if the store still holds a stale
 * value from a prior `/apply` visit, nothing shows on Home / Help / Documents /
 * History, because those routes fail the prefix test. (The old `default.tsx`
 * → null fallback only applied on HARD nav, so a soft-nav stranded the stepper.)
 */

import { usePathname } from "next/navigation";
import { PortalSidebarContent } from "./portal-sidebar";
import { useStepperData } from "./stepper-data-context";

/** True only on the wizard routes that should display the section stepper. */
export function isApplyRoute(pathname: string | null): boolean {
  return pathname === "/apply" || (pathname?.startsWith("/apply/") ?? false);
}

export function RailStepper() {
  const pathname = usePathname();
  const { sections, roundName } = useStepperData();

  // Route gate (#4): never show the stepper off the wizard, regardless of any
  // stale store value left over from a prior `/apply` visit.
  if (!isApplyRoute(pathname)) return null;

  // No in-flight application / not yet loaded → render nothing (rail stays
  // nav-only), matching the old slot's `loadRailStepper() === null` behaviour.
  if (!sections) return null;

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
