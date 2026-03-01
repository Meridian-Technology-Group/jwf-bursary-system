"use client";

/**
 * Pre-populated field indicator components.
 *
 * Used on re-assessment form sections where data has been copied from the
 * previous year's application. The applicant can edit these values — they
 * are merely defaults to reduce data-entry burden.
 *
 * Components exported:
 *   - PrepopulatedSectionBanner — section-level info banner
 *   - PrepopulatedFieldWrapper  — wraps an individual field
 *   - PrepopulatedIndicator     — inline badge for use alongside a label
 */

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

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

// ─── Field-level wrapper ──────────────────────────────────────────────────────

interface PrepopulatedFieldWrapperProps {
  children: React.ReactNode;
  /** Whether this specific field was pre-populated. Defaults to true. */
  isPrepopulated?: boolean;
  className?: string;
}

/**
 * Wraps an individual form field with a subtle blue left-border and the
 * "Pre-filled from last year — please verify" caption.
 *
 * Use this around a single field (e.g. a TextInput or CurrencyInput) when
 * you want per-field granularity rather than the section-level banner.
 */
export function PrepopulatedFieldWrapper({
  children,
  isPrepopulated = true,
  className,
}: PrepopulatedFieldWrapperProps) {
  if (!isPrepopulated) return <>{children}</>;

  return (
    <div
      className={cn(
        "relative rounded-md border-l-2 border-info-400 bg-info-50/50 pl-3",
        className
      )}
    >
      {children}
      <PrepopulatedCaption />
    </div>
  );
}

// ─── Inline indicator ─────────────────────────────────────────────────────────

/**
 * Small inline badge rendered beside a field label to signal pre-population.
 * Use inside form field label areas when a full wrapper is not practical.
 */
export function PrepopulatedIndicator() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-info-200 bg-info-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-info-700">
      <Info className="h-2.5 w-2.5" aria-hidden="true" />
      Last year
    </span>
  );
}

// ─── Caption ─────────────────────────────────────────────────────────────────

/**
 * Small caption rendered beneath a pre-populated field.
 */
function PrepopulatedCaption() {
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-info-600">
      <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
      Pre-filled from last year — please verify
    </p>
  );
}
