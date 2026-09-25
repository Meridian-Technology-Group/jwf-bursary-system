/**
 * The single source of truth for what differs between schools.
 *
 * GT migration PR-C: before this module, 18 conditionals and 5 loose label
 * maps each decided Trinity-or-Whitgift for themselves, most with a silent
 * `else` that would have treated any third school as the other one. Every
 * school-specific label, rate, horizon and option list comes from here, and
 * `Record<School, …>` makes a new school a compile error until it is placed.
 *
 * Pure, and type-only on Prisma, so client components can import it.
 */
import type { School } from "@prisma/client";

export const SCHOOL_LABELS: Record<School, { short: string; long: string }> = {
  TRINITY: { short: "Trinity", long: "Trinity School" },
  WHITGIFT: { short: "Whitgift", long: "Whitgift School" },
};

/** "Trinity School" (long) or "Trinity" (short). Unknown or absent → "". */
export function schoolName(
  school: School | string | null | undefined,
  form: "short" | "long" = "long",
): string {
  if (!school) return "";
  return (SCHOOL_LABELS as Record<string, { short: string; long: string }>)[school]?.[form] ?? "";
}

/** The final school year a bursary can run to (Year 13 / Upper Sixth). */
export const FINAL_ELIGIBLE_SCHOOL_YEAR_BY_SCHOOL: Record<School, number> = {
  TRINITY: 13,
  WHITGIFT: 13,
};

/** The final school year a bursary at this school can run to; 13 when unknown. */
export function finalEligibleSchoolYear(school: School | string | null | undefined): number {
  if (!school) return 13;
  return (FINAL_ELIGIBLE_SCHOOL_YEAR_BY_SCHOOL as Record<string, number>)[school] ?? 13;
}

/** VAT % stamped on a new assessment at this school. */
export const SCHOOL_VAT_RATE: Record<School, number> = {
  TRINITY: 20,
  WHITGIFT: 20,
};

export function schoolVatRate(school: School | string | null | undefined): number {
  if (!school) return 20;
  return (SCHOOL_VAT_RATE as Record<string, number>)[school] ?? 20;
}

/** Whether the school's fees are kept in the Settings fee table (vs per account). */
export const SCHOOL_HAS_FEE_TABLE: Record<School, boolean> = {
  TRINITY: true,
  WHITGIFT: true,
};

export function schoolHasFeeTable(school: School): boolean {
  return SCHOOL_HAS_FEE_TABLE[school];
}

/** Every school, in the order staff filters and pickers list them. */
export const ALL_SCHOOLS: readonly School[] = ["WHITGIFT", "TRINITY"];

/** Schools a family can be newly invited to, or pick on a parent-facing form. */
export const INVITABLE_SCHOOLS: readonly School[] = ["WHITGIFT", "TRINITY"];

/** Schools with a fee table in Settings. */
export const FEE_TABLE_SCHOOLS: readonly School[] = ALL_SCHOOLS.filter(schoolHasFeeTable);

export function isSchool(value: unknown): value is School {
  return typeof value === "string" && (ALL_SCHOOLS as readonly string[]).includes(value);
}

/** Tailwind colours for the school badge (tables, application header). */
export const SCHOOL_BADGE_COLOUR: Record<School, string> = {
  WHITGIFT: "bg-primary-100 text-primary-800",
  TRINITY: "bg-blue-50 text-blue-700",
};
