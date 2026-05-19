"use client";

/**
 * Client wrapper for round detail page action buttons.
 * Houses the CloseRoundDialog + BatchInviteDialog state.
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CloseRoundDialog } from "./close-round-dialog";
import { OpenRoundDialog } from "./open-round-dialog";
import { BatchInviteDialog } from "./batch-invite-dialog";

interface RoundDetailActionsProps {
  roundId: string;
  academicYear: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  activeBursaryHolderCount: number;
}

export function RoundDetailActions({
  roundId,
  academicYear,
  status,
  activeBursaryHolderCount,
}: RoundDetailActionsProps) {
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Always show: navigate to invitations pre-filtered for this round */}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/invitations?roundId=${roundId}`}>
          Send Invitations
        </Link>
      </Button>

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

      {/* Batch re-assessment only when round is OPEN and there are holders */}
      {status === "OPEN" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBatchDialogOpen(true)}
        >
          Batch Re-assessment Invite
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

      <BatchInviteDialog
        roundId={roundId}
        academicYear={academicYear}
        holderCount={activeBursaryHolderCount}
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
      />
    </div>
  );
}
