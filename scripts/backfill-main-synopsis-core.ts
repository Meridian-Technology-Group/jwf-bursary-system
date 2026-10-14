/**
 * Pure core of `scripts/backfill-main-synopsis.ts` (Epic 21 R1, 14 Oct 2026).
 *
 * A bursary account's Main synopsis is seeded at its FIRST award lock
 * (`seedMainSynopsisAtLock`, post-assessment-core). Accounts whose award was
 * locked before #447 reached their database never got one. This decides, per
 * account, which locked assessment's synopsis would have seeded it, exactly as
 * the lock path would have: the earliest locked year with a non-blank synopsis.
 *
 * Migrated (Grant Tracker) accounts are excluded: the migration toolkit writes
 * and ledgers their Main synopsis (`mig backfill-synopsis`), and a write here
 * would break its rollback.
 */
import { isSynopsisLocked, mainSynopsisSeed } from "../src/lib/bursary-accounts/standing-synopsis";

export interface CandidateApplication {
  id: string;
  reference: string | null;
  migrationSource: string | null;
  academicYear: string;
  assessment: { id: string; status: string; synopsis: string | null } | null;
}

export interface CandidateAccount {
  id: string;
  hasMain: boolean;
  applications: CandidateApplication[];
}

export type SeedDecision =
  | {
      action: "SEED";
      accountId: string;
      applicationId: string;
      reference: string | null;
      assessmentId: string;
      academicYear: string;
      body: string;
    }
  | { action: "SKIP"; accountId: string; reference: string | null; reason: SkipReason };

export type SkipReason = "HAS_MAIN" | "MIGRATED" | "NO_LOCKED_ASSESSMENT" | "BLANK_SYNOPSIS";

/** "2026/27" and "2026-27" order by their starting calendar year. */
function startYear(academicYear: string): number {
  const m = academicYear.match(/(\d{4})/);
  return m ? Number.parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

export function decideSeed(account: CandidateAccount): SeedDecision {
  const firstRef = account.applications.find((a) => a.reference)?.reference ?? null;
  if (account.hasMain) return { action: "SKIP", accountId: account.id, reference: firstRef, reason: "HAS_MAIN" };
  if (account.applications.some((a) => a.migrationSource != null)) {
    return { action: "SKIP", accountId: account.id, reference: firstRef, reason: "MIGRATED" };
  }

  const locked = account.applications
    .filter((a) => a.assessment && isSynopsisLocked(a.assessment.status))
    .sort((a, b) => startYear(a.academicYear) - startYear(b.academicYear));
  if (locked.length === 0) {
    return { action: "SKIP", accountId: account.id, reference: firstRef, reason: "NO_LOCKED_ASSESSMENT" };
  }

  for (const app of locked) {
    const body = mainSynopsisSeed(app.assessment!.synopsis);
    if (body) {
      return {
        action: "SEED",
        accountId: account.id,
        applicationId: app.id,
        reference: app.reference,
        assessmentId: app.assessment!.id,
        academicYear: app.academicYear,
        body,
      };
    }
  }
  return { action: "SKIP", accountId: account.id, reference: locked[0].reference, reason: "BLANK_SYNOPSIS" };
}

/**
 * A printable label for an application reference. Prod references embed the
 * child's name (e.g. "<CODE>-<SURNAME>, <First>" or "<Name> – <School> – …"),
 * so only a leading family code like "TS-WILL05" is ever printed.
 */
export function safeLabel(reference: string | null): string {
  const m = reference?.match(/^([A-Z]{2}-[A-Z]{3,5}\d{2})\b/);
  return m ? m[1] : "(no family code)";
}

/**
 * The Supabase project ref a Postgres URL points at: the pooler username
 * `postgres.<ref>` / `app_user.<ref>`, or the direct host `db.<ref>.supabase.co`.
 * Null when neither shape matches.
 */
export function supabaseProjectRef(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) return null;
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return null;
  }
  const user = decodeURIComponent(url.username);
  const fromUser = user.match(/\.([a-z0-9]{20})$/);
  if (fromUser) return fromUser[1];
  const fromHost = url.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  return fromHost ? fromHost[1] : null;
}
