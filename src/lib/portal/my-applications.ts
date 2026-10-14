/**
 * Epic 22 P1 (CR-002 Phase 5 #2) — "My Bursary Application(s)": one block per
 * child, each with the family's last login, how much of the form is complete
 * and Charlotte's four "I would like to…" options.
 *
 * Pure module: the page loads accounts, applications, invitations and each
 * draft's completion, and this decides what each child's block says and which
 * options apply. Nothing here touches the DB or the clock.
 *
 * "Paused" in her wording is a form the family saved and left — NOT the
 * assessor's pause (Missing Documents), which keeps its own nav item.
 */

import type { School, ScheduleEntryStatus } from "@prisma/client";
import { parseAcademicYearStart } from "@/lib/assessment/fee-year";
import type { ScheduleHomeRow } from "@/lib/bursary-accounts/schedule-home";
import type { SidebarSection } from "@/components/portal/portal-sidebar-sections";

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface BlockAccountInput {
  id: string;
  childName: string;
  school: School;
  /** Portal-visible schedule entries (status per academic year). */
  entries: readonly { academicYear: string; status: ScheduleEntryStatus }[];
  /** The same entries as dated rows (`buildScheduleHomeRows`). */
  rows: readonly ScheduleHomeRow[];
}

export interface BlockApplicationInput {
  id: string;
  childName: string;
  school: School;
  bursaryAccountId: string | null;
  roundId: string;
  /** Start year of the application's round (2027 for "2027-28"). */
  roundStartYear: number | null;
  formStatus: string;
  submittedAt: Date | null;
  updatedAt: Date;
}

export interface BlockInvitationInput {
  id: string;
  childName: string | null;
  school: School | null;
  bursaryAccountId: string | null;
  roundId: string | null;
  /**
   * A first-year invitation that is missing what the form needs to be created
   * straight away (school, child, round, entry year group). The family starts
   * it from the home page's chooser instead.
   */
  needsDetails: boolean;
}

