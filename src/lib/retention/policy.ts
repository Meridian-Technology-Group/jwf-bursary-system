/**
 * Epic 10 — tiered data-retention policy (Decision D6).
 *
 * The SINGLE source of truth for "how long is this application's data kept,
 * and from when?". Both the manual GDPR delete button
 * (`gdprDeleteApplicantAction`) and the auto-purge cron read this module so the
 * two paths can never diverge on the horizon.
 *
 * This file is intentionally DB-free and side-effect-free: it is pure date
 * arithmetic over a small, typed policy object plus a narrow read-model of the
 * application + its account. That makes the GDPR-critical eligibility decision
 * unit-testable to the day with no database.
 *
 * ── Policy (D6, defaults; DPO signs the final year values) ──────────────────
 *
 *   | Outcome                          | Horizon | Anchored from           |
 *   |----------------------------------|---------|-------------------------|
 *   | Declined (DOES_NOT_QUALIFY)      | grace   | archivedAt → submittedAt|
 *   | Qualifies-not-awarded            | 6 years | submittedAt             |
 *   | Awarded                          | 7 years | account.closedAt        |
 *   | Closed, no outcome (item 2)      | grace   | application.closedAt    |
 *   | In-flight (no terminal outcome)  | never   | —                       |
 *
 * The "closed" tier (item 2, unified close): an application closed via the
 * reason-driven close with NO assessment outcome is terminal — it must not sit
 * outside retention forever. It ages on a short grace window from its own
 * closedAt (default = the declined grace; DPO to confirm alongside D6). An
 * application that is closed AND has an outcome uses its outcome tier — the
 * outcome anchors are the legally-motivated ones.
 *
 * The horizons are CONFIGURABLE via environment variables (so the DPO can
 * re-cut them without a code deploy) and fall back to the table above. The env
 * names are read once, lazily, and validated; a malformed value falls back to
 * the default rather than throwing (fail-safe-LONG — never purge sooner than
 * the documented default because of a typo'd env var).
 *
 * NOTE: This is policy, not enforcement. `isPurgeable` returns WHETHER an
 * application's window has elapsed; the cron/manual action perform the actual
 * (anonymising) deletion via `lib/retention/purge.ts`.
 */

import type { AssessmentOutcome, BursaryAccountStatus } from "@prisma/client";

/** Where a retention window is measured from. */
export type RetentionAnchor =
  | "archivedAt"
  | "submittedAt"
  | "closedAt"
  | "applicationClosedAt";

/** A single tier of the policy. */
export interface RetentionTier {
  /** Whole years (or, for declined, days — see `unit`) the data is kept. */
  amount: number;
  /** Granularity of `amount`. Declined uses a short DAY grace; others YEARS. */
  unit: "years" | "days";
  /** Which date the window is measured from. */
  anchor: RetentionAnchor;
}

export interface RetentionPolicy {
  /** Declined / does-not-qualify: short grace then purge. */
  declined: RetentionTier;
  /** Qualifies but not awarded this round. */
  qualifiesNotAwarded: RetentionTier;
  /** Awarded — anchored from account close, not first submission. */
  awarded: RetentionTier;
  /** Unified close with no outcome (item 2) — grace from application close. */
  closed: RetentionTier;
}

/**
 * Default policy (D6). Year values are the documented defaults; the DPO signs
 * the legal figures before `RETENTION_PURGE_ENABLED` is turned on in prod.
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  // Declined: a short grace window (30 days) before purge, so a mis-decision
  // can be reversed and the applicant has time to query the outcome.
  declined: { amount: 30, unit: "days", anchor: "archivedAt" },
  qualifiesNotAwarded: { amount: 6, unit: "years", anchor: "submittedAt" },
  awarded: { amount: 7, unit: "years", anchor: "closedAt" },
  // Item 2: closed-without-outcome mirrors the declined grace by default;
  // DPO to confirm the figure alongside the D6 sign-off.
  closed: { amount: 30, unit: "days", anchor: "applicationClosedAt" },
};

/** Parse a positive-integer env override, falling back to `fallback`. */
function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    console.warn(
      `[retention] ${name}="${raw}" is not a non-negative integer — using default ${fallback}`
    );
    return fallback;
  }
  return n;
}

/**
 * The active policy, with env overrides applied over the defaults. Read this
 * (not the constant) from runtime code so DPO-set env values take effect.
 *
 * Overrides:
 *   RETENTION_DECLINED_GRACE_DAYS        (default 30)
 *   RETENTION_QUALIFIES_NOT_AWARDED_YEARS (default 6)
 *   RETENTION_AWARDED_YEARS              (default 7)
 */
export function getRetentionPolicy(): RetentionPolicy {
  return {
    declined: {
      ...DEFAULT_RETENTION_POLICY.declined,
      amount: intFromEnv(
        "RETENTION_DECLINED_GRACE_DAYS",
        DEFAULT_RETENTION_POLICY.declined.amount
      ),
    },
    qualifiesNotAwarded: {
      ...DEFAULT_RETENTION_POLICY.qualifiesNotAwarded,
      amount: intFromEnv(
        "RETENTION_QUALIFIES_NOT_AWARDED_YEARS",
        DEFAULT_RETENTION_POLICY.qualifiesNotAwarded.amount
      ),
    },
    awarded: {
      ...DEFAULT_RETENTION_POLICY.awarded,
      amount: intFromEnv(
        "RETENTION_AWARDED_YEARS",
        DEFAULT_RETENTION_POLICY.awarded.amount
      ),
    },
    closed: {
      ...DEFAULT_RETENTION_POLICY.closed,
      amount: intFromEnv(
        "RETENTION_CLOSED_GRACE_DAYS",
        DEFAULT_RETENTION_POLICY.closed.amount
      ),
    },
  };
}

