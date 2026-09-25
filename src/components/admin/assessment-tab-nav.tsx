"use client";

/**
 * Epic 14 C3 (CG-16, D14-2) — the assessment workspace's five-tab navigation.
 *
 * Tab names are Charlotte's, verbatim (workbook/email, 2026-08-16):
 * UPLOADED DOCUMENTS DISPLAY · APPLICATION FORM · ASSESSMENT MODEL (1-5) ·
 * BURSARY AWARD CALCULATION (6) · ASSESSMENT ADMIN.
 *
 * Sub-route based (deep-linkable); the ASSESSMENT MODEL tab is the index
 * route, so its active check is exact while the others are prefix-based.
 *
 * GT migration (PR-D): a migrated application has no form, so its
 * APPLICATION FORM tab renders disabled (`applicationFormDisabled`).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "UPLOADED DOCUMENTS DISPLAY", segment: "documents" },
  { label: "APPLICATION FORM", segment: "application-form" },
  { label: "ASSESSMENT MODEL (1-5)", segment: "" },
  { label: "BURSARY AWARD CALCULATION (6)", segment: "award" },
  { label: "ASSESSMENT ADMIN", segment: "admin" },
] as const;

const DISABLED_TAB_TITLE = "Migrated from Grant Tracker: there is no application form.";

export function AssessmentTabNav({
  applicationId,
  applicationFormDisabled = false,
}: {
  applicationId: string;
  applicationFormDisabled?: boolean;
}) {
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
          if (applicationFormDisabled && tab.segment === "application-form") {
            return (
              <span
                key={tab.label}
                aria-disabled="true"
                title={DISABLED_TAB_TITLE}
                className="cursor-not-allowed whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-300"
              >
                {tab.label}
              </span>
            );
          }
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
