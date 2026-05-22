"use client";

/**
 * ReassessmentCard — shown on the portal dashboard when a returning bursary
 * holder has a PENDING re-assessment invitation but no application yet for
 * the new round.
 *
 * Unlike the first-year OnboardingCard ("set up your application / school
 * you've been offered a place at"), this is a "welcome back" confirmation:
 * the school and child's full name are already known from last year, so the
 * applicant just confirms them and clicks Begin. Begin consumes the
 * (still-PENDING) invite, creates the prepopulated re-assessment application,
 * and drops them into the shorter form.
 */

import * as React from "react";
import { beginReassessmentAction } from "@/app/(portal)/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface ReassessmentCardProps {
  /** Child's full name, pre-filled from last year's record. */
  defaultChildName?: string | null;
  /** School the child currently attends (TRINITY | WHITGIFT). */
  school?: "TRINITY" | "WHITGIFT" | null;
  /** Academic year of the new round, e.g. "2026/2027". */
  academicYear?: string | null;
}

function schoolLabel(school: ReassessmentCardProps["school"]): string {
  if (school === "TRINITY") return "Trinity School";
  if (school === "WHITGIFT") return "Whitgift School";
  return "your child's school";
}

export function ReassessmentCard({
  defaultChildName,
  school,
  academicYear,
}: ReassessmentCardProps) {
  const [childName, setChildName] = React.useState<string>(
    defaultChildName ?? ""
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const childLabel = defaultChildName?.trim() || "your child";
  const yearLabel = academicYear ? ` for ${academicYear}` : "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!childName.trim()) {
      setError("Please confirm your child's full name.");
      return;
    }

    setPending(true);

    // The action consumes the invite + creates the prepopulated application
    // server-side from the invitation, then redirects. We only land back here
    // if it returned an error before redirecting.
    const result = await beginReassessmentAction();

    if (result && !result.success) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
          <RefreshCw className="h-6 w-6 text-primary-700" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary-900">
            Welcome back — your bursary for {childLabel} is up for re-assessment
            {yearLabel}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Bursaries are reviewed each year. Please confirm the school{" "}
            {childLabel} currently attends and their full name, then begin your
            re-assessment. Most of last year&rsquo;s details are pre-filled —
            you&rsquo;ll only need to re-enter this year&rsquo;s financial
            information.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        {/* School — confirmation only (read-only, known from last year) */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            School your child currently attends
          </label>
          <Input
            type="text"
            value={schoolLabel(school)}
            readOnly
            className="bg-slate-50 text-slate-600"
            aria-readonly="true"
          />
          <p className="text-xs text-slate-400">
            If this has changed, contact the Foundation before continuing.
          </p>
        </div>

        {/* Child's full name */}
        <div className="space-y-2">
          <label
            htmlFor="childName"
            className="block text-sm font-medium text-slate-700"
          >
            Child&rsquo;s full name{" "}
            <span className="text-error-600" aria-hidden="true">
              *
            </span>
          </label>
          <Input
            id="childName"
            name="childName"
            type="text"
            placeholder="Enter child's full legal name"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            required
            aria-required="true"
            autoComplete="name"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-accent-600 text-white hover:bg-accent-700 focus-visible:outline-accent-600"
        >
          {pending ? "Setting up your re-assessment…" : "Begin re-assessment"}
        </Button>
      </form>
    </div>
  );
}
