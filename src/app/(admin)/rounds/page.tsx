/**
 * Assessment Rounds list page.
 *
 * Server component — requires ASSESSOR role.
 * Shows all rounds in a table with application count breakdowns.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { listRounds } from "@/lib/db/queries/rounds";
import { CreateRoundDialog } from "@/components/admin/create-round-dialog";
import { RoundActionsCell } from "@/components/admin/round-actions-cell";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Assessment Rounds",
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function RoundStatusBadge({ status }: { status: "DRAFT" | "OPEN" | "CLOSED" }) {
  const styles = {
    DRAFT: "bg-neutral-100 text-neutral-600",
    OPEN: "bg-green-50 text-green-700",
    CLOSED: "bg-neutral-100 text-neutral-500",
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RoundsPage() {
  await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const rounds = await listRounds();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">
            Assessment Rounds
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage bursary assessment cycles and their applications.
          </p>
        </div>
        <CreateRoundDialog />
      </div>

      {/* Table */}
      {rounds.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <CalendarRange
            className="h-10 w-10 text-slate-300 mb-3"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-slate-500">No rounds yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Create the first assessment round to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Academic Year
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Open Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Close Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500"
                    title="Pre-Submission"
                  >
                    Pre-Sub
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Submitted
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    In Progress
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Complete
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rounds.map((round) => (
                  <tr key={round.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/rounds/${round.id}`}
                        className="text-sm font-medium text-primary-700 hover:text-primary-900 hover:underline"
                      >
                        {round.academicYear}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <RoundStatusBadge status={round.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {formatDate(round.openDate)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {formatDate(round.closeDate)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center text-sm tabular-nums text-slate-600">
                      {round.counts.preSubmission}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center text-sm tabular-nums text-slate-600">
                      {round.counts.submitted}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center text-sm tabular-nums text-slate-600">
                      {round.counts.inProgress}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center text-sm tabular-nums text-slate-600">
                      {round.counts.complete}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <RoundActionsCell
                        roundId={round.id}
                        academicYear={round.academicYear}
                        status={round.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
