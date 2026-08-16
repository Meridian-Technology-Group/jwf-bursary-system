/**
 * BURSARY AWARD CALCULATION (5) — Epic 14 C3 placeholder (CG-16, US-C8).
 *
 * WP-C7 builds the full award sheet here (sibling fees, the three award legs,
 * award summary, gap + reason codes). Until then this tab points at the
 * existing recommendation flow — where the outcome is recorded today
 * (Charlotte's CG-14 answer) — so nothing is hidden in the interim.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Calculator } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getAssessment } from "@/lib/db/queries/assessments";
import { deriveReviewPhase } from "@/lib/applications/status";

export const metadata = {
  title: "Assessment — Bursary Award Calculation",
};

interface Props {
  params: { id: string };
}

export default async function AssessmentAwardPage({ params }: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const { application, assessment } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const app = await getApplicationWithDetails(tx, params.id);
      return {
        application: app,
        assessment: app ? await getAssessment(tx, params.id) : null,
      };
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
    <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
      <Calculator className="h-12 w-12 text-slate-200" aria-hidden="true" />
      <div>
        <p className="text-base font-semibold text-slate-700">
          Bursary Award Calculation
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-400">
          The award sheet (sibling fees, the three calculation legs, the award
          summary and reason codes) is being built on this tab. Until it lands,
          the recommendation and outcome are recorded on the Recommendation
          step, exactly as before.
        </p>
      </div>
      <Link
        href={`/applications/${params.id}/recommendation`}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800"
      >
        Open the Recommendation
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
