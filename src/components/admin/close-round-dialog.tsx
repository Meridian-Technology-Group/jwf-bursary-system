"use client";

/**
 * Close Round confirmation dialog.
 *
 * Prompts for confirmation before calling closeRoundAction.
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
import { closeRoundAction } from "@/app/(admin)/rounds/actions";

interface CloseRoundDialogProps {
  roundId: string;
  academicYear: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CloseRoundDialog({
  roundId,
  academicYear,
  open,
  onOpenChange,
}: CloseRoundDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClose() {
    setError(null);
    startTransition(async () => {
      const result = await closeRoundAction(roundId);
      if (result.success) {
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to close round.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close Round {academicYear}?</DialogTitle>
          <DialogDescription>
            This will set the round status to CLOSED. Applications can no longer
            be submitted. This action cannot be undone.
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
          <Button
            variant="destructive"
            onClick={handleClose}
            disabled={isPending}
          >
            {isPending ? "Closing..." : "Close Round"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
