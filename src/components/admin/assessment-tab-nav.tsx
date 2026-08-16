"use client";

/**
 * Epic 14 C3 (CG-16, D14-2) — the assessment workspace's five-tab navigation.
 *
 * Tab names are Charlotte's, verbatim (workbook/email, 2026-08-16):
 * UPLOADED DOCUMENTS DISPLAY · APPLICATION FORM · ASSESSMENT MODEL (1-4) ·
 * BURSARY AWARD CALCULATION (5) · ASSESSMENT ADMIN.
 *
 * Sub-route based (deep-linkable); the ASSESSMENT MODEL tab is the index
 * route, so its active check is exact while the others are prefix-based.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "UPLOADED DOCUMENTS DISPLAY", segment: "documents" },
  { label: "APPLICATION FORM", segment: "application-form" },
  { label: "ASSESSMENT MODEL (1-4)", segment: "" },
  { label: "BURSARY AWARD CALCULATION (5)", segment: "award" },
  { label: "ASSESSMENT ADMIN", segment: "admin" },
] as const;

export function AssessmentTabNav({ applicationId }: { applicationId: string }) {
  const pathname = usePathname() ?? "";
  const base = `/applications/${applicationId}/assessment`;

  return (
    <div className="overflow-x-auto border-b border-slate-200">
      <nav
        className="-mb-px flex min-w-max gap-0"
        aria-label="Assessment workspace tabs"
      >
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active = tab.segment
            ? pathname.startsWith(href)
            : pathname === base || pathname === `${base}/`;
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold tracking-wide transition-colors",
                active
                  ? "border-accent-600 text-primary-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
