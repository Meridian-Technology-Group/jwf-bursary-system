"use client";

/**
 * Sticky bottom navigation bar for the portal.
 *
 * Renders "Back" and "Save and Continue" buttons.
 * In a real implementation these would accept onClick handlers or
 * be tied to router navigation and form submission logic.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PortalBottomNav() {
  return (
    <div className="flex items-center justify-between px-4 py-3 md:px-8">
      {/* Back button */}
      <button
        type="button"
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700",
          "hover:bg-slate-50 hover:text-slate-900 transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      {/* Save and continue button */}
      <button
        type="submit"
        form="section-form"
        className={cn(
          "flex items-center gap-1.5 rounded-md bg-primary-900 px-5 py-2 text-sm font-medium text-white",
          "hover:bg-primary-800 transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
          "disabled:pointer-events-none disabled:opacity-60"
        )}
      >
        Save and Continue
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
