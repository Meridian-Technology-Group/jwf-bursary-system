"use client";

/**
 * ApplicationTypeChooser — Epic 05 (feedback ask #4).
 *
 * The parent has exactly two possible application types: a NEW application (the
 * full form, including the mandatory identity-documents section) and a
 * ROLLING-OVER re-assessment for an active bursary recipient (the form with the
 * ID section hidden). The Foundation asked for BOTH to be shown as visual
 * options, with the wrong one VISIBLY DISABLED so a parent can never start the
 * incorrect form.
 *
 * Eligibility is NOT a free choice — it is derived upstream from the
 * invitation type (first-year vs re-assessment) and the application type, and
 * passed in as `eligibleType`. The matching card is rendered active (its real
 * onboarding / re-assessment body); the other is a muted, disabled shell with a
 * one-line reason and a "contact the Foundation" link (risk mitigation §8).
 */

import * as React from "react";
import { GraduationCap, RefreshCw, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingCard } from "@/app/(portal)/onboarding-card";
import { ReassessmentCard } from "@/app/(portal)/reassessment-card";
import { BURSARIES_CONTACT_EMAIL } from "@/lib/portal/guidance-content";

export type EligibleApplicationType = "NEW" | "ROLLING_OVER";

interface ApplicationTypeChooserProps {
  /** Which card is active — derived from the invitation, not chosen here. */
  eligibleType: EligibleApplicationType;
  /** Pre-filled child name from the invitation, if supplied. */
  defaultChildName?: string | null;
  /** School (re-assessment only) — known from last year. */
  school?: "TRINITY" | "WHITGIFT" | null;
  /** New round's academic year, for the re-assessment "welcome back" copy. */
  academicYear?: string | null;
}

function DisabledCard({
  variant,
}: {
  variant: EligibleApplicationType;
}) {
  const isNew = variant === "NEW";
  const Icon = isNew ? GraduationCap : RefreshCw;
  const title = isNew
    ? "New application"
    : "Re-assessment (rolling-over bursary)";
  const reason = isNew
    ? "This option is for families applying for the first time. You have an active bursary, so your application is a re-assessment."
    : "This option is for families with an active bursary. Your invitation is for a new application.";

  return (
    <div
      className="relative rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 opacity-70"
      aria-disabled="true"
    >
      <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
        <Lock className="h-3 w-3" aria-hidden="true" />
        Not available
      </span>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200">
          <Icon className="h-6 w-6 text-slate-400" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-500">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{reason}</p>
          <p className="mt-3 text-xs text-slate-400">
            If you think this is wrong, please contact the Foundation at{" "}
            <a
              href={`mailto:${BURSARIES_CONTACT_EMAIL}`}
              className="font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
            >
              {BURSARIES_CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export function ApplicationTypeChooser({
  eligibleType,
  defaultChildName,
  school,
  academicYear,
}: ApplicationTypeChooserProps) {
  const isRollingOver = eligibleType === "ROLLING_OVER";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Your application
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          There are two kinds of bursary application. Based on your invitation,
          only the correct one is available to you — the other is shown for
          reference but cannot be started.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* New application */}
        <div className={cn(isRollingOver && "order-2")}>
          {isRollingOver ? (
            <DisabledCard variant="NEW" />
          ) : (
            <OnboardingCard defaultChildName={defaultChildName} />
          )}
        </div>

        {/* Rolling-over re-assessment */}
        <div className={cn(isRollingOver ? "order-1" : "order-2")}>
          {isRollingOver ? (
            <ReassessmentCard
              defaultChildName={defaultChildName}
              school={school}
              academicYear={academicYear}
            />
          ) : (
            <DisabledCard variant="ROLLING_OVER" />
          )}
        </div>
      </div>
    </div>
  );
}
