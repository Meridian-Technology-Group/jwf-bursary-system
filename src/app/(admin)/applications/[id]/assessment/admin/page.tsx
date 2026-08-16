/**
 * ASSESSMENT ADMIN — Epic 14 C3 placeholder shell (CG-24, US-C9).
 *
 * WP-C8 builds the full tab (account synopsis + assessor's wizard blocks with
 * the header strip, the year-on-year history table, and the payable-fees
 * schedule). Until then this tab hosts the ACCOUNT SYNOPSIS — its natural
 * workbook home (sheet 3) — using the existing component and its own save
 * path, plus the previous assessment's wizard notes when they exist.
 * The editable "things to look out for" notes stay in the Assessment Model
 * tab's form (their save rides the assessment form) until C8 relocates them.
 */

import { notFound, redirect } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getAssessment } from "@/lib/db/queries/assessments";
import { getPreviousWatchOutNotes } from "@/lib/db/queries/reassessment";
import { deriveReviewPhase } from "@/lib/applications/status";
import { AssessmentSynopsis } from "@/components/admin/assessment-synopsis";

export const metadata = {
  title: "Assessment — Admin",
};

interface Props {
  params: { id: string };
}

export default async function AssessmentAdminPage({ params }: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const { application, assessment, watchOut } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const app = await getApplicationWithDetails(tx, params.id);
      if (!app) return { application: null, assessment: null, watchOut: null };
      const a = await getAssessment(tx, params.id);
      const notes = app.bursaryAccountId
        ? await getPreviousWatchOutNotes(tx, app.bursaryAccountId, params.id)
        : null;
      return { application: app, assessment: a, watchOut: notes };
    }
  );
  if (!application) notFound();

  const reviewPhase = deriveReviewPhase({
    formStatus: application.formStatus,
    assessmentStatus: assessment?.status ?? null,
    outcome: assessment?.outcome ?? null,
    closedAt: application.closedAt,
  });
  if (reviewPhase === "PRE_SUBMISSION") {
    redirect(`/applications/${params.id}`);
  }

  return (
    <div className="space-y-5">
      {/* Account reference strip (sheet 3 header; Fees Account Code renders
          the editable Application.reference — D13-1a). */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm shadow-sm">
        <span className="font-mono font-semibold text-primary-900">
          {application.reference}
        </span>
        <span className="text-slate-600">
          {application.school === "TRINITY" ? "Trinity School" : "Whitgift School"}
        </span>
        <span className="text-slate-500">
          {application.round.academicYear} assessment round
        </span>
      </div>

      {/* Previous assessor's wizard notes (CALC-10) — read-only context. */}
      {watchOut && (
        <div
          role="note"
          aria-label="Assessor's wizard"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <Lightbulb
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Assessor&apos;s wizard — from {watchOut.academicYear}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-amber-800">
              {watchOut.watchOutNotes}
            </p>
          </div>
        </div>
      )}

      {/* Account synopsis — the workbook's sheet-3 free-text block; existing
          component + save path, editable even after completion. */}
      {assessment ? (
        <AssessmentSynopsis
          assessmentId={assessment.id}
          applicationId={params.id}
          synopsis={assessment.synopsis}
          assessmentCompleted={assessment.status === "COMPLETED"}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">
            The account synopsis becomes available once the assessment has been
            started (Assessment Model tab).
          </p>
        </div>
      )}

      <p className="text-xs text-slate-400">
        The year-on-year history and payable-fees schedule tables are being
        built on this tab. The editable &quot;things to look out for with this
        family&quot; notes currently live in the Assessment Model tab&apos;s
        Assessor&apos;s Wizard section.
      </p>
    </div>
  );
}
