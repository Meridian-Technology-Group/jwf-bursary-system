/**
 * Applicant Data tab — read-only view of all submitted ApplicationSection data.
 *
 * Each section is rendered as a Card with the section title and the raw JSON
 * fields displayed in a readable format. Currency values are formatted with £.
 * Document slots are listed via DocumentChecklist.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import {
  getApplicationWithDetails,
  getApplicationNamesForReveal,
} from "@/lib/db/queries/applications";
import { getApplicationContributors } from "@/lib/db/queries/contributors";
import { contributorRoleLabel, isParentOwnedSection } from "@/lib/contributors/dual-view";
import { deriveReviewPhase } from "@/lib/applications/status";
import { canEditOnBehalf } from "@/lib/applications/edit-on-behalf";
import { getSiblingLinks } from "@/lib/db/queries/siblings";
import { getScheduleForAccount, type ScheduleEntryRow } from "@/lib/db/queries/schedule";
import { getYoyFinancialsRows } from "@/lib/db/queries/assessments";
import type { YoyFinancialsTableRow } from "@/lib/assessment/yoy-financials";
import { ScheduleGrid } from "@/components/admin/schedule-grid";
import { YoyFinancialsTable } from "@/components/admin/yoy-financials-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SECTION_LABELS,
  asProvenanceMap,
  DataBlock,
} from "@/components/admin/application-section-cards";
import { DocumentChecklist } from "@/components/admin/document-checklist";
import { AdminUpload } from "@/components/admin/admin-upload";
import { SubmissionDeadlineCard } from "@/components/admin/submission-deadline-card";
import {
  effectiveSubmissionDeadline,
  roundDefaultForType,
} from "@/lib/rounds/submission-deadline";
import { SiblingLinkerCard } from "@/components/admin/sibling-linker";
import { SiblingListCard } from "@/components/admin/sibling-list";
import type {
  ApplicationSectionType,
  BursaryAccountStatus,
} from "@prisma/client";

export const metadata = {
  title: "Applicant Data",
};

interface Props {
  params: { id: string };
}

export default async function ApplicantDataPage({ params }: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);
  const isAssessor = user.role === Role.ADMIN || user.role === Role.ASSESSOR;

  const {
    application,
    siblingLinks,
    names,
    contributors,
    scheduleEntries,
    accountStatus,
    yoyRows,
  } = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
    const app = await getApplicationWithDetails(tx, params.id);
    if (!app)
      return {
        application: null,
        siblingLinks: [],
        names: null,
        contributors: [],
        scheduleEntries: [] as ScheduleEntryRow[],
        accountStatus: null as BursaryAccountStatus | null,
        yoyRows: [] as YoyFinancialsTableRow[],
      };
    const siblings = app.bursaryAccountId
      ? await getSiblingLinks(tx, app.bursaryAccountId)
      : [];
    const schedule = app.bursaryAccountId
      ? await getScheduleForAccount(tx, app.bursaryAccountId)
      : [];
    const account = app.bursaryAccountId
      ? await tx.bursaryAccount.findUnique({
          where: { id: app.bursaryAccountId },
          select: { status: true },
        })
      : null;
    // CALC-10 — YoY financials history (read-only projection over the
    // account's COMPLETED assessments; no new write path).
    const yoy = app.bursaryAccountId
      ? await getYoyFinancialsRows(tx, app.bursaryAccountId)
      : [];
    const revealed = await getApplicationNamesForReveal(tx, app.id, user.id);
    const ctribs = await getApplicationContributors(tx, params.id);
    return {
      application: app,
      siblingLinks: siblings,
      names: revealed,
      contributors: ctribs,
      scheduleEntries: schedule,
      accountStatus: account?.status ?? null,
      yoyRows: yoy,
    };
  });

  if (!application) {
    notFound();
  }

  const { sections, documents, bursaryAccountId } = application;
  const currentChildName = names?.childName ?? "";

  // Per-application submission deadline (Epic 03) — ADMIN-editable. The effective
  // deadline (override ?? round close end-of-day) is derived in one helper so
  // this display and Epic 05's parent countdown agree.
  const isAdmin = user.role === Role.ADMIN;
  const effective = effectiveSubmissionDeadline(
    {
      submissionDeadlineAt: application.submissionDeadlineAt,
      applicationType: application.applicationType,
    },
    application.round
  );
  // The round default that actually applies to THIS application (E1/D13-8) —
  // NEW and ROLLING_OVER read different columns, so the card must be shown the
  // one on this application's clock, not "the round default" in the abstract.
  const roundDefaultDeadline = roundDefaultForType(
    application.round,
    application.applicationType
  );

  // ── Edit on behalf (CR-001) ─────────────────────────────────────────────────
  // Entry point to amend the applicant's form data. Shown only while the review
  // phase still permits editing (blocked once the assessment is COMPLETED or an
  // outcome is set — see canEditOnBehalf) AND the viewer is an ADMIN or the
  // assigned ASSESSOR. VIEWERs never see it.
  const reviewPhase = deriveReviewPhase({
    formStatus: application.formStatus,
    assessmentStatus: application.assessment?.status ?? null,
    outcome: application.assessment?.outcome ?? null,
    closedAt: application.closedAt,
  });
  const showEditOnBehalf =
    canEditOnBehalf(reviewPhase) &&
    (isAdmin ||
      (user.role === Role.ASSESSOR && application.assignedToId === user.id));

  const editOnBehalfButton = showEditOnBehalf ? (
    <div className="flex justify-end">
      <Button
        asChild
        variant="outline"
        size="sm"
        className="h-9 border-neutral-200 bg-white text-slate-600 hover:bg-neutral-50"
      >
        <Link href={`/applications/${application.id}/edit`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit on behalf
        </Link>
      </Button>
    </div>
  ) : null;

  // ── Dual-parent: separate sections by owning contributor ───────────────────
  // When a SECONDARY contributor exists, the parent-owned sections
  // (PARENT_DETAILS / PARENTS_INCOME / ASSETS_LIABILITIES) have a copy per
  // parent. We label each section card with its owner ("Parent 1 (primary
  // applicant)" / "Parent 2 (second parent)"). Child-level sections are
  // PRIMARY-owned only and shown once. When there is NO secondary, the owner
  // label is omitted entirely and the view is exactly as before.
  const primaryContributorId = contributors.find(
    (c) => c.role === "PRIMARY"
  )?.id;
  const hasSecondary = contributors.some((c) => c.role === "SECONDARY");
  const ownerLabelById = new Map(
    contributors.map((c) => [c.id, contributorRoleLabel(c.role)])
  );

  function ownerLabelFor(ownerContributorId: string): string | null {
    if (!hasSecondary) return null;
    return ownerLabelById.get(ownerContributorId) ?? null;
  }

  // Deterministic order: primary's sections first, then secondary's, each in
  // the section enum order the query already returns. Within a section, the
  // primary copy precedes the secondary copy.
  const orderedSections = hasSecondary
    ? [...sections].sort((a, b) => {
        const aPrimary = a.ownerContributorId === primaryContributorId ? 0 : 1;
        const bPrimary = b.ownerContributorId === primaryContributorId ? 0 : 1;
        if (aPrimary !== bPrimary) return aPrimary - bPrimary;
        return a.section.localeCompare(b.section);
      })
    : sections;

  if (sections.length === 0) {
    return (
      <div className="space-y-5">
        {editOnBehalfButton}

        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">
            No application sections have been submitted yet.
          </p>
        </div>

        {/* CALC-10 — YoY financials history */}
        {bursaryAccountId && <AccountAdminSection yoyRows={yoyRows} />}

        {/* Forward schedule — shown when the account is linked (Epic 10) */}
        {bursaryAccountId && (
          <ScheduleGrid
            applicationId={application.id}
            entries={scheduleEntries}
            canManage={user.role === Role.ADMIN}
            accountId={bursaryAccountId}
            accountStatus={accountStatus ?? "ACTIVE"}
          />
        )}

        {/* Sibling Links — shown even when no sections exist if account is linked */}
        {bursaryAccountId && (
          <SiblingSection
            bursaryAccountId={bursaryAccountId}
            currentChildName={currentChildName}
            currentBursaryAccountId={bursaryAccountId}
            siblingLinks={siblingLinks}
            isAssessor={isAssessor}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {editOnBehalfButton}

      {/* Document checklist first */}
      <DocumentChecklist
        applicationId={application.id}
        documents={documents}
      />

      {/* Assessor document upload */}
      <AdminUpload applicationId={application.id} />

      {/* Per-application submission deadline — ADMIN only */}
      {isAdmin && (
        <SubmissionDeadlineCard
          applicationId={application.id}
          submissionDeadlineAt={
            application.submissionDeadlineAt
              ? application.submissionDeadlineAt.toISOString()
              : null
          }
          roundCloseDate={application.round.closeDate.toISOString()}
          roundDefaultDeadline={
            roundDefaultDeadline ? roundDefaultDeadline.toISOString() : null
          }
          applicationType={application.applicationType}
          effectiveDeadline={effective.deadline.toISOString()}
          source={effective.source}
        />
      )}

      {/* Section data cards */}
      {orderedSections.map((section) => {
        const sectionData = section.data as Record<string, unknown>;
        const hasData =
          sectionData && Object.keys(sectionData).length > 0;

        // Owner label only when a second parent exists AND this is a
        // parent-owned section (child-level sections are primary-only).
        const ownerLabel =
          hasSecondary && isParentOwnedSection(section.section)
            ? ownerLabelFor(section.ownerContributorId)
            : null;

        // Assessor-entered fields (CR-001) — badge each leaf row and
        // summarise the count in the card header.
        const provenance = asProvenanceMap(section.assessorProvenance);
        const provenanceCount = Object.keys(provenance).length;

        return (
          <Card key={section.id} className="overflow-hidden">
            <CardHeader className="bg-neutral-50 px-6 py-4 border-b border-neutral-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    {SECTION_LABELS[section.section] ?? section.section}
                  </CardTitle>
                  {ownerLabel && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {ownerLabel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {provenanceCount > 0 && (
                    <span className="whitespace-nowrap rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700">
                      {provenanceCount} field{provenanceCount === 1 ? "" : "s"}{" "}
                      entered by assessor
                    </span>
                  )}
                  <span
                    className={
                      section.isComplete
                        ? "text-xs font-medium text-green-600"
                        : "text-xs font-medium text-amber-600"
                    }
                  >
                    {section.isComplete ? "Complete" : "Incomplete"}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 py-5">
              {hasData ? (
                <DataBlock data={sectionData} provenance={provenance} />
              ) : (
                <p className="text-sm text-slate-400 italic">No data recorded.</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* CALC-10 — YoY financials history */}
      {bursaryAccountId && <AccountAdminSection yoyRows={yoyRows} />}

      {/* Forward schedule — only when the application has a bursary account (Epic 10) */}
      {bursaryAccountId && (
        <ScheduleGrid
          applicationId={application.id}
          entries={scheduleEntries}
          canManage={user.role === Role.ADMIN}
          accountId={bursaryAccountId}
          accountStatus={accountStatus ?? "ACTIVE"}
        />
      )}

      {/* Sibling Links section — only when application has a bursary account */}
      {bursaryAccountId && (
        <SiblingSection
          bursaryAccountId={bursaryAccountId}
          currentChildName={currentChildName}
          currentBursaryAccountId={bursaryAccountId}
          siblingLinks={siblingLinks}
          isAssessor={isAssessor}
        />
      )}
    </div>
  );
}

// ─── Sibling Section ──────────────────────────────────────────────────────────

import type { SiblingListItem } from "@/components/admin/sibling-list";

interface SiblingSectionProps {
  bursaryAccountId: string;
  currentChildName: string;
  currentBursaryAccountId: string;
  siblingLinks: SiblingListItem[];
  isAssessor: boolean;
}

function SiblingSection({
  bursaryAccountId,
  currentChildName,
  currentBursaryAccountId,
  siblingLinks,
  isAssessor,
}: SiblingSectionProps) {
  return (
    <section aria-labelledby="sibling-links-heading">
      <h2
        id="sibling-links-heading"
        className="mb-3 text-sm font-semibold text-slate-700"
      >
        Sibling Links
      </h2>
      <div className="space-y-3">
        {/* Current linked siblings */}
        <SiblingListCard
          siblings={siblingLinks}
          currentBursaryAccountId={currentBursaryAccountId}
          isAssessor={isAssessor}
        />

        {/* Search + link new sibling (assessor only) */}
        {isAssessor && (
          <SiblingLinkerCard
            bursaryAccountId={bursaryAccountId}
            currentChildName={currentChildName}
            isAssessor={isAssessor}
          />
        )}
      </div>
    </section>
  );
}

// ─── Account Admin Section (CALC-10) ───────────────────────────────────────────

/**
 * Epic 13 (C4b / D13-1a): this section used to pair the fees-account-code
 * editor with the YoY history. The account no longer exposes any identifier —
 * reconciliation against the fees system happens on `Application.reference` —
 * so only the read-only YoY projection remains, and the section needs neither
 * the account id nor an edit permission.
 */
interface AccountAdminSectionProps {
  yoyRows: YoyFinancialsTableRow[];
}

function AccountAdminSection({ yoyRows }: AccountAdminSectionProps) {
  return (
    <section
      aria-labelledby="account-admin-heading"
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2
        id="account-admin-heading"
        className="text-sm font-semibold text-slate-700"
      >
        Account Admin
      </h2>

      {/* CALC-10 — YoY financials history table, mirroring the workbook's
          per-assessment-year comparison (gap-analysis.md §2.2 rows 195–203). */}
      <YoyFinancialsTable rows={yoyRows} />
    </section>
  );
}
