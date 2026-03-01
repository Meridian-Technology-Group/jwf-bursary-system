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
 *   COMPLETED     → "Set Qualifies" (→ QUALIFIES) | "Set Does Not Qualify" (→ DOES_NOT_QUALIFY)
 *
 * Outcome transitions (COMPLETED → QUALIFIES / DOES_NOT_QUALIFY) are considered
 * irreversible and therefore require an inline confirmation step.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MissingDocsDialog } from "@/components/admin/missing-docs-dialog";
import {
  updateApplicationStatus,
  resumeApplication,
  setOutcome,
} from "@/app/(admin)/applications/[id]/actions";
import type { Document } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type PrismaStatus =
  | "PRE_SUBMISSION"
  | "SUBMITTED"
  | "NOT_STARTED"
  | "PAUSED"
  | "COMPLETED"
  | "QUALIFIES"
  | "DOES_NOT_QUALIFY";

interface ApplicationActionsProps {
  applicationId: string;
  status: PrismaStatus;
  /** Documents needed by MissingDocsDialog to pre-select unverified slots */
  documents: Document[];
}

// ─── Outcome confirmation dialog ──────────────────────────────────────────────

interface OutcomeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outcome: "QUALIFIES" | "DOES_NOT_QUALIFY";
  isPending: boolean;
  onConfirm: () => void;
}

function OutcomeConfirmDialog({
  open,
  onOpenChange,
  outcome,
  isPending,
  onConfirm,
}: OutcomeConfirmDialogProps) {
  const isQualifies = outcome === "QUALIFIES";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-primary-900">
            Confirm Outcome: {isQualifies ? "Qualifies" : "Does Not Qualify"}
          </DialogTitle>
          <DialogDescription>
            {isQualifies
              ? "This will mark the application as QUALIFIES and send the outcome email to the applicant. This action cannot be undone."
              : "This will mark the application as DOES NOT QUALIFY and send the outcome email to the applicant. This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={
              isQualifies
                ? "bg-green-600 hover:bg-green-700 text-white gap-2"
                : "bg-rose-600 hover:bg-rose-700 text-white gap-2"
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isQualifies ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirm Qualifies
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Confirm Does Not Qualify
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ApplicationActions({
  applicationId,
  status,
  documents,
}: ApplicationActionsProps) {
  const router = useRouter();

  const [isPending, startTransition] = React.useTransition();
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [confirmOutcome, setConfirmOutcome] = React.useState<
    "QUALIFIES" | "DOES_NOT_QUALIFY" | null
  >(null);

  // Hide the bar for terminal or pre-active statuses
  if (
    status === "PRE_SUBMISSION" ||
    status === "QUALIFIES" ||
    status === "DOES_NOT_QUALIFY"
  ) {
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

  function handleConfirmOutcome() {
    if (!confirmOutcome) return;
    startTransition(async () => {
      setActionError(null);
      const result = await setOutcome(applicationId, confirmOutcome);
      setConfirmOutcome(null);
      if (!result.success) {
        setActionError(result.error ?? "An unexpected error occurred.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: context label */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Actions</span>
            <ChevronRight
              className="h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <span className="text-sm text-slate-500">
              {STATUS_LABEL[status]}
            </span>
          </div>

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

            {/* COMPLETED → Set Qualifies | Set Does Not Qualify */}
            {status === "COMPLETED" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmOutcome("DOES_NOT_QUALIFY")}
                  disabled={isPending}
                  className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
                >
                  <XCircle className="h-4 w-4" />
                  Set Does Not Qualify
                </Button>
                <Button
                  size="sm"
                  onClick={() => setConfirmOutcome("QUALIFIES")}
                  disabled={isPending}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Set Qualifies
                </Button>
              </>
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

      {/* Outcome confirmation dialog (outside the actions bar so it overlays cleanly) */}
      {confirmOutcome && (
        <OutcomeConfirmDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setConfirmOutcome(null);
          }}
          outcome={confirmOutcome}
          isPending={isPending}
          onConfirm={handleConfirmOutcome}
        />
      )}
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<PrismaStatus, string> = {
  PRE_SUBMISSION: "Pre-submission",
  SUBMITTED: "Awaiting review",
  NOT_STARTED: "Review in progress",
  PAUSED: "Paused — awaiting documents",
  COMPLETED: "Assessment complete",
  QUALIFIES: "Qualifies",
  DOES_NOT_QUALIFY: "Does not qualify",
};
