"use client";

/**
 * ApplyFooter — the ONE canonical sticky footer for the lead-applicant wizard.
 *
 * Scoped to `/apply/*` by living in `(portal)/apply/layout.tsx`. This is a SHELL
 * footer (not in-form), and it is the single replacement for both the old
 * `PortalBottomNav` (deleted) and the in-form nav block in `SectionForm` (which
 * the apply flow now suppresses via `hideInlineNav`). Decision 3 — single path.
 *
 * Behaviour:
 *  - On `/apply/review` → renders nothing (the Review page owns its own
 *    "Proceed to Declaration" CTA, §2.6).
 *  - Back → `router.back()` (the old PortalBottomNav Back was a dead no-op).
 *  - Save and Continue → `<button type="submit" form="section-form">` (the same
 *    cross-form submit mechanism); label becomes "Review and Submit" on
 *    `/apply/declaration`.
 *  - Disabled/spinner reflect `useSectionSaving().saving`, set by `SectionForm`.
 */

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSectionSaving } from "./section-saving-context";

export function ApplyFooter() {
  const pathname = usePathname();
  const router = useRouter();
  const { saving } = useSectionSaving();

  // Review owns its own CTA — show no shell footer there.
  if (pathname === "/apply/review") {
    return null;
  }

  const isDeclaration = pathname === "/apply/declaration";
  const nextLabel = isDeclaration ? "Review and Submit" : "Save and Continue";

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 shadow-md md:-mx-8 md:px-8">
      {/* Back — real handler (router.back), unlike the old dead control. */}
      <button
        type="button"
        onClick={() => router.back()}
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

      {/* Save and Continue (or Review and Submit on Declaration). Submits the
          section form across the tree via form="section-form". */}
      <button
        type="submit"
        form="section-form"
        disabled={saving}
        className={cn(
          "flex items-center gap-1.5 rounded-md bg-primary-900 px-5 py-2 text-sm font-medium text-white",
          "hover:bg-primary-800 transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
          "disabled:pointer-events-none disabled:opacity-60"
        )}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Saving...
          </>
        ) : (
          <>
            {nextLabel}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}
