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
import { getSecondaryContributor } from "@/lib/db/queries/contributors";
import { getPriorYearSecondaryContributor } from "@/lib/db/queries/reassessment";
import { listAssessors } from "@/lib/db/queries/profiles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApplicationActions } from "@/components/admin/application-actions";
import { AssignAssessorSelect } from "@/components/admin/assign-assessor-select";
import { GdprDeleteAction } from "@/components/admin/gdpr-delete-action";
import { AddSecondParentCard } from "@/components/admin/add-second-parent-card";
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

  const {
    application,
    assessors,
    assignedOk,
    secondary,
    secondaryOverride,
    priorYearSecondary,
  } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const app = await getApplicationWithDetails(tx, params.id);
      const asrs = user.role === Role.ADMIN ? await listAssessors(tx) : [];

      // ASSESSORs may only access applications assigned to them
      let ok = true;
      if (user.role === Role.ASSESSOR) {
        const assigned = await tx.application.findFirst({
          where: { id: params.id, assignedToId: user.id },
          select: { id: true },
        });
        ok = !!assigned;
      }

      const sec = await getSecondaryContributor(tx, params.id);

      // Whether the assessor has chosen to proceed without the second parent
      // (override on the assessment). Drives the "Override" status display.
      const overrideRow = await tx.assessment.findUnique({
        where: { applicationId: params.id },
        select: { secondaryParentOverride: true },
      });

      // Re-assessment carry-forward (dual-parent PR 6, decision #6): if this
      // application has NO second parent yet but the prior-year application for
      // the same bursary account had one, surface them for a re-invite prompt.
      // Only meaningful for staff who can write (ADMIN / ASSESSOR) and when no
      // secondary exists yet — the helper enforces the latter internally.
      const prior =
        !sec && (user.role === Role.ADMIN || user.role === Role.ASSESSOR)
          ? await getPriorYearSecondaryContributor(tx, params.id)
          : null;

      return {
        application: app,
        assessors: asrs,
        assignedOk: ok,
        secondary: sec,
        secondaryOverride: overrideRow?.secondaryParentOverride ?? false,
        priorYearSecondary: prior,
      };
    }
  );

  if (!application) {
    notFound();
  }

  if (!assignedOk) {
    redirect("/admin");
  }

  const tabs = getTabItems(params.id);

  // Secondary "Manage" affordances are demoted beneath the primary outcome
  // actions. Role gating is unchanged from the original layout:
  //   • GDPR erasure        → ADMIN only.
  //   • Second-parent panel → ADMIN/ASSESSOR can invite; VIEWER only sees the
  //     read-only status panel once a secondary already exists.
  const canManageGdpr = user.role === Role.ADMIN;
  const showSecondParent =
    user.role === Role.ADMIN ||
    user.role === Role.ASSESSOR ||
    Boolean(secondary);
  const showManageCard = canManageGdpr || showSecondParent;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav
        className="flex items-center gap-1.5 text-sm text-slate-500"
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
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
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

      {/* WP-15: Primary outcome actions — the prominent decision surface.
          Hidden for terminal statuses (handled inside the component). */}
      <ApplicationActions
        applicationId={application.id}
        status={application.status}
        documents={application.documents}
      />

      {/* Secondary "Manage" affordances — demoted beneath the primary actions
          so the rare/destructive (GDPR) and occasional (second parent) tasks
          don't compete with the outcome decision. Each affordance is rendered
          as a quiet row inside one shared card. Role gating is unchanged:
          GDPR is ADMIN-only; the second-parent row follows the original
          ADMIN/ASSESSOR-or-existing-secondary rule. */}
      {showManageCard && (
        <section
          className="rounded-xl border border-slate-200 bg-white shadow-sm"
          aria-label="Manage application"
        >
          <h2 className="px-6 pt-4 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Manage
          </h2>
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {showSecondParent && (
              <AddSecondParentCard
                applicationId={application.id}
                secondary={secondary}
                overrideActive={secondaryOverride}
                priorYearSecondary={
                  priorYearSecondary
                    ? {
                        email: priorYearSecondary.email,
                        firstName: priorYearSecondary.firstName,
                        lastName: priorYearSecondary.lastName,
                        previousAcademicYear:
                          priorYearSecondary.previousAcademicYear,
                      }
                    : null
                }
              />
            )}

            {/* B7: GDPR right-to-erasure — ADMIN only. The server action also
                enforces ADMIN/ASSESSOR + the 7-year retention guard. */}
            {canManageGdpr && (
              <GdprDeleteAction
                applicationId={application.id}
                reference={application.reference}
                documentCount={application.documents.length}
              />
            )}
          </div>
        </section>
      )}

      {/* Tab navigation */}
      <div className="border-b border-slate-200 pt-2">
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
