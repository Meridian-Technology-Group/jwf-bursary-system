/**
 * Export search filters (Epic 23 T4; EXPORTS.xlsx "Search Selection").
 *
 * Sections 2 and 3 share one assessment filter set: bursary account (D-8:
 * Active / Closed / No account yet), assessment status, application type,
 * round, assessment completion date (from–to), academic year (D-7: every
 * round of that year), school (D-6: the assessment's school, falling back to
 * the application's) and school year. Section 1 (T6) adds its own.
 *
 * Parsed from the download URL's query string; an absent filter = all.
 * Pure: zod + Prisma `where` shapes only.
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { endOfDay, startOfDay } from "@/lib/export/fields";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const optional = <T extends z.ZodTypeAny>(t: T) =>
  z.preprocess((v) => (v === "" || v === "__all__" || v == null ? undefined : v), t.optional());

export const SCHOOL_VALUES = ["TRINITY", "WHITGIFT", "OP_PARTNER"] as const;
export const SCHOOL_YEAR_VALUES = ["Y6", "Y7", "Y8", "Y9", "Y10", "Y11", "Y12", "Y13", "OTHER"] as const;
export const ASSESSMENT_STATUS_VALUES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "NEW_AWARD",
  "ROLLED_OVER",
  "WAITING_LIST",
  "CLOSED_ARCHIVED",
] as const;
export const ACCOUNT_VALUES = ["ACTIVE", "CLOSED", "NONE"] as const;
export const APPLICATION_TYPE_VALUES = ["ROLLING_OVER", "NEW"] as const;

export const AssessmentFiltersSchema = z
  .object({
    account: optional(z.enum(ACCOUNT_VALUES)),
    assessmentStatus: optional(z.enum(ASSESSMENT_STATUS_VALUES)),
    applicationType: optional(z.enum(APPLICATION_TYPE_VALUES)),
    roundId: optional(z.string().uuid("Unknown round.")),
    academicYear: optional(z.string().regex(/^\d{4}\/\d{2}$/, "Academic year must look like 2026/27.")),
    completedFrom: optional(z.string().regex(ISO_DATE, "Dates must be YYYY-MM-DD.")),
    completedTo: optional(z.string().regex(ISO_DATE, "Dates must be YYYY-MM-DD.")),
    school: optional(z.enum(SCHOOL_VALUES)),
    schoolYear: optional(z.enum(SCHOOL_YEAR_VALUES)),
  })
  .refine((f) => !f.completedFrom || !f.completedTo || f.completedFrom <= f.completedTo, {
    message: "The completion date range ends before it starts.",
  });

export type AssessmentFilters = z.infer<typeof AssessmentFiltersSchema>;

/** The filter names the UI renders for Sections 2 and 3, in her order. */
export const ASSESSMENT_FILTER_KEYS = [
  "account",
  "assessmentStatus",
  "applicationType",
  "roundId",
  "completedRange",
  "academicYear",
  "school",
  "schoolYear",
] as const;

export type ParseResult<F> = { ok: true; filters: F } | { ok: false; error: string };

/** Query string → filters (first zod issue as the error). */
export function parseWith<S extends z.ZodTypeAny>(schema: S, params: URLSearchParams): ParseResult<z.infer<S>> {
  const raw: Record<string, string> = {};
  params.forEach((v, k) => {
    raw[k] = v;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid filters." };
  return { ok: true, filters: parsed.data };
}

/** The filters as a Prisma `where` on Assessment. Pure, for unit testing. */
export function assessmentWhere(f: AssessmentFilters): Prisma.AssessmentWhereInput {
  const and: Prisma.AssessmentWhereInput[] = [];
  const app: Prisma.ApplicationWhereInput = {};
  if (f.roundId) app.roundId = f.roundId;
  if (f.academicYear) app.round = { academicYear: f.academicYear };
  if (f.applicationType) app.applicationType = f.applicationType;
  if (f.schoolYear) app.entryYearGroup = f.schoolYear;
  if (f.account === "NONE") app.bursaryAccountId = null;
  else if (f.account) app.bursaryAccount = { status: f.account };
  if (Object.keys(app).length) and.push({ application: app });
  if (f.assessmentStatus) and.push({ status: f.assessmentStatus });
  if (f.completedFrom || f.completedTo) {
    and.push({
      completedAt: {
        ...(f.completedFrom ? { gte: startOfDay(f.completedFrom) } : {}),
        ...(f.completedTo ? { lte: endOfDay(f.completedTo) } : {}),
      },
    });
  }
  if (f.school) {
    and.push({
      OR: [{ assessmentSchool: f.school }, { assessmentSchool: null, application: { school: f.school } }],
    });
  }
  return and.length ? { AND: and } : {};
}
