"use client";

/**
 * RejectRestartDialog — Application rejection (Epic 23 T7; renamed from
 * Return for correction on Charlotte's 17 Oct 2026 testing). The component
 * keeps its name.
 *
 * Sends a submitted application back to the family with a NEW Submit by
 * (required; pre-filled with the later of the current deadline and today + 7
 * days). The email box opens with the Application Rejection template from
 * Settings, this family's details filled in; staff add the specifics and what
 * they send is the email. The uploaded documents are listed by group (17 Oct
 * 2026): staff tick a whole group or single files to remove with the
 * rejection, and clear wrong answers afterwards through Edit on behalf. See
 * `rejectAndRestartApplication`.
 *
 * Uncontrolled (own trigger) on the application and assessment pages; the
 * applications table row drives it controlled (`open` / `onOpenChange`).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, Loader2, RotateCcw } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getRejectionDraft,
  rejectAndRestartApplication,
} from "@/app/(admin)/applications/[id]/actions";
import {
  REJECTION_DOCUMENT_GROUPS,
  type RejectionDocument,
} from "@/lib/documents/section-grouping";

interface RejectRestartDialogProps {
  applicationId: string;
  /** Optional trigger element — if omitted a default button is rendered. */
  trigger?: React.ReactNode;
  /** Controlled mode (the table row): no trigger is rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called after a successful return (defaults to refreshing the page). */
  onDone?: () => void;
}

/** Tomorrow in the viewer's calendar, `yyyy-MM-dd` (the input's `min`). */
function tomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RejectRestartDialog({
  applicationId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onDone,
}: RejectRestartDialogProps) {
  const router = useRouter();
  const controlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlled ? controlledOpen : uncontrolledOpen;
  const [isPending, startTransition] = React.useTransition();
  const [emailBody, setEmailBody] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [submitBy, setSubmitBy] = React.useState("");
  const [documents, setDocuments] = React.useState<RejectionDocument[]>([]);
  const [removeIds, setRemoveIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  function toggleDocs(ids: string[], on: boolean) {
    setRemoveIds((prev) =>
      on ? Array.from(new Set(prev.concat(ids))) : prev.filter((id) => !ids.includes(id))
    );
  }

  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  }

  // Reset and pre-fill each time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setEmailBody("");
    setError(null);
    setSubmitBy("");
    setDocuments([]);
    setRemoveIds([]);
    setLoading(true);
    let live = true;
    getRejectionDraft(applicationId)
      .then((draft) => {
        if (!live) return;
        setSubmitBy((v) => v || draft.submitBy);
        setEmailBody((v) => v || draft.body);
        setDocuments(draft.documents);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [open, applicationId]);

  function handleConfirm() {
    setError(null);
    if (!submitBy) {
      setError("Enter the new submit-by date.");
      return;
    }
    if (!emailBody.trim()) {
      setError("Write the email to the family.");
      return;
    }
    startTransition(async () => {
      const result = await rejectAndRestartApplication(applicationId, emailBody, submitBy, removeIds);
      if (result.success) {
        setOpen(false);
        if (onDone) onDone();
        else router.refresh();
      } else {
        setError(result.error ?? "An unexpected error occurred.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Application rejection
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-rose-700">Application rejection</DialogTitle>
          <DialogDescription>
            The form goes back to the family, who must complete it again and
            resubmit by the new date. The email below is the only one they get.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
            <p className="text-sm text-sky-800">
              Tick below the documents to remove with the rejection. To clear
              answers that are not acceptable, open <strong>Edit on behalf</strong>{" "}
              on the application page afterwards. Those sections then show as
              incomplete to the family. Any review in progress goes back to Not
              started.
            </p>
          </div>

          {documents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Documents to remove{" "}
                <span className="font-normal normal-case tracking-normal text-slate-400">
                  ({removeIds.length} of {documents.length} ticked; deleted when you reject)
                </span>
              </p>
              <div className="max-h-56 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-3">
                {REJECTION_DOCUMENT_GROUPS.map((g) => {
                  const inGroup = documents.filter((d) => d.group === g.key);
                  if (inGroup.length === 0) return null;
                  const ids = inGroup.map((d) => d.id);
                  const ticked = ids.filter((id) => removeIds.includes(id)).length;
                  const groupId = `reject-group-${g.key}`;
                  return (
                    <div key={g.key} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={groupId}
                          checked={ticked === ids.length ? true : ticked > 0 ? "indeterminate" : false}
                          onCheckedChange={(v) => toggleDocs(ids, v === true)}
                          disabled={isPending}
                        />
                        <Label htmlFor={groupId} className="text-sm font-medium">
                          {g.label} ({ids.length})
                        </Label>
                      </div>
                      <ul className="ml-6 space-y-1">
                        {inGroup.map((d) => {
                          const docId = `reject-doc-${d.id}`;
                          return (
                            <li key={d.id} className="flex items-center gap-2">
                              <Checkbox
                                id={docId}
                                checked={removeIds.includes(d.id)}
                                onCheckedChange={(v) => toggleDocs([d.id], v === true)}
                                disabled={isPending}
                              />
                              <Label htmlFor={docId} className="truncate text-xs font-normal text-slate-700">
                                {d.filename}
                              </Label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="return-submit-by"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              New submit-by date
            </Label>
            <Input
              id="return-submit-by"
              type="date"
              required
              min={tomorrowKey()}
              value={submitBy}
              onChange={(e) => setSubmitBy(e.target.value)}
              disabled={isPending}
              className="w-48"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="reject-message"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Email to the family{" "}
              <span className="font-normal normal-case tracking-normal text-slate-400">
                (from Settings &gt; Email templates &gt; Application Rejection)
              </span>
            </Label>
            <Textarea
              id="reject-message"
              placeholder={loading ? "Loading the template…" : "Write the email to the family…"}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              disabled={isPending || loading}
              rows={14}
              className="text-sm"
            />
            {emailBody.includes("{{deadline}}") && (
              <p className="text-xs text-slate-500">
                {"{{deadline}}"} becomes the new submit-by date when the email is sent.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || loading || !submitBy || !emailBody.trim()}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Rejecting…
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reject and email the family
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
