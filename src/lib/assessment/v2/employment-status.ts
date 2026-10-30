/**
 * Best-effort dominant employment status for the (non-null)
 * `assessment_earners.employment_status` column, from an assessor income
 * record. Back-compat display only; the engine reads `incomeDetail`.
 *
 * Shared by the v2 assessment form and the GT migration loader, so a migrated
 * earner row is stamped exactly as a saved one would be.
 */
import type { EmploymentStatus } from "@prisma/client";
import type { AssessorIncomeRecord } from "@/types/assessment-v2";

export function dominantEmploymentStatus(rec: AssessorIncomeRecord): EmploymentStatus {
  if (rec.selfEmployed) return rec.selfEmployed.dividends > 0 ? "SELF_EMPLOYED_DIRECTOR" : "SELF_EMPLOYED_SOLE";
  if (rec.retired) return "OLD_AGE_PENSION";
  if (rec.unemployed) return "UNEMPLOYED";
  if (rec.benefits && !rec.employed) return "BENEFITS";
  return "PAYE";
}
