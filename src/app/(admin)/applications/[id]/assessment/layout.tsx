/**
 * Assessment workspace layout — Epic 14 C3 (CG-16, D14-2).
 *
 * Wraps every assessment sub-route in Charlotte's five-tab IA:
 * UPLOADED DOCUMENTS DISPLAY · APPLICATION FORM · ASSESSMENT MODEL (1-5) ·
 * BURSARY AWARD CALCULATION (6) · ASSESSMENT ADMIN.
 *
 * The four-state lifecycle strip (Epic 15 W1) lives in the application
 * header card (Epic 15 W2 / CH-03 — the compressed banner), rendered by the
 * parent application-detail layout.
 *
 * Auth/assignment guarding stays with the parent application-detail layout;
 * per-tab data loading stays with each page (server components).
 */

import { AssessmentTabNav } from "@/components/admin/assessment-tab-nav";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { isMigrated } from "@/lib/applications/migration-source";

export default async function AssessmentWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  // GT migration (PR-D): a migrated application has no form to show.
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);
  const app = await withUserContext(user.id, user.role as RlsRole, (tx) =>
    tx.application.findUnique({
      where: { id: params.id },
      select: { migrationSource: true },
    })
  );

  return (
    <div className="space-y-4">
      <AssessmentTabNav
        applicationId={params.id}
        applicationFormDisabled={app ? isMigrated(app) : false}
      />
      {children}
    </div>
  );
}
