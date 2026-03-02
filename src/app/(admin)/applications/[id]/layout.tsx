/**
 * Application Detail Layout.
 *
 * Server component. Fetches application data and renders:
 * - Header with reference, school badge, status badge
 * - Contextual actions bar (WP-15)
 * - Tabbed navigation: Applicant Data | Assessment | Recommendation | History
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole, Role } from "@/lib/auth/roles";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { listAssessors } from "@/lib/db/queries/profiles";
import { prisma } from "@/lib/db/prisma";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApplicationActions } from "@/components/admin/application-actions";
import { AssignAssessorSelect } from "@/components/admin/assign-assessor-select";
import type { ApplicationStatus as PrismaStatus } from "@prisma/client";

// Map Prisma status to StatusBadge status
function mapStatus(
  status: PrismaStatus
): React.ComponentProps<typeof StatusBadge>["status"] {
  const map: Record<
    PrismaStatus,
    React.ComponentProps<typeof StatusBadge>["status"]
  > = {
    PRE_SUBMISSION: "DRAFT",
    SUBMITTED: "SUBMITTED",
    NOT_STARTED: "SUBMITTED",
    PAUSED: "PAUSED",
    COMPLETED: "IN_REVIEW",
    QUALIFIES: "QUALIFIES",
    DOES_NOT_QUALIFY: "DOES_NOT_QUALIFY",
  };
  return map[status] ?? "DRAFT";
}

function SchoolBadge({ school }: { school: "WHITGIFT" | "TRINITY" }) {
  if (school === "WHITGIFT") {
    return (
      <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-800">
        Whitgift
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
      Trinity
    </span>
  );
}

// ─── Tab navigation ───────────────────────────────────────────────────────────

interface TabItem {
  label: string;
  href: string;
  isPlaceholder?: boolean;
}

function getTabItems(applicationId: string): TabItem[] {
  return [
    {
      label: "Applicant Data",
      href: `/applications/${applicationId}`,
    },
    {
      label: "Assessment",
      href: `/applications/${applicationId}/assessment`,
    },
    {
      label: "Recommendation",
      href: `/applications/${applicationId}/recommendation`,
    },
    {
      label: "History",
      href: `/applications/${applicationId}/history`,
    },
  ];
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  params: { id: string };
}

export default async function ApplicationDetailLayout({
  children,
  params,
}: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const [application, assessors] = await Promise.all([
    getApplicationWithDetails(params.id),
    user.role === Role.ADMIN ? listAssessors() : Promise.resolve([]),
  ]);

  if (!application) {
    notFound();
  }

  // ASSESSORs may only access applications assigned to them
  if (user.role === Role.ASSESSOR) {
    const assigned = await prisma.application.findFirst({
      where: { id: params.id, assignedToId: user.id },
      select: { id: true },
    });
    if (!assigned) {
      redirect("/admin");
    }
  }

  const tabs = getTabItems(params.id);

  return (
    <div className="space-y-0">
      {/* Breadcrumb */}
      <nav
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-500"
        aria-label="Breadcrumb"
      >
        <Link
          href="/queue"
          className="hover:text-primary-700 transition-colors"
        >
          Applications
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-slate-700">{application.reference}</span>
      </nav>

      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="font-mono text-2xl font-semibold text-primary-900">
                {application.reference}
              </h1>
              <SchoolBadge school={application.school} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>Round: {application.round.academicYear}</span>
              {application.entryYear && (
                <span>Entry: {application.entryYear}</span>
              )}
              {application.isReassessment && (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 border border-orange-200">
                  Re-assessment
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={mapStatus(application.status)} />
            {user.role === Role.ADMIN && (
              <AssignAssessorSelect
                applicationId={application.id}
                currentAssessorId={application.assignedToId}
                assessors={assessors}
              />
            )}
          </div>
        </div>
      </div>

      {/* WP-15: Contextual actions bar — hidden for terminal statuses */}
      <ApplicationActions
        applicationId={application.id}
        status={application.status}
        documents={application.documents}
      />

      {/* Tab navigation */}
      <div className="border-b border-slate-200 mb-6">
        <nav
          className="-mb-px flex gap-0"
          aria-label="Application detail tabs"
        >
          {tabs.map((tab) => (
            <TabLink
              key={tab.href}
              label={tab.label}
              href={tab.href}
              isPlaceholder={tab.isPlaceholder}
            />
          ))}
        </nav>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}

// ─── TabLink (client component needed for active state detection) ─────────────

import { ApplicationDetailTabLink } from "@/components/admin/application-detail-tab-link";

function TabLink({
  label,
  href,
  isPlaceholder,
}: {
  label: string;
  href: string;
  isPlaceholder?: boolean;
}) {
  return (
    <ApplicationDetailTabLink
      label={label}
      href={href}
      isPlaceholder={isPlaceholder}
    />
  );
}
