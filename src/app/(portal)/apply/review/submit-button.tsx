"use client";

/**
 * SubmitApplicationButton — client component that triggers the submitApplication server action.
 */

import * as React from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitApplication } from "../actions";

interface SubmitApplicationButtonProps {
  applicationId: string;
  disabled?: boolean;
}

export function SubmitApplicationButton({
  applicationId,
  disabled = false,
}: SubmitApplicationButtonProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      await submitApplication(applicationId);
      // submitApplication redirects to /submitted on success — if we reach
      // here something went wrong without throwing.
    } catch (err) {
      // Next.js redirect() throws a special NEXT_REDIRECT error — re-throw it
      // so the router can handle the navigation.
      if (
        err instanceof Error &&
        (err.message === "NEXT_REDIRECT" ||
          err.message.startsWith("NEXT_REDIRECT") ||
          (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))
      ) {
        throw err;
      }

      const message =
        err instanceof Error ? err.message : "Submission failed. Please try again.";
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p
          role="alert"
          className="text-sm text-error-600"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || submitting}
        className={cn(
          "flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-white",
          "bg-primary-900 hover:bg-primary-800 transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
        aria-busy={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Submitting…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            Submit Application
          </>
        )}
      </button>

      {disabled && (
        <p className="text-xs text-slate-500">
          Complete all sections above to enable submission.
        </p>
      )}
    </div>
  );
}
