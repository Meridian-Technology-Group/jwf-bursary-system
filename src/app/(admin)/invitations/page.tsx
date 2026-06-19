/**
 * Invitations page.
 *
 * Server component — requires ASSESSOR role.
 * Shows the Send New Invitation form and invitation history table.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Mail, Users, ArrowRight } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { listInvitations } from "@/lib/db/queries/invitations";
import { listRounds } from "@/lib/db/queries/rounds";
import { SendInvitationForm } from "@/components/admin/send-invitation-form";
import { InvitationRowActions } from "@/components/admin/invitation-row-actions";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Invitations",
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function InvitationStatusBadge({
  status,
}: {
  status: "PENDING" | "ACCEPTED" | "EXPIRED";
}) {
  const styles = {
    PENDING: "bg-yellow-50 text-yellow-700",
    ACCEPTED: "bg-green-50 text-green-700",
    EXPIRED: "bg-neutral-100 text-neutral-400",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSchool(school: string | null): string {
  if (!school) return "—";
  return school === "TRINITY" ? "Trinity" : "Whitgift";
}

function formatName(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ");
  return name || email;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams?: { roundId?: string };
}) {
  const user = await requireRole([Role.ADMIN]);

  const roundIdFilter = searchParams?.roundId;

  // Fetch data in parallel
  const [invitations, rounds] = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      Promise.all([
        listInvitations(tx, roundIdFilter ? { roundId: roundIdFilter } : undefined),
        listRounds(tx),
      ])
  );

  // Epic 03 (D13): the invite picker offers LIVE rounds only — you invite into
  // an OPEN intake, never a DRAFT/CLOSED round. `listRounds` returns newest
  // first, so the filtered list keeps that order. CLOSED rounds never appear.
  const liveRounds = rounds.filter((r) => r.status === "OPEN");

  // Default to the most-recent OPEN round (first in the newest-first list). If
  // the page was opened pre-filtered to a specific round that is itself live,
  // honour it; otherwise fall back to the default live round.
  const filterRoundIsLive =
    roundIdFilter && liveRounds.some((r) => r.id === roundIdFilter);
  const defaultRoundId = filterRoundIsLive ? roundIdFilter : liveRounds[0]?.id;

  // Live round options for the picker (OPEN only, newest first).
  const roundOptions = liveRounds.map((r) => ({
    id: r.id,
    academicYear: r.academicYear,
  }));

  return (
    <div className="space-y-8">
      {/* Header — unmistakably the FAMILY (parent) invite flow. Staff invites
          live on a separate page (/users); contact-driven invites are the
          recommended parent path (Epic 04). */}
      <div className="flex items-start gap-3">
        <span className="mt-1 rounded-lg bg-primary-50 p-2 text-primary-900">
          <Mail className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">
            Invite a family to apply
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Send a parent a link to start a bursary application. To invite a
            staff member (assessor or viewer) instead, use{" "}
            <Link href="/users" className="font-medium text-primary-800 underline">
              Users
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Recommended path: the contact register. The quick-invite form below is
          the exception for one-off invites. */}
      <Link
        href="/contacts"
        className="flex items-center justify-between rounded-xl border border-primary-100 bg-primary-50/60 px-5 py-4 transition-colors hover:bg-primary-50"
      >
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary-800" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-primary-900">
              Invite from the contact register
            </p>
            <p className="text-xs text-slate-500">
              Recommended — invite a family from their stored record, with the
              school and entry year already locked in.
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-primary-800" aria-hidden="true" />
      </Link>

      {/* Quick (single-send) invite form */}
      <SendInvitationForm
        rounds={roundOptions}
        defaultRoundId={defaultRoundId}
      />

      {/* Invitation history */}
      <section aria-label="Invitation history">
        <h2 className="mb-3 text-base font-medium text-slate-700">
          Invitation History
        </h2>

        {invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <Mail
              className="h-10 w-10 text-slate-300 mb-3"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-500">
              No invitations yet
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Use the form above to send the first invitation.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Email",
                      "Applicant",
                      "Child",
                      "School",
                      "Round",
                      "Status",
                      "Sent",
                      "Sent By",
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                        {inv.email}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {[inv.firstName, inv.lastName].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {inv.childName ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {formatSchool(inv.school)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {inv.round?.academicYear ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <InvitationStatusBadge status={inv.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                        {formatName(
                          inv.creator.firstName,
                          inv.creator.lastName,
                          inv.creator.email
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                        {inv.status === "PENDING" ? (
                          <InvitationRowActions
                            invitationId={inv.id}
                            email={inv.email}
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
