"use client";

/**
 * Epic 21 #4 — the Assessment Admin page's "End after this year" and
 * "Add a year" controls (her conditional bursary, 11 Oct 2026). ADMIN only
 * (the page renders them conditionally). Each opens a dialog that says exactly
 * which years are removed or added and asks for a reason, which is audited.
 * A disabled button says why in its tooltip.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarMinus, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addScheduleYearAction,
  endScheduleAfterYearAction,
} from "@/app/(admin)/applications/[id]/schedule-actions";
import type {
  ScheduleAddControl,
  ScheduleEndControl,
} from "@/lib/bursary-accounts/schedule";

type Mode = "end" | "add";

export function ScheduleEndAddControls({
  applicationId,
  end,
  add,
}: {
  applicationId: string;
  end: ScheduleEndControl;
  add: ScheduleAddControl;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode | null>(null);
  const [reason, setReason] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function openDialog(next: Mode) {
    setReason("");
    setError(null);
    setMode(next);
  }

  async function handleConfirm() {
    if (reason.trim().length < 3) {
      setError("Please give a reason.");
      return;
    }
    setIsPending(true);
    setError(null);
    const action = mode === "end" ? endScheduleAfterYearAction : addScheduleYearAction;
    const result = await action({ applicationId, reason });
    setIsPending(false);
    if (result.success) {
      setMode(null);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <span title={end.enabled ? undefined : end.why}>
        <Button
          type="button"
          variant="outline"
          disabled={!end.enabled}
          onClick={() => openDialog("end")}
        >
          <CalendarMinus className="mr-2 h-4 w-4" aria-hidden="true" />
          End after this year
        </Button>
      </span>
      <span title={add.enabled ? undefined : add.why}>
        <Button
          type="button"
          variant="outline"
          disabled={!add.enabled}
          onClick={() => openDialog("add")}
        >
          <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add a year
        </Button>
      </span>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            {mode === "end" && end.enabled && (
              <>
                <DialogTitle>End the schedule after {end.thisYear}?</DialogTitle>
                <DialogDescription>
                  These years will be removed from the schedule:{" "}
                  <strong>{end.removedYears.join(", ")}</strong>. The family
                  will not be invited to re-apply for them, and the account
                  closes as usual once {end.thisYear} is complete. You can add
                  a year back later. No email is sent.
                </DialogDescription>
              </>
            )}
            {mode === "add" && add.enabled && (
              <>
                <DialogTitle>Add {add.addedYear} to the schedule?</DialogTitle>
                <DialogDescription>
                  {add.addedYear} will be added as a scheduled year, so the
                  family can be invited to re-apply for it.
                  {add.reopens &&
                    " The account is closed, so it will be re-opened and the family's portal access returns."}{" "}
                  No email is sent.
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="schedule-change-reason">Reason</Label>
            <Textarea
              id="schedule-change-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={
                mode === "end"
                  ? "e.g. Conditional bursary for one year, agreed by the Headmaster"
                  : "e.g. Headmaster extended the award"
              }
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMode(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={isPending || reason.trim().length < 3}>
              {isPending
                ? "Saving…"
                : mode === "end"
                  ? "End schedule"
                  : "Add a year"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
