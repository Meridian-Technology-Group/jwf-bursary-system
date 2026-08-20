"use client";

/**
 * Epic 14 C2 (CG-18/CG-19) — chrome that behaves differently on ASSESSMENT
 * routes only.
 *
 * The application-detail layout is one server component shared by every tab,
 * but Charlotte's asks are assessment-view-scoped: hide the status-badge
 * block there (CG-18) and collapse the second-parent/GDPR "Manage" card
 * behind a disclosure (CG-19), while the Applicant Data / Recommendation /
 * History tabs keep their existing chrome. These small client wrappers read
 * the pathname and scope the behaviour; the wrapped content itself stays
 * server-rendered (passed through as children).
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

function useIsAssessmentRoute(): boolean {
  const pathname = usePathname();
  return /\/applications\/[^/]+\/assessment(\/|$)/.test(pathname ?? "");
}

/** Renders children everywhere EXCEPT the assessment routes (CG-18). */
export function HideOnAssessmentRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const onAssessment = useIsAssessmentRoute();
  if (onAssessment) return null;
  return <>{children}</>;
}

/** Renders children ONLY on assessment routes (Epic 15 W2 / CH-03). */
export function ShowOnAssessmentRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const onAssessment = useIsAssessmentRoute();
  if (!onAssessment) return null;
  return <>{children}</>;
}

/**
 * On assessment routes, collapses its children behind a quiet `Manage`
 * disclosure (closed by default — CG-19); everywhere else the children render
 * as before. The children are the existing server-rendered Manage card, so
 * role gating and content are untouched — this is placement only.
 */
export function ManageDisclosure({
  children,
}: {
  children: React.ReactNode;
}) {
  const onAssessment = useIsAssessmentRoute();
  const [open, setOpen] = React.useState(false);

  if (!onAssessment) return <>{children}</>;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600",
          "transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        Manage
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
