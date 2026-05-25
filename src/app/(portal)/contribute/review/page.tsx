/**
 * Secondary-parent review & submit page — /contribute/review.
 *
 * Shows the completeness of the second parent's THREE sections, an issues panel
 * for any error-severity gaps (missing required documents etc.), and a submit
 * button. Everything is owner-scoped to the secondary's contributor — the
 * primary's data is never read here.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  Edit2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { ApplicationSectionType, ApplicationContributorStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import {
  getSecondaryContributorContext,
  type SecondaryContributorContext,
} from "@/lib/db/queries/contributors";
import { getSectionStatusList } from "@/lib/db/queries/applications";
import { getSectionGapStatuses } from "@/lib/portal/section-gaps";
import { cn } from "@/lib/utils";
import { ContributeSubmitButton } from "./submit-button";

export const metadata = { title: "Review & Submit" };

const SECONDARY_SECTIONS: ApplicationSectionType[] = [
  "PARENT_DETAILS",
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
];

const SECTION_TITLES: Record<string, string> = {
  PARENT_DETAILS: "Your Details",
  PARENTS_INCOME: "Your Income",
  ASSETS_LIABILITIES: "Your Assets & Liabilities",
};

const SECTION_SLUGS: Record<string, string> = {
  PARENT_DETAILS: "parent-details",
  PARENTS_INCOME: "parents-income",
  ASSETS_LIABILITIES: "assets-liabilities",
};

export default async function ContributeReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { ctx, statuses } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const ctx = await getSecondaryContributorContext(tx, user.id);
      if (!ctx) return { ctx: null, statuses: [] };
      const statuses = await getSectionStatusList(
        tx,
        ctx.applicationId,
        ctx.contributorId
      );
      return { ctx, statuses };
    }
  );

  if (!ctx) redirect("/");
  if (ctx.status === ApplicationContributorStatus.SUBMITTED) {
    redirect("/contribute/submitted");
  }

  const c: SecondaryContributorContext = ctx;

  // Owner-scoped gap analysis (the secondary's owned sections + own documents).
  const gapStatuses = await getSectionGapStatuses(c.applicationId, c.contributorId);
  const relevantGapStatuses = gapStatuses.filter((gs) =>
    SECONDARY_SECTIONS.includes(gs.sectionType)
  );
  const allErrorGaps = relevantGapStatuses.flatMap((gs) =>
    gs.gaps.filter((g) => g.severity === "error")
  );
  const hasBlockingGaps = allErrorGaps.length > 0;

  const completeMap = new Map(statuses.map((s) => [s.section, s.isComplete]));
  const gapMap = new Map<ApplicationSectionType, typeof allErrorGaps>();
  for (const gs of relevantGapStatuses) {
    gapMap.set(
      gs.sectionType,
      gs.gaps.filter((g) => g.severity === "error")
    );
  }

  const completedCount = SECONDARY_SECTIONS.filter(
    (s) => completeMap.get(s) === true
  ).length;
  const allComplete = completedCount === SECONDARY_SECTIONS.length;
  const canSubmit = allComplete && !hasBlockingGaps;

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Review & Submit
        </div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Review your contribution
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Please check your three sections below, then submit your part of the
          bursary application for{" "}
          <span className="font-semibold">{c.childName}</span>.
        </p>
      </div>

      {/* Issues panel OR positive state */}
      {hasBlockingGaps ? (
        <section
          aria-labelledby="issues-heading"
          className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <h2 id="issues-heading" className="text-base font-semibold text-red-800">
                {allErrorGaps.length} issue{allErrorGaps.length === 1 ? "" : "s"} to
                resolve before you can submit
              </h2>
              <ul className="mt-3 space-y-2">
                {allErrorGaps.map((gap) => {
                  const slug = SECTION_SLUGS[gap.sectionType];
                  const href = slug
                    ? `/contribute/${slug}${gap.fieldRef ? `#${gap.fieldRef}` : ""}`
                    : "#";
                  return (
                    <li key={gap.id} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                      <span className="flex-1 text-red-800">{gap.label}</span>
                      <Link
                        href={href}
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
                      >
                        Go fix this
                        <ChevronRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      ) : (
        <section
          aria-label="Contribution status"
          className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
            <p className="text-sm font-medium text-green-800">
              {allComplete
                ? "Looks complete — review your details below and submit when ready."
                : "Complete all three sections below, then submit."}
            </p>
          </div>
        </section>
      )}

      {/* Section cards */}
      <section aria-labelledby="sections-heading">
        <h2
          id="sections-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400"
        >
          Your sections
        </h2>
        <div className="space-y-4">
          {SECONDARY_SECTIONS.map((sectionType, idx) => {
            const isComplete = completeMap.get(sectionType) === true;
            const sectionErrorGaps = gapMap.get(sectionType) ?? [];
            const hasErrors = sectionErrorGaps.length > 0;
            const editHref = `/contribute/${SECTION_SLUGS[sectionType]}`;
            return (
              <div
                key={sectionType}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-white px-5 py-4 shadow-sm",
                  isComplete && !hasErrors
                    ? "border-green-200"
                    : hasErrors
                      ? "border-red-200"
                      : "border-slate-200"
                )}
              >
                <span className="text-xs font-medium text-slate-400 shrink-0">
                  {idx + 1}.
                </span>
                <h3 className="flex-1 text-sm font-semibold text-slate-800">
                  {SECTION_TITLES[sectionType]}
                </h3>
                {isComplete && !hasErrors ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Complete
                  </span>
                ) : hasErrors ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    Needs attention
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                    Not complete
                  </span>
                )}
                <Link
                  href={editHref}
                  className="shrink-0 flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                >
                  <Edit2 className="h-3 w-3" aria-hidden="true" />
                  Edit
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Submit */}
      <section aria-labelledby="submit-heading">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="submit-heading" className="text-base font-semibold text-primary-900">
            Ready to submit?
          </h2>
          {canSubmit ? (
            <p className="mt-2 text-sm text-slate-600">
              Your information will be considered confidentially alongside the
              rest of the application. You can submit when ready.
            </p>
          ) : (
            <p className="mt-2 text-sm text-red-700">
              Please complete all three sections and resolve any issues above
              before submitting.
            </p>
          )}
          <div className="mt-5">
            <ContributeSubmitButton disabled={!canSubmit} />
          </div>
        </div>
      </section>
    </div>
  );
}
