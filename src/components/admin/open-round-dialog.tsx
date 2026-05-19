"use client";

/**
 * Open Round confirmation dialog.
 *
 * Prompts for confirmation before calling openRoundAction.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { openRoundAction } from "@/app/(admin)/rounds/actions";

interface OpenRoundDialogProps {
  roundId: string;
  academicYear: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenRoundDialog({
  roundId,
  academicYear,
  open,
  onOpenChange,
}: OpenRoundDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpen() {
    setError(null);
    startTransition(async () => {
      const result = await openRoundAction(roundId);
      if (result.success) {
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to open round.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open Round {academicYear}?</DialogTitle>
          <DialogDescription>
            This will set the round status to OPEN so applicants can begin
            submitting applications. Only one round can be OPEN at a time —
            close any other open round first.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-red-600 px-1">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleOpen} disabled={isPending}>
            {isPending ? "Opening..." : "Open Round"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
