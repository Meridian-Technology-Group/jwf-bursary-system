/**
 * GET /api/exports/recommendations
 *
 * Streams a downloadable XLSX or CSV file containing recommendation data
 * for all applications in the requested round.
 *
 * Query params:
 *   roundId  (required) — UUID of the assessment round
 *   school   (optional) — "TRINITY" | "WHITGIFT"
 *   format   (optional) — "xlsx" (default) | "csv"
 *
 * Auth: ASSESSOR or VIEWER role required.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { getExportRows } from "@/lib/db/queries/exports";
import { buildXlsxBuffer, buildCsvString } from "@/lib/export/xlsx";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth guard ───────────────────────────────────────────────────────────────
  // Use getCurrentUser (not requireRole) so we return JSON rather than
  // triggering a redirect in a Route Handler context.
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== Role.ASSESSOR && user.role !== Role.VIEWER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Parse query params ───────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const roundId = searchParams.get("roundId");
  const school = searchParams.get("school") ?? undefined;
  const format = (searchParams.get("format") ?? "xlsx").toLowerCase();

  if (!roundId) {
    return NextResponse.json(
      { error: "roundId query parameter is required" },
      { status: 400 }
    );
  }

  if (format !== "xlsx" && format !== "csv") {
    return NextResponse.json(
      { error: "format must be 'xlsx' or 'csv'" },
      { status: 400 }
    );
  }

  if (school && school !== "TRINITY" && school !== "WHITGIFT") {
    return NextResponse.json(
      { error: "school must be 'TRINITY' or 'WHITGIFT'" },
      { status: 400 }
    );
  }

  // ── Resolve round name for the filename ─────────────────────────────────────
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { academicYear: true },
  });

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const safeName = round.academicYear.replace(/[^a-zA-Z0-9-_]/g, "-");

  // ── Fetch data ───────────────────────────────────────────────────────────────
  const rows = await getExportRows(roundId, school);

  // ── Build response ───────────────────────────────────────────────────────────
  if (format === "csv") {
    const csv = buildCsvString(rows);
    const filename = `recommendations-${safeName}-${dateStr}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: xlsx
  const buffer = await buildXlsxBuffer(rows);
  const filename = `recommendations-${safeName}-${dateStr}.xlsx`;

  // Slice the underlying ArrayBuffer to the exact bounds of the Buffer view
  // so NextResponse receives an unambiguous ArrayBuffer (accepted as BodyInit).
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );

  return new NextResponse(arrayBuffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
