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
  // S9: her name for it. One school, no per-pupil partner field.
  OP_PARTNER: { short: "OP partner", long: "OP partnering school" },
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
  // S9: the Foundation's commitment to an Old Palace pupil ends at Year 11.
  OP_PARTNER: 11,
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
  // S9: Old Palace fees carry no VAT.
  OP_PARTNER: 0,
};

export function schoolVatRate(school: School | string | null | undefined): number {
  if (!school) return 20;
  return (SCHOOL_VAT_RATE as Record<string, number>)[school] ?? 20;
}

/** Whether the school's fees are kept in the Settings fee table (vs per account). */
export const SCHOOL_HAS_FEE_TABLE: Record<School, boolean> = {
  TRINITY: true,
  WHITGIFT: true,
  // S9: fees differ per account (BursaryAccount.annualFeesOverride).
  OP_PARTNER: false,
};

export function schoolHasFeeTable(school: School): boolean {
  return SCHOOL_HAS_FEE_TABLE[school];
}

/** Every school, in the order staff filters, exports and pickers list them. */
export const ALL_SCHOOLS: readonly School[] = ["WHITGIFT", "TRINITY", "OP_PARTNER"];

/**
 * Schools a family can be newly invited to, or pick on a parent-facing form.
 * No new Old Palace family is ever invited (S9); an OP child's re-assessment
 * arrives with the school already locked from the account.
 */
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
  OP_PARTNER: "bg-purple-50 text-purple-700",
};

export function isInvitableSchool(school: School | string | null | undefined): boolean {
  return !!school && (INVITABLE_SCHOOLS as readonly string[]).includes(school);
}

/**
 * S9: a school no family is newly invited to (Old Palace) only ever receives
 * a rolling-over (re-assessment) invitation. Contact validation uses this.
 */
export function schoolAllowsSituation(
  school: School | string | null | undefined,
  situation: "NEW" | "INTERNAL" | "ROLLING_OVER" | string | null | undefined,
): boolean {
  return isInvitableSchool(school) || situation === "ROLLING_OVER";
}

export const ROLLING_OVER_ONLY_MESSAGE =
  "The OP partnering school only takes rolling-over (re-assessment) invitations.";

/** The entry school years offerable at a school: Year 6 to its final year. */
export function entrySchoolYearOptions(school: School | string | null | undefined): number[] {
  const last = finalEligibleSchoolYear(school);
  return Array.from({ length: last - 5 }, (_, i) => i + 6);
}

export interface SchoolFeePair {
  annual: number | null;
  nextYear: number | null;
}

/**
 * The fee pair the assessment offers for each school: the Settings fee table
 * where the school has one, then the account's own fee for its school, which
 * wins (S9: the OP partnering school has no table). An account fee has no
 * next-year figure; the award summary falls back to the current-year fee.
 */
export function feesBySchool(
  table: Partial<Record<School, { currentYearAnnualFees: number | null; nextYearAnnualFees: number | null } | null>>,
  account: { school: School; annualFeesOverride: number | null } | null,
): Record<School, SchoolFeePair> {
  const out = Object.fromEntries(
    ALL_SCHOOLS.map((s) => [s, { annual: null, nextYear: null }]),
  ) as Record<School, SchoolFeePair>;
  for (const s of FEE_TABLE_SCHOOLS) {
    const row = table[s];
    out[s] = { annual: row?.currentYearAnnualFees ?? null, nextYear: row?.nextYearAnnualFees ?? null };
  }
  if (account?.annualFeesOverride != null) {
    out[account.school] = { annual: account.annualFeesOverride, nextYear: null };
  }
  return out;
}