/** The minimal application shape the policy reasons over. */
export interface RetentionApplication {
  outcome: AssessmentOutcome | null;
  archivedAt: Date | null;
  submittedAt: Date | null;
  /** Unified close marker (item 2); anchors the `closed` tier. */
  closedAt: Date | null;
}

/** The minimal account shape the policy reasons over (null when none). */
export interface RetentionAccount {
  status: BursaryAccountStatus;
  closedAt: Date | null;
}

export interface PurgeEvaluation {
  /** True iff the retention window has fully elapsed and data may be purged. */
  purgeable: boolean;
  /** The matched tier, or null when the application is not yet terminal. */
  tier: keyof RetentionPolicy | null;
  /** The date the window is measured from (null when no anchor resolves). */
  anchorDate: Date | null;
  /** The date on/after which purge is permitted (null when not applicable). */
  eligibleFrom: Date | null;
  /** Human-readable reason — surfaced in the manual button's error/logs. */
  reason: string;
}

/** Adds whole years to a date (UTC-safe — month/day preserved). */
function addYears(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/** Adds whole days to a date. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function resolveAnchorDate(
  anchor: RetentionAnchor,
  application: RetentionApplication,
  account: RetentionAccount | null
): Date | null {
  switch (anchor) {
    case "archivedAt":
      // Declined: prefer the explicit archive date; fall back to submittedAt
      // (legacy declined rows pre-Epic-01 may have no archivedAt).
      return application.archivedAt ?? application.submittedAt ?? null;
    case "submittedAt":
      return application.submittedAt ?? null;
    case "closedAt":
      return account?.closedAt ?? null;
    case "applicationClosedAt":
      return application.closedAt ?? null;
  }
}

function tierExpiry(tier: RetentionTier, anchorDate: Date): Date {
  return tier.unit === "days"
    ? addDays(anchorDate, tier.amount)
    : addYears(anchorDate, tier.amount);
}

/**
 * The GDPR-critical decision. Pure: given an application, its account, the
 * current time and a policy, decide whether the retention window has fully
 * elapsed.
 *
 * Strictly window-gated — only returns `purgeable: true` when `now` is at or
 * past the computed expiry. In-flight applications (no terminal outcome) are
 * NEVER purgeable. An awarded application whose account is still ACTIVE is
 * NEVER purgeable (no `closedAt` anchor yet).
 */
export function isPurgeable(
  application: RetentionApplication,
  account: RetentionAccount | null,
  now: Date = new Date(),
  policy: RetentionPolicy = getRetentionPolicy()
): PurgeEvaluation {
  const notTerminal: PurgeEvaluation = {
    purgeable: false,
    tier: null,
    anchorDate: null,
    eligibleFrom: null,
    reason: "Application has no terminal outcome — never auto-purged.",
  };

  // Resolve which tier applies from the outcome.
  let tierKey: keyof RetentionPolicy;
  switch (application.outcome) {
    case "DOES_NOT_QUALIFY":
      tierKey = "declined";
      break;
    case "QUALIFIES_NOT_AWARDED":
      tierKey = "qualifiesNotAwarded";
      break;
    case "AWARDED":
      tierKey = "awarded";
      break;
    // Legacy pre-3-value rows ("QUALIFIES") and null are NOT terminal via the
    // outcome — but a unified close (item 2) IS terminal: a closed application
    // with no outcome ages on the `closed` tier from its own closedAt.
    // Otherwise treat as in-flight → never purge.
    default:
      if (application.closedAt != null) {
        tierKey = "closed";
        break;
      }
      return notTerminal;
  }

  const tier = policy[tierKey];
  const anchorDate = resolveAnchorDate(tier.anchor, application, account);

  if (!anchorDate) {
    // Awarded but account not yet closed (or missing submit/archive date) →
    // the window cannot start, so the data is retained.
    return {
      purgeable: false,
      tier: tierKey,
      anchorDate: null,
      eligibleFrom: null,
      reason:
        tier.anchor === "closedAt"
          ? "Awarded account is still active — retained until it closes."
          : `No ${tier.anchor} date to anchor the retention window — retained.`,
    };
  }

  const eligibleFrom = tierExpiry(tier, anchorDate);
  const purgeable = now.getTime() >= eligibleFrom.getTime();

  const horizonLabel =
    tier.unit === "days" ? `${tier.amount} days` : `${tier.amount} years`;

  return {
    purgeable,
    tier: tierKey,
    anchorDate,
    eligibleFrom,
    reason: purgeable
      ? `Retention window (${horizonLabel} from ${tier.anchor}) has elapsed.`
      : `Retained until ${eligibleFrom.toISOString().slice(0, 10)} (${horizonLabel} from ${tier.anchor}).`,
  };
}

/**
 * A friendly error message for the manual GDPR button when a record is not yet
 * purgeable — keeps the existing UX while sourcing the horizon from the policy.
 */
export function notYetPurgeableMessage(evaluation: PurgeEvaluation): string {
  if (evaluation.tier == null) {
    return "This application has no final outcome yet and cannot be deleted.";
  }
  if (evaluation.eligibleFrom == null) {
    return evaluation.reason;
  }
  const date = evaluation.eligibleFrom.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `This application cannot be deleted yet. Under the retention policy it must be kept until ${date}.`;
}
