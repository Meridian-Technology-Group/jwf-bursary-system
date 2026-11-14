"use client";

/**
 * The lead-applicant contact register table (Epic 04). Browsable / searchable
 * list of families with their child, school, entry year and register state
 * (has-account / pending-invite). Create + edit open the contact form dialog;
 * "Send invitation" is wired in PR-3.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Pencil,
  Archive,
  Send,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
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
import { InviteFromContactDialog } from "./invite-from-contact-dialog";
import { archiveContactAction } from "@/app/(admin)/contacts/actions";
import type { ContactListItem } from "@/lib/db/queries/contacts";
import { ADULT_TITLES, titleLabel } from "@/lib/contacts/titles";
import { entryAcademicYearLabelOrNull } from "@/lib/schools/academic-year";
import { schoolName } from "@/lib/schools";

interface RoundOption {
  id: string;
  academicYear: string;
}

function schoolShort(school: string): string {
  return schoolName(school, "short");
}

/**
 * Fallback split of a stored `childName` for legacy rows saved before the name
 * was split into dedicated first/surname columns. The last whitespace-delimited
 * token becomes the surname and the remainder the first name.
 */
function splitChildName(childName: string): { first: string; last: string } {
  const parts = childName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: "", last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/** Resolve a contact's child first/last, preferring the split columns. */
function childNameParts(c: ContactListItem): { first: string; last: string } {
  if (c.childFirstName !== null || c.childLastName !== null) {
    return { first: c.childFirstName ?? "", last: c.childLastName ?? "" };
  }
  return splitChildName(c.childName);
}

function fmtDob(dob: Date | null): string {
  if (!dob) return "—";
  return new Date(dob).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * 14 Nov 2026 (Charlotte): sortable register columns. Sorting is client-side
 * over the already-filtered list; with no sort chosen the server's newest-first
 * order stands. State sorts New → Invited → Registered + Invited → Registered,
 * so ascending surfaces the contacts still waiting for an invitation.
 */
type SortKey =
  | "lead"
  | "childFirst"
  | "childLast"
  | "dob"
  | "school"
  | "year"
  | "state";
type SortDir = "asc" | "desc";

const COLUMNS: { label: string; key: SortKey | null }[] = [
  { label: "Lead applicant", key: "lead" },
  { label: "Child first", key: "childFirst" },
  { label: "Child last", key: "childLast" },
  { label: "DOB", key: "dob" },
  { label: "School", key: "school" },
  { label: "Academic year", key: "year" },
  { label: "State", key: "state" },
  { label: "Actions", key: null },
];

function stateRank(c: ContactListItem): number {
  if (!c.hasAccount && !c.hasPendingInvite) return 0; // New
  if (!c.hasAccount) return 1; // Invited
  if (c.hasPendingInvite) return 2; // Registered + Invited
  return 3; // Registered
}

function sortValue(c: ContactListItem, key: SortKey): string | number | null {
  switch (key) {
    case "lead":
      return [c.lastName, c.firstName].filter(Boolean).join(" ").toLowerCase();
    case "childFirst":
      return childNameParts(c).first.toLowerCase() || null;
    case "childLast":
      return childNameParts(c).last.toLowerCase() || null;
    case "dob":
      return c.childDob ? new Date(c.childDob).getTime() : null;
    case "school":
      return schoolShort(c.school).toLowerCase();
    case "year":
      return c.entryYear;
    case "state":
      return stateRank(c);
  }
}

/** Stable sort; blanks (no DOB, no child first name) always sink to the end. */
function sortContacts(
  rows: ContactListItem[],
  key: SortKey,
  dir: SortDir
): ContactListItem[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((c, i) => ({ c, i, v: sortValue(c, key) }))
    .sort((a, b) => {
      if (a.v === null && b.v === null) return a.i - b.i;
      if (a.v === null) return 1;
      if (b.v === null) return -1;
      const cmp =
        typeof a.v === "number" && typeof b.v === "number"
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v), "en-GB");
      return cmp !== 0 ? sign * cmp : a.i - b.i;
    })
    .map((r) => r.c);
}

