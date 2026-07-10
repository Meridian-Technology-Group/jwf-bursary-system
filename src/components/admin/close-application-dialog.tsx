"use client";

/**
 * CloseApplicationDialog — the unified application close (item 2).
 *
 * ADMIN-only. Requires a close reason from the admin-configured dropdown
 * (item 4.1 — no free text, no close without a reason); the selected reason's
 * `purgeOnClose` flag drives the confirmation copy: a purge-flagged reason
 * shows the destructive warning with the retained-vs-removed split from the
 * canonical scrub map, a non-purge reason shows neutral retain copy
 * (Story 2.2). Modelled on WithdrawAccountDialog, which this replaces.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, Archive, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { closeApplicationAction } from "@/app/(admin)/applications/[id]/actions";
import { CLOSE_PURGE_SUMMARY } from "@/lib/retention/scrub-map";

export interface CloseReasonOption {
  id: string;
  label: string;
  purgeOnClose: boolean;
}

interface CloseApplicationDialogProps {
  applicationId: string;
  reference: string;
  reasons: CloseReasonOption[];
  /** Optional trigger element — if omitted a default button is rendered. */
  trigger?: React.ReactNode;
  /** Called after a successful close (e.g. to close a parent dropdown). */
  onClosed?: () => void;
  /**
   * Controlled mode (for use under a dropdown, where nesting a DialogTrigger
   * is a Radix anti-pattern): pass `open` + `onOpenChange` and no trigger is
   * rendered. Uncontrolled with a trigger otherwise.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CloseApplicationDialog({
  applicationId,
  reference,
  reasons,
  trigger,
  onClosed,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CloseApplicationDialogProps) {
  const router = useRouter();
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const [isPending, startTransition] = React.useTransition();
  const [reasonId, setReasonId] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  const selected = reasons.find((r) => r.id === reasonId) ?? null;

  function setOpen(next: boolean) {
    if (isControlled) controlledOnOpenChange?.(next);
    else setUncontrolledOpen(next);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setReasonId("");
      setError(null);
    }
    setOpen(next);
  }

  function handleConfirm() {
    setError(null);
    if (!reasonId) {
      setError("Please select a close reason.");
      return;
    }
    startTransition(async () => {
      const result = await closeApplicationAction(applicationId, reasonId);
      if (result.success) {
        setOpen(false);
        onClosed?.();
        router.refresh();
      } else {
        setError(result.error ?? "An unexpected error occurred.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled &&
        (trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : (
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              Close application
            </Button>
          </DialogTrigger>
        ))}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-rose-700">
            Close application {reference}
          </DialogTitle>
          <DialogDescription>
            Closing is the single terminal state for an application. Whether
            the applicant&apos;s data is retained or removed is decided by the
            close reason you choose.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Reason (required, admin-configured — item 4.1) */}
          <div className="space-y-1.5">
            <Label
              htmlFor="close-reason"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Close reason{" "}
              <span className="font-normal normal-case tracking-normal text-rose-500">
                (required)
              </span>
            </Label>
            <Select
              value={reasonId}
              onValueChange={setReasonId}
              disabled={isPending || reasons.length === 0}
            >
              <SelectTrigger id="close-reason" className="w-full">
                <SelectValue
                  placeholder={
                    reasons.length === 0
                      ? "No active close reasons configured"
                      : "Select a reason…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reason) => (
                  <SelectItem key={reason.id} value={reason.id}>
                    {reason.label}
                    {reason.purgeOnClose ? " — removes personal data" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reasons.length === 0 && (
              <p className="text-xs text-slate-500">
                An ADMIN can add close reasons under Settings → Close Reasons.
              </p>
            )}
          </div>

          {/* Reason-driven consequence copy (Story 2.2 / 3.3) */}
          {selected &&
            (selected.purgeOnClose ? (
              <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-rose-700">
                    &ldquo;{selected.label}&rdquo; permanently removes personal
                    data. This cannot be undone.
                  </p>
                </div>
                <div className="grid gap-2 pl-6 text-xs text-rose-800 sm:grid-cols-2">
                  <div>
                    <p className="font-semibold">Removed:</p>
                    <ul className="list-disc pl-4">
                      {CLOSE_PURGE_SUMMARY.scrubbed.slice(0, 4).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">Retained:</p>
                    <ul className="list-disc pl-4">
                      {CLOSE_PURGE_SUMMARY.retained.slice(0, 4).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="pl-6 text-xs text-rose-700">
                  The retained assessment synopsis is kept exactly as written —
                  check it contains no personal details before closing.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <p className="text-sm text-slate-600">
                  All data is retained under the normal retention policy. A live
                  bursary account is closed with the application, which removes
                  the family&apos;s portal access.
                </p>
              </div>
            ))}

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
            disabled={isPending || !reasonId}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Closing…
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" aria-hidden="true" />
                {selected?.purgeOnClose
                  ? "Close & remove data"
                  : "Close application"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
