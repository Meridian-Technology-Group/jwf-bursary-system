"use client";

/**
 * The lead-applicant contact register table (Epic 04). Browsable / searchable
 * list of families with their child, school, entry year and register state
 * (has-account / pending-invite). Create + edit open the contact form dialog;
 * "Send invitation" is wired in PR-3.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContactFormDialog,
  type ContactFormValues,
} from "./contact-form-dialog";
import { archiveContactAction } from "@/app/(admin)/contacts/actions";
import type { ContactListItem } from "@/lib/db/queries/contacts";

function schoolShort(school: string): string {
  return school === "TRINITY" ? "Trinity" : "Whitgift";
}

function fmtDob(dob: Date | null): string {
  if (!dob) return "—";
  return new Date(dob).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toFormValues(c: ContactListItem & {
  phone: string | null;
}): ContactFormValues {
  return {
    id: c.id,
    firstName: c.firstName ?? "",
    lastName: c.lastName,
    email: c.email,
    phone: c.phone ?? "",
    childName: c.childName,
    childDob: c.childDob
      ? new Date(c.childDob).toISOString().slice(0, 10)
      : "",
    school: (c.school as ContactFormValues["school"]) ?? "",
    entryYear: String(c.entryYear),
    entryYearGroup:
      (c.entryYearGroup as ContactFormValues["entryYearGroup"]) ?? "",
    // Address fields are not loaded into the list item; the edit dialog still
    // lets the admin re-enter / amend them. (Kept lean to avoid over-fetching
    // the register list.)
    addressLine1: "",
    addressLine2: "",
    town: "",
    postcode: "",
    notes: "",
  };
}

export function ContactsTable({ contacts }: { contacts: ContactListItem[] }) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ContactFormValues | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ContactListItem | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.firstName, c.lastName, c.email, c.childName]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [contacts, query]);

  function confirmArchive() {
    if (!archiveTarget) return;
    const id = archiveTarget.id;
    setArchiveTarget(null);
    startTransition(async () => {
      await archiveContactAction(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            placeholder="Search parent or child…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Search contacts"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New contact
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <p className="text-sm font-medium text-slate-500">
            {contacts.length === 0
              ? "No contacts yet"
              : "No contacts match your search"}
          </p>
          {contacts.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Add a family to invite them to apply.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Parent",
                    "Child",
                    "DOB",
                    "School",
                    "Entry year",
                    "State",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="font-medium">
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") ||
                          "—"}
                      </div>
                      <div className="text-xs text-slate-400">{c.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {c.childName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                      {fmtDob(c.childDob)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {schoolShort(c.school)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {c.entryYear}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.hasAccount && (
                          <Badge variant="secondary">Registered</Badge>
                        )}
                        {c.hasPendingInvite && (
                          <Badge variant="outline">Invited</Badge>
                        )}
                        {!c.hasAccount && !c.hasPendingInvite && (
                          <Badge variant="outline">New</Badge>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(toFormValues(c))}
                          className="gap-1"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setArchiveTarget(c)}
                          className="gap-1 text-slate-500"
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          Archive
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create */}
      <ContactFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit */}
      <ContactFormDialog
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        initial={editing ?? undefined}
      />

      {/* Archive confirm */}
      <Dialog
        open={archiveTarget !== null}
        onOpenChange={(next) => {
          if (!next) setArchiveTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive this contact?</DialogTitle>
            <DialogDescription>
              {archiveTarget
                ? `${archiveTarget.childName}'s contact will be hidden from the register. Existing invitations and applications are unaffected.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmArchive}
              disabled={isPending}
            >
              {isPending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
