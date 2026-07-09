"use client";

/**
 * ApplicationRowActions — the per-row action menu on the Applications list.
 *
 * Exposes the four case-management transitions the Foundation drives from the
 * list (state-model §4/§5/§6):
 *   • Reject           → void + recreate (rejectAndRestartApplication)
 *   • Move to active    → the school's OFFERED decision (AWARDED). Routes to the
 *                         recommendation page to capture the award £ figures.
 *   • Decline           → the school's DECLINED decision (DOES_NOT_QUALIFY);
 *                         closes/archives, data retained per the tiered-retention
 *                         policy (not purged here).
 *   • Withdraw account  → close the rolling BursaryAccount (withdrawBursaryAccount)
 *
 * Gating mirrors the server-side guards so disabled items explain themselves
 * rather than failing on click:
 *   - Reject          — only before a final outcome (form SUBMITTED, assessment
 *                       not yet COMPLETED, no outcome).
 *   - Move to active / Decline — only once the assessment is COMPLETED in full
 *                       and no outcome has been set yet.
 *   - Withdraw        — only when a (non-closed) bursary account exists.
 *
 * Dialogs are rendered controlled (not via DialogTrigger nested in a dropdown
 * item, which Radix warns against) — a single `activeDialog` state drives them.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  XCircle,
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
import { withdrawBursaryAccount } from "@/app/(admin)/applications/[id]/bursary-account-actions";
import { setApplicationAwardAction } from "@/app/(admin)/applications/[id]/recommendation/actions";
import type {
  ApplicationFormStatus,
  AssessmentStatus,
  AssessmentOutcome,
  BursaryAccountStatus,
} from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApplicationRowActionsProps {
  applicationId: string;
  reference: string;
  formStatus: ApplicationFormStatus;
  assessmentStatus: AssessmentStatus | null;
  outcome: AssessmentOutcome | null;
  bursaryAccountId: string | null;
  bursaryAccountStatus: BursaryAccountStatus | null;
}

type ActiveDialog = "reject" | "decline" | "withdraw" | null;

// ─── Component ──────────────────────────────────────────────────────────────────

export function ApplicationRowActions({
  applicationId,
  reference,
  formStatus,
  assessmentStatus,
  outcome,
  bursaryAccountId,
  bursaryAccountStatus,
}: ApplicationRowActionsProps) {
  const router = useRouter();
  const [activeDialog, setActiveDialog] = React.useState<ActiveDialog>(null);

  // Availability — kept in lock-step with the server guards.
  const hasOutcome = outcome != null;
  const assessmentComplete = assessmentStatus === "COMPLETED";
  // Reject: only before a final outcome, while the form is still submitted and
  // the assessment is reversible (not yet completed).
  const canReject =
    !hasOutcome && formStatus === "SUBMITTED" && !assessmentComplete;
  // Move to active / Decline: the assessment must be finished in full, and no
  // outcome recorded yet.
  const canDecide = assessmentComplete && !hasOutcome;
  // Withdraw: a live (non-closed) account must exist.
  const canWithdraw =
    bursaryAccountId != null && bursaryAccountStatus !== "CLOSED";

  const decideDisabledReason = hasOutcome
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
          {/* Decline — the school's DECLINED decision. */}
          <GatedItem
            enabled={canDecide}
            disabledReason={decideDisabledReason}
            onSelect={() => setActiveDialog("decline")}
            icon={<XCircle className="mr-2 h-4 w-4 text-rose-600" />}
            label="Decline"
          />

          <DropdownMenuSeparator />

          {/* Reject & restart. */}
          <GatedItem
            enabled={canReject}
            disabledReason="Only available before an outcome is set."
            onSelect={() => setActiveDialog("reject")}
            icon={<RotateCcw className="mr-2 h-4 w-4 text-rose-600" />}
            label="Reject & restart…"
          />
          {/* Withdraw the bursary account. */}
          <GatedItem
            enabled={canWithdraw}
            disabledReason={
              bursaryAccountId == null
                ? "No bursary account exists yet."
                : "The bursary account is already closed."
            }
            onSelect={() => setActiveDialog("withdraw")}
            icon={<Ban className="mr-2 h-4 w-4 text-rose-600" />}
            label="Withdraw account…"
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Controlled dialogs */}
      <RejectDialog
        applicationId={applicationId}
        open={activeDialog === "reject"}
        onOpenChange={(o) => setActiveDialog(o ? "reject" : null)}
        onDone={() => router.refresh()}
      />
      <DeclineDialog
        applicationId={applicationId}
        reference={reference}
        open={activeDialog === "decline"}
        onOpenChange={(o) => setActiveDialog(o ? "decline" : null)}
        onDone={() => router.refresh()}
      />
      {bursaryAccountId && (
        <WithdrawDialog
          accountId={bursaryAccountId}
          applicationId={applicationId}
          open={activeDialog === "withdraw"}
          onOpenChange={(o) => setActiveDialog(o ? "withdraw" : null)}
          onDone={() => router.refresh()}
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

// ─── Decline dialog ──────────────────────────────────────────────────────────

function DeclineDialog({
  applicationId,
  reference,
  open,
  onOpenChange,
  onDone,
}: ControlledDialogProps & { applicationId: string; reference: string }) {
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await setApplicationAwardAction(
        applicationId,
        "DOES_NOT_QUALIFY"
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-rose-700">
            Decline application {reference}
          </DialogTitle>
          <DialogDescription>
            Record the school&apos;s decision to decline. This sends the outcome
            email to the applicant and cannot be undone. The applicant&apos;s data
            is retained under the retention policy — it is not deleted now.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="py-1">
            <ErrorBanner message={error} />
          </div>
        )}

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
                Declining…
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Confirm decline
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Withdraw dialog ─────────────────────────────────────────────────────────

function WithdrawDialog({
  accountId,
  applicationId,
  open,
  onOpenChange,
  onDone,
}: ControlledDialogProps & { accountId: string; applicationId: string }) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  function confirm() {
    setError(null);
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please give a reason for withdrawing this account.");
      return;
    }
    startTransition(async () => {
      const result = await withdrawBursaryAccount({
        accountId,
        applicationId,
        reason: trimmed,
      });
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
            Withdraw &amp; close bursary account
          </DialogTitle>
          <DialogDescription>
            Use this to close the bursary account at any point. No documents are
            required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
              aria-hidden="true"
            />
            <p className="text-sm text-rose-700">
              This closes the bursary account and removes the family&apos;s access
              to the parent portal. A re-award re-activates the account and
              restores access.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="row-withdraw-reason"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Reason for withdrawal{" "}
              <span className="font-normal normal-case tracking-normal text-rose-500">
                (required)
              </span>
            </Label>
            <Textarea
              id="row-withdraw-reason"
              placeholder="Explain why this bursary account is being closed…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
                Withdrawing…
              </>
            ) : (
              <>
                <Ban className="h-4 w-4" aria-hidden="true" />
                Withdraw account
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
