/**
 * Parent-portal home page state — Epic 21 T1 (WP-F1).
 *
 * The home page renders one main block under the per-child schedule:
 *   - "application"   — the current portal application (status, continue, actions),
 *   - "invitation"    — invited, not started (the application-type chooser),
 *   - "no-invitation" — the neutral "No invitation found" card,
 *   - "none"          — nothing: the family has a schedule, and the schedule
 *                       IS the page.
 *
 * "none" exists for migrated families and any family between rounds. Their
 * Grant Tracker applications are excluded from "the current application" by
 * design (`PORTAL_APPLICATION`, migration-source.ts) and they hold no open
 * invitation, so before this fix they saw "No invitation found… if you believe
 * this is an error" directly under three healthy schedules.
 */

export type PortalHomeMain = "application" | "invitation" | "none" | "no-invitation";

export function portalHomeMain({
  hasApplication,
  hasInvitation,
  hasSchedule,
}: {
  hasApplication: boolean;
  hasInvitation: boolean;
  /** At least one ACTIVE bursary account with a portal schedule row. */
  hasSchedule: boolean;
}): PortalHomeMain {
  if (hasApplication) return "application";
  if (hasInvitation) return "invitation";
  return hasSchedule ? "none" : "no-invitation";
}
