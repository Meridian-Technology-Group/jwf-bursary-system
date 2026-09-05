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
import { entryAcademicYearLabelOrNull } from "@/lib/schools/academic-year";

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
  defaultBcc,
}: {
  contact: ContactListItem | null;
  liveRounds: RoundOption[];
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /**
   * CH-32 — the address pre-filled into the BCC box, resolved on the server by
   * `inviteBccAddress()`. Undefined outside production unless
   * `RESEND_INVITE_BCC_EMAIL` is set, so a test send never copies the client's
   * live mailbox.
   */
  defaultBcc?: string;
}) {
  const [roundId, setRoundId] = useState<string>(liveRounds[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Epic 15 X2 (CI-04): create without emailing; the link is shown to copy.
  const [skipEmail, setSkipEmail] = useState(false);
  // CH-32 — option (1): pre-filled with the bursary inbox, shown and clearable.
  const [bcc, setBcc] = useState(defaultBcc ?? "");
  const [registrationLink, setRegistrationLink] = useState<string | null>(null);
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
    setSkipEmail(false);
    setBcc(defaultBcc ?? "");
    setRegistrationLink(null);
    setRoundId(liveRounds[0]?.id ?? "");
  }

  function onSend() {
    if (!contact || !roundId) return;
    setError(null);
    startTransition(async () => {
      const result = await sendInvitationFromContactAction(contact.id, roundId, {
        skipEmail,
        // CH-32 — ignored server-side when skipEmail is set; not sent at all
        // here so the intent is unambiguous in the request itself.
        bcc: skipEmail ? undefined : bcc.trim() || undefined,
      });
      if (result.success) {
        router.refresh();
        if (result.registrationLink) {
          // CI-04: keep the dialog open so the admin can copy the link.
          setRegistrationLink(result.registrationLink);
          setSuccess(
            `Invitation created for ${contact.email} — no email sent. Copy the link below.`
          );
        } else {
          setSuccess(`Invitation sent to ${contact.email}`);
          // Close shortly after so the admin sees the confirmation.
          setTimeout(() => {
            onOpenChange(false);
            reset();
          }, 900);
        }
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
            Sends a parent invite seeded from this contact. The school and
            academic year are locked — the parent cannot change them.
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
              <dt className="col-span-1 text-slate-500">Academic year</dt>
              <dd className="col-span-2 text-slate-700">
                {entryAcademicYearLabelOrNull(contact.entryYear) ?? "—"}
              </dd>
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

            {/* Epic 15 X2 (CI-04) */}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={skipEmail}
                onChange={(e) => setSkipEmail(e.target.checked)}
                disabled={isPending || registrationLink != null}
                className="h-4 w-4 rounded border-slate-300"
              />
              Don&apos;t email — I&apos;ll send the registration link myself
            </label>

            {/* CH-32 — BCC on this individual invite. Hidden when the admin has
                chosen not to email at all: there is no send to copy. */}
            {!skipEmail && registrationLink == null && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <label htmlFor="contact-invite-bcc" className="font-medium">
                  BCC (optional):
                </label>
                <input
                  id="contact-invite-bcc"
                  type="email"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. fees@johnwhitgiftfoundation.org"
                  className="h-7 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 font-mono text-xs text-slate-700 placeholder-slate-400"
                />
                {bcc.trim() && (
                  <button
                    type="button"
                    onClick={() => setBcc("")}
                    disabled={isPending}
                    className="underline underline-offset-2 hover:text-slate-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            {registrationLink && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-xs font-medium text-slate-500">
                  Registration link (30-day expiry) — send it from your own
                  mailbox:
                </p>
                <input
                  readOnly
                  value={registrationLink}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Registration link"
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-700"
                />
              </div>
            )}
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
            disabled={isPending || liveRounds.length === 0 || !roundId || registrationLink != null}
            className="gap-2"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {isPending ? (skipEmail ? "Creating…" : "Sending…") : skipEmail ? "Create invitation" : "Confirm & send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
