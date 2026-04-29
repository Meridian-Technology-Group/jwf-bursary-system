/**
 * Review page — applicant reviews all sections before submitting.
 *
 * Server component. Shows:
 *   - Section completion cards (all 10 sections)
 *   - Document checklist
 *   - Issues panel (when error-severity gaps exist) — blocks submit
 *   - Submit button (disabled if any error-severity gap exists)
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Edit2, XCircle } from "lucide-react";
import { ApplicationSectionType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { getSectionGapStatuses } from "@/lib/portal/section-gaps";
import { cn } from "@/lib/utils";
import { SubmitApplicationButton } from "./submit-button";

export const metadata = {
  title: "Review Your Application",
};

// ─── Section metadata ─────────────────────────────────────────────────────────

const SECTION_ORDER: ApplicationSectionType[] = [
  "CHILD_DETAILS",
  "FAMILY_ID",
  "PARENT_DETAILS",
  "DEPENDENT_CHILDREN",
  "DEPENDENT_ELDERLY",
  "OTHER_INFO",
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
  "ADDITIONAL_INFO",
  "DECLARATION",
];

const SECTION_TITLES: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "Details of Child",
  FAMILY_ID: "Family Identification",
  PARENT_DETAILS: "Parent / Guardian Details",
  DEPENDENT_CHILDREN: "Dependent Children",
  DEPENDENT_ELDERLY: "Dependent Elderly",
  OTHER_INFO: "Other Information Required",
  PARENTS_INCOME: "Parents' Income",
  ASSETS_LIABILITIES: "Parents' Assets & Liabilities",
  ADDITIONAL_INFO: "Additional Information",
  DECLARATION: "Declaration",
};

const SECTION_SLUGS: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "child-details",
  FAMILY_ID: "family-id",
  PARENT_DETAILS: "parent-details",
  DEPENDENT_CHILDREN: "dependent-children",
  DEPENDENT_ELDERLY: "dependent-elderly",
  OTHER_INFO: "other-info",
  PARENTS_INCOME: "parents-income",
  ASSETS_LIABILITIES: "assets-liabilities",
  ADDITIONAL_INFO: "additional-info",
  DECLARATION: "declaration",
};

// ─── Document checklist definition ───────────────────────────────────────────

interface DocumentSlotDef {
  slot: string;
  label: string;
  required: boolean;
}

const DOCUMENT_CHECKLIST: DocumentSlotDef[] = [
  { slot: "BIRTH_CERTIFICATE", label: "Birth Certificate", required: true },
  { slot: "UK_PASSPORT_PARENT_1", label: "UK Passport — Parent/Guardian 1", required: false },
  { slot: "PASSPORT_PARENT_1", label: "Passport — Parent/Guardian 1", required: false },
  { slot: "UK_PASSPORT_PARENT_2", label: "UK Passport — Parent/Guardian 2", required: false },
  { slot: "PASSPORT_PARENT_2", label: "Passport — Parent/Guardian 2", required: false },
  { slot: "P60_PARENT_1", label: "P60 — Parent/Guardian 1", required: false },
  { slot: "P60_PARENT_2", label: "P60 — Parent/Guardian 2", required: false },
  { slot: "SELF_ASSESSMENT_PARENT_1", label: "Self-Assessment Tax Return — Parent/Guardian 1", required: false },
  { slot: "SELF_ASSESSMENT_PARENT_2", label: "Self-Assessment Tax Return — Parent/Guardian 2", required: false },
  { slot: "CERTIFIED_ACCOUNTS_PARENT_1", label: "Certified Accounts — Parent/Guardian 1", required: false },
  { slot: "CERTIFIED_ACCOUNTS_PARENT_2", label: "Certified Accounts — Parent/Guardian 2", required: false },
  { slot: "BANK_STATEMENT_PARENT_1", label: "Bank Statement — Parent/Guardian 1", required: false },
  { slot: "BANK_STATEMENT_PARENT_2", label: "Bank Statement — Parent/Guardian 2", required: false },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Load the user's application and all related data in one query
  const application = await prisma.application.findFirst({
    where: { leadApplicantId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      sections: {
        select: { section: true, isComplete: true },
      },
      documents: {
        select: { slot: true, filename: true },
      },
    },
  });

  if (!application) redirect("/");

  // If already submitted, redirect to confirmation
  if (application.status === "SUBMITTED") {
    redirect("/submitted");
  }

  // ── Gap analysis ───────────────────────────────────────────────────────────
  const gapStatuses = await getSectionGapStatuses(application.id);

  // All error-severity gaps across all sections
  const allErrorGaps = gapStatuses.flatMap((gs) =>
    gs.gaps.filter((g) => g.severity === "error")
  );
  const hasBlockingGaps = allErrorGaps.length > 0;

  // Section-level view: isFullyValid from the gap model
  const validMap = new Map<ApplicationSectionType, boolean>();
  const gapMap = new Map<ApplicationSectionType, typeof allErrorGaps>();
  for (const gs of gapStatuses) {
    validMap.set(gs.sectionType as ApplicationSectionType, gs.isFullyValid);
    gapMap.set(
      gs.sectionType as ApplicationSectionType,
      gs.gaps.filter((g) => g.severity === "error")
    );
  }

  const uploadedSlots = new Set(application.documents.map((d) => d.slot));

  const completedCount = SECTION_ORDER.filter(
    (s) => validMap.get(s) === true
  ).length;

  // Progress: sum of partial satisfied/total from gap model
  const totalSatisfied = gapStatuses.reduce(
    (acc, gs) => acc + gs.progress.satisfied,
    0
  );
  const totalItems = gapStatuses.reduce(
    (acc, gs) => acc + gs.progress.total,
    0
  );
  const progressPct =
    totalItems > 0
      ? parseFloat(((totalSatisfied / totalItems) * 100).toFixed(1))
      : 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Final step
        </div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Review Your Application
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Here is your application — please review each section before
          submitting. You can edit any section by clicking the Edit button.
        </p>
      </div>

      {/* Progress summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Sections fully complete</span>
          <span className="font-semibold text-primary-900">
            {completedCount} of {SECTION_ORDER.length}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-accent-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progressPct}% of required items complete`}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-400 text-right">{progressPct}%</p>
      </div>

      {/* ── Issues panel — shown only when blocking gaps exist ─────────────── */}
      {hasBlockingGaps && (
        <section
          aria-labelledby="issues-heading"
          className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <XCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <h2
                id="issues-heading"
                className="text-base font-semibold text-red-800"
              >
                {allErrorGaps.length} issue{allErrorGaps.length === 1 ? "" : "s"} to resolve before you can submit
              </h2>
              <p className="mt-1 text-sm text-red-700">
                Please fix the following before submitting your application.
              </p>
              <ul className="mt-3 space-y-2">
                {allErrorGaps.map((gap) => {
                  const slug = SECTION_SLUGS[gap.sectionType as ApplicationSectionType];
                  const href = slug ? `/apply/${slug}` : "#";
                  return (
                    <li key={gap.id} className="flex items-start gap-2 text-sm">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-red-800">{gap.label}</span>
                      <Link
                        href={href}
                        className="shrink-0 text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
                      >
                        Go to section
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Section summary cards */}
      <section aria-labelledby="sections-heading">
        <h2
          id="sections-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400"
        >
          Application sections
        </h2>

        <div className="space-y-3">
          {SECTION_ORDER.map((sectionType, idx) => {
            const isFullyValid = validMap.get(sectionType) === true;
            const sectionErrorGaps = gapMap.get(sectionType) ?? [];
            const hasErrors = sectionErrorGaps.length > 0;
            const editHref = `/apply/${SECTION_SLUGS[sectionType]}`;

            return (
              <div
                key={sectionType}
                className={cn(
                  "rounded-xl border p-4 flex items-center gap-4",
                  isFullyValid
                    ? "border-green-200 bg-green-50"
                    : hasErrors
                      ? "border-red-200 bg-red-50"
                      : "border-amber-200 bg-amber-50"
                )}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {isFullyValid ? (
                    <CheckCircle2
                      className="h-5 w-5 text-green-600"
                      aria-label="Complete"
                    />
                  ) : hasErrors ? (
                    <AlertTriangle
                      className="h-5 w-5 text-red-500"
                      aria-label="Has issues"
                    />
                  ) : (
                    <AlertTriangle
                      className="h-5 w-5 text-amber-500"
                      aria-label="Incomplete"
                    />
                  )}
                </div>

                {/* Section info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400 font-medium">
                      {idx + 1}.
                    </span>
                    <span className="text-sm font-medium text-slate-800">
                      {SECTION_TITLES[sectionType]}
                    </span>
                  </div>

                  {isFullyValid ? (
                    <p className="mt-0.5 text-xs text-green-700">Complete</p>
                  ) : hasErrors ? (
                    <p className="mt-0.5 text-xs text-red-700">
                      {sectionErrorGaps.length} issue{sectionErrorGaps.length === 1 ? "" : "s"} — please resolve before submitting
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-amber-700">
                      Incomplete — please complete this section before submitting
                    </p>
                  )}
                </div>

                {/* Edit link */}
                <Link
                  href={editHref}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium",
                    "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
                    isFullyValid
                      ? "border-green-300 bg-white text-green-800 hover:bg-green-100"
                      : hasErrors
                        ? "border-red-300 bg-white text-red-800 hover:bg-red-100"
                        : "border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                  )}
                >
                  <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Document checklist */}
      <section aria-labelledby="documents-heading">
        <h2
          id="documents-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400"
        >
          Supporting documents
        </h2>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {DOCUMENT_CHECKLIST.map(({ slot, label, required }) => {
              const uploaded = uploadedSlots.has(slot);
              return (
                <div
                  key={slot}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      uploaded
                        ? "bg-green-100 text-green-700"
                        : required
                          ? "bg-red-100 text-red-600"
                          : "bg-slate-100 text-slate-400"
                    )}
                    aria-label={uploaded ? "Uploaded" : "Not uploaded"}
                  >
                    {uploaded ? "✓" : "✗"}
                  </span>

                  <span className="flex-1 text-sm text-slate-700">
                    {label}
                    {required && (
                      <span
                        className="ml-1 text-error-600"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    )}
                  </span>

                  {!uploaded && (
                    <span className="text-xs text-slate-400">
                      {required ? "Required" : "Optional"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Submit section */}
      <section aria-labelledby="submit-heading">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2
            id="submit-heading"
            className="text-base font-semibold text-primary-900"
          >
            Ready to submit?
          </h2>

          {!hasBlockingGaps && completedCount === SECTION_ORDER.length ? (
            <p className="mt-2 text-sm text-slate-600">
              All sections are complete. Once submitted, you will receive a
              confirmation email with your application reference number.
            </p>
          ) : hasBlockingGaps ? (
            <p className="mt-2 text-sm text-red-700">
              You have {allErrorGaps.length} unresolved issue{allErrorGaps.length === 1 ? "" : "s"}. Please fix them (see the issues panel above) before submitting.
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-700">
              You have {SECTION_ORDER.length - completedCount} incomplete{" "}
              {SECTION_ORDER.length - completedCount === 1
                ? "section"
                : "sections"}
              . Please complete all sections before submitting.
            </p>
          )}

          <div className="mt-5">
            <SubmitApplicationButton
              applicationId={application.id}
              disabled={hasBlockingGaps || completedCount < SECTION_ORDER.length}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
