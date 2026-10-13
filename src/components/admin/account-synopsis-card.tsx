"use client";

/**
 * Epic 21 #6 — "Account synopsis (all years)": the standing synopsis at the
 * top of the ASSESSMENT ADMIN tab. A timeline, newest first:
 *   - each locked year's synopsis, headed by its academic year (read-only
 *     here; it is edited in that year's assessment, linked);
 *   - staff notes, headed by date and author. ADMIN and ASSESSOR add notes;
 *     ADMIN edits them; nobody deletes (D-6).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, Pencil, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  addAccountSynopsisNoteAction,
  editAccountSynopsisNoteAction,
} from "@/app/(admin)/applications/[id]/account-synopsis-actions";

export interface AccountSynopsisCardEntry {
  id: string;
  kind: "YEAR" | "NOTE";
  academicYear: string | null;
  body: string;
  /** ISO strings — formatted here. */
  createdAt: string;
  updatedAt: string;
  applicationId: string | null;
  authorName: string | null;
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

function NoteEditor({
  initial,
  onSave,
  onCancel,
  saveLabel,
}: {
  initial: string;
  onSave: (body: string) => Promise<string | null>;
  onCancel: () => void;
  saveLabel: string;
}) {
  const [body, setBody] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={5000}
        aria-label="Note"
        autoFocus
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
          disabled={pending || !body.trim()}
          onClick={async () => {
            setPending(true);
            setError(null);
            const err = await onSave(body);
            setPending(false);
            if (err) setError(err);
          }}
        >
          {pending ? "Saving…" : saveLabel}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function AccountSynopsisCard({
  applicationId,
  entries,
  canAddNote,
  canEditNotes,
}: {
  applicationId: string;
  entries: AccountSynopsisCardEntry[];
  canAddNote: boolean;
  canEditNotes: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-neutral-100 bg-neutral-50 px-5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <BookOpenText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <div>
              <CardTitle className="text-sm font-semibold text-slate-700">
                Account synopsis (all years)
              </CardTitle>
              <p className="mt-0.5 text-xs text-slate-400">
                Each year&apos;s synopsis is added when its award is locked. Notes
                can be added at any time.
              </p>
            </div>
          </div>
          {canAddNote && !adding && (
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Add a note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 py-4">
        {adding && (
          <NoteEditor
            initial=""
            saveLabel="Add note"
            onCancel={() => setAdding(false)}
            onSave={async (body) => {
              const res = await addAccountSynopsisNoteAction({ applicationId, body });
              if (!res.success) return res.error;
              setAdding(false);
              router.refresh();
              return null;
            }}
          />
        )}

        {entries.length === 0 && !adding ? (
          <p className="text-sm text-slate-400">
            Nothing yet. A year&apos;s synopsis appears here when its award is locked.
          </p>
        ) : (
          <ol className="space-y-4">
            {entries.map((e) => (
              <li key={e.id} className="border-l-2 border-slate-200 pl-3">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  {e.kind === "YEAR" ? (
                    <>
                      <span className="font-semibold text-primary-900">{e.academicYear}</span>
                      <span className="text-slate-400">synopsis</span>
                      {e.applicationId && e.applicationId !== applicationId && (
                        <Link
                          href={`/applications/${e.applicationId}/assessment`}
                          className="text-primary-700 underline underline-offset-2 hover:text-primary-900"
                        >
                          edit in that year&apos;s assessment
                        </Link>
                      )}
                      {e.applicationId === applicationId && (
                        <span className="text-slate-400">(this year: edit below)</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-slate-700">Note</span>
                      <span className="text-slate-500">
                        {fmtDate(e.createdAt)}
                        {e.authorName ? ` · ${e.authorName}` : ""}
                        {/* createdAt is the DB clock, updatedAt Prisma's: allow drift. */}
                        {new Date(e.updatedAt).getTime() - new Date(e.createdAt).getTime() > 5000
                          ? " · edited"
                          : ""}
                      </span>
                      {canEditNotes && editingId !== e.id && (
                        <button
                          type="button"
                          onClick={() => setEditingId(e.id)}
                          className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-900"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          Edit
                        </button>
                      )}
                    </>
                  )}
                </div>
                {editingId === e.id ? (
                  <div className="mt-2">
                    <NoteEditor
                      initial={e.body}
                      saveLabel="Save note"
                      onCancel={() => setEditingId(null)}
                      onSave={async (body) => {
                        const res = await editAccountSynopsisNoteAction({
                          applicationId,
                          entryId: e.id,
                          body,
                        });
                        if (!res.success) return res.error;
                        setEditingId(null);
                        router.refresh();
                        return null;
                      }}
                    />
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{e.body}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
