/**
 * GET /api/exports/[section] — the three export sections (Epic 23 T4/T6/T8).
 *
 *   section  workload | spend-billing | statistical (404 if not built)
 *   fields   comma-separated column keys from the field picker; absent = all;
 *            empty or unknown → 400 (validated against the section's registry)
 *   format   xlsx (default) | csv
 *   …        the section's search filters (absent = all)
 *
 * Auth as Export Recommendations: ADMIN, ASSESSOR or VIEWER (decision 14:
 * access control per section is deferred). One RLS transaction builds the
 * rows and writes the section's audit row (filters, format, column and row
 * counts); the file is built in memory after it commits.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { selectColumns } from "@/lib/export/columns";
import { buildSheetCsv, buildSheetXlsx, toSheetColumns } from "@/lib/export/build";
import { serverSection } from "@/lib/export/sections/registry";

export async function GET(
  request: NextRequest,
  { params }: { params: { section: string } }
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== Role.ADMIN && user.role !== Role.ASSESSOR && user.role !== Role.VIEWER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const section = serverSection(params.section);
  if (!section) return NextResponse.json({ error: "Unknown export" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "xlsx").toLowerCase();
  if (format !== "xlsx" && format !== "csv") {
    return NextResponse.json({ error: "format must be 'xlsx' or 'csv'" }, { status: 400 });
  }
  const selection = selectColumns(section.descriptor.columns, searchParams.get("fields"));
  if (!selection.ok) return NextResponse.json({ error: selection.error }, { status: 400 });

  const filterParams = new URLSearchParams(searchParams);
  filterParams.delete("format");
  filterParams.delete("fields");
  const parsed = section.parse(filterParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const rows = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const built = await section.buildRows(tx, parsed.filters);
      await createAuditLog(tx, {
        userId: user.id,
        action: section.auditAction,
        entityType: AUDIT_ENTITY_TYPES.Round,
        entityId: typeof parsed.filters.roundId === "string" ? parsed.filters.roundId : undefined,
        context: `Export ${section.descriptor.number}: ${section.descriptor.title}`,
        metadata: {
          filters: parsed.filters,
          format,
          columns: selection.columns.length,
          allColumns: selection.columns.length === section.descriptor.columns.length,
          rows: built.length,
        },
      });
      return built;
    },
    { timeoutMs: section.timeoutMs }
  );

  const columns = toSheetColumns(selection.columns);
  const filename = `${section.filenameStem}-${new Date().toISOString().slice(0, 10)}.${format}`;
  if (format === "csv") {
    return new NextResponse(buildSheetCsv(columns, rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const buffer = await buildSheetXlsx(columns, rows, section.sheetName);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new NextResponse(arrayBuffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
