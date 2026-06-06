// src/app/api/cron/purge-expired/route.ts
//
// Vercel Cron handler implementing the Epic 10 tiered data-retention policy
// (Decision D6). It finds terminal-outcome applications whose retention window
// has fully elapsed (per `lib/retention/policy.ts`) and erases each via the
// SHARED cascade `lib/retention/purge.ts` — the exact same anonymising deletion
// the manual GDPR button runs.
//
// ── DESTRUCTIVE-OPERATION SAFETY (read before changing anything) ─────────────
//
//  1. STRICTLY WINDOW-GATED. Only rows whose retention window has elapsed
//     (computed from the decision/archive/close date) are ever touched. On
//     recent data this is a NO-OP — nothing on a freshly-seeded nonprod is
//     eligible. The cron never deletes anything inside its window.
//
//  2. DRY-RUN BY DEFAULT. The destructive path runs ONLY when
//     `RETENTION_PURGE_ENABLED` is exactly "true". With the flag unset/anything
//     else, the cron LOGS what it WOULD purge (counts per tier + ids) and
//     deletes NOTHING. This is the default posture so the job can be deployed
//     and observed on shared nonprod / before DPO sign-off without data loss.
//
//  3. AUDITED. When it actually purges, it writes ONE summary RETENTION_PURGE_CRON
//     audit row (only if something changed — no nightly no-op flood). It NEVER
//     deletes audit rows (audit_logs is append-only; the cascade nulls userId).
//
//  4. BOUNDED. Caps the rows processed per run (`MAX_PER_RUN`) to limit blast
//     radius and Storage API calls; per-item failures are logged and skipped,
//     never aborting the batch.
//
// Schedule: registered in vercel.json under `crons`. Vercel invokes this route
// with `Authorization: Bearer ${CRON_SECRET}` (reused from expire-invitations;
// already set in Production AND Preview).
//
// Security: fail-closed — requests without a matching bearer token (or when
// CRON_SECRET is unset) are rejected 401.

import { NextRequest, NextResponse } from "next/server";
import { withAdminContext } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { deleteDocument } from "@/lib/storage/documents";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { isPurgeable, getRetentionPolicy } from "@/lib/retention/policy";
import {
  purgeApplication,
  buildPurgeAuditMetadata,
  type PurgeableApplication,
} from "@/lib/retention/purge";
import type { AssessmentOutcome } from "@prisma/client";

export const dynamic = "force-dynamic";

/** Hard cap on rows processed per run (blast-radius / Storage-call ceiling). */
const MAX_PER_RUN = 100;

/** Destructive deletion runs ONLY when this is exactly "true". */
function isPurgeEnabled(): boolean {
  return process.env.RETENTION_PURGE_ENABLED === "true";
}

