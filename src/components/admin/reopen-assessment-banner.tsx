"use client";

/**
 * Epic 13 / C1 — "Assessment complete" banner + Reopen control.
 *
 * The assessment form goes read-only once the assessment is COMPLETED, which
 * until now looked like a dead end: nothing on the page said why the fields
 * were locked or what to do about it. This banner is that explanation, and
 * carries the one way back (`reopenAssessmentAction`, D13-2 — allowed only
 * until an outcome is set).
 *
 * The server action re-checks everything this component decides in the browser
 * (role, assignment, outcome, status). Rendering or hiding the button is a
 * usability choice, never the authorisation.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reopenAssessmentAction } from "@/app/(admin)/applications/[id]/assessment/actions";

interface ReopenAssessmentBannerProps {
  assessmentId: string;
  applicationId: string;
  /** False for a read-only viewer, or once an outcome exists — hides the control. */
  canReopen: boolean;
}

export function ReopenAssessmentBanner({
  assessmentId,
  applicationId,
  canReopen,
}: ReopenAssessmentBannerProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleReopen = async () => {
    setIsLoading(true);
    setError(null);

    const result = await reopenAssessmentAction(assessmentId, applicationId);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <Lock
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">This assessment is marked complete.</p>
            <p className="text-xs text-amber-800">
              The assessment fields are locked.
              {canReopen
                ? " Reopen it if any of the figures still need to change."
                : " An outcome has been recorded, so it can no longer be reopened."}
            </p>
          </div>
        </div>

        {canReopen && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReopen}
            disabled={isLoading}
            className="border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
          >
            {isLoading ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Reopening…
              </>
            ) : (
              <>
                <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Reopen assessment
              </>
            )}
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
