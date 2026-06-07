"use client";

/**
 * PortalNavMobileHeader — the mobile header for the unified applicant portal.
 *
 * This is the lead-applicant mobile header (a DISTINCT component family from the
 * `/contribute`-shared `PortalMobileHeader` — Decision 6; do NOT repurpose that
 * one). It exposes TWO independent Sheets:
 *
 *   1. a hamburger → PORTAL NAV Sheet (Home / My Application / Documents /
 *      History / Help + the account/sign-out footer), and
 *   2. an "All sections" → STEPPER Sheet fed the `@stepper` slot node. The
 *      stepper node is null off `/apply/*`, so the trigger is hidden there.
 *
 * Each Sheet keeps its own `open` state so they never collide.
 */

import { useState } from "react";
import { Menu, LayoutList } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { JwfLogo } from "@/components/brand/jwf-logo";
import { PortalNav } from "./portal-nav";

interface PortalNavMobileHeaderProps {
  userName: string;
  /** Adaptive "My Application" target (default `/apply/child-details`). */
  applicationHref?: string;
  /** Whether a paused document request exists (badges Documents). PR-9. */
  needsDocs?: boolean;
  /**
   * The `@stepper` slot node. Non-null only on `/apply/*`; when present, the
   * "All sections" trigger is shown and opens a Sheet that renders it.
   */
  stepper?: React.ReactNode;
}

export function PortalNavMobileHeader({
  userName,
  applicationHref,
  needsDocs,
  stepper,
}: PortalNavMobileHeaderProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [stepperOpen, setStepperOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      {/* Hamburger → portal nav Sheet */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetTrigger asChild>
          <button
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-600",
              "hover:bg-slate-50 hover:text-primary-900 transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            )}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Portal navigation</SheetTitle>
          </SheetHeader>
          <div className="h-full">
            {/* The nav Sheet shows nav only — never the stepper (no children),
                so it stays a clean menu even on /apply/*. */}
            <PortalNav
              userName={userName}
              applicationHref={applicationHref}
              needsDocs={needsDocs}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Brand wordmark */}
      <JwfLogo compact className="h-9" />

      {/* "All sections" → stepper Sheet (only on /apply/*, where stepper exists) */}
      {stepper ? (
        <Sheet open={stepperOpen} onOpenChange={setStepperOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600",
                "hover:bg-slate-50 hover:text-primary-900 transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              )}
              aria-label="View all sections"
            >
              <LayoutList className="h-3.5 w-3.5" aria-hidden="true" />
              All sections
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] overflow-y-auto p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Application sections</SheetTitle>
            </SheetHeader>
            <div className="px-3 py-4">{stepper}</div>
          </SheetContent>
        </Sheet>
      ) : (
        // Keep the layout balanced when there is no stepper (off /apply/*).
        <span className="w-[88px] shrink-0" aria-hidden="true" />
      )}
    </div>
  );
}
