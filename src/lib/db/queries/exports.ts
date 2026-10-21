/**
 * Export queries for WP-17 — Exports (XLSX & CSV Download).
 *
 * Returns flattened, serialisation-safe rows that join:
 *   Application → Assessment → Recommendation → ReasonCodes
 *
 * All Prisma Decimal fields are converted to `number` via Number(decimal)
 * before returning so the data is safe to cross server/client boundaries.
 */

import type { School } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import type { AssessmentOutcome } from "@prisma/client";
import {
  mainGapReason,
  scholarshipAdjustedGap,
} from "@/lib/reason-codes/gap-metrics";
import { raisedFlagLabels } from "@/lib/assessment/recommendation-flags";
import { accommodationLabel } from "@/lib/export/accommodation";

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
  /**
   * Epic 21 #2 — the highest-ranked gap reason ("code – label"), which takes
   * the full justification of the gap. Blank when there are no gap reasons.
   */
  mainGapReason: string;
  /**
   * Epic 21 #1 — gap + scholarship spend incl VAT (`gap-metrics.ts`). Equals
   * `gapAmount` when there is no scholarship; null when `gapAmount` is null.
   */
  scholarshipAdjustedGap: number | null;
  /** `Assessment.debtStatusLabel` (v2 only). */
  debtStatus: string;
  /** `Assessment.lifestyleSqueezeLabel` (v2 only). */
  lifestyleSqueezeLabel: string;
  /**
   * Epic 13 / C2 — the household net income the award was calculated from,
   * plus the signed manual income adjustment baked into it and its mandatory
   * reason. Exported alongside the income figure so a reviewer working from
   * the spreadsheet can see why it differs from the earners' total.
   */
  totalHouseholdNetIncome: number | null;
  manualAdjustment: number | null;
  manualAdjustmentReason: string;
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
      ...(school ? { school: school as School } : {}),
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
      // 17 Oct — the family's own/rent answer feeds "Accommodation".
      sections: {
        where: { section: "ASSETS_LIABILITIES" },
        select: { data: true },
        take: 1,
      },
      assessment: {
        select: {
          outcome: true,
          synopsis: true,
          familyTypeCategory: true,
          rentAddBackType: true,
          property: { select: { propertyAssets: true } },
          // CALC-12: v2-only snapshot fields, null for v1 assessments.
          debtStatusLabel: true,
          lifestyleSqueezeLabel: true,
          // Epic 13 / C2 — household income + the manual adjustment folded
          // into it (shared column: v1 rows carry v1's fees-adjustment
          // semantics, v2 rows the income-adjustment line).
          totalHouseholdNetIncome: true,
          manualAdjustment: true,
          manualAdjustmentReason: true,
          // Epic 21 #1 — VAT rate for the scholarship-adjusted gap.
          vatRate: true,
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
              inconsistencyFlag: true,
              pastoralFlag: true,
              acuteCrisisFlag: true,
              highFrugalityFlag: true,
              // CALC-12: v2 min-of-three / gap-tracking fields (CALC-06/08),
              // null for v1 recommendations.
              recommendedPayableFees: true,
              confirmedPayableFees: true,
              gapAmount: true,
              // Epic 21 #1 — scholarship spend (fees × pct, before VAT).
              scholarshipSpendBeforeVat: true,
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
                      // Epic 21 #2 — precedence for the main gap reason.
                      rank: true,
                      sortOrder: true,
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
    // D13-1a: `reference` is no longer unique, so it is not a total order on
    // its own — two rows sharing a fees-system code would swap places between
    // exports. `id` breaks the tie so the sheet is byte-stable run to run.
    orderBy: [{ reference: "asc" }, { id: "asc" }],
  });

  return rows.map(mapExportRow);
}

// ─── Row mapping (pure — exported for unit testing) ──────────────────────────

/** The shape `getExportRows`' Prisma query resolves to, per application row. */
export interface ExportRowSource {
  reference: string;
  childName: string | null;
  school: string;
  sections?: { data: unknown }[];
  assessment: {
    outcome: AssessmentOutcome | null;
    synopsis: string | null;
    familyTypeCategory?: number | null;
    rentAddBackType?: string | null;
    property?: { propertyAssets: unknown } | null;
    debtStatusLabel: string | null;
    lifestyleSqueezeLabel: string | null;
    totalHouseholdNetIncome: unknown;
    manualAdjustment: unknown;
    manualAdjustmentReason: string | null;
    vatRate: unknown;
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
      inconsistencyFlag?: boolean;
      pastoralFlag?: boolean;
      acuteCrisisFlag?: boolean;
      highFrugalityFlag?: boolean;
      recommendedPayableFees: unknown;
      confirmedPayableFees: unknown;
      gapAmount: unknown;
      scholarshipSpendBeforeVat: unknown;
      reasonCodes: { reasonCode: { code: number; label: string } }[];
      gapReasons: {
        gapReason: {
          code: number;
          label: string;
          rank: number | null;
          sortOrder: number;
        };
      }[];
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

  // Epic 21 #2 — the highest-ranked gap reason, same "code – label" form.
  const main = mainGapReason((rec?.gapReasons ?? []).map((g) => g.gapReason));
  const mainGapReasonLabel = main ? `${main.code} – ${main.label}` : "";

  // Flags — her seven, in her order (17 + 21 Oct); Large family from the family type.
  const flags = raisedFlagLabels(rec, app.assessment?.familyTypeCategory).join(", ");

  // Accommodation (17 Oct) — the form's own/rent answer, else the assessment.
  const assets = asRecord(app.sections?.[0]?.data);
  const accommodation = accommodationLabel({
    formOwnership: assets.propertyOwnership,
    formRentAgreement: assets.rentAgreementType,
    portfolioType: asRecord(app.assessment?.property?.propertyAssets).portfolioType,
    rentAddBackType: app.assessment?.rentAddBackType ?? null,
  });

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
    accommodationType: accommodation || (rec?.accommodationStatus ?? ""),
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
    mainGapReason: mainGapReasonLabel,
    scholarshipAdjustedGap: scholarshipAdjustedGap(
      decimalToNumber(rec?.gapAmount),
      decimalToNumber(rec?.scholarshipSpendBeforeVat),
      decimalToNumber(app.assessment?.vatRate)
    ),
    debtStatus: app.assessment?.debtStatusLabel ?? "",
    lifestyleSqueezeLabel: app.assessment?.lifestyleSqueezeLabel ?? "",
    // Epic 13 / C2 — the income figure and the adjustment that explains it.
    totalHouseholdNetIncome: decimalToNumber(app.assessment?.totalHouseholdNetIncome),
    manualAdjustment: decimalToNumber(app.assessment?.manualAdjustment),
    manualAdjustmentReason: app.assessment?.manualAdjustmentReason ?? "",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

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
