/**
 * Export Recommendations page — /admin/exports
 *
 * Server component. Requires ASSESSOR or VIEWER role.
 * Renders a round selector, optional school filter, format toggle,
 * and a download button that calls /api/exports/recommendations.
 */

export const dynamic = "force-dynamic";

import { Download } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { listRounds } from "@/lib/db/queries/rounds";
import { ExportFilterForm } from "@/components/admin/export-filter-form";

export const metadata = {
  title: "Export Recommendations",
};

export default async function ExportsPage() {
  await requireRole([Role.ASSESSOR, Role.VIEWER]);

  const rounds = await listRounds();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
          <Download className="h-5 w-5 text-primary-700" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">
            Export Recommendations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Download a spreadsheet of recommendation data for a selected
            assessment round. Only applications with a completed recommendation
            are included.
          </p>
        </div>
      </div>

      {/* Filter form + download */}
      <ExportFilterForm rounds={rounds} />
    </div>
  );
}
