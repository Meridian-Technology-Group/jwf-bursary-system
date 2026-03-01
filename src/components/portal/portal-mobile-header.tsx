"use client";

/**
 * Mobile portal header.
 *
 * Shows:
 * - Foundation name + progress bar (compact)
 * - "View all sections" button that opens a Sheet with the full stepper
 */

import { useState } from "react";
import { LayoutList } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PortalSidebarContent } from "./portal-sidebar";
import { cn } from "@/lib/utils";

interface PortalMobileHeaderProps {
  userName: string;
}

// Placeholder progress — in real app comes from application state
const COMPLETED = 1;
const TOTAL = 10;

export function PortalMobileHeader({ userName }: PortalMobileHeaderProps) {
  const [open, setOpen] = useState(false);
  const progressPct = Math.round((COMPLETED / TOTAL) * 100);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Brand + progress summary */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary-900">
            John Whitgift Foundation
          </p>

          {/* Compact progress bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-accent-600 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${COMPLETED} of ${TOTAL} sections complete`}
              />
            </div>
            <span className="shrink-0 text-xs text-slate-500">
              {COMPLETED}/{TOTAL}
            </span>
          </div>
        </div>

        {/* Sheet trigger */}
        <Sheet open={open} onOpenChange={setOpen}>
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

          <SheetContent side="left" className="w-[300px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Application sections</SheetTitle>
            </SheetHeader>
            <div className="h-full">
              <PortalSidebarContent lastSaved="2 minutes ago" />
              {/* User at bottom */}
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
                <p className="truncate text-xs text-slate-500">
                  Signed in as
                </p>
                <p className="truncate text-sm font-medium text-primary-900">
                  {userName}
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
