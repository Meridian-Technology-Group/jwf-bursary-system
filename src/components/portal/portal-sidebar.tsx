"use client";

/**
 * Portal sidebar — section progress stepper for the applicant portal.
 *
 * Displayed at 280 px on desktop; collapses into a Sheet on mobile.
 */

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionStatus = "not_started" | "in_progress" | "complete";

interface Section {
  id: number;
  label: string;
  status: SectionStatus;
}

// ─── Placeholder section data ────────────────────────────────────────────────
// In a real implementation these would come from the application state / server.

const SECTIONS: Section[] = [
  { id: 1, label: "Personal Details", status: "complete" },
  { id: 2, label: "Family Circumstances", status: "in_progress" },
  { id: 3, label: "Financial Information", status: "not_started" },
  { id: 4, label: "School Information", status: "not_started" },
  { id: 5, label: "Siblings", status: "not_started" },
  { id: 6, label: "Employment", status: "not_started" },
  { id: 7, label: "Housing", status: "not_started" },
  { id: 8, label: "Other Income", status: "not_started" },
  { id: 9, label: "Supporting Documents", status: "not_started" },
  { id: 10, label: "Declaration & Submit", status: "not_started" },
];

// ─── Section icon ─────────────────────────────────────────────────────────────

function SectionIcon({ status }: { status: SectionStatus }) {
  switch (status) {
    case "complete":
      return (
        <CheckCircle2
          className="h-4 w-4 shrink-0 text-success-600"
          aria-hidden="true"
        />
      );
    case "in_progress":
      return (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-accent-600"
          aria-hidden="true"
        />
      );
    default:
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
  currentSection?: number;
}

export function PortalSidebarContent({
  roundName = "2024–25 Assessment Round",
  lastSaved,
  currentSection = 2,
}: PortalSidebarContentProps) {
  const completedCount = SECTIONS.filter((s) => s.status === "complete").length;
  const progressPct = Math.round((completedCount / SECTIONS.length) * 100);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Foundation logo / wordmark */}
      <div className="border-b border-slate-200 px-6 py-5">
        <span className="block text-sm font-semibold leading-tight text-primary-900">
          John Whitgift Foundation
        </span>
        <span className="block text-xs text-slate-500">Bursary Assessment</span>
      </div>

      {/* Round name */}
      <div className="border-b border-slate-200 px-6 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Round
        </p>
        <p className="mt-0.5 text-sm font-medium text-primary-800">
          {roundName}
        </p>
      </div>

      {/* Section stepper */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4"
        aria-label="Application sections"
      >
        <ol className="space-y-0.5">
          {SECTIONS.map((section) => {
            const isActive = section.id === currentSection;
            return (
              <li key={section.id}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-primary-50 text-primary-900 font-medium"
                      : section.status === "complete"
                        ? "text-slate-600 hover:bg-slate-50"
                        : "text-slate-400 hover:bg-slate-50"
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {/* Step number / status icon */}
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {section.status === "not_started" && !isActive ? (
                      <span className="text-xs text-slate-300">
                        {section.id}
                      </span>
                    ) : (
                      <SectionIcon status={section.status} />
                    )}
                  </span>

                  <span className="flex-1 truncate">{section.label}</span>

                  {isActive && (
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0 text-primary-600"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Progress bar */}
      <div className="border-t border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span>{completedCount} of {SECTIONS.length} sections complete</span>
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
            aria-label={`${completedCount} of ${SECTIONS.length} sections complete`}
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
