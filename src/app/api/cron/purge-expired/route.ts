// src/app/api/cron/purge-expired/route.ts
//
// Weekly retention run (Epic 23 T10) — the DPO-signed rules of
// `lib/retention/policy.ts`, one stage at a time, per application, via the
// primitives of `lib/retention/stages.ts` (never the whole-family GDPR
// cascade).
//
// ── DESTRUCTIVE-OPERATION SAFETY (read before changing anything) ─────────────
//
//  1. DRY-RUN BY DEFAULT. The destructive path runs ONLY when
//     `RETENTION_PURGE_ENABLED` is exactly "true" — unset everywhere until
//     Brian has reviewed the dry-run report. Otherwise the run reports what it
//     WOULD do (counts per stage + the next 10 due) and changes nothing.
//  2. DUE-GATED IN SQL, RE-CHECKED IN THE TRANSACTION. Candidates are selected
//     by due date (`dueCandidatesWhere`) and paged through; each primitive
//     re-reads the row and re-plans inside its own transaction, so a reopened
//     account or an already-reached stage is skipped.
//  3. AUDITED. Each applied stage writes its own audit row; a run that applied
//     anything writes one RETENTION_PURGE_CRON summary. Audit rows are never
//     deleted.
//  4. BOUNDED. At most MAX_STAGES_PER_RUN stages per run; per-item failures are
//     logged and skipped. Storage objects and auth users are removed after
//     each stage's commit (non-fatal).
//
// Schedule: vercel.json `crons`. Auth: `Authorization: Bearer ${CRON_SECRET}`,
// fail-closed.

import { NextRequest, NextResponse } from "next/server";
import { withAdminContext } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { deleteDocument } from "@/lib/storage/documents";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { isRetentionPurgeEnabled, planRetention, type RetentionPlan } from "@/lib/retention/policy";
import {
  deleteStorageObjectsPostCommit,
  purgeAssessment,
  purgeFormAndDocuments,
  toRetentionRecord,
} from "@/lib/retention/stages";
import { countByAction, dueCandidatesWhere, retentionPage, retentionSchedule, PAGE_SIZE } from "@/lib/retention/schedule";
import { deleteAuthUsersPostCommit } from "@/lib/retention/close-purge";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Blast-radius ceiling per run; the rest wait for next week. */
const MAX_STAGES_PER_RUN = 500;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const enabled = isRetentionPurgeEnabled();

  try {
    // 1. Every due stage, paged by id.
    const due: { id: string; reference: string; plan: RetentionPlan }[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page = await withAdminContext((tx) => retentionPage(tx, dueCandidatesWhere(now), cursor));
      for (const row of page) {
        const plan = planRetention(toRetentionRecord(row), now);
        if (plan.due && plan.action !== "keep") due.push({ id: row.id, reference: row.reference, plan });
      }
      if (page.length < PAGE_SIZE) break;
      cursor = page[page.length - 1].id;
    }
    const stageCounts = countByAction(due.map((d) => d.plan));
    const upcoming = (await withAdminContext((tx) => retentionSchedule(tx, now)))
      .filter((s) => !s.plan.due)
      .slice(0, 10)
      .map((s) => ({ reference: s.reference, action: s.plan.action, rule: s.plan.rule, dueAt: s.plan.dueAt?.toISOString().slice(0, 10) }));

    // 2a. DRY-RUN (default): report, change nothing.
    if (!enabled) {
      console.info(`[cron/purge-expired] DRY-RUN (RETENTION_PURGE_ENABLED!=true): ${due.length} stage(s) due`, {
        stageCounts,
        applicationIds: due.map((d) => d.id),
      });
      return NextResponse.json({
        ok: true,
        mode: "dry-run",
        due: due.length,
        stageCounts,
        nextDue: upcoming,
        applied: 0,
        ranAt: now.toISOString(),
      });
    }

    // 2b. ENABLED: one stage per application per run, each in its own transaction.
    const applied: { applicationId: string; action: string }[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const item of due.slice(0, MAX_STAGES_PER_RUN)) {
      try {
        const result = await withAdminContext((tx) =>
          item.plan.action === "purge-form-docs"
            ? purgeFormAndDocuments(tx, item.id, now)
            : purgeAssessment(tx, item.id, now),
        );
        if (!result.applied) continue;
        await deleteStorageObjectsPostCommit(result.storagePaths, deleteDocument);
        if (result.authUsersToDelete.length) {
          await deleteAuthUsersPostCommit(result.authUsersToDelete, {
            deleteAuthUser: (uid) => createSupabaseAdminClient().auth.admin.deleteUser(uid),
          });
        }
        applied.push({ applicationId: item.id, action: item.plan.action });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ id: item.id, error: msg });
        console.error("[cron/purge-expired] stage failed for", item.id, msg);
      }
    }

    if (applied.length > 0) {
      await withAdminContext((tx) =>
        createAuditLog(tx, {
          action: AUDIT_ACTIONS.RETENTION_PURGE_CRON,
          entityType: AUDIT_ENTITY_TYPES.Application,
          context: `Retention run: ${applied.length} stage(s) applied`,
          metadata: {
            applied: applied.length,
            failed: failed.length,
            stageCounts: countByAction(applied.map((a) => ({ action: a.action }) as RetentionPlan)),
            // Ids, never references: the run's own row outlives the purge, and a
            // reference read before it would put the child's name back in the
            // history trail (retention trial, 22 Oct 2026). Each stage's own
            // row, on the application, says what happened to it.
            applicationIds: applied.map((a) => a.applicationId),
            failures: failed.length > 0 ? failed : undefined,
            deferred: Math.max(0, due.length - MAX_STAGES_PER_RUN),
            ranAt: now.toISOString(),
          },
        }),
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "enabled",
      due: due.length,
      stageCounts,
      nextDue: upcoming,
      applied: applied.length,
      failed: failed.length,
      ranAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[cron/purge-expired] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to run the retention purge" }, { status: 500 });
  }
}
