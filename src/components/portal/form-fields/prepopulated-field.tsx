"use client";

/**
 * Pre-populated section indicator.
 *
 * Used on re-assessment form sections where data has been copied from the
 * previous year's application. The applicant can edit these values — they
 * are merely defaults to reduce data-entry burden.
 *
 * Component exported:
 *   - PrepopulatedSectionBanner — section-level info banner
 */

import { Info } from "lucide-react";

// ─── Section-level banner ─────────────────────────────────────────────────────

/**
 * Banner shown at the top of a pre-populated section.
 * Explains that the section has been pre-filled from last year and invites
 * the applicant to verify and update the information.
 */
export function PrepopulatedSectionBanner() {
  return (
    <div
      role="note"
      aria-label="Pre-filled section"
      className="flex items-start gap-3 rounded-lg border border-info-200 bg-info-50 px-4 py-3"
    >
      <Info
        className="mt-0.5 h-4 w-4 shrink-0 text-info-600"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary-900">
          Pre-filled from last year
        </p>
        <p className="mt-0.5 text-sm text-info-700">
          We have carried forward your answers from the previous assessment.
          Please review each field and update anything that has changed.
        </p>
      </div>
    </div>
  );
}
