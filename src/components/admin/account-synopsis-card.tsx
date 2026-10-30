"use client";

/**
 * Epic 21 #6 (rework, 14 Oct 2026) — "Main synopsis": the account's one
 * standing synopsis, at the top of the ASSESSMENT ADMIN tab. It sustains every
 * year of the bursary (Charlotte, 11 Oct 2026); "This year's synopsis" below it
 * pertains to this year's assessment only.
 *
 * Pre-filled from the Grant Tracker synopsis (migrated accounts) or from the
 * first locked year's synopsis (new awards). ADMIN and ASSESSOR edit it; each
 * save is audited, so earlier versions are on the History tab, not here.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveMainSynopsisAction } from "@/app/(admin)/applications/[id]/account-synopsis-actions";
import { MAIN_SYNOPSIS_MAX } from "@/lib/bursary-accounts/standing-synopsis";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

export function AccountSynopsisCard({
  applicationId,
  body,
  updatedAt,
  canEdit,
}: {
  applicationId: string;
  /** The MAIN entry's text; null when the account has none yet. */
  body: string | null;
  /** ISO string; null when there is no entry. */
  updatedAt: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(body ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasText = !!body?.trim();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-neutral-100 bg-neutral-50 px-5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <BookOpenText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <div>
              <CardTitle className="text-sm font-semibold text-slate-700">Main synopsis</CardTitle>
              <p className="mt-0.5 text-xs text-slate-400">
                The account&apos;s synopsis across every year. Earlier versions are on the{" "}
                <Link
                  href={`/applications/${applicationId}/history`}
                  className="underline underline-offset-2 hover:text-slate-600"
                >
                  History
                </Link>{" "}
                tab.
                {updatedAt && hasText ? ` Last changed ${fmtDate(updatedAt)}.` : ""}
              </p>
            </div>
          </div>
          {canEdit && !editing && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(body ?? "");
                setError(null);
                setEditing(true);
              }}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 py-4">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              maxLength={MAIN_SYNOPSIS_MAX}
              aria-label="Main synopsis"
              autoFocus
              className="resize-y border-slate-200 text-sm leading-relaxed text-slate-700"
            />
            {error && (
              <p className="text-sm font-medium text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setError(null);
                  const res = await saveMainSynopsisAction({ applicationId, body: draft });
                  setPending(false);
                  if (!res.success) {
                    setError(res.error);
                    return;
                  }
                  setEditing(false);
                  router.refresh();
                }}
              >
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : hasText ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{body}</p>
        ) : (
          <p className="text-sm text-slate-400">
            No main synopsis yet. It is filled in from this year&apos;s synopsis when the award is
            locked{canEdit ? ", or you can write one now" : ""}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
