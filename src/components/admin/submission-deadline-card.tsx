"use client";

/**
 * Submission Deadline card (Epic 03).
 *
 * Admin control to grant an individual applicant a later (or earlier) submit-by
 * date than the round's close date. Shows the EFFECTIVE deadline with a clear
 * marker for whether it is a per-application override or inherited from the
 * round. Calls `setSubmissionDeadlineAction` (set or clear).
 *
 * The effective deadline shown here is the single source of truth that Epic 05's
 * parent countdown / lockout and the submit guard also read
 * (effectiveSubmissionDeadline). This card only edits the raw override.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setSubmissionDeadlineAction } from "@/app/(admin)/applications/[id]/actions";

interface SubmissionDeadlineCardProps {
  applicationId: string;
  /** Current per-application override as an ISO string, or null. */
  submissionDeadlineAt: string | null;
  /** The round close date (ISO) shown as the inherited fallback. */
  roundCloseDate: string;
  /** Pre-computed effective deadline (ISO) + whether it is an override. */
  effectiveDeadline: string;
  isOverride: boolean;
}

/** Converts an ISO instant to the `datetime-local` input value (local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatDisplay(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SubmissionDeadlineCard({
  applicationId,
  submissionDeadlineAt,
  roundCloseDate,
  effectiveDeadline,
  isOverride,
}: SubmissionDeadlineCardProps) {
  const router = useRouter();
  const [value, setValue] = useState<string>(toLocalInput(submissionDeadlineAt));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(deadlineIso: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await setSubmissionDeadlineAction(applicationId, deadlineIso);
      if (!result.success) {
        setError(result.error ?? "Failed to update deadline.");
        return;
      }
      router.refresh();
    });
  }

  function handleSave() {
    if (!value) {
      setError("Pick a date/time, or use Clear to revert to the round.");
      return;
    }
    // datetime-local has no timezone; treat it as local and send an ISO instant.
    const iso = new Date(value).toISOString();
    save(iso);
  }

  return (
    <Card>
      <CardHeader className="bg-neutral-50 px-6 py-4 border-b border-neutral-100">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CalendarClock className="h-4 w-4 text-slate-500" aria-hidden="true" />
          Submission deadline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
        <div className="text-sm text-slate-600">
          <span className="text-slate-500">Effective deadline: </span>
          <span className="font-medium text-slate-800">
            {formatDisplay(effectiveDeadline)}
          </span>{" "}
          {isOverride ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Override
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              From round close ({formatDisplay(roundCloseDate)})
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="submission-deadline"
              className="text-xs font-medium text-slate-500"
            >
              Override submit-by date/time
            </label>
            <Input
              id="submission-deadline"
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isPending}
              className="w-[15rem]"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Set override"}
          </Button>
          {submissionDeadlineAt && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setValue("");
                save(null);
              }}
              disabled={isPending}
            >
              Clear (use round)
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-slate-400">
          Grants this applicant a different deadline to submit their form. Does
          not affect the round close date or other applicants.
        </p>
      </CardContent>
    </Card>
  );
}
