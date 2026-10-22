/**
 * Exports page — /exports
 *
 * Server component. Requires ADMIN, ASSESSOR, or VIEWER role.
 *
 * Epic 23: Charlotte's export sections (EXPORTS.xlsx, 15 Oct 2026), each with
 * its search form and field picker (→ /api/exports/<section>), above the
 * original Export Recommendations card (round selector, school filter,
 * format → /api/exports/recommendations).
 */

export const dynamic = "force-dynamic";

import { Download } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { listRounds } from "@/lib/db/queries/rounds";
import { ExportFilterForm } from "@/components/admin/export-filter-form";
import { SectionExportCard } from "@/components/admin/exports/section-export-card";
import { SECTION_DESCRIPTORS } from "@/lib/export/sections/descriptors";

export const metadata = {
  title: "Exports",
};

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: { roundId?: string };
}) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const rounds = await withUserContext(user.id, user.role as RlsRole, (tx) =>
    listRounds(tx)
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
          <Download className="h-5 w-5 text-primary-700" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Exports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose the search selection and the fields to return, then download
            the spreadsheet. Every field is ticked to start with: untick any you
            don&apos;t need for a shorter report.
          </p>
        </div>
      </div>

      {SECTION_DESCRIPTORS.map((section) => (
        <SectionExportCard
          key={section.key}
          section={section}
          rounds={rounds.map((r) => ({ id: r.id, academicYear: r.academicYear, status: r.status }))}
        />
      ))}

      {/* Model Variance Audit (WP-17's Export Recommendations, renamed 17 Oct) */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-primary-900">Model Variance Audit</h2>
        <p className="text-sm text-slate-500">
          The recommendations for a selected round, with the gaps and variances
          between the model's figure and the confirmed one. Only applications
          with a recommendation are included.
        </p>
        <ExportFilterForm rounds={rounds} defaultRoundId={searchParams.roundId} />
      </div>
    </div>
  );
}
