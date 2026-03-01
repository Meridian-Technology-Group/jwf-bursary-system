/**
 * Review page — applicant reviews all sections before submitting.
 *
 * Server component. Shows:
 *   - Section completion cards (all 10 sections)
 *   - Document checklist
 *   - Submit button (disabled if any required section is incomplete)
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Edit2 } from "lucide-react";
import { ApplicationSectionType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
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

  // Build a quick lookup map
  const completionMap = new Map<ApplicationSectionType, boolean>();
  for (const s of application.sections) {
    completionMap.set(s.section, s.isComplete);
  }

  const uploadedSlots = new Set(application.documents.map((d) => d.slot));

  const allSectionsComplete = SECTION_ORDER.every(
    (s) => completionMap.get(s) === true
  );

  const completedCount = SECTION_ORDER.filter(
    (s) => completionMap.get(s) === true
  ).length;

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
          <span className="text-slate-500">Sections complete</span>
          <span className="font-semibold text-primary-900">
            {completedCount} of {SECTION_ORDER.length}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-accent-600 transition-all duration-500"
            style={{
              width: `${Math.round((completedCount / SECTION_ORDER.length) * 100)}%`,
            }}
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={SECTION_ORDER.length}
            aria-label={`${completedCount} of ${SECTION_ORDER.length} sections complete`}
          />
        </div>
      </div>

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
            const isComplete = completionMap.get(sectionType) === true;
            const editHref = `/apply/${SECTION_SLUGS[sectionType]}`;

            return (
              <div
                key={sectionType}
                className={cn(
                  "rounded-xl border p-4 flex items-center gap-4",
                  isComplete
                    ? "border-green-200 bg-green-50"
                    : "border-amber-200 bg-amber-50"
                )}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {isComplete ? (
                    <CheckCircle2
                      className="h-5 w-5 text-green-600"
                      aria-label="Complete"
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

                  {isComplete ? (
                    <p className="mt-0.5 text-xs text-green-700">Complete</p>
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
                    isComplete
                      ? "border-green-300 bg-white text-green-800 hover:bg-green-100"
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

          {allSectionsComplete ? (
            <p className="mt-2 text-sm text-slate-600">
              All sections are complete. Once submitted, you will receive a
              confirmation email with your application reference number.
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
              disabled={!allSectionsComplete}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
