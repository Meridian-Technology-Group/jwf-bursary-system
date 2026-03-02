"use client";

/**
 * Round table row action buttons (Edit / Close).
 * Extracted as a client component because CloseRoundDialog requires state.
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CloseRoundDialog } from "./close-round-dialog";

interface RoundActionsCellProps {
  roundId: string;
  academicYear: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
}

export function RoundActionsCell({
  roundId,
  academicYear,
  status,
}: RoundActionsCellProps) {
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/rounds/${roundId}`}>View</Link>
      </Button>

      {status === "OPEN" && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={() => setCloseDialogOpen(true)}
          >
            Close
          </Button>
          <CloseRoundDialog
            roundId={roundId}
            academicYear={academicYear}
            open={closeDialogOpen}
            onOpenChange={setCloseDialogOpen}
          />
        </>
      )}
    </div>
  );
}