function toFormValues(c: ContactListItem & {
  phone: string | null;
}): ContactFormValues {
  const child = childNameParts(c);
  return {
    id: c.id,
    title: c.title ?? "",
    firstName: c.firstName ?? "",
    lastName: c.lastName,
    email: c.email,
    phone: c.phone ?? "",
    childTitle: c.childTitle ?? "",
    childFirstName: child.first,
    childLastName: child.last,
    childDob: c.childDob
      ? new Date(c.childDob).toISOString().slice(0, 10)
      : "",
    school: (c.school as ContactFormValues["school"]) ?? "",
    entryYear: String(c.entryYear),
    entryYearGroup:
      (c.entryYearGroup as ContactFormValues["entryYearGroup"]) ?? "",
    situation: (c.situation as ContactFormValues["situation"]) ?? "NEW",
    // Address + notes must round-trip through the edit form: the update action
    // writes a full record (unsubmitted fields become null), so presenting them
    // blank would silently wipe the stored address on every edit.
    addressLine1: c.addressLine1 ?? "",
    addressLine2: c.addressLine2 ?? "",
    town: c.town ?? "",
    postcode: c.postcode ?? "",
    notes: c.notes ?? "",
  };
}

export function ContactsTable({
  contacts,
  liveRounds,
  defaultBcc,
}: {
  contacts: ContactListItem[];
  liveRounds: RoundOption[];
  /** CH-32 — server-resolved default for the invite dialog's BCC box. */
  defaultBcc?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(
    null
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ContactFormValues | null>(null);
  const [inviteTarget, setInviteTarget] = useState<ContactListItem | null>(
    null
  );
  const [archiveTarget, setArchiveTarget] = useState<ContactListItem | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = !q
      ? contacts
      : contacts.filter((c) =>
      [
        c.firstName,
        c.lastName,
        c.email,
        c.childName,
        c.childFirstName,
        c.childLastName,
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
    return sort ? sortContacts(matched, sort.key, sort.dir) : matched;
  }, [contacts, query, sort]);

  /** Click cycles ascending → descending → back to newest-first. */
  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

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
                  {COLUMNS.map(({ label, key }) => {
                    const active = key !== null && sort?.key === key;
                    const Icon = !active
                      ? ArrowUpDown
                      : sort?.dir === "asc"
                        ? ArrowUp
                        : ArrowDown;
                    return (
                      <th
                        key={label}
                        scope="col"
                        aria-sort={
                          active
                            ? sort?.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                      >
                        {key === null ? (
                          label
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleSort(key)}
                            className={`inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wider hover:text-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm ${
                              active ? "text-slate-800" : ""
                            }`}
                            title={`Sort by ${label.toLowerCase()}`}
                          >
                            {label}
                            <Icon
                              className={`h-3 w-3 ${active ? "" : "opacity-40"}`}
                              aria-hidden="true"
                            />
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((c) => {
                  const child = childNameParts(c);
                  return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="font-medium">
                        {[titleLabel(c.title, ADULT_TITLES), c.firstName, c.lastName]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </div>
                      <div className="text-xs text-slate-400">{c.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {child.first || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {child.last || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                      {fmtDob(c.childDob)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {schoolShort(c.school)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {entryAcademicYearLabelOrNull(c.entryYear) ?? "—"}
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
                          onClick={() => setInviteTarget(c)}
                          className="gap-1 text-primary-800"
                          disabled={liveRounds.length === 0}
                          title={
                            liveRounds.length === 0
                              ? "No open round to invite into"
                              : "Send a parent invite from this contact"
                          }
                        >
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                          Invite
                        </Button>
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
                  );
                })}
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

      {/* Invite from contact */}
      <InviteFromContactDialog
        contact={inviteTarget}
        liveRounds={liveRounds}
        defaultBcc={defaultBcc}
        open={inviteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setInviteTarget(null);
        }}
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
