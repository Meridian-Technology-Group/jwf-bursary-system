/**
 * Round Detail page.
 *
 * Server component — requires ASSESSOR or VIEWER role.
 * Shows round metadata, summary cards, school breakdown, and action buttons.
 */

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import {
  ClipboardList,
  Send,
  Loader2,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { getRound } from "@/lib/db/queries/rounds";
import { getActiveBursaryHolders } from "@/lib/db/queries/invitations";
import { RoundDetailActions } from "@/components/admin/round-detail-actions";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  return { title: `Round ${params.id}` };
}

// ---------------------------------------------------------------------------
// Sub-components
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

interface SummaryCardProps {
  label: string;
  count: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

function SummaryCard({
  label,
  count,
  icon: Icon,
  iconBg,
  iconColor,
}: SummaryCardProps) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          iconBg
        )}
        aria-hidden="true"
      >
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-primary-900">
          {count}
        </p>
      </div>
    </div>
  );
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RoundDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const [round, activeBursaryHolders] = await Promise.all([
    getRound(params.id),
    getActiveBursaryHolders(params.id),
  ]);

  if (!round) notFound();

  const summaryCards: SummaryCardProps[] = [
    {
      label: "Total Applications",
      count: round.counts.total,
      icon: ClipboardList,
      iconBg: "bg-primary-50",
      iconColor: "text-primary-700",
    },
    {
      label: "Submitted",
      count: round.counts.submitted,
      icon: Send,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Assessment In Progress",
      count: round.counts.inProgress,
      icon: Loader2,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      label: "Completed",
      count: round.counts.complete,
      icon: CheckCircle2,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      label: "Qualifies",
      count: round.statusBreakdown.qualifies,
      icon: ThumbsUp,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "Does Not Qualify",
      count: round.statusBreakdown.doesNotQualify,
      icon: ThumbsDown,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-primary-900">
              Round {round.academicYear}
            </h1>
            <RoundStatusBadge status={round.status} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
            <span>
              Opens:{" "}
              <span className="font-medium text-slate-700">
                {formatDate(round.openDate)}
              </span>
            </span>
            <span>
              Closes:{" "}
              <span className="font-medium text-slate-700">
                {formatDate(round.closeDate)}
              </span>
            </span>
            {round.decisionDate && (
              <span>
                Decision:{" "}
                <span className="font-medium text-slate-700">
                  {formatDate(round.decisionDate)}
                </span>
              </span>
            )}
          </div>
        </div>

        <RoundDetailActions
          roundId={round.id}
          academicYear={round.academicYear}
          status={round.status}
          activeBursaryHolderCount={activeBursaryHolders.length}
        />
      </div>

      {/* Summary cards */}
      <section aria-label="Application summary">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* School breakdown */}
      {round.schoolBreakdown.length > 0 && (
        <section aria-label="School breakdown">
          <h2 className="mb-3 text-base font-medium text-slate-700">
            Applications by School
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    School
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Applications
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {round.schoolBreakdown.map(({ school, count }) => (
                  <tr key={school} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-6 py-3 text-sm font-medium text-slate-700">
                      {school}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-right text-sm tabular-nums text-slate-600">
                      {count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
