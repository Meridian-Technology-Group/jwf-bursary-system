"use client";

/**
 * SubmitConfirmDialog — the explicit confirmation gate on submission (D4/CF-32).
 *
 * Rendered only on the Declaration section. `SectionPageClient` opens it from
 * INSIDE the save (after react-hook-form has validated), awaits the answer, and
 * only then calls `submitApplication`. So: nothing is written on a cancel, and
 * no submission can happen without the applicant answering this question.
 *
 * Dismissing by Escape or by clicking the overlay resolves as a cancel — Radix
 * routes all three through `onOpenChange(false)`, so there is no way to close
 * this without the promise settling (which would wedge the form in "Saving…").
 */

import * as React from "react";
import { AlertTriangle, Loader2, Send } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SUBMIT_APPLICATION_LABEL } from "@/lib/portal/declaration-submit";

interface SubmitConfirmDialogProps {
  open: boolean;
  /** Settles the awaiting save: `true` submits, `false` cancels. */
  onResolve: (confirmed: boolean) => void;
}

export function SubmitConfirmDialog({
  open,
  onResolve,
}: SubmitConfirmDialogProps) {
  // Once confirmed, the submission runs while this dialog animates away. Keep
  // the button in a pending state so a double-click cannot resolve twice.
  const [submitting, setSubmitting] = React.useState(false);

  // Reset when the gate re-opens (e.g. the applicant cancelled, fixed
  // something, and pressed Submit again).
  React.useEffect(() => {
    if (open) setSubmitting(false);
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onResolve(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className="h-5 w-5 shrink-0 text-warning-600"
              aria-hidden="true"
            />
            Submit your application?
          </DialogTitle>
          <DialogDescription>
            This sends your application to the John Whitgift Foundation for
            assessment. You will not be able to change your answers afterwards,
            and we will email you a confirmation.
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-slate-600">
          If you would rather check your answers first, choose{" "}
          <span className="font-medium text-slate-800">Go back</span> and use the{" "}
          <span className="font-medium text-slate-800">Review</span> button —
          nothing is submitted until you confirm here.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onResolve(false)}
          >
            Go back
          </Button>
          <Button
            type="button"
            disabled={submitting}
            onClick={() => {
              setSubmitting(true);
              onResolve(true);
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" />
                {SUBMIT_APPLICATION_LABEL}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
