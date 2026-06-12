"use client";

/**
 * Client chrome for the edit-on-behalf shell (CR-001).
 *
 * - EditSectionNav       — pill nav over the application's ACTIVE section
 *                          order. Lives client-side because the layout cannot
 *                          read the child segment's [section] param on the
 *                          server; usePathname resolves the current slug.
 * - StaffUploadEndpoints — points the portal FileUpload widget at the staff
 *                          /api/admin/documents endpoints. Lives client-side
 *                          because the deleteUrl builder is a function and so
 *                          cannot cross the server → client prop boundary.
 * - EditOnBehalfFooter   — sticky Back / Save bar mirroring the portal
 *                          ApplyFooter (SectionPageClient suppresses the
 *                          in-form nav via hideInlineNav, so without this bar
 *                          the form would have no save button).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTION_TO_SLUG } from "@/lib/portal/sections";
import {
  UploadEndpointProvider,
  type UploadEndpoints,
} from "@/components/portal/upload-endpoints";
import { useSectionSaving } from "@/components/portal/section-saving-context";

// ─── Section nav ──────────────────────────────────────────────────────────────

export interface EditSectionNavItem {
  slug: string;
  title: string;
  href: string;
}

export function EditSectionNav({ items }: { items: EditSectionNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Edit application sections"
      className="flex flex-wrap gap-2"
    >
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.slug}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "border-primary-700 bg-primary-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

// ─── Staff upload endpoints ───────────────────────────────────────────────────

/** Module-level so the provider value is referentially stable across renders. */
const STAFF_UPLOAD_ENDPOINTS: UploadEndpoints = {
  uploadUrl: "/api/admin/documents",
  deleteUrl: (id) => `/api/admin/documents/${id}`,
};

export function StaffUploadEndpoints({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UploadEndpointProvider value={STAFF_UPLOAD_ENDPOINTS}>
      {children}
    </UploadEndpointProvider>
  );
}

// ─── Sticky footer ────────────────────────────────────────────────────────────

export function EditOnBehalfFooter() {
  const pathname = usePathname();
  const router = useRouter();
  const { saving } = useSectionSaving();

  // The last section's save returns to the application detail page, so the
  // label drops the "Continue" promise there (mirrors the ApplyFooter pattern).
  const isLastSection = pathname.endsWith(
    `/edit/${SECTION_TO_SLUG.DECLARATION}`
  );
  const nextLabel = isLastSection ? "Save and Finish" : "Save and Continue";

  return (
    <div className="sticky bottom-0 z-20 mt-8 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-md">
      <button
        type="button"
        onClick={() => router.back()}
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700",
          "transition-colors hover:bg-slate-50 hover:text-slate-900",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      {/* Submits the section form across the tree via form="section-form" —
          the same cross-form mechanism the portal ApplyFooter uses. */}
      <button
        type="submit"
        form="section-form"
        disabled={saving}
        className={cn(
          "flex items-center gap-1.5 rounded-md bg-primary-900 px-5 py-2 text-sm font-medium text-white",
          "transition-colors hover:bg-primary-800",
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
