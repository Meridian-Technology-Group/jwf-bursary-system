"use client";

/**
 * GDPR Delete Dialog
 *
 * Two-step modal for permanently deleting / anonymising an applicant's personal
 * data in compliance with GDPR right-to-erasure requests.
 *
 * Step 1: Summary of what will be deleted, anonymised, and retained.
 * Step 2: Type "DELETE" to confirm, then click the destructive button.
 *
 * Only accessible for terminal-status applications by ASSESSOR users.
 */

import { useState, useTransition } from "react";
import {
  Trash2,
  ShieldAlert,
  CheckCircle2,
  MinusCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gdprDeleteApplicantAction } from "@/app/(admin)/applications/[id]/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GdprDeleteDialogProps {
  /** The application ID to delete */
  applicationId: string;
  /** Human-readable reference (e.g. JWF-2024-001) */
  reference: string;
  /** Anonymised child name shown in the summary */
  childName: string;
  /** Number of uploaded documents that will be erased */
  documentCount: number;
  /** Controlled open state */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
}

// ─── Confirmation word ────────────────────────────────────────────────────────

const CONFIRM_WORD = "DELETE";

// ─── Summary item components ──────────────────────────────────────────────────

function DeleteItem({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <Trash2
        className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
        aria-hidden="true"
      />
      <span className="text-slate-700">{label}</span>
    </li>
  );
}

function AnonymiseItem({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <MinusCircle
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
        aria-hidden="true"
      />
      <span className="text-slate-700">{label}</span>
    </li>
  );
}

function RetainItem({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <CheckCircle2
        className="mt-0.5 h-4 w-4 shrink-0 text-green-500"
        aria-hidden="true"
      />
      <span className="text-slate-700">{label}</span>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GdprDeleteDialog({
  applicationId,
  reference,
  childName,
  documentCount,
  open,
  onOpenChange,
}: GdprDeleteDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmInput, setConfirmInput] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm = confirmInput === CONFIRM_WORD && !isPending;

  function handleClose() {
    if (isPending) return;
    setStep(1);
    setConfirmInput("");
    setServerError(null);
    onOpenChange(false);
  }

  function handleConfirm() {
    if (!canConfirm) return;
    setServerError(null);

    startTransition(async () => {
      const result = await gdprDeleteApplicantAction(applicationId);
      if (!result.success) {
        setServerError(
          result.error ?? "An unexpected error occurred. Please try again."
        );
      } else {
        handleClose();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {/* ── Step 1: Summary ─────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                GDPR Data Deletion — {reference}
              </DialogTitle>
              <DialogDescription>
                This will permanently erase personal data for{" "}
                <strong>{childName}</strong> in compliance with GDPR right-to-erasure.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* What will be DELETED */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-600">
                  Permanently deleted
                </p>
                <ul className="space-y-1.5">
                  <DeleteItem label="All application section form data" />
                  <DeleteItem
                    label={`${documentCount} uploaded document${documentCount !== 1 ? "s" : ""} (DB records + Storage files)`}
                  />
                  <DeleteItem label="Assessment data (earners, property, checklists)" />
                  <DeleteItem label="Recommendation and reason-code selections" />
                  <DeleteItem label="Invitation records" />
                </ul>
              </div>

              {/* What will be ANONYMISED */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                  Anonymised (replaced with placeholder values)
                </p>
                <ul className="space-y-1.5">
                  <AnonymiseItem label="Profile: name, email, phone — replaced with anonymised values; role set to DELETED" />
                  <AnonymiseItem label="Application: child name replaced with '[Child Removed]', date of birth cleared" />
                  <AnonymiseItem label="Audit log: user references set to null (actions are retained)" />
                </ul>
              </div>

              {/* What will be RETAINED */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-600">
                  Retained (non-personal aggregate data)
                </p>
                <ul className="space-y-1.5">
                  <RetainItem label="Round data and academic year statistics" />
                  <RetainItem label="Reason code definitions" />
                  <RetainItem label="Anonymised audit trail entries" />
                </ul>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setStep(2)}
              >
                Proceed to Confirmation
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 2: Type DELETE to confirm ──────────────────────────── */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                Confirm Permanent Deletion
              </DialogTitle>
              <DialogDescription>
                To permanently delete all personal data for application{" "}
                <strong>{reference}</strong>, type{" "}
                <strong className="font-mono text-red-700">{CONFIRM_WORD}</strong>{" "}
                in the box below and click the button.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <strong>Warning:</strong> This action is irreversible. Personal
                data cannot be recovered after deletion.
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gdpr-confirm-input">
                  Type{" "}
                  <span className="font-mono font-semibold">{CONFIRM_WORD}</span>{" "}
                  to confirm
                </Label>
                <Input
                  id="gdpr-confirm-input"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  disabled={isPending}
                  autoComplete="off"
                  className="font-mono"
                />
              </div>

              {serverError && (
                <p className="text-sm text-red-600">{serverError}</p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setConfirmInput("");
                  setServerError(null);
                }}
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Permanently Delete Data
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
