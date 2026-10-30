/**
 * "Overdue" (Charlotte, 17 Oct 2026): a scheduled year whose Submit by date has
 * passed with nothing submitted shows as Overdue, in red, as Grant Tracker did.
 */

/** Badge classes for an Overdue year (staff grid and parent schedule alike). */
export const OVERDUE_BADGE_CLASS = "bg-red-50 text-red-700 border-red-200";

/**
 * The moment a year falls due: the family's own deadline (a timestamp, already
 * the end of its London day), else the year's Required By date (a calendar
 * date, so the end of that day).
 */
export function dueAt(familyDeadline: Date | null, requiredBy: Date | null): number | null {
  if (familyDeadline) return familyDeadline.getTime();
  if (!requiredBy) return null;
  const end = new Date(requiredBy);
  end.setUTCHours(23, 59, 59, 999);
  return end.getTime();
}

export function isOverdue(due: number | null, now: Date): boolean {
  return due != null && now.getTime() > due;
}
