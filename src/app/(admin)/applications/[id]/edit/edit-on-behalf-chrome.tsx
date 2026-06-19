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
 * - EditOnBehalfBannerActions — "Finish editing" (+ the FILLED_IN-gated
 *                          "Submit on behalf of applicant" behind a confirm
 *                          dialog) in the banner, visible from every section.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SECTION_TO_SLUG } from "@/lib/portal/sections";
import {
  UploadEndpointProvider,
  type UploadEndpoints,
} from "@/components/portal/upload-endpoints";
import { useSectionSaving } from "@/components/portal/section-saving-context";
import { finishEditingOnBehalf, submitApplicationOnBehalf } from "./actions";

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

// ─── Banner actions ───────────────────────────────────────────────────────────

interface EditOnBehalfBannerActionsProps {
  applicationId: string;
  /**
   * True only while the form is FILLED_IN — the submit-on-behalf gate. The
   * layout re-renders per navigation, so this tracks every save's
   * `refreshFormStatus` outcome; the server action re-checks it regardless.
   */
  canSubmit: boolean;
}

/**
 * The banner's action buttons, visible from every edit page:
 *
 *   - "Finish editing" ends the editing pass — the action emails the applicant
 *     a summary of the assessor-edited sections (silently no-ops when nothing
 *     was edited) and returns to the application detail page.
 *   - "Submit on behalf of applicant" (FILLED_IN only) runs the SAME
 *     submission core as the portal, behind a confirm dialog.
 *
 * Action failures render inline (ApplicationActions' error-banner pattern).
 */
export function EditOnBehalfBannerActions({
  applicationId,
  canSubmit,
}: EditOnBehalfBannerActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  function handleFinish() {
    setActionError(null);
    startTransition(async () => {
      const result = await finishEditingOnBehalf(applicationId);
      if (!result.success) {
        setActionError(result.error);
        return;
      }
      router.push(`/applications/${applicationId}`);
    });
  }

  function handleConfirmSubmit() {
    setActionError(null);
    startTransition(async () => {
      const result = await submitApplicationOnBehalf(applicationId);
      setConfirmOpen(false);
      if (!result.success) {
        setActionError(result.error);
        return;
      }
      router.push(`/applications/${applicationId}`);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {canSubmit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            className="gap-2 border-primary-300 text-primary-800 hover:bg-primary-50"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Submit on behalf of applicant
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleFinish}
          disabled={isPending}
          className="gap-2 bg-accent-600 text-white hover:bg-accent-700 focus-visible:outline-accent-600"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          Finish editing
        </Button>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
            aria-hidden="true"
          />
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      {/* Submit-on-behalf confirmation (OutcomeConfirmDialog pattern) */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isPending) setConfirmOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary-900">
              Submit on behalf of applicant?
            </DialogTitle>
            <DialogDescription>
              This will submit the application exactly as if the applicant had
              submitted it — the form becomes read-only to the applicant and
              assessment can begin. The applicant will receive the standard
              confirmation email.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={isPending}
              className="gap-2 bg-primary-700 hover:bg-primary-800"
            >
              {isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Confirm Submit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
