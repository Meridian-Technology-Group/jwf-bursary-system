/**
 * WP-21: GET /api/pdf/recommendation/[applicationId]
 *
 * Generates and streams a PDF recommendation document for the given
 * application. Requires ASSESSOR or VIEWER role.
 *
 * Returns:
 *   200  application/pdf   — rendered PDF buffer
 *   401  Unauthorized      — no session
 *   403  Forbidden         — insufficient role
 *   404  Not Found         — application or recommendation not found
 *   500  Internal          — rendering failure
 *
 * Runtime: nodejs (required — @react-pdf/renderer is not edge-compatible)
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole, Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import {
  RecommendationPDF,
  type ReasonCodeEntry,
} from "@/lib/pdf/recommendation-pdf";

interface RouteParams {
  params: Promise<{ applicationId: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  // ── Auth ───────────────────────────────────────────────────────────────────

  let user;
  try {
    user = await requireRole([Role.ASSESSOR, Role.VIEWER]);
  } catch {
    // requireRole throws a Next.js redirect for unauthenticated / wrong-role users.
    // In a route handler context, re-return appropriate HTTP responses instead.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { applicationId } = await params;

  // ── Fetch application with all relations needed for the PDF ────────────────

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      reference: true,
      school: true,
      childName: true,
      round: {
        select: { academicYear: true },
      },
      assessment: {
        select: {
          id: true,
          familyTypeCategory: true,
          totalHouseholdNetIncome: true,
          netAssetsYearlyValuation: true,
          grossFees: true,
          scholarshipPct: true,
          bursaryAward: true,
          yearlyPayableFees: true,
          monthlyPayableFees: true,
          dishonestyFlag: true,
          creditRiskFlag: true,
          recommendation: {
            select: {
              id: true,
              familySynopsis: true,
              accommodationStatus: true,
              incomeCategory: true,
              propertyCategory: true,
              bursaryAward: true,
              yearlyPayableFees: true,
              monthlyPayableFees: true,
              dishonestyFlag: true,
              creditRiskFlag: true,
              summary: true,
              reasonCodes: {
                include: {
                  reasonCode: {
                    select: { code: true, label: true },
                  },
                },
                orderBy: { reasonCode: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    },
  });

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  }

  const { assessment } = application;

  if (!assessment || !assessment.recommendation) {
    return NextResponse.json(
      { error: "Recommendation not found" },
      { status: 404 }
    );
  }

  const { recommendation } = assessment;

  // ── Convert Decimal → number ────────────────────────────────────────────────

  const toNum = (v: unknown): number | null => {
    if (v == null) return null;
    const n = parseFloat(String(v));
    return isNaN(n) ? null : n;
  };

  const reasonCodes: ReasonCodeEntry[] = recommendation.reasonCodes.map(
    (rc) => ({
      code: rc.reasonCode.code,
      label: rc.reasonCode.label,
    })
  );

  // Derive the bursary award and fees: prefer recommendation values (which may
  // have been manually adjusted), fall back to assessment values.
  const bursaryAward =
    toNum(recommendation.bursaryAward) ?? toNum(assessment.bursaryAward);
  const yearlyPayableFees =
    toNum(recommendation.yearlyPayableFees) ??
    toNum(assessment.yearlyPayableFees);
  const monthlyPayableFees =
    toNum(recommendation.monthlyPayableFees) ??
    toNum(assessment.monthlyPayableFees);

  const pdfProps = {
    // Header
    reference: application.reference,
    school: application.school,
    academicYear: application.round.academicYear,
    childName: application.childName,

    // Family Assessment
    familyTypeCategory: assessment.familyTypeCategory,
    accommodationStatus: recommendation.accommodationStatus,
    familySynopsis: recommendation.familySynopsis,

    // Financial Summary
    totalHouseholdNetIncome: toNum(assessment.totalHouseholdNetIncome),
    netAssetsYearlyValuation: toNum(assessment.netAssetsYearlyValuation),
    grossFees: toNum(assessment.grossFees),
    scholarshipPct: toNum(assessment.scholarshipPct),
    bursaryAward,
    yearlyPayableFees,
    monthlyPayableFees,

    // Flags — use assessment flags (source of truth)
    dishonestyFlag: assessment.dishonestyFlag,
    creditRiskFlag: assessment.creditRiskFlag,

    // Reason codes
    reasonCodes,

    // Narrative
    summary: recommendation.summary,

    // Outcome
    incomeCategory: recommendation.incomeCategory,
    propertyCategory: recommendation.propertyCategory,

    // Meta
    generatedAt: new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
  };

  // ── Render PDF ──────────────────────────────────────────────────────────────

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(<RecommendationPDF {...pdfProps} />);
  } catch (err) {
    console.error("[pdf/recommendation] renderToBuffer failed:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }

  // Sanitise filename — replace any non-alphanumeric/dash chars
  const safeRef = application.reference.replace(/[^a-zA-Z0-9-]/g, "-");
  const filename = `recommendation-${safeRef}.pdf`;

  // Convert Buffer to Uint8Array for the Web Response API
  const body = new Uint8Array(pdfBuffer);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      // Prevent caching of sensitive documents
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Generated-By": user.id,
    },
  });
}
