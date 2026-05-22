"use client";

/**
 * Client island for the "Respond to a missing-documents request" page.
 *
 * Renders one `FileUpload` per requested slot (reusing the exact upload
 * mechanic from the application form), tracks which slots now have a file,
 * and submits via `submitMissingDocsResponse` once every requested item is
 * filled in. On success it swaps to a confirmation panel.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  Send,
} from "lucide-react";
import { FileUpload, type UploadedDocument } from "@/components/portal/file-upload";
import { Button } from "@/components/ui/button";
import { humaniseSlot } from "@/lib/documents/slots";
import { submitMissingDocsResponse } from "@/app/(portal)/actions";

interface ExistingDoc {
  id: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;
}

interface RespondMissingDocsClientProps {
  applicationId: string;
  requestedSlots: string[];
  customMessage: string | null;
  existingBySlot: Record<string, ExistingDoc>;
}

/**
 * Splits a slot's human label into a primary document name and an optional
 * "Parent N" qualifier so the page can render e.g.
 * "Bank Statement — Parent 1" as the guide describes.
 */
function slotLabel(slot: string): { primary: string; qualifier: string | null } {
  const match = slot.match(/_PARENT_(\d)$/);
  if (match) {
    const base = slot.replace(/_PARENT_\d$/, "");
    return {
      primary: humaniseSlot(base),
      qualifier: `Parent ${match[1]}`,
    };
  }
  return { primary: humaniseSlot(slot), qualifier: null };
}

export function RespondMissingDocsClient({
  applicationId,
  requestedSlots,
  customMessage,
  existingBySlot,
}: RespondMissingDocsClientProps) {
  const router = useRouter();

  // Track which requested slots currently have at least one uploaded file.
  const [filledSlots, setFilledSlots] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const slot of requestedSlots) {
      if (existingBySlot[slot]) initial.add(slot);
    }
    return initial;
  });

  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  const allFilled = requestedSlots.every((slot) => filledSlots.has(slot));
  const remaining = requestedSlots.filter((slot) => !filledSlots.has(slot)).length;

  function markFilled(slot: string) {
    setFilledSlots((prev) => {
      const next = new Set(prev);
      next.add(slot);
      return next;
    });
  }

  function markEmpty(slot: string) {
    setFilledSlots((prev) => {
      const next = new Set(prev);
      next.delete(slot);
      return next;
    });
  }

  function handleSend() {
    if (!allFilled) {
      setError("Please upload every requested document before sending.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitMissingDocsResponse(applicationId);
      if (result.success) {
        setSent(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  // ── Confirmation ────────────────────────────────────────────────────────────
  if (sent) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-green-900">
          Sent to the assessor
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-green-800">
          Thank you. Your documents have been sent and your application has
          returned to <span className="font-medium">Under Review</span>. There
          is nothing more for you to do — the bursary team will pick it back up
          and let you know the outcome.
        </p>
        <div className="mt-6">
          <Link
            href="/status"
            className="inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100 transition-colors"
          >
            View application status
          </Link>
        </div>
      </div>
    );
  }

  // ── Request + uploads ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Intro / instructions */}
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
        <p className="text-sm text-yellow-900">
          An assessor needs a little more from you before your application can
          continue. Please add each requested document below, then click{" "}
          <span className="font-medium">Send to assessor</span>.
        </p>
        {customMessage && (
          <div className="mt-3 flex gap-2 rounded-md border border-yellow-200 bg-white/70 p-3">
            <MessageSquareText
              className="mt-0.5 h-4 w-4 shrink-0 text-yellow-700"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
                Note from the assessor
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-yellow-900">
                {customMessage}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Requested items */}
      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Requested documents
          </h2>
          <span className="text-xs font-medium text-slate-500">
            {filledSlots.size} of {requestedSlots.length} added
          </span>
        </div>

        <ul className="space-y-6">
          {requestedSlots.map((slot) => {
            const { primary, qualifier } = slotLabel(slot);
            const label = qualifier ? `${primary} — ${qualifier}` : primary;
            const existing = existingBySlot[slot];
            return (
              <li key={slot}>
                <FileUpload
                  slot={slot}
                  label={label}
                  applicationId={applicationId}
                  existingDocument={existing}
                  disabled={isPending}
                  onUploadComplete={(_doc: UploadedDocument) => markFilled(slot)}
                  onRemove={() => markEmpty(slot)}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Submit */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {allFilled
            ? "All requested documents are ready to send."
            : `${remaining} document${remaining === 1 ? "" : "s"} still to upload.`}
        </p>
        <Button
          type="button"
          onClick={handleSend}
          disabled={isPending || !allFilled}
          className="gap-2 bg-primary-700 hover:bg-primary-800"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              Send to assessor
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
