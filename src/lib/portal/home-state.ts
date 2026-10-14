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

// ─── Epic 22 P4 — the two versions of Home in her sheet ──────────────────────

/**
 * "rolling-over" — the family holds at least one ACTIVE bursary account:
 *   "Welcome back", the active-bursary count and one line per child.
 * "new" — no active account yet: "Welcome", "You currently do not have an
 *   active bursary." and the first-application card.
 * A family can be both (a bursary for one child, a first application for
 * another): it gets the rolling-over version, with the application or
 * invitation card below the children.
 */
export type HomeVariant = "new" | "rolling-over";

export function homeVariant({ activeAccounts }: { activeAccounts: number }): HomeVariant {
  return activeAccounts > 0 ? "rolling-over" : "new";
}

export function homeHeading(variant: HomeVariant, firstName: string): string {
  return variant === "rolling-over" ? `Welcome back, ${firstName}` : `Welcome, ${firstName}`;
}

/** Her sentences, with the count. */
export function activeBursariesText(activeAccounts: number): string {
  if (activeAccounts <= 0) return "You currently do not have an active bursary.";
  return `You currently have ${activeAccounts} active ${
    activeAccounts === 1 ? "bursary" : "bursaries"
  } with the John Whitgift Foundation.`;
}

export const INVITED_TO_APPLY_TEXT =
  "You have been invited to fill in the following bursary application for us to assess your household:";