/** Terminal outcomes the policy can tier. Legacy QUALIFIES is excluded. */
const TERMINAL_OUTCOMES: AssessmentOutcome[] = [
  "DOES_NOT_QUALIFY",
  "QUALIFIES_NOT_AWARDED",
  "AWARDED",
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth: require a matching bearer token (fail closed) ───────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const enabled = isPurgeEnabled();
  const policy = getRetentionPolicy();

  try {
    // 1. Candidate set: terminal-outcome applications, not already anonymised,
    //    capped. We over-fetch the small fields needed to evaluate the window
    //    AND to drive the cascade, then filter in-process via `isPurgeable`.
    const candidates = await withAdminContext((tx) =>
      tx.application.findMany({
        where: {
          assessment: { outcome: { in: TERMINAL_OUTCOMES } },
          // Skip rows already anonymised by a prior purge.
          childName: { not: "[Child Removed]" },
        },
        take: MAX_PER_RUN,
        orderBy: { submittedAt: "asc" },
        select: {
          id: true,
          reference: true,
          leadApplicantId: true,
          submittedAt: true,
          archivedAt: true,
          documents: { select: { id: true, storagePath: true } },
          assessment: {
            select: {
              id: true,
              outcome: true,
              property: { select: { id: true } },
              recommendation: { select: { id: true } },
            },
          },
          bursaryAccount: { select: { status: true, closedAt: true } },
        },
      })
    );

    // 2. Window-gate: keep only those whose retention window has fully elapsed.
    const eligible = candidates.filter(
      (app) =>
        isPurgeable(
          {
            outcome: app.assessment?.outcome ?? null,
            archivedAt: app.archivedAt,
            submittedAt: app.submittedAt,
          },
          app.bursaryAccount
            ? {
                status: app.bursaryAccount.status,
                closedAt: app.bursaryAccount.closedAt,
              }
            : null,
          now,
          policy
        ).purgeable
    );

    // Per-tier counts for the report / audit metadata.
    const tierCounts = eligible.reduce<Record<string, number>>((acc, app) => {
      const tier = isPurgeable(
        {
          outcome: app.assessment?.outcome ?? null,
          archivedAt: app.archivedAt,
          submittedAt: app.submittedAt,
        },
        app.bursaryAccount
          ? { status: app.bursaryAccount.status, closedAt: app.bursaryAccount.closedAt }
          : null,
        now,
        policy
      ).tier;
      if (tier) acc[tier] = (acc[tier] ?? 0) + 1;
      return acc;
    }, {});

    // 3a. DRY-RUN (default): log what WOULD be purged, delete nothing.
    if (!enabled) {
      console.info(
        `[cron/purge-expired] DRY-RUN (RETENTION_PURGE_ENABLED!=true): ` +
          `${eligible.length}/${candidates.length} candidate(s) are eligible`,
        {
          tierCounts,
          references: eligible.map((a) => a.reference),
        }
      );
      return NextResponse.json({
        ok: true,
        mode: "dry-run",
        candidates: candidates.length,
        eligible: eligible.length,
        tierCounts,
        purged: 0,
        ranAt: now.toISOString(),
      });
    }

    // 3b. ENABLED: erase each eligible application via the shared cascade.
    //     Per-item failures are non-fatal (logged + skipped).
    const purged: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const app of eligible) {
      const purgeable: PurgeableApplication = {
        id: app.id,
        reference: app.reference,
        leadApplicantId: app.leadApplicantId,
        documents: app.documents,
        assessment: app.assessment
          ? {
              id: app.assessment.id,
              property: app.assessment.property,
              recommendation: app.assessment.recommendation,
            }
          : null,
      };
      try {
        const result = await purgeApplication(purgeable, {
          withAdminContext,
          deleteDocument,
          deleteAuthUser: (uid) =>
            createSupabaseAdminClient().auth.admin.deleteUser(uid),
        });
        // One per-application audit row keyed to the application, mirroring the
        // manual GDPR_DELETION shape but with the automatic action key.
        await withAdminContext((tx) =>
          createAuditLog(tx, {
            action: AUDIT_ACTIONS.RETENTION_PURGE_CRON,
            entityType: AUDIT_ENTITY_TYPES.Application,
            entityId: app.id,
            context: `Automatic retention purge of application ${app.reference}`,
            metadata: buildPurgeAuditMetadata(app, app.leadApplicantId, result),
          })
        );
        purged.push(app.reference);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ id: app.id, error: msg });
        console.error("[cron/purge-expired] purge failed for", app.id, msg);
      }
    }

    // 4. One summary audit row — ONLY when something was actually purged, so a
    //    no-op run never floods the trail.
    if (purged.length > 0) {
      await withAdminContext((tx) =>
        createAuditLog(tx, {
          action: AUDIT_ACTIONS.RETENTION_PURGE_CRON,
          entityType: AUDIT_ENTITY_TYPES.Application,
          context: `Retention purge run: ${purged.length} application(s) erased`,
          metadata: {
            purgedCount: purged.length,
            failedCount: failed.length,
            tierCounts,
            references: purged,
            failed: failed.length > 0 ? failed : undefined,
            ranAt: now.toISOString(),
          },
        })
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "enabled",
      candidates: candidates.length,
      eligible: eligible.length,
      tierCounts,
      purged: purged.length,
      failed: failed.length,
      ranAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[cron/purge-expired] error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to run retention purge" },
      { status: 500 }
    );
  }
}
