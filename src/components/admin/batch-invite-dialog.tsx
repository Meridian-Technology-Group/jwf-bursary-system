"use client";

/**
 * Re-assessment Invite Dialog (selective)
 *
 * Lets staff pick WHICH active bursary holders to re-invite for a round
 * (previously all-or-nothing). Renders one checkbox row per eligible holder
 * with a select-all/none control and a live selected count, then calls
 * `reassessmentInviteSelectedAction(roundId, selectedIds)`.
 */

import { useMemo, useState, useTransition } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { reassessmentInviteSelectedAction } from "@/app/(admin)/invitations/actions";

export interface BatchInviteHolder {
  /** BursaryAccount id — the value sent to the action. */
  id: string;
  reference: string;
  childName: string;
  school: string;
  applicantName: string;
  email: string;
}

interface BatchInviteDialogProps {
  roundId: string;
  academicYear: string;
  holders: BatchInviteHolder[];
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
  holders,
  open,
  onOpenChange,
  onComplete,
}: BatchInviteDialogProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<BatchResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const selectedCount = selectedIds.size;
  const allSelected = holders.length > 0 && selectedCount === holders.length;
  const noneEligible = holders.length === 0;

  const sortedHolders = useMemo(
    () => [...holders].sort((a, b) => a.reference.localeCompare(b.reference)),
    [holders]
  );

  function toggleHolder(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === holders.length
        ? new Set()
        : new Set(holders.map((h) => h.id))
    );
  }

  function handleSend() {
    if (selectedCount === 0) return;
    setStatus("sending");
    startTransition(async () => {
      const inviteResult = await reassessmentInviteSelectedAction(
        roundId,
        Array.from(selectedIds)
      );
      setResult(inviteResult);
      setStatus("done");
      onComplete?.();
    });
  }

  function handleClose() {
    if (isPending) return;
    setStatus("idle");
    setResult(null);
    setSelectedIds(new Set());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Re-assessment invites</DialogTitle>
          <DialogDescription>
            {status === "done"
              ? "Send complete."
              : noneEligible
                ? `No eligible holders for round ${academicYear}.`
                : `Pick which active bursary holders to re-invite for round ${academicYear}.`}
          </DialogDescription>
        </DialogHeader>

        {/* Idle state — selectable checklist */}
        {status === "idle" && (
          <>
            {noneEligible ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                All active bursary holders have already been invited for this
                round.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-sm font-medium text-primary-700 hover:text-primary-900 hover:underline"
                  >
                    {allSelected ? "Select none" : "Select all"}
                  </button>
                  <span className="text-sm text-slate-500">
                    <span className="font-medium text-slate-700">
                      {selectedCount}
                    </span>{" "}
                    selected
                  </span>
                </div>

                <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1">
                  {sortedHolders.map((holder) => {
                    const checked = selectedIds.has(holder.id);
                    return (
                      <li key={holder.id}>
                        <label
                          className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 hover:bg-slate-50"
                          htmlFor={`holder-${holder.id}`}
                        >
                          <Checkbox
                            id={`holder-${holder.id}`}
                            checked={checked}
                            onCheckedChange={() => toggleHolder(holder.id)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-mono text-xs font-medium text-slate-700">
                                {holder.reference}
                              </span>
                              <span className="text-sm font-medium text-slate-800">
                                {holder.childName}
                              </span>
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {holder.applicantName} · {holder.school}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
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

            {/* Surface a "nothing happened" case where the action returned an
                errors-only result with zero sent (e.g. "No eligible holders
                selected"). */}
            {result.sent === 0 && result.failed === 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-sm text-slate-600">
                    {err}
                  </p>
                ))}
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
              <Button
                onClick={handleSend}
                disabled={isPending || selectedCount === 0}
              >
                {isPending
                  ? "Sending..."
                  : `Send ${selectedCount} re-assessment invite${selectedCount !== 1 ? "s" : ""}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
