"use client";

/**
 * Portal sidebar — section progress stepper for the applicant portal.
 *
 * Displayed at 280 px on desktop; collapses into a Sheet on mobile.
 */

import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JwfLogo } from "@/components/brand/jwf-logo";
import {
  DEFAULT_SIDEBAR_SECTIONS,
  type SectionStatus,
  type SidebarSection,
} from "./portal-sidebar-sections";

// Re-export the shared types so existing `@/components/portal/portal-sidebar`
// importers keep working.
export type { SidebarSection };
export { buildSidebarSections } from "./portal-sidebar-sections";

// ─── Section icon ─────────────────────────────────────────────────────────────

function SectionIcon({
  status,
  stepNumber,
  gapCount,
}: {
  status: SectionStatus;
  stepNumber: number;
  gapCount: number;
}) {
  switch (status) {
    case "complete":
      return (
        <CheckCircle2
          className="h-4 w-4 shrink-0 text-success-600"
          aria-hidden="true"
        />
      );
    case "needs_attention":
      return (
        <AlertTriangle
          className="h-4 w-4 shrink-0 text-amber-500"
          aria-label={`Needs attention — ${gapCount} issue${gapCount === 1 ? "" : "s"} outstanding`}
        />
      );
    default:
      // In-progress (currently active, not yet complete) — show step number bubble.
      if (stepNumber < 0) {
        // Sentinel: active-but-not-started renders as numbered bubble; handled below.
        return (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-600 text-[10px] font-bold text-white">
            {Math.abs(stepNumber)}
          </span>
        );
      }
      return (
        <Circle
          className="h-4 w-4 shrink-0 text-slate-300"
          aria-hidden="true"
        />
      );
  }
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

interface PortalSidebarContentProps {
  roundName?: string;
  lastSaved?: string;
  /** Section data — if not provided, uses defaults */
  sections?: SidebarSection[];
}

export function PortalSidebarContent({
  roundName,
  lastSaved,
  sections,
}: PortalSidebarContentProps) {
  const pathname = usePathname();
  const sectionList = sections ?? DEFAULT_SIDEBAR_SECTIONS;

  // Derive active section from URL: /apply/parent-details → "parent-details"
  const currentSlug = pathname?.startsWith("/apply/")
    ? pathname.replace("/apply/", "").split("/")[0]
    : null;
  const currentSection =
    sectionList.find((s) => s.slug === currentSlug)?.id ?? 0;

  // ── Partial-fill progress bar ──────────────────────────────────────────────
  // Sum satisfied and total across all sections, then compute percentage.
  // A section that is 3/4 satisfied (e.g. form saved + 2 of 3 docs) contributes
  // 3 to the numerator and 4 to the denominator.
  const totalSatisfied = sectionList.reduce(
    (acc, s) => acc + s.progressSatisfied,
    0
  );
  const totalItems = sectionList.reduce(
    (acc, s) => acc + s.progressTotal,
    0
  );
  const progressPct =
    totalItems > 0
      ? Math.min(100, parseFloat(((totalSatisfied / totalItems) * 100).toFixed(1)))
      : 0;

  // Human-readable label: show satisfied / total at the item level.
  const completedSections = sectionList.filter(
    (s) => s.status === "complete"
  ).length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Foundation logo / wordmark */}
      <div className="flex flex-col items-center gap-2 border-b border-slate-200 px-6 py-7">
        <JwfLogo className="h-20" />
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
          Bursary Assessment
        </span>
      </div>

      {/* Round name — hidden when the user has no invitation/application yet */}
      {roundName ? (
        <div className="border-b border-slate-200 px-6 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Round
          </p>
          <p className="mt-0.5 text-sm font-medium text-primary-800">
            {roundName}
          </p>
        </div>
      ) : null}

      {/* Section stepper */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4"
        aria-label="Application sections"
      >
        <ol className="space-y-0.5">
          {sectionList.map((section) => {
            const isActive = section.id === currentSection;
            // Determine the effective display status for the icon.
            // Active + not yet complete → show numbered bubble (in_progress).
            // We pass a negative sentinel value to SectionIcon to signal this.
            const iconStatus: SectionStatus =
              isActive && section.status !== "complete" && section.status !== "needs_attention"
                ? "not_started" // renders Circle normally, but we override below
                : section.status;

            return (
              <li key={section.id}>
                <a
                  href={`/apply/${section.slug}`}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-primary-50 text-primary-900 font-medium"
                      : section.status === "complete"
                        ? "text-slate-600 hover:bg-slate-50"
                        : section.status === "needs_attention"
                          ? "text-amber-700 hover:bg-amber-50"
                          : "text-slate-400 hover:bg-slate-50"
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {/* Step number / status icon */}
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center"
                    title={
                      section.status === "needs_attention"
                        ? `Needs attention — ${section.gapCount} issue${section.gapCount === 1 ? "" : "s"} outstanding`
                        : undefined
                    }
                  >
                    {isActive && section.status !== "complete" && section.status !== "needs_attention" ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-600 text-[10px] font-bold text-white">
                        {section.id}
                      </span>
                    ) : (
                      <SectionIcon
                        status={iconStatus}
                        stepNumber={section.id}
                        gapCount={section.gapCount}
                      />
                    )}
                  </span>

                  <span className="flex-1 truncate">{section.label}</span>

                  {isActive && (
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0 text-primary-600"
                      aria-hidden="true"
                    />
                  )}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Progress bar — partial fill based on item-level satisfied/total */}
      <div className="border-t border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span>{completedSections} of {sectionList.length} sections complete</span>
          <span className="font-medium text-primary-700">{progressPct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-accent-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progressPct}% of required items complete`}
          />
        </div>

        {/* Last saved */}
        {lastSaved && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Saved {lastSaved}
          </p>
        )}
      </div>
    </div>
  );
}
