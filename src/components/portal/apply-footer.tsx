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
 *    cross-form submit mechanism).
 *  - Disabled/spinner reflect `useSectionSaving().saving`, set by `SectionForm`.
 *
 * DECLARATION — the review/submit split (D4, CF-32). The Declaration used to
 * carry ONE button that both saved and irreversibly submitted, labelled "Review
 * and Submit" here but "Submit Application" on the page. Charlotte's UAT
 * feedback was that conflating the two is stressful, so there are now two:
 *
 *   - "Review"             — saves, then lands on /apply/review. No prompt, no
 *                            submission. (The section's `nextHref` IS
 *                            /apply/review, so this is the ordinary
 *                            save-and-continue path.)
 *   - "Submit Application" — saves, then submits, behind a confirmation dialog.
 *
 * Both submit the SAME `section-form`, so each arms `setSubmitIntent` in its
 * `onClick` (a synchronous ref write) to say which one was pressed;
 * `SectionPageClient` consumes it. The submit label is the shared
 * `SUBMIT_APPLICATION_LABEL` constant so the footer and the page can no longer
 * disagree about what this control is called.
 */

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTION_TO_SLUG } from "@/lib/portal/sections";
import {
  REVIEW_LABEL,
  SUBMIT_APPLICATION_LABEL,
} from "@/lib/portal/declaration-submit";
import { useSectionSaving } from "./section-saving-context";
import { useUnsavedChanges } from "./unsaved-changes-context";

/**
 * The one wide section. The footer's button row must track the section CARD's
 * per-section width (see `section-page-client.tsx`), which is max-w-3xl for
 * every section EXCEPT Parents' Income (max-w-4xl). Deriving the path from the
 * canonical `SECTION_TO_SLUG` map ties this decision to the same source the
 * route + card width use, so the footer and card can never drift apart.
 */
const PARENTS_INCOME_PATH = `/apply/${SECTION_TO_SLUG.PARENTS_INCOME}`;

/** Shared chrome for the footer's secondary (outline) controls. */
const SECONDARY_BUTTON = cn(
  "flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700",
  "hover:bg-slate-50 hover:text-slate-900 transition-colors",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
  "disabled:pointer-events-none disabled:opacity-50"
);

/** Shared chrome for the footer's primary (filled) control. */
const PRIMARY_BUTTON = cn(
  "flex items-center gap-1.5 rounded-md bg-primary-900 px-5 py-2 text-sm font-medium text-white",
  "hover:bg-primary-800 transition-colors",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
  "disabled:pointer-events-none disabled:opacity-60"
);

export function ApplyFooter() {
  const pathname = usePathname();
  const router = useRouter();
  const { saving, setSubmitIntent } = useSectionSaving();
  const { requestUnroutedNavigation } = useUnsavedChanges();

  // Review owns its own CTA — show no shell footer there.
  if (pathname === "/apply/review") {
    return null;
  }

  const isDeclaration = pathname === "/apply/declaration";
  const nextLabel = isDeclaration
    ? SUBMIT_APPLICATION_LABEL
    : "Save and Continue";

  // Match the section card's width so Back/Continue land on its outer edges.
  // Parents' Income is the only max-w-4xl section; everything else is max-w-3xl.
  const innerMaxWidth =
    pathname === PARENTS_INCOME_PATH ? "max-w-4xl" : "max-w-3xl";

  return (
    // Full-bleed sticky BAR: the border/background/shadow span the whole content
    // area (the -mx bleed cancels <main>'s padding). The INNER row is centred and
    // capped to the current section's card width, so the buttons align with the
    // card's left/right edges per-section instead of the wider 4xl envelope edges.
    <div className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-8 border-t border-slate-200 bg-white px-4 py-3 shadow-md md:-mx-8 md:-mb-10 md:px-8">
      <div
        className={cn(
          "mx-auto flex w-full flex-wrap items-center justify-between gap-3",
          innerMaxWidth
        )}
      >
        {/* Back — real handler (router.back), unlike the old dead control.
            Routed through the unsaved-changes guard (WP B1): stepping back out
            of a half-filled section discards it just as thoroughly as a sidebar
            click did. `requestUnroutedNavigation` returns true when there is
            nothing to lose; otherwise the guard replays the Back itself. */}
        <button
          type="button"
          onClick={() => {
            if (requestUnroutedNavigation(() => router.back())) {
              router.back();
            }
          }}
          className={SECONDARY_BUTTON}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Declaration only: REVIEW — save and return to the review tab, with
              no submission and no prompt (CF-32). The armed "review" intent is
              also what clears a stale "submit" from an earlier attempt. */}
          {isDeclaration && (
            <button
              type="submit"
              form="section-form"
              disabled={saving}
              onClick={() => setSubmitIntent("review")}
              aria-label="Review — save your declaration and return to the review page without submitting"
              className={SECONDARY_BUTTON}
            >
              {REVIEW_LABEL}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {/* Save and Continue (Submit Application on Declaration). Submits the
              section form across the tree via form="section-form". */}
          <button
            type="submit"
            form="section-form"
            disabled={saving}
            onClick={() => setSubmitIntent(isDeclaration ? "submit" : "review")}
            className={PRIMARY_BUTTON}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                {nextLabel}
                {isDeclaration ? (
                  <Send className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
