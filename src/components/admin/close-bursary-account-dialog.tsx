"use client";

/**
 * Epic 18b — the Assessment Admin page's "close active bursary account"
 * control (her April–May leavers window). ADMIN only (the page renders it
 * conditionally); requires a structured close reason, same convention as the
 * application close dialog.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { closeBursaryAccountAction } from "@/app/(admin)/applications/[id]/bursary-account-actions";

export function CloseBursaryAccountDialog({
  bursaryAccountId,
  applicationId,
  closeReasons,
}: {
  bursaryAccountId: string;
  applicationId: string;
  closeReasons: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reasonId, setReasonId] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleConfirm() {
    if (!reasonId) {
      setError("Please select a close reason.");
      return;
    }
    setIsPending(true);
    setError(null);
    const result = await closeBursaryAccountAction({
      bursaryAccountId,
      closeReasonId: reasonId,
      applicationId,
    });
    setIsPending(false);
    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={() => {
          setReasonId("");
          setError(null);
          setOpen(true);
        }}
      >
        <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
        Close bursary account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this bursary account?</DialogTitle>
            <DialogDescription>
              The account closes with today&apos;s date and the reason you
              select, the remaining schedule years stop being administered,
              and the family&apos;s portal access ends. No email is sent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="account-close-reason">Close reason</Label>
            <Select value={reasonId} onValueChange={setReasonId}>
              <SelectTrigger id="account-close-reason">
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {closeReasons.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isPending || !reasonId}
              className="bg-red-600 text-white hover:bg-red-600/90"
            >
              {isPending ? "Closing…" : "Close account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
