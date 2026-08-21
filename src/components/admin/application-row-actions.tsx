"use client";

/**
 * ApplicationRowActions — the per-row action menu on the Applications list.
 *
 * Exposes the case-management transitions the Foundation drives from the list
 * (state-model §4/§5/§6, revised by item 2's unified close):
 *   • Move to active    → the school's OFFERED decision (AWARDED). Routes to the
 *                         recommendation page to capture the award £ figures.
 *   • Reject           → void + recreate (rejectAndRestartApplication)
 *   • Close…            → item 2's SINGLE terminal state, ADMIN-only, driven by
 *                         an admin-configured close reason whose purgeOnClose
 *                         flag decides purge-vs-retain. REPLACES the old
 *                         Decline (outcome write) and Withdraw-account items —
 *                         a school decline is now Close with the matching
 *                         reason (D-3: no outcome coupling), and a live account
 *                         is wound down inside the close.
 *
 * Gating mirrors the server-side guards so disabled items explain themselves
 * rather than failing on click:
 *   - Reject          — only before a final outcome (form SUBMITTED, assessment
 *                       not yet COMPLETED, no outcome), and not closed.
 *   - Move to active  — only once the assessment is COMPLETED in full and no
 *                       outcome has been set yet, and not closed.
 *   - Close…          — ADMIN only (hidden otherwise); never offered on an
 *                       already-closed application (no double-close).
 *
 * Dialogs are rendered controlled (not via DialogTrigger nested in a dropdown
 * item, which Radix warns against) — a single `activeDialog` state drives them.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { rejectAndRestartApplication } from "@/app/(admin)/applications/[id]/actions";
import {
  CloseApplicationDialog,
  type CloseReasonOption,
} from "@/components/admin/close-application-dialog";
import type {
  ApplicationFormStatus,
  AssessmentStatus,
  AssessmentOutcome,
} from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApplicationRowActionsProps {
  applicationId: string;
  reference: string;
  formStatus: ApplicationFormStatus;
  assessmentStatus: AssessmentStatus | null;
  outcome: AssessmentOutcome | null;
  /** Unified close marker (item 2) — non-null hides every transition. */
  closedAt: Date | null;
  /** Close is ADMIN-only (Story 2.1); the item is hidden for other roles. */
  isAdmin: boolean;
  /** Active close reasons for the Close dialog (item 4.1). */
  closeReasons: CloseReasonOption[];
}

type ActiveDialog = "reject" | "close" | null;

// ─── Component ──────────────────────────────────────────────────────────────────

export function ApplicationRowActions({
  applicationId,
  reference,
  formStatus,
  assessmentStatus,
  outcome,
  closedAt,
  isAdmin,
  closeReasons,
}: ApplicationRowActionsProps) {
  const router = useRouter();
  const [activeDialog, setActiveDialog] = React.useState<ActiveDialog>(null);

  // Availability — kept in lock-step with the server guards.
  const isClosed = closedAt != null;
  const hasOutcome = outcome != null;
  const assessmentComplete = assessmentStatus === "COMPLETED";
  // Reject: only before a final outcome, while the form is still submitted and
  // the assessment is reversible (not yet completed), and not closed.
  const canReject =
    !isClosed && !hasOutcome && formStatus === "SUBMITTED" && !assessmentComplete;
  // Move to active: the assessment must be finished in full, and no outcome
  // recorded yet, and not closed.
  const canDecide = !isClosed && assessmentComplete && !hasOutcome;
  // Close: ADMIN-only; never re-offered on an already-closed application.
  const canClose = isAdmin && !isClosed;

  const decideDisabledReason = isClosed
    ? "This application is closed."
    : hasOutcome
      ? "An outcome has already been recorded."
      : "The assessment must be completed in full first.";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => e.stopPropagation()}
            aria-label="Application actions"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Move to active bursary — routes to the recommendation page to
              capture the award figures (the OFFERED decision). */}
          <GatedItem
            enabled={canDecide}
            disabledReason={decideDisabledReason}
            onSelect={() =>
              router.push(`/applications/${applicationId}/recommendation`)
            }
            icon={<CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
            label="Move to active bursary…"
          />
          <DropdownMenuSeparator />

          {/* Reject & restart. */}
          <GatedItem
            enabled={canReject}
            disabledReason={
              isClosed
                ? "This application is closed."
                : "Only available before an outcome is set."
            }
            onSelect={() => setActiveDialog("reject")}
            icon={<RotateCcw className="mr-2 h-4 w-4 text-rose-600" />}
            label="Reject & restart…"
          />
          {/* Unified close (item 2) — ADMIN only, hidden for other roles. */}
          {isAdmin && canClose && (
            <GatedItem
              enabled
              disabledReason=""
              onSelect={() => setActiveDialog("close")}
              icon={<Archive className="mr-2 h-4 w-4 text-rose-600" />}
              label="Close…"
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Controlled dialogs */}
      <RejectDialog
        applicationId={applicationId}
        open={activeDialog === "reject"}
        onOpenChange={(o) => setActiveDialog(o ? "reject" : null)}
        onDone={() => router.refresh()}
      />
      {isAdmin && (
        <CloseApplicationDialog
          applicationId={applicationId}
          reference={reference}
          reasons={closeReasons}
          open={activeDialog === "close"}
          onOpenChange={(o) => setActiveDialog(o ? "close" : null)}
        />
      )}
    </>
  );
}

// ─── Gated dropdown item ─────────────────────────────────────────────────────

function GatedItem({
  enabled,
  disabledReason,
  onSelect,
  icon,
  label,
}: {
  enabled: boolean;
  disabledReason: string;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  if (enabled) {
    return (
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          onSelect();
        }}
      >
        {icon}
        {label}
      </DropdownMenuItem>
    );
  }
  // Disabled: explain why on hover. A plain disabled DropdownMenuItem swallows
  // pointer events, so wrap it and let the tooltip sit on the wrapper.
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <DropdownMenuItem
              disabled
              onSelect={(e) => e.preventDefault()}
              className="opacity-50"
            >
              {icon}
              {label}
            </DropdownMenuItem>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-56 text-xs">
          {disabledReason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Shared dialog scaffolding ───────────────────────────────────────────────

interface ControlledDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

// ─── Reject dialog ───────────────────────────────────────────────────────────

function RejectDialog({
  applicationId,
  open,
  onOpenChange,
  onDone,
}: ControlledDialogProps & { applicationId: string }) {
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setMessage("");
      setError(null);
    }
  }, [open]);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await rejectAndRestartApplication(
        applicationId,
        message.trim() || undefined
      );
      if (result.success) {
        onOpenChange(false);
        onDone();
      } else {
        setError(result.error ?? "An unexpected error occurred.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-rose-700">
            Reject application &amp; ask applicant to restart
          </DialogTitle>
          <DialogDescription>
            Use this when the whole submission is invalid and the applicant needs
            to start again from scratch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
              aria-hidden="true"
            />
            <p className="text-sm text-rose-700">
              This permanently clears all uploaded documents and the current
              submission, and creates a fresh blank application for the applicant
              to complete. The current submission cannot be recovered.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="row-reject-message"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Note to applicant{" "}
              <span className="font-normal normal-case tracking-normal text-slate-400">
                (included in the email)
              </span>
            </Label>
            <Textarea
              id="row-reject-message"
              placeholder="Explain what was wrong and what they should address in their new application…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isPending}
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          {error && <ErrorBanner message={error} />}
        </div>

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
            onClick={confirm}
            disabled={isPending}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Rejecting…
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reject &amp; Restart
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared error banner ─────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}
