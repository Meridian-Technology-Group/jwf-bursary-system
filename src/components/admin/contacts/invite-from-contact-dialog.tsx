"use client";

/**
 * "Send invitation from contact" — round picker + confirmation (Epic 04).
 *
 * Seeds a parent invite entirely from a contact's stored data. The round picker
 * lists LIVE (OPEN) rounds only; a confirmation summary names recipient / child
 * / school / entry year / round before the irreversible send, matching the
 * single-send + bulk-invite confirmation pattern.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { sendInvitationFromContactAction } from "@/app/(admin)/contacts/invite-actions";
import type { ContactListItem } from "@/lib/db/queries/contacts";

interface RoundOption {
  id: string;
  academicYear: string;
}

function schoolLabel(school: string): string {
  return school === "TRINITY" ? "Trinity School" : "Whitgift School";
}

export function InviteFromContactDialog({
  contact,
  liveRounds,
  open,
  onOpenChange,
}: {
  contact: ContactListItem | null;
  liveRounds: RoundOption[];
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [roundId, setRoundId] = useState<string>(liveRounds[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const useSegmented = liveRounds.length > 0 && liveRounds.length <= 2;
  const recipient =
    contact &&
    ([contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      contact.email);

  function reset() {
    setError(null);
    setSuccess(null);
    setRoundId(liveRounds[0]?.id ?? "");
  }

  function onSend() {
    if (!contact || !roundId) return;
    setError(null);
    startTransition(async () => {
      const result = await sendInvitationFromContactAction(contact.id, roundId);
      if (result.success) {
        setSuccess(`Invitation sent to ${contact.email}`);
        router.refresh();
        // Close shortly after so the admin sees the confirmation.
        setTimeout(() => {
          onOpenChange(false);
          reset();
        }, 900);
      } else {
        setError(result.error ?? "Failed to send invitation.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite this family to apply</DialogTitle>
          <DialogDescription>
            Sends a parent invite seeded from this contact. The school and entry
            year are locked — the parent cannot change them.
          </DialogDescription>
        </DialogHeader>

        {contact && (
          <div className="space-y-4">
            {/* Summary */}
            <dl className="grid grid-cols-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <dt className="col-span-1 text-slate-500">Parent</dt>
              <dd className="col-span-2 font-medium text-slate-800">
                {recipient}
              </dd>
              <dt className="col-span-1 text-slate-500">Child</dt>
              <dd className="col-span-2 text-slate-700">{contact.childName}</dd>
              <dt className="col-span-1 text-slate-500">School</dt>
              <dd className="col-span-2 text-slate-700">
                {schoolLabel(contact.school)}
              </dd>
              <dt className="col-span-1 text-slate-500">Entry year</dt>
              <dd className="col-span-2 text-slate-700">{contact.entryYear}</dd>
              <dt className="col-span-1 text-slate-500">Email</dt>
              <dd className="col-span-2 text-slate-700">{contact.email}</dd>
            </dl>

            {/* Round picker — live rounds only */}
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">
                Round
              </p>
              {liveRounds.length === 0 ? (
                <p className="text-sm text-amber-600">
                  No open round to invite into. Open a round first.
                </p>
              ) : useSegmented ? (
                <div
                  role="radiogroup"
                  aria-label="Application round"
                  className="inline-flex rounded-md border border-slate-200 p-0.5"
                >
                  {liveRounds.map((r) => {
                    const selected = roundId === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={isPending}
                        onClick={() => setRoundId(r.id)}
                        className={cn(
                          "min-w-[6rem] rounded px-4 py-1.5 text-sm font-medium transition-colors",
                          selected
                            ? "bg-primary-900 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {r.academicYear}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Select
                  value={roundId}
                  onValueChange={setRoundId}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select round" />
                  </SelectTrigger>
                  <SelectContent>
                    {liveRounds.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.academicYear}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSend}
            disabled={isPending || liveRounds.length === 0 || !roundId}
            className="gap-2"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {isPending ? "Sending…" : "Confirm & send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
