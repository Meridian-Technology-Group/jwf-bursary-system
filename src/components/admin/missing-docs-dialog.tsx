"use client";

/**
 * MissingDocsDialog — WP-15
 *
 * Modal triggered by the "Request Missing Documents" button on the application
 * detail actions bar. Assessors select which document slots are outstanding,
 * optionally add a custom message, then click "Send Request" to:
 *   1. Pause the application (status → PAUSED)
 *   2. Fire a MISSING_DOCS email to the lead applicant
 *   3. Write an audit log entry
 *
 * The list of displayed slots is derived from ALL_DOCUMENT_SLOTS minus any
 * slots that already have a verified document uploaded.
 */

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { pauseApplication } from "@/app/(admin)/applications/[id]/actions";
import { ALL_DOCUMENT_SLOTS, humaniseSlot } from "@/lib/documents/slots";
import type { Document } from "@prisma/client";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MissingDocsDialogProps {
  applicationId: string;
  /** Existing documents already uploaded for this application */
  documents: Document[];
  /** Optional trigger element — if omitted a default button is rendered */
  trigger?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MissingDocsDialog({
  applicationId,
  documents,
  trigger,
}: MissingDocsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Pre-select slots that are either missing or not yet verified
  const verifiedSlots = new Set(
    documents.filter((d) => d.isVerified).map((d) => d.slot)
  );
  const uploadedSlots = new Set(documents.map((d) => d.slot));

  // Derive which slots are "missing" (not uploaded or not verified)
  const missingByDefault = ALL_DOCUMENT_SLOTS.filter(
    (slot) => !verifiedSlots.has(slot)
  );

  const [selectedSlots, setSelectedSlots] = React.useState<Set<string>>(
    new Set(missingByDefault)
  );
  const [customMessage, setCustomMessage] = React.useState("");

  // Reset state when dialog opens
  function handleOpenChange(next: boolean) {
    if (next) {
      setSelectedSlots(new Set(missingByDefault));
      setCustomMessage("");
      setSent(false);
      setError(null);
    }
    setOpen(next);
  }

  function toggleSlot(slot: string) {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) {
        next.delete(slot);
      } else {
        next.add(slot);
      }
      return next;
    });
  }

  function handleSend() {
    if (selectedSlots.size === 0) {
      setError("Please select at least one missing document.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await pauseApplication(
        applicationId,
        Array.from(selectedSlots),
        customMessage.trim() || undefined
      );

      if (result.success) {
        setSent(true);
        // Auto-close after 1.5 s so the user sees the confirmation
        setTimeout(() => setOpen(false), 1500);
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
          <Button variant="outline" size="sm" className="gap-2">
            <Mail className="h-4 w-4" aria-hidden="true" />
            Request Missing Documents
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-primary-900">
            Request Missing Documents
          </DialogTitle>
          <DialogDescription>
            Select the documents that are outstanding. The applicant will be
            notified by email and the application will be paused until the
            documents are received.
          </DialogDescription>
        </DialogHeader>

        {/* Success state */}
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium text-slate-700">
              Request sent successfully.
            </p>
            <p className="text-xs text-slate-500">
              The applicant has been emailed and the application is now paused.
            </p>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Slot checkboxes */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Document slots
              </p>
              <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
                {ALL_DOCUMENT_SLOTS.map((slot) => {
                  const isUploaded = uploadedSlots.has(slot);
                  const isVerified = verifiedSlots.has(slot);
                  const isChecked = selectedSlots.has(slot);

                  return (
                    <label
                      key={slot}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors select-none"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleSlot(slot)}
                        disabled={isPending}
                        id={`slot-${slot}`}
                        className="shrink-0"
                      />
                      <span className="flex-1 text-sm text-slate-700">
                        {humaniseSlot(slot)}
                      </span>
                      {/* Upload / verified indicators */}
                      {isVerified && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200 shrink-0">
                          Verified
                        </span>
                      )}
                      {isUploaded && !isVerified && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200 shrink-0">
                          Uploaded
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {selectedSlots.size} slot{selectedSlots.size !== 1 ? "s" : ""}{" "}
                selected
              </p>
            </div>

            {/* Custom message */}
            <div className="space-y-1.5">
              <Label
                htmlFor="custom-message"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Additional message{" "}
                <span className="font-normal normal-case tracking-normal text-slate-400">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="custom-message"
                placeholder="Provide any additional context or instructions for the applicant..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                disabled={isPending}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        )}

        {!sent && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={isPending || selectedSlots.size === 0}
              className="gap-2 bg-primary-700 hover:bg-primary-800"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
