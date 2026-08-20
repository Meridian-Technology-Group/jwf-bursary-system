"use client";

/**
 * ApplicationActions — WP-15
 *
 * Contextual actions bar rendered at the top of the application detail view.
 * The set of available buttons changes based on the application's current status,
 * matching the allowed status lifecycle transitions.
 *
 * Status → available actions:
 *   SUBMITTED     → "Begin Review" (→ NOT_STARTED)
 *   NOT_STARTED   → "Request Missing Documents" (→ PAUSED) | "Mark Complete" (→ COMPLETED)
 *   PAUSED        → "Resume Review" (→ NOT_STARTED)
 *
 * COMPLETED has no actions here (Epic 13 C3 / D13-5): the outcome is set solely
 * by the v2 recommendation form's 3-way decision.
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MissingDocsDialog } from "@/components/admin/missing-docs-dialog";
import { RejectRestartDialog } from "@/components/admin/reject-restart-dialog";
import {
  updateApplicationStatus,
  resumeApplication,
} from "@/app/(admin)/applications/[id]/actions";
import type { Document } from "@prisma/client";
import type { ReviewPhase } from "@/lib/applications/status";
import { REVIEW_PHASE_LABEL } from "@/lib/applications/review-phase-labels";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApplicationActionsProps {
  applicationId: string;
  /**
   * The derived review phase (Epic 01 PR-6a) — the 7-value vocabulary projected
   * from the lifecycle columns by `deriveReviewPhase`. Replaces the deprecated
   * fused `applications.status` the component used to read.
   */
  status: ReviewPhase;
  /** Documents needed by MissingDocsDialog to pre-select unverified slots */
  documents: Document[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ApplicationActions({
  applicationId,
  status,
  documents,
}: ApplicationActionsProps) {
  const router = useRouter();
  // Assessment-route detection (same test as assessment-route-chrome.tsx).
  const pathname = usePathname();
  const onAssessmentRoute = /\/applications\/[^/]+\/assessment(\/|$)/.test(
    pathname ?? ""
  );

  const [isPending, startTransition] = React.useTransition();
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Hide the bar for terminal or pre-active statuses (CLOSED = unified
  // terminal state, item 2 — no state-changing actions on a closed application)
  // and for COMPLETED, which no longer has any action here (Epic 13 C3).
  if (
    status === "PRE_SUBMISSION" ||
    status === "COMPLETED" ||
    status === "QUALIFIES" ||
    status === "DOES_NOT_QUALIFY" ||
    status === "CLOSED"
  ) {
    return null;
  }

  // Epic 15 W2 (CH-03): on assessment routes the in-review actions live in
  // the compressed header (Request Missing Documents / Reject & Restart moved
  // there; Mark Complete retired there under CH-04) — the bar would be empty,
  // so it doesn't render. Begin Review (SUBMITTED) and Resume Review (PAUSED)
  // keep their bar everywhere: they are the only way into/out of those states.
  if (onAssessmentRoute && status === "NOT_STARTED") {
    return null;
  }

  function runAction(fn: () => Promise<{ success: boolean; error?: string }>) {
    setActionError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.success) {
        setActionError(result.error ?? "An unexpected error occurred.");
      } else {
        router.refresh();
      }
    });
  }

  function handleBeginReview() {
    runAction(() =>
      updateApplicationStatus(
        applicationId,
        "NOT_STARTED",
        "Assessor began review"
      )
    );
  }

  function handleMarkComplete() {
    runAction(() =>
      updateApplicationStatus(
        applicationId,
        "COMPLETED",
        "Assessment marked complete"
      )
    );
  }

  function handleResumeReview() {
    runAction(() => resumeApplication(applicationId));
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: context label. Hidden on assessment routes (CH-06) — the
              W1 lifecycle strip is the status vocabulary there. */}
          {!onAssessmentRoute && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Actions</span>
              <ChevronRight
                className="h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <span className="text-sm text-slate-500">
                {REVIEW_PHASE_LABEL[status]}
              </span>
            </div>
          )}

          {/* Right: contextual buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* SUBMITTED → Begin Review */}
            {status === "SUBMITTED" && (
              <Button
                size="sm"
                onClick={handleBeginReview}
                disabled={isPending}
                className="gap-2 bg-primary-700 hover:bg-primary-800"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Begin Review
              </Button>
            )}

            {/* NOT_STARTED → Request Missing Docs | Mark Complete */}
            {status === "NOT_STARTED" && (
              <>
                <MissingDocsDialog
                  applicationId={applicationId}
                  documents={documents}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      className="gap-2 border-slate-300"
                    >
                      Request Missing Documents
                    </Button>
                  }
                />
                <RejectRestartDialog
                  applicationId={applicationId}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
                    >
                      Reject &amp; Restart
                    </Button>
                  }
                />
                {/* CH-04 (Epic 15 W1): on assessment routes the form's green
                    Complete is the single completion affordance — the blue
                    duplicate is hidden there. */}
                {!onAssessmentRoute && (
                  <Button
                    size="sm"
                    onClick={handleMarkComplete}
                    disabled={isPending}
                    className="gap-2 bg-primary-700 hover:bg-primary-800"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Mark Complete
                  </Button>
                )}
              </>
            )}

            {/* PAUSED → Resume Review */}
            {status === "PAUSED" && (
              <Button
                size="sm"
                onClick={handleResumeReview}
                disabled={isPending}
                className="gap-2 bg-primary-700 hover:bg-primary-800"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Resume Review
              </Button>
            )}
          </div>
        </div>

        {/* Inline error banner */}
        {actionError && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{actionError}</p>
          </div>
        )}
      </div>
    </>
  );
}

