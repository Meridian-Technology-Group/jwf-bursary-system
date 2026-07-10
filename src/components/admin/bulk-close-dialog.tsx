"use client";

/**
 * BulkCloseDialog — the bulk counterpart of CloseApplicationDialog (Story 3.2).
 *
 * Requires ONE close reason (item 4.1/4.2 — no free text) applied to the
 * WHOLE selected batch; the reason's `purgeOnClose` flag drives the same
 * destructive-vs-retain confirmation copy as the per-row dialog (Story 3.3),
 * scaled to "N applications". After the batch runs, the dialog switches to a
 * result view listing succeeded/skipped counts and each skipped row's reason
 * (Story 3.2's per-row result summary) — the compact top-of-page feedback
 * banner has no room for that detail.
 *
 * Selection is deliberately only cleared/refreshed when the admin
 * acknowledges the result (Done) — clearing it earlier would unmount this
 * dialog along with the rest of the bulk toolbar (which is only rendered
 * while `selectedIds.length > 0`) before the result could be read.
 */

import * as React from "react";
import { AlertCircle, AlertTriangle, Archive, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  bulkCloseApplicationsAction,
  type BulkResultRow,
} from "@/app/(admin)/applications/[id]/actions";
import { CLOSE_PURGE_SUMMARY } from "@/lib/retention/scrub-map";
import type { CloseReasonOption } from "@/components/admin/close-application-dialog";

interface BulkCloseDialogProps {
  selectedIds: string[];
  isPending: boolean;
  run: (fn: () => Promise<void>) => void;
  reasons: CloseReasonOption[];
  /** Clears the selection + refreshes the list — called only from Done. */
  onActionComplete: () => void;
}

type Phase = "select" | "result";

export function BulkCloseDialog({
  selectedIds,
  isPending,
  run,
  reasons,
  onActionComplete,
}: BulkCloseDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [reasonId, setReasonId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>("select");
  const [result, setResult] = React.useState<{
    succeeded: number;
    skipped: BulkResultRow[];
  } | null>(null);

  const count = selectedIds.length;
  const selected = reasons.find((r) => r.id === reasonId) ?? null;

  function resetState() {
    setReasonId("");
    setError(null);
    setPhase("select");
    setResult(null);
  }

  function handleOpenChange(next: boolean) {
    // Cancelling preserves the selection (Story 3.3's AC) — nothing is
    // cleared until the explicit Done button on the result view.
    setOpen(next);
    if (!next) resetState();
  }

  function handleConfirm() {
    setError(null);
    if (!reasonId) {
      setError("Please select a close reason.");
      return;
    }
    run(async () => {
      const res = await bulkCloseApplicationsAction(selectedIds, reasonId);
      if (!res.success) {
        setError(res.error ?? "An unexpected error occurred.");
        return;
      }
      setResult({ succeeded: res.succeeded, skipped: res.skipped });
      setPhase("result");
    });
  }

  function handleDone() {
    setOpen(false);
    resetState();
    onActionComplete();
  }

  const batchTotal = (result?.succeeded ?? 0) + (result?.skipped.length ?? 0);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending || count === 0}
        onClick={() => setOpen(true)}
        className="h-8 shrink-0 whitespace-nowrap border-rose-300 bg-white text-xs text-rose-700 hover:bg-rose-50"
      >
        <Archive className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Close
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          {phase === "select" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-rose-700">
                  Close {count} application{count === 1 ? "" : "s"}
                </DialogTitle>
                <DialogDescription>
                  Closing is the single terminal state for an application. The
                  reason you choose applies to every selected application and
                  decides whether their data is retained or removed.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Reason (required, admin-configured, one for the whole batch — item 4.2) */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="bulk-close-reason"
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
                    <SelectTrigger id="bulk-close-reason" className="w-full">
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
                      An ADMIN can add close reasons under Settings → Close
                      Reasons.
                    </p>
                  )}
                </div>

                {/* Reason-driven consequence copy, scaled to the batch (Story 3.3) */}
                {selected &&
                  (selected.purgeOnClose ? (
                    <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
                          aria-hidden="true"
                        />
                        <p className="text-sm font-medium text-rose-700">
                          Closing {count} application{count === 1 ? "" : "s"}{" "}
                          with &ldquo;{selected.label}&rdquo; permanently
                          removes personal data. This cannot be undone.
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
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-slate-600">
                        Closing {count} application{count === 1 ? "" : "s"}{" "}
                        with &ldquo;{selected.label}&rdquo; retains all data
                        under the normal retention policy. Any live bursary
                        accounts are closed with their applications.
                      </p>
                    </div>
                  ))}

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
                        : "Close applications"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Batch close complete</DialogTitle>
                <DialogDescription>
                  Closed {result?.succeeded ?? 0} of {batchTotal} selected
                  application{batchTotal === 1 ? "" : "s"}.
                </DialogDescription>
              </DialogHeader>

              {result && result.skipped.length > 0 && (
                <div className="space-y-1.5 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Skipped ({result.skipped.length})
                  </p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {result.skipped.map((row) => (
                      <li key={row.id}>
                        <span className="font-mono text-xs">{row.reference}</span>{" "}
                        — {row.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <DialogFooter>
                <Button type="button" onClick={handleDone}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
