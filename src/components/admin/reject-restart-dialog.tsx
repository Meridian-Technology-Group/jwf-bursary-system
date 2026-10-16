"use client";

/**
 * RejectRestartDialog — Return for correction (Epic 23 T7; Charlotte, 16 Oct
 * 2026). The component keeps its name; the action is no longer destructive.
 *
 * Sends a submitted application back to the family with every answer and
 * document kept, a note explaining what to correct, and a NEW Submit by
 * (required; pre-filled with the later of the current deadline and today + 7
 * days). The family is emailed and sees a "returned for correction" banner.
 * Staff then remove the specific bad items through edit-on-behalf so the
 * gaps show. See `rejectAndRestartApplication`.
 *
 * Uncontrolled (own trigger) on the application and assessment pages; the
 * applications table row drives it controlled (`open` / `onOpenChange`).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, Loader2, RotateCcw } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  getReturnSubmitByDefault,
  rejectAndRestartApplication,
} from "@/app/(admin)/applications/[id]/actions";

interface RejectRestartDialogProps {
  applicationId: string;
  /** Optional trigger element — if omitted a default button is rendered. */
  trigger?: React.ReactNode;
  /** Controlled mode (the table row): no trigger is rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called after a successful return (defaults to refreshing the page). */
  onDone?: () => void;
}

/** Tomorrow in the viewer's calendar, `yyyy-MM-dd` (the input's `min`). */
function tomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RejectRestartDialog({
  applicationId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onDone,
}: RejectRestartDialogProps) {
  const router = useRouter();
  const controlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlled ? controlledOpen : uncontrolledOpen;
  const [isPending, startTransition] = React.useTransition();
  const [customMessage, setCustomMessage] = React.useState("");
  const [submitBy, setSubmitBy] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  }

  // Reset and pre-fill each time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setCustomMessage("");
    setError(null);
    setSubmitBy("");
    let live = true;
    getReturnSubmitByDefault(applicationId)
      .then((d) => {
        if (live) setSubmitBy((v) => v || d);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, applicationId]);

  function handleConfirm() {
    setError(null);
    if (!submitBy) {
      setError("Enter the new submit-by date.");
      return;
    }
    startTransition(async () => {
      const result = await rejectAndRestartApplication(
        applicationId,
        customMessage.trim() || undefined,
        submitBy
      );
      if (result.success) {
        setOpen(false);
        if (onDone) onDone();
        else router.refresh();
      } else {
        setError(result.error ?? "An unexpected error occurred.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Return for correction
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-rose-700">Return application for correction</DialogTitle>
          <DialogDescription>
            The family gets their answers and documents back with your note, and
            must correct the form and resubmit by the new date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
            <p className="text-sm text-sky-800">
              Nothing is deleted. To make a gap show, remove the wrong document or
              clear the wrong figure on the family&apos;s behalf (Edit form), or mark
              a section as needing correction. Any review in progress goes back to
              Not started.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="return-submit-by"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              New submit-by date
            </Label>
            <Input
              id="return-submit-by"
              type="date"
              required
              min={tomorrowKey()}
              value={submitBy}
              onChange={(e) => setSubmitBy(e.target.value)}
              disabled={isPending}
              className="w-48"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="reject-message"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Note to the family{" "}
              <span className="font-normal normal-case tracking-normal text-slate-400">
                (in the email and on their application)
              </span>
            </Label>
            <Textarea
              id="reject-message"
              placeholder="Explain what needs correcting, e.g. the P60 is for the wrong year…"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              disabled={isPending}
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || !submitBy}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Returning…
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Return for correction
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
