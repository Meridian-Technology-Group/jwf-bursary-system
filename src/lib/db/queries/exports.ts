/**
 * Export queries for WP-17 — Exports (XLSX & CSV Download).
 *
 * Returns flattened, serialisation-safe rows that join:
 *   Application → Assessment → Recommendation → ReasonCodes
 *
 * All Prisma Decimal fields are converted to `number` via Number(decimal)
 * before returning so the data is safe to cross server/client boundaries.
 */

import type { Tx } from "@/lib/db/prisma";
import type { AssessmentOutcome } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportRow {
  reference: string;
  childFirstName: string;
  childLastName: string;
  school: string;
  familySynopsis: string;
  accommodationType: string;
  incomeCategory: string;
  propertyCategory: string;
  bursaryAward: number | null;
  yearlyPayableFees: number | null;
  monthlyPayableFees: number | null;
  reasonCodes: string;
  flags: string;
  outcome: string;
  /**
   * CALC-12 — v2-only fields (min-of-three / gap tracking, CALC-06/08). All
   * null/blank for v1 rows, which never populate these columns.
   */
  recommendedPayableFees: number | null;
  confirmedPayableFees: number | null;
  gapAmount: number | null;
  /** Gap reasons as comma-separated "code – label" strings (mirrors `reasonCodes`). */
  gapReasons: string;
  /** `Assessment.debtStatusLabel` (v2 only). */
  debtStatus: string;
  /** `Assessment.lifestyleSqueezeLabel` (v2 only). */
  lifestyleSqueezeLabel: string;
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Returns typed ExportRow[] for all applications in a given round,
 * optionally filtered by school.
 *
 * Only applications that have a completed Recommendation are included.
 */
export async function getExportRows(
  tx: Tx,
  roundId: string,
  school?: string
): Promise<ExportRow[]> {
  const rows = await tx.application.findMany({
    where: {
      roundId,
      ...(school ? { school: school as "TRINITY" | "WHITGIFT" } : {}),
      assessment: {
        recommendation: {
          isNot: null,
        },
      },
    },
    select: {
      reference: true,
      childName: true,
      school: true,
      assessment: {
        select: {
          outcome: true,
          synopsis: true,
          // CALC-12: v2-only snapshot fields, null for v1 assessments.
          debtStatusLabel: true,
          lifestyleSqueezeLabel: true,
          recommendation: {
            select: {
              familySynopsis: true,
              accommodationStatus: true,
              incomeCategory: true,
              propertyCategory: true,
              bursaryAward: true,
              yearlyPayableFees: true,
              monthlyPayableFees: true,
              dishonestyFlag: true,
              creditRiskFlag: true,
              // CALC-12: v2 min-of-three / gap-tracking fields (CALC-06/08),
              // null for v1 recommendations.
              recommendedPayableFees: true,
              confirmedPayableFees: true,
              gapAmount: true,
              reasonCodes: {
                select: {
                  reasonCode: {
                    select: {
                      code: true,
                      label: true,
                    },
                  },
                },
                orderBy: {
                  reasonCode: { sortOrder: "asc" },
                },
              },
              gapReasons: {
                select: {
                  gapReason: {
                    select: {
                      code: true,
                      label: true,
                    },
                  },
                },
                orderBy: {
                  gapReason: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { reference: "asc" },
  });

  return rows.map(mapExportRow);
}

// ─── Row mapping (pure — exported for unit testing) ──────────────────────────

/** The shape `getExportRows`' Prisma query resolves to, per application row. */
export interface ExportRowSource {
  reference: string;
  childName: string | null;
  school: string;
  assessment: {
    outcome: AssessmentOutcome | null;
    synopsis: string | null;
    debtStatusLabel: string | null;
    lifestyleSqueezeLabel: string | null;
    recommendation: {
      familySynopsis: string | null;
      accommodationStatus: string | null;
      incomeCategory: string | null;
      propertyCategory: number | null;
      bursaryAward: unknown;
      yearlyPayableFees: unknown;
      monthlyPayableFees: unknown;
      dishonestyFlag: boolean;
      creditRiskFlag: boolean;
      recommendedPayableFees: unknown;
      confirmedPayableFees: unknown;
      gapAmount: unknown;
      reasonCodes: { reasonCode: { code: number; label: string } }[];
      gapReasons: { gapReason: { code: number; label: string } }[];
    } | null;
  } | null;
}

/** Converts a Prisma Decimal (or number/string) to a plain number, or null. */
function decimalToNumber(value: unknown): number | null {
  return value != null ? Number(value) : null;
}

/**
 * Maps one application row (with its assessment/recommendation) to a flat
 * `ExportRow`. Pure — no DB access — so it is unit-testable directly against
 * fixture shapes for both a v1 and a v2 row.
 */
export function mapExportRow(app: ExportRowSource): ExportRow {
  const rec = app.assessment?.recommendation;
  const outcome = app.assessment?.outcome ?? null;

  // Split childName into first/last (stored as a single string)
  const nameParts = (app.childName ?? "").trim().split(/\s+/);
  const childFirstName = nameParts[0] ?? "";
  const childLastName = nameParts.slice(1).join(" ");

  // Reason codes as comma-separated "code – label" strings
  const reasonCodes = (rec?.reasonCodes ?? [])
    .map(({ reasonCode }) => `${reasonCode.code} – ${reasonCode.label}`)
    .join(", ");

  // CALC-12: gap reasons, same "code – label" join as reasonCodes. Empty for
  // v1 rows (no gapReasons relation ever populated) and for v2 rows with no
  // material gap.
  const gapReasons = (rec?.gapReasons ?? [])
    .map(({ gapReason }) => `${gapReason.code} – ${gapReason.label}`)
    .join(", ");

  // Flags
  const flagList: string[] = [];
  if (rec?.dishonestyFlag) flagList.push("Dishonesty");
  if (rec?.creditRiskFlag) flagList.push("Credit Risk");
  const flags = flagList.join(", ");

  // Outcome label
  const outcomeLabel = formatOutcome(outcome);

  return {
    reference: app.reference,
    childFirstName,
    childLastName,
    school: app.school,
    // Epic 06: prefer the legacy recommendation synopsis for historical rows;
    // fall back to the single Assessment.synopsis for newer assessments.
    familySynopsis: rec?.familySynopsis ?? app.assessment?.synopsis ?? "",
    accommodationType: rec?.accommodationStatus ?? "",
    incomeCategory: rec?.incomeCategory ?? "",
    propertyCategory:
      rec?.propertyCategory != null ? String(rec.propertyCategory) : "",
    bursaryAward: decimalToNumber(rec?.bursaryAward),
    yearlyPayableFees: decimalToNumber(rec?.yearlyPayableFees),
    monthlyPayableFees: decimalToNumber(rec?.monthlyPayableFees),
    reasonCodes,
    flags,
    outcome: outcomeLabel,
    // CALC-12: v2-only columns — blank/null for v1 rows.
    recommendedPayableFees: decimalToNumber(rec?.recommendedPayableFees),
    confirmedPayableFees: decimalToNumber(rec?.confirmedPayableFees),
    gapAmount: decimalToNumber(rec?.gapAmount),
    gapReasons,
    debtStatus: app.assessment?.debtStatusLabel ?? "",
    lifestyleSqueezeLabel: app.assessment?.lifestyleSqueezeLabel ?? "",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatOutcome(outcome: AssessmentOutcome | null): string {
  if (!outcome) return "";
  switch (outcome) {
    case "QUALIFIES":
      return "Qualifies";
    case "DOES_NOT_QUALIFY":
      return "Does Not Qualify";
    default:
      return outcome;
  }
}
