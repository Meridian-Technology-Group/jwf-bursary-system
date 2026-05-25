"use client";

/**
 * Second-parent completeness gate (dual-parent feature, backlog #20, PR 5).
 *
 * Rendered on the assessment tab's "no assessment yet" state when the
 * application has a SECONDARY contributor that has NOT submitted and no
 * assessor override is in effect. Blocks "Begin assessment" with a clear
 * message + the secondary's current status, and offers a
 * "Proceed without second parent" control that captures a required reason and
 * calls `proceedWithoutSecondParentAction` (which sets the override + creates
 * the assessment, then the workspace opens).
 *
 * For applications with NO secondary, this component is NOT rendered — the
 * plain BeginAssessmentButton is shown, exactly as before.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { proceedWithoutSecondParentAction } from "@/app/(admin)/applications/[id]/assessment/actions";
import type { ApplicationContributorStatus } from "@prisma/client";

interface SecondParentGateProps {
  applicationId: string;
  secondaryStatus: ApplicationContributorStatus;
  secondaryName: string;
}

const STATUS_LABELS: Record<ApplicationContributorStatus, string> = {
  INVITED: "Invited — not yet started",
  IN_PROGRESS: "In progress — not yet submitted",
  SUBMITTED: "Submitted",
};

export function SecondParentGate({
  applicationId,
  secondaryStatus,
  secondaryName,
}: SecondParentGateProps) {
  const router = useRouter();
  const [showForm, setShowForm] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleProceed() {
    setError(null);
    startTransition(async () => {
      const result = await proceedWithoutSecondParentAction(
        applicationId,
        reason
      );
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 px-6 py-12 text-center shadow-sm">
      <AlertTriangle className="h-11 w-11 text-amber-400" aria-hidden="true" />
      <div className="max-w-md">
        <p className="text-base font-semibold text-slate-700">
          Waiting for the second parent
        </p>
        <p className="mt-1.5 text-sm text-slate-500">
          A second parent has been invited to provide their own financial
          details. The assessment cannot begin until they submit, unless you
          choose to proceed without them.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-700">
          <span className="text-slate-500">{secondaryName}:</span>
          {STATUS_LABELS[secondaryStatus]}
        </div>
      </div>

      {!showForm ? (
        <Button
          variant="outline"
          className="gap-2 border-amber-300 text-amber-800 hover:bg-amber-100"
          onClick={() => setShowForm(true)}
        >
          <UserX className="h-4 w-4" aria-hidden="true" />
          Proceed without second parent
        </Button>
      ) : (
        <div className="w-full max-w-md space-y-3 text-left">
          <div className="space-y-1.5">
            <Label
              htmlFor="override-reason"
              className="text-xs font-medium text-slate-600"
            >
              Reason for proceeding without the second parent
              <span className="text-red-500"> *</span>
            </Label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              rows={3}
              placeholder="e.g. Second parent did not respond to repeated invitations; assessing on the primary applicant's details only."
              className="text-sm"
            />
            <p className="text-xs text-slate-400">
              This is recorded on the assessment and audit-logged. The
              assessment will fall back to the primary applicant only
              (single-earner) mode.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleProceed}
              disabled={isPending || reason.trim().length < 3}
              className="gap-2 bg-amber-600 text-white hover:bg-amber-600/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Recording…
                </>
              ) : (
                "Confirm & begin assessment"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setReason("");
                setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
