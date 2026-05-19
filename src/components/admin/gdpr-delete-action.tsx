"use client";

/**
 * GdprDeleteAction — destructive action affordance that mounts the
 * GdprDeleteDialog.
 *
 * Rendered on the application detail layout for ADMIN users only. Provides
 * the only UI surface for invoking `gdprDeleteApplicantAction`
 * (Article 17 erasure). Two-step confirmation is handled inside the dialog.
 *
 * On successful deletion the application has been anonymised in-place; we
 * redirect to the applications queue rather than reloading a now-empty
 * record.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GdprDeleteDialog } from "@/components/admin/gdpr-delete-dialog";

interface GdprDeleteActionProps {
  applicationId: string;
  reference: string;
  documentCount: number;
}

export function GdprDeleteAction({
  applicationId,
  reference,
  documentCount,
}: GdprDeleteActionProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/40 px-6 py-4 shadow-sm mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <ShieldAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-red-800">
              Destructive actions
            </p>
            <p className="text-xs text-red-700/80">
              GDPR right-to-erasure removes personal data permanently. Subject
              to a 7-year retention guard.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 border-red-300 text-red-700 hover:bg-red-100 hover:border-red-400"
          onClick={() => setOpen(true)}
        >
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          Delete (GDPR)
        </Button>
      </div>

      <GdprDeleteDialog
        applicationId={applicationId}
        reference={reference}
        // Names are not revealed in the SSR payload for this layout (see
        // getApplicationWithDetails). The dialog uses childName only as a
        // visual aid in the summary copy; the reference uniquely identifies
        // the record. Passing a non-revealing placeholder avoids triggering
        // an audit-logged NAME_REVEAL just to render the confirmation modal.
        childName="this applicant"
        documentCount={documentCount}
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => {
          // The lead applicant profile has been anonymised and the
          // application stripped of personal data; the detail view is no
          // longer meaningful. Return to the queue.
          router.push("/queue");
          router.refresh();
        }}
      />
    </div>
  );
}
