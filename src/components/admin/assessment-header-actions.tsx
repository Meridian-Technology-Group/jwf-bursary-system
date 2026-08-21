"use client";

/**
 * Assessment-header action buttons — Epic 15 W2 (CH-03, `ch-image003`).
 *
 * Charlotte's compressed header row carries the assessment's working actions:
 * REJECT & RESTART · REQUEST MISSING DOCUMENTS · SEE COMPUTATION (MANAGE is
 * the existing disclosure, mounted beside this by the layout). The two
 * dialogs are the SAME components the old Actions row used — placement only;
 * they render only while the review is active (phase NOT_STARTED), exactly
 * as before. SEE COMPUTATION deep-links to the model tab with `?see=1`,
 * which the SeeComputationToggle honours.
 */

import Link from "next/link";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MissingDocsDialog } from "@/components/admin/missing-docs-dialog";
import { RejectRestartDialog } from "@/components/admin/reject-restart-dialog";
import type { Document } from "@prisma/client";
import type { ReviewPhase } from "@/lib/applications/status";

export function AssessmentHeaderActions({
  applicationId,
  status,
  documents,
}: {
  applicationId: string;
  status: ReviewPhase;
  documents: Document[];
}) {
  const reviewActive = status === "NOT_STARTED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {reviewActive && (
        <>
          <RejectRestartDialog
            applicationId={applicationId}
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50"
              >
                Reject &amp; Restart
              </Button>
            }
          />
          <MissingDocsDialog
            applicationId={applicationId}
            documents={documents}
            trigger={
              <Button variant="outline" size="sm" className="gap-2 border-slate-300">
                Request Missing Documents
              </Button>
            }
          />
        </>
      )}
      <Button
        asChild
        variant="outline"
        size="sm"
        className="gap-1.5 border-slate-300 text-xs font-semibold uppercase tracking-wide text-slate-600"
      >
        <Link href={`/applications/${applicationId}/assessment?see=1`}>
          <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
          See computation
        </Link>
      </Button>
    </div>
  );
}
