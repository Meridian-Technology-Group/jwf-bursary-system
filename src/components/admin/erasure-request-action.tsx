"use client";

/**
 * Erasure request (Epic 23 T10 — DPO-signed retention rule 3). ADMIN only,
 * for an application at the new-application stage (no bursary account).
 *
 * Step 1 explains what goes and what stays; step 2 asks for "ERASE" typed in.
 * The form and documents are deleted at once and the name and reference
 * anonymised ("XXXX"); the assessment is kept anonymous for 6 years. The server
 * refuses while retention purging is off on the environment.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eraser, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requestErasureAction } from "@/app/(admin)/applications/[id]/actions";

const CONFIRM_WORD = "ERASE";

export function ErasureRequestAction({ applicationId, reference }: { applicationId: string; reference: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2>(1);
  const [typed, setTyped] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function openDialog() {
    setStep(1);
    setTyped("");
    setError(null);
    setOpen(true);
  }

  function confirm() {
    startTransition(async () => {
      const r = await requestErasureAction(applicationId);
      if (r.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <div className="flex items-start gap-2">
        <Eraser className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-slate-800">Erasure request</p>
          <p className="text-xs text-slate-500">
            The parent asked for their data to be erased. The form and documents go now; the assessment is kept
            anonymous for 6 years.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 border-red-300 text-red-700 hover:bg-red-100 hover:border-red-400"
        onClick={openDialog}
      >
        <Eraser className="h-4 w-4" aria-hidden="true" />
        Erase on request…
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-700">Erasure request — {reference}</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          {step === 1 ? (
            <div className="space-y-3 py-2 text-sm text-slate-700">
              <p className="font-medium">Deleted now:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>The application form and every uploaded document</li>
                <li>The child&apos;s name, date of birth and the reference (shown as &ldquo;XXXX&rdquo;)</li>
                <li>The contact-register entry for this child, and the parent&apos;s login if nothing else of theirs is live</li>
              </ul>
              <p className="font-medium">Kept, anonymous, for 6 years:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>The assessment figures (its notes and synopsis are cleared)</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              <Label htmlFor="erase-confirm">
                Type <span className="font-mono font-semibold">{CONFIRM_WORD}</span> to confirm
              </Label>
              <Input id="erase-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            {step === 1 ? (
              <Button type="button" className="bg-red-600 text-white hover:bg-red-700" onClick={() => setStep(2)}>
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                className="gap-2 bg-red-600 text-white hover:bg-red-700"
                disabled={typed !== CONFIRM_WORD || isPending}
                onClick={confirm}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Erase
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
