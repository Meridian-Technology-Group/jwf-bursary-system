/**
 * Assessment workspace layout — Epic 14 C3 (CG-16, D14-2).
 *
 * Wraps every assessment sub-route in Charlotte's five-tab IA:
 * UPLOADED DOCUMENTS DISPLAY · APPLICATION FORM · ASSESSMENT MODEL (1-4) ·
 * BURSARY AWARD CALCULATION (5) · ASSESSMENT ADMIN.
 *
 * The four-state lifecycle strip (Epic 15 W1) lives in the application
 * header card (Epic 15 W2 / CH-03 — the compressed banner), rendered by the
 * parent application-detail layout.
 *
 * Auth/assignment guarding stays with the parent application-detail layout;
 * per-tab data loading stays with each page (server components).
 */

import { AssessmentTabNav } from "@/components/admin/assessment-tab-nav";

export default async function AssessmentWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <div className="space-y-4">
      <AssessmentTabNav applicationId={params.id} />
      {children}
    </div>
  );
}
