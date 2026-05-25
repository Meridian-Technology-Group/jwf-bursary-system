"use client";

/**
 * ContributeSubmitButton — submits the secondary parent's contribution.
 *
 * Calls submitContribution(), which validates the three owned sections, flips
 * the contributor → SUBMITTED (admin context), emails the parent, and redirects
 * to /contribute/submitted. A NEXT_REDIRECT must bubble so the router navigates;
 * any other error (including the structured GAPS_BLOCKING_SUBMISSION payload) is
 * surfaced inline.
 */

import * as React from "react";
import { ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitContribution } from "../actions";

interface SubmitButtonProps {
  disabled?: boolean;
}

export function ContributeSubmitButton({ disabled = false }: SubmitButtonProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await submitContribution();
    } catch (err) {
      const digest = (err as { digest?: string } | null)?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      let message =
        err instanceof Error ? err.message : "Submission failed. Please try again.";
      // The action encodes a structured gaps payload as JSON in the message.
      try {
        const parsed = JSON.parse(message) as {
          code?: string;
          gaps?: Array<{ label: string }>;
        };
        if (parsed.code === "GAPS_BLOCKING_SUBMISSION" && parsed.gaps?.length) {
          message = `Please resolve: ${parsed.gaps.map((g) => g.label).join("; ")}`;
        }
      } catch {
        // not JSON — use the message as-is
      }
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-error-200 bg-error-50 p-3 text-sm text-error-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error-600" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || submitting}
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-white",
          "bg-primary-900 transition-colors hover:bg-primary-800",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary-900"
        )}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Submitting...
          </>
        ) : (
          <>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            Submit my contribution
          </>
        )}
      </button>
    </div>
  );
}
