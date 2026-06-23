"use client";

/**
 * WithdrawAccountDialog — F1 manual bursary-account withdrawal.
 *
 * Destructive confirm + reason capture, modelled on RejectRestartDialog. Lets an
 * assessor/admin close (withdraw) a bursary account at any time, at account
 * level, with no documents required. Closing the account revokes the parent's
 * portal access (see lib/bursary-accounts/access.ts).
 *
 * Rendered only for an ACTIVE account (the caller hides it once CLOSED). On
 * success we refresh the detail page so the schedule/account UI reflects the
 * new CLOSED state.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, Ban, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { withdrawBursaryAccount } from "@/app/(admin)/applications/[id]/bursary-account-actions";

interface WithdrawAccountDialogProps {
  accountId: string;
  applicationId: string;
  /** Optional trigger element — if omitted a default button is rendered. */
  trigger?: React.ReactNode;
}

export function WithdrawAccountDialog({
  accountId,
  applicationId,
  trigger,
}: WithdrawAccountDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      setReason("");
      setError(null);
    }
    setOpen(next);
  }

  function handleConfirm() {
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
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "An unexpected error occurred.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
            Withdraw account
          </Button>
        </DialogTrigger>
      )}

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
          {/* Destructive warning */}
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
              aria-hidden="true"
            />
            <p className="text-sm text-rose-700">
              This closes the bursary account and removes the family&apos;s
              access to the parent portal. A re-award re-activates the account
              and restores access.
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label
              htmlFor="withdraw-reason"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Reason for withdrawal{" "}
              <span className="font-normal normal-case tracking-normal text-rose-500">
                (required)
              </span>
            </Label>
            <Textarea
              id="withdraw-reason"
              placeholder="Explain why this bursary account is being closed…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
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
