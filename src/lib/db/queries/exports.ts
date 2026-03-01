/**
 * Export queries for WP-17 — Exports (XLSX & CSV Download).
 *
 * Returns flattened, serialisation-safe rows that join:
 *   Application → Assessment → Recommendation → ReasonCodes
 *
 * All Prisma Decimal fields are converted to `number` via Number(decimal)
 * before returning so the data is safe to cross server/client boundaries.
 */

import { prisma } from "@/lib/db/prisma";
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
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Returns typed ExportRow[] for all applications in a given round,
 * optionally filtered by school.
 *
 * Only applications that have a completed Recommendation are included.
 */
export async function getExportRows(
  roundId: string,
  school?: string
): Promise<ExportRow[]> {
  const rows = await prisma.application.findMany({
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
            },
          },
        },
      },
    },
    orderBy: { reference: "asc" },
  });

  return rows.map((app): ExportRow => {
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
      familySynopsis: rec?.familySynopsis ?? "",
      accommodationType: rec?.accommodationStatus ?? "",
      incomeCategory: rec?.incomeCategory ?? "",
      propertyCategory:
        rec?.propertyCategory != null ? String(rec.propertyCategory) : "",
      bursaryAward:
        rec?.bursaryAward != null ? Number(rec.bursaryAward) : null,
      yearlyPayableFees:
        rec?.yearlyPayableFees != null ? Number(rec.yearlyPayableFees) : null,
      monthlyPayableFees:
        rec?.monthlyPayableFees != null
          ? Number(rec.monthlyPayableFees)
          : null,
      reasonCodes,
      flags,
      outcome: outcomeLabel,
    };
  });
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
