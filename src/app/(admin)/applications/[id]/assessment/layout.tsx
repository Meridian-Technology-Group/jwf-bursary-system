/**
 * Assessment workspace layout — Epic 14 C3 (CG-16, D14-2).
 *
 * Wraps every assessment sub-route in Charlotte's five-tab IA:
 * UPLOADED DOCUMENTS DISPLAY · APPLICATION FORM · ASSESSMENT MODEL (1-4) ·
 * BURSARY AWARD CALCULATION (5) · ASSESSMENT ADMIN.
 *
 * Epic 15 W1 (CH-05): the four-state lifecycle strip renders above the tab
 * row on every workspace tab — one green chip, derived from the assessment
 * row (LA15-1). W2 folds it into the compressed header.
 *
 * Auth/assignment guarding stays with the parent application-detail layout;
 * per-tab data loading stays with each page (server components).
 */

import { withAdminContext } from "@/lib/db/prisma";
import { deriveAssessmentLifecycleState } from "@/lib/assessments/lifecycle-state";
import { AssessmentLifecycleStrip } from "@/components/admin/assessment-lifecycle-strip";
import { AssessmentTabNav } from "@/components/admin/assessment-tab-nav";

export default async function AssessmentWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  // Access is already guarded by the parent application-detail layout; this
  // is a display-only read of the lifecycle inputs.
  const row = await withAdminContext((tx) =>
    tx.application.findUnique({
      where: { id: params.id },
      select: {
        closedAt: true,
        assessment: { select: { status: true, outcome: true } },
      },
    })
  );

  const lifecycleState = deriveAssessmentLifecycleState({
    assessmentStatus: row?.assessment?.status ?? null,
    outcome: row?.assessment?.outcome ?? null,
    closedAt: row?.closedAt ?? null,
  });

  return (
    <div className="space-y-4">
      <AssessmentLifecycleStrip state={lifecycleState} />
      <AssessmentTabNav applicationId={params.id} />
      {children}
    </div>
  );
}
