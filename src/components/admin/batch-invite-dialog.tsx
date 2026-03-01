"use client";

/**
 * Batch Invite Dialog
 *
 * Confirmation dialog for sending re-assessment invitations to all active
 * bursary holders not yet invited for a given round.
 */

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { batchReassessmentInviteAction } from "@/app/(admin)/invitations/actions";

interface BatchInviteDialogProps {
  roundId: string;
  academicYear: string;
  holderCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type Status = "idle" | "sending" | "done";

interface BatchResult {
  sent: number;
  failed: number;
  errors: string[];
}

export function BatchInviteDialog({
  roundId,
  academicYear,
  holderCount,
  open,
  onOpenChange,
  onComplete,
}: BatchInviteDialogProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<BatchResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    setStatus("sending");
    startTransition(async () => {
      const batchResult = await batchReassessmentInviteAction(roundId);
      setResult(batchResult);
      setStatus("done");
      onComplete?.();
    });
  }

  function handleClose() {
    if (isPending) return;
    setStatus("idle");
    setResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Batch Re-assessment Invitations</DialogTitle>
          <DialogDescription>
            {status === "idle" || status === "sending"
              ? `This will send reassessment invitations to ${holderCount} active bursary holder${holderCount !== 1 ? "s" : ""} not yet invited for round ${academicYear}.`
              : "Batch send complete."}
          </DialogDescription>
        </DialogHeader>

        {/* Idle state — confirmation details */}
        {status === "idle" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
            <p className="text-sm font-medium text-slate-700">Summary</p>
            <p className="text-sm text-slate-500">
              Round:{" "}
              <span className="font-medium text-slate-700">{academicYear}</span>
            </p>
            <p className="text-sm text-slate-500">
              Recipients:{" "}
              <span className="font-medium text-slate-700">{holderCount}</span>
            </p>
          </div>
        )}

        {/* Sending state */}
        {status === "sending" && (
          <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
              aria-hidden="true"
            />
            <p className="text-sm text-blue-700">
              Sending invitations&hellip; please wait.
            </p>
          </div>
        )}

        {/* Done state — results */}
        {status === "done" && result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
              <CheckCircle2
                className="h-4 w-4 text-green-600 shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm text-green-700">
                <span className="font-medium">{result.sent}</span> invitation
                {result.sent !== 1 ? "s" : ""} sent successfully.
              </p>
            </div>

            {result.failed > 0 && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle
                    className="h-4 w-4 text-red-600 shrink-0"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-red-700">
                    {result.failed} failed
                  </p>
                </div>
                {result.errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-red-600 font-mono">
                    {err}
                  </p>
                ))}
                {result.errors.length > 5 && (
                  <p className="text-xs text-red-500">
                    +{result.errors.length - 5} more errors
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {status === "done" ? (
            <Button onClick={handleClose}>Close</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={isPending || holderCount === 0}>
                {isPending ? "Sending..." : "Send All Invitations"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
