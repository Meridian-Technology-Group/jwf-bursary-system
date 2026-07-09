"use client";

/**
 * EditReferenceDialog — item 11, Story 11.1/11.2.
 *
 * ADMIN-only affordance to edit an application's bursary reference at any
 * point in its lifecycle (no state-gating). The value is preserved verbatim —
 * whitespace and special characters are significant, so the input is NOT
 * trimmed or normalised client-side beyond the emptiness check the server
 * already enforces. Inline errors surface the server's blank/duplicate
 * validation (updateApplicationReferenceAction, applications/[id]/actions.ts).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateApplicationReferenceAction } from "@/app/(admin)/applications/[id]/actions";

interface EditReferenceDialogProps {
  applicationId: string;
  currentReference: string;
  /** Optional trigger element — if omitted a default icon button is rendered. */
  trigger?: React.ReactNode;
}

export function EditReferenceDialog({
  applicationId,
  currentReference,
  trigger,
}: EditReferenceDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [value, setValue] = React.useState(currentReference);
  const [error, setError] = React.useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      setValue(currentReference);
      setError(null);
    }
    setOpen(next);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateApplicationReferenceAction(
        applicationId,
        value
      );
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "An unexpected error occurred.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-slate-400 hover:text-primary-700"
            aria-label="Edit bursary reference"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit bursary reference</DialogTitle>
          <DialogDescription>
            The reference can be changed at any point in the application&apos;s
            lifecycle. It must be unique (case-insensitive) across all
            applications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="edit-reference-input"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Bursary reference
            </Label>
            <Input
              id="edit-reference-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isPending}
              className="font-mono"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
