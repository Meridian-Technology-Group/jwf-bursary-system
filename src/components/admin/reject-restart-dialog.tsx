"use client";

/**
 * RejectRestartDialog — Full Rejection.
 *
 * Triggered from the application detail actions bar. Lets an assessor reject a
 * submission outright and ask the applicant to start a fresh application from
 * scratch. This is destructive: it HARD-DELETES the current application (its
 * sections, documents and assessment) and creates a new blank one in its place
 * (see `rejectAndRestartApplication`). The applicant is emailed a link back into
 * the portal.
 *
 * Because the current application is deleted, on success we navigate away to the
 * queue (the old detail URL no longer exists).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
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
import { rejectAndRestartApplication } from "@/app/(admin)/applications/[id]/actions";

interface RejectRestartDialogProps {
  applicationId: string;
  /** Optional trigger element — if omitted a default button is rendered. */
  trigger?: React.ReactNode;
}

export function RejectRestartDialog({
  applicationId,
  trigger,
}: RejectRestartDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [customMessage, setCustomMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      setCustomMessage("");
      setError(null);
    }
    setOpen(next);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await rejectAndRestartApplication(
        applicationId,
        customMessage.trim() || undefined
      );
      if (result.success) {
        setOpen(false);
        // The current application was deleted — its detail page is gone.
        router.push("/queue");
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
            variant="outline"
            size="sm"
            className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reject &amp; Restart
          </Button>
        </DialogTrigger>
      )}

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
          {/* Destructive warning */}
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

          {/* Personal note */}
          <div className="space-y-1.5">
            <Label
              htmlFor="reject-message"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Note to applicant{" "}
              <span className="font-normal normal-case tracking-normal text-slate-400">
                (included in the email)
              </span>
            </Label>
            <Textarea
              id="reject-message"
              placeholder="Explain what was wrong and what they should address in their new application…"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
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
