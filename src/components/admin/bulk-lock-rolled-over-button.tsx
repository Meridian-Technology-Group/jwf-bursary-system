"use client";

/**
 * Epic 18b — the mid-September bulk lock (ADMIN only). Renders a button with
 * the eligible count, a confirm dialog spelling out the fund carry-forward
 * rule, and a skip-and-report summary afterwards. The server action re-derives
 * the eligible set authoritatively — the count here is display only.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bulkLockRolledOverAction,
  type BulkLockResult,
} from "@/app/(admin)/assessments/actions";

export function BulkLockRolledOverButton({ eligibleCount }: { eligibleCount: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [outcome, setOutcome] = React.useState<BulkLockResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (eligibleCount === 0 && !open) return null;

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    const res = await bulkLockRolledOverAction();
    setIsPending(false);
    if (res.success) {
      setOutcome(res.result);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setOutcome(null);
          setError(null);
          setOpen(true);
        }}
      >
        <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
        Lock rolled-over awards ({eligibleCount})
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock all rolled-over awards?</DialogTitle>
            <DialogDescription>
              Every rolling-over assessment currently stored as complete locks
              as a rolled-over award. Each award keeps the fund its account
              used last year (JWF where there is no previous award). No emails
              are sent. Locked awards can be reversed individually.
            </DialogDescription>
          </DialogHeader>

          {outcome && (
            <div className="space-y-1 text-sm" role="status">
              <p className="font-medium text-success-700">
                {outcome.locked} assessment{outcome.locked === 1 ? "" : "s"} locked.
              </p>
              {outcome.skipped.length > 0 && (
                <div className="text-amber-700">
                  <p className="font-medium">
                    {outcome.skipped.length} skipped:
                  </p>
                  <ul className="ml-4 list-disc">
                    {outcome.skipped.map((s) => (
                      <li key={s.reference}>
                        {s.reference} — {s.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
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
              {outcome ? "Done" : "Cancel"}
            </Button>
            {!outcome && (
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="bg-success-600 text-white hover:bg-success-600/90"
              >
                {isPending ? "Locking…" : "Lock all"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
