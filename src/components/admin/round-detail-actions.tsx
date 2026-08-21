"use client";

/**
 * Client wrapper for round detail page action buttons.
 * Houses the CloseRoundDialog + OpenRoundDialog state.
 *
 * Re-assessment invites are no longer initiated from here — they live in the
 * `/queue` bulk-action system (select the eligible holders' applications, then
 * "Send re-assessment invite"). Use the "Re-assessment eligible" queue filter
 * to find the candidates.
 */

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseRoundDialog } from "./close-round-dialog";
import { OpenRoundDialog } from "./open-round-dialog";
import { EditRoundDatesButton } from "./edit-round-dialog";

interface RoundDetailActionsProps {
  roundId: string;
  academicYear: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  /** ISO yyyy-MM-dd strings for the edit-dates dialog. */
  openDate: string;
  closeDate: string;
  decisionDate: string;
  /** ISO yyyy-MM-dd, or "" when the round has no default (Item 12). */
  defaultSubmissionDeadlineNew: string;
  defaultSubmissionDeadlineRolling: string;
}

export function RoundDetailActions({
  roundId,
  academicYear,
  status,
  openDate,
  closeDate,
  decisionDate,
  defaultSubmissionDeadlineNew,
  defaultSubmissionDeadlineRolling,
}: RoundDetailActionsProps) {
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);

  // ── Closed rounds are archived: read-only actions only. No inviting/closing;
  //    just navigate to the report and the export archive. ──────────────────────
  if (status === "CLOSED") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports">
            <BarChart3 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            View report
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/exports?roundId=${roundId}`}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Export archive
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Navigate to invitations pre-filtered for this round (non-closed only) */}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/invitations?roundId=${roundId}`}>
          Send Invitations
        </Link>
      </Button>

      {/* Edit / extend dates (DRAFT + OPEN). Extending closeDate keeps an OPEN
          round open longer; cockpit pacing & Rule 8 recompute from the field. */}
      <EditRoundDatesButton
        roundId={roundId}
        academicYear={academicYear}
        status={status}
        openDate={openDate}
        closeDate={closeDate}
        decisionDate={decisionDate}
        defaultSubmissionDeadlineNew={defaultSubmissionDeadlineNew}
        defaultSubmissionDeadlineRolling={defaultSubmissionDeadlineRolling}
      />

      {/* Open round (DRAFT only) */}
      {status === "DRAFT" && (
        <Button
          variant="outline"
          size="sm"
          className="text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
          onClick={() => setOpenDialogOpen(true)}
        >
          Open Round
        </Button>
      )}

      {/* Close round */}
      {status === "OPEN" && (
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={() => setCloseDialogOpen(true)}
        >
          Close Round
        </Button>
      )}

      <CloseRoundDialog
        roundId={roundId}
        academicYear={academicYear}
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
      />

      <OpenRoundDialog
        roundId={roundId}
        academicYear={academicYear}
        open={openDialogOpen}
        onOpenChange={setOpenDialogOpen}
      />
    </div>
  );
}