export interface DraftCompletion {
  /** `applicationCompletion` — the rail's figure. */
  percent: number;
  /** Every section (bar the Declaration) has its green tick. */
  canSubmit: boolean;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export type ApplicationBlockState =
  | { kind: "start"; invitationId: string; needsDetails: boolean }
  | {
      kind: "draft";
      applicationId: string;
      percent: number;
      canSubmit: boolean;
    }
  | { kind: "submitted"; applicationId: string; submittedAt: Date | null }
  /** Between rounds: the next year's form opens on a known date. */
  | { kind: "next-year"; academicYear: string; opensOn: Date }
  /** The next year's window is open but no invitation has been sent yet. */
  | { kind: "awaiting-invitation"; academicYear: string }
  /** No further year on the schedule. */
  | { kind: "ended"; lastAcademicYear: string | null };

export interface ApplicationBlock {
  key: string;
  childName: string;
  school: School | null;
  state: ApplicationBlockState;
}

export interface BuildApplicationBlocksParams {
  accounts: readonly BlockAccountInput[];
  applications: readonly BlockApplicationInput[];
  invitations: readonly BlockInvitationInput[];
  completions: ReadonlyMap<string, DraftCompletion>;
  today: Date;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

function nameKey(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

interface Working {
  key: string;
  childName: string;
  school: School | null;
  account: BlockAccountInput | null;
  applications: BlockApplicationInput[];
  invitations: BlockInvitationInput[];
}

/** The application that describes the child now: newest round, then newest edit. */
function currentApplication(
  apps: readonly BlockApplicationInput[]
): BlockApplicationInput | null {
  let best: BlockApplicationInput | null = null;
  for (const app of apps) {
    if (!best) {
      best = app;
      continue;
    }
    const a = app.roundStartYear ?? -Infinity;
    const b = best.roundStartYear ?? -Infinity;
    if (a > b || (a === b && app.updatedAt > best.updatedAt)) best = app;
  }
  return best;
}

function accountState(
  account: BlockAccountInput,
  today: Date
): ApplicationBlockState {
  const next = account.rows.find(
    (r) => r.state === "locked" || r.state === "start"
  );
  if (next) {
    if (next.openingDate && next.openingDate.getTime() > today.getTime()) {
      return {
        kind: "next-year",
        academicYear: next.academicYear,
        opensOn: next.openingDate,
      };
    }
    return { kind: "awaiting-invitation", academicYear: next.academicYear };
  }
  const last = account.rows[account.rows.length - 1];
  return { kind: "ended", lastAcademicYear: last?.academicYear ?? null };
}

/** Is the account's schedule year for this application already COMPLETE? */
function yearIsComplete(
  account: BlockAccountInput | null,
  app: BlockApplicationInput
): boolean {
  if (!account || app.roundStartYear == null) return false;
  const entry = account.entries.find(
    (e) => parseAcademicYearStart(e.academicYear) === app.roundStartYear
  );
  return entry?.status === "COMPLETE";
}

export function buildApplicationBlocks(
  params: BuildApplicationBlocksParams
): ApplicationBlock[] {
  const { accounts, applications, invitations, completions, today } = params;

  const blocks: Working[] = accounts.map((account) => ({
    key: `account:${account.id}`,
    childName: account.childName,
    school: account.school,
    account,
    applications: [],
    invitations: [],
  }));
  const byAccount = new Map(
    blocks.map((b) => [b.account!.id, b] as const)
  );

  // Children without an account are matched on their name (the same rule the
  // home schedule uses for an original NEW application).
  const findOrCreate = (
    accountId: string | null,
    childName: string | null,
    school: School | null
  ): Working => {
    if (accountId) {
      const own = byAccount.get(accountId);
      if (own) return own;
    }
    const key = nameKey(childName);
    const existing = blocks.find((b) => nameKey(b.childName) === key);
    if (existing) return existing;
    const created: Working = {
      key: `child:${key || blocks.length}`,
      childName: childName?.trim() || "Your child",
      school,
      account: null,
      applications: [],
      invitations: [],
    };
    blocks.push(created);
    return created;
  };

  const sortedApps = [...applications].sort(
    (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime()
  );
  for (const app of sortedApps) {
    findOrCreate(app.bursaryAccountId, app.childName, app.school).applications.push(app);
  }
  for (const inv of invitations) {
    // A bare first-year invitation (no child name) whose round already has an
    // application was used from the home page's chooser under the name the
    // parent typed — it is not a second child.
    if (
      !inv.bursaryAccountId &&
      !inv.childName?.trim() &&
      applications.some((a) => a.roundId === inv.roundId)
    ) {
      continue;
    }
    findOrCreate(inv.bursaryAccountId, inv.childName, inv.school).invitations.push(inv);
  }

  return blocks.map((b) => {
    const current = currentApplication(b.applications);
    // An invitation still to be used: nothing in this child's block for its round.
    const pendingInvite = b.invitations.find(
      (inv) =>
        inv.roundId == null ||
        !b.applications.some((a) => a.roundId === inv.roundId)
    );

    let state: ApplicationBlockState;
    if (current && current.formStatus !== "SUBMITTED") {
      const completion = completions.get(current.id);
      state = {
        kind: "draft",
        applicationId: current.id,
        percent: completion?.percent ?? 0,
        canSubmit: completion?.canSubmit ?? false,
      };
    } else if (pendingInvite) {
      state = {
        kind: "start",
        invitationId: pendingInvite.id,
        needsDetails: pendingInvite.needsDetails,
      };
    } else if (current && !yearIsComplete(b.account, current)) {
      state = {
        kind: "submitted",
        applicationId: current.id,
        submittedAt: current.submittedAt,
      };
    } else if (b.account) {
      state = accountState(b.account, today);
    } else if (current) {
      state = {
        kind: "submitted",
        applicationId: current.id,
        submittedAt: current.submittedAt,
      };
    } else {
      state = { kind: "ended", lastAcademicYear: null };
    }

    return {
      key: b.key,
      childName: b.childName,
      school: b.school,
      state,
    };
  });
}

// ─── Her four options ─────────────────────────────────────────────────────────

export type ApplicationActionKey = "start" | "continue" | "review" | "submit";

export interface ApplicationBlockAction {
  key: ApplicationActionKey;
  label: string;
  enabled: boolean;
  /** Where the option goes (links); null for the start option's form post. */
  href: string | null;
  /** The invitation the start option uses. */
  invitationId: string | null;
  /** Shown under a disabled option when it explains why. */
  hint: string | null;
}

export const ACTION_LABELS: Record<ApplicationActionKey, string> = {
  start: "I would like to start the application",
  continue: "I have paused the application and would like to keep working on it",
  review:
    "I would like to see which sections still need an answer or a document upload",
  submit: "I would like to submit the form",
};

export const SUBMIT_DISABLED_HINT =
  "Complete the sections listed in the option above first.";

/**
 * The four options for a block, each enabled only when it applies. Blocks that
 * are not startable or in progress (submitted, between rounds) have none.
 */
export function applicationBlockActions(
  state: ApplicationBlockState
): ApplicationBlockAction[] {
  const action = (
    key: ApplicationActionKey,
    enabled: boolean,
    href: string | null,
    extra: Partial<ApplicationBlockAction> = {}
  ): ApplicationBlockAction => ({
    key,
    label: ACTION_LABELS[key],
    enabled,
    href: enabled ? href : null,
    invitationId: null,
    hint: null,
    ...extra,
  });

  if (state.kind === "start") {
    return [
      state.needsDetails
        ? action("start", true, "/#start-application")
        : action("start", true, null, { invitationId: state.invitationId }),
      action("continue", false, null),
      action("review", false, null),
      action("submit", false, null),
    ];
  }

  if (state.kind === "draft") {
    const open = (to: string) => `/apply/open/${state.applicationId}?to=${to}`;
    return [
      action("start", false, null, { hint: "Already started." }),
      action("continue", true, open("continue")),
      action("review", true, open("review")),
      state.canSubmit
        ? action("submit", true, open("submit"))
        : action("submit", false, null, { hint: SUBMIT_DISABLED_HINT }),
    ];
  }

  return [];
}

// ─── Deep-link targets (/apply/open/[id]?to=…) ────────────────────────────────

export const OPEN_TARGETS = ["continue", "review", "submit"] as const;
export type OpenTarget = (typeof OPEN_TARGETS)[number];

/** Whitelist: anything other than the three known targets is ignored. */
export function parseOpenTarget(raw: string | null): OpenTarget | null {
  return (OPEN_TARGETS as readonly string[]).includes(raw ?? "")
    ? (raw as OpenTarget)
    : null;
}

/**
 * Where `/apply/open/[id]` sends the family.
 *   submitted          → /status (whatever was asked)
 *   continue           → the first section without a green tick
 *   review             → the validation section (/apply/review)
 *   submit             → the end of the form (the Declaration)
 *   none               → the start of the form
 *
 * `sections` is the rail's list for this application (`buildSidebarSections`);
 * it is only read for "continue".
 */
export function openTarget(
  to: OpenTarget | null,
  formStatus: string,
  sections: readonly Pick<SidebarSection, "slug" | "status" | "isSynthetic">[]
): string {
  if (formStatus === "SUBMITTED") return "/status";
  switch (to) {
    case "review":
      return "/apply/review";
    case "submit":
      return "/apply/declaration";
    case "continue": {
      const next = sections.find(
        (s) => !s.isSynthetic && s.status !== "complete"
      );
      return `/apply/${next?.slug ?? "review"}`;
    }
    default:
      return "/apply/child-details";
  }
}

/**
 * Submit is offered only once every section bar the Declaration has its green
 * tick (the Declaration is completed by submitting).
 */
export function canSubmitFromSections(
  sections: readonly Pick<SidebarSection, "slug" | "status" | "isSynthetic">[]
): boolean {
  return sections
    .filter((s) => !s.isSynthetic && s.slug !== "declaration")
    .every((s) => s.status === "complete");
}

// ─── Last login (D-5) ─────────────────────────────────────────────────────────

export const FIRST_RECORDED_LOGIN = "This is your first recorded login";

/** "11 October 2026, 22:26" in London time; the first-login text when null. */
export function formatLastLogin(previousSignInAt: Date | null): string {
  if (!previousSignInAt) return FIRST_RECORDED_LOGIN;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(previousSignInAt);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")}`;
}
