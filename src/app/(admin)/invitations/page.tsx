/**
 * Invitations page.
 *
 * Server component — requires ASSESSOR role.
 * Shows the Send New Invitation form and invitation history table.
 */

export const dynamic = "force-dynamic";

import { Mail } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { listInvitations } from "@/lib/db/queries/invitations";
import { listRounds } from "@/lib/db/queries/rounds";
import { SendInvitationForm } from "@/components/admin/send-invitation-form";
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
  await requireRole([Role.ADMIN]);

  const roundIdFilter = searchParams?.roundId;

  // Fetch data in parallel
  const [invitations, rounds] = await Promise.all([
    listInvitations(roundIdFilter ? { roundId: roundIdFilter } : undefined),
    listRounds(),
  ]);

  // Default to the most recent open round for the form
  const openRound = rounds.find((r) => r.status === "OPEN");
  const defaultRoundId = roundIdFilter ?? openRound?.id;

  // Simple round options for the dropdown (all rounds, newest first)
  const roundOptions = rounds.map((r) => ({
    id: r.id,
    academicYear: r.academicYear,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Invitations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Send bursary application invitations and track their status.
        </p>
      </div>

      {/* Send invitation form */}
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
                        {inv.applicantName ?? "—"}
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
