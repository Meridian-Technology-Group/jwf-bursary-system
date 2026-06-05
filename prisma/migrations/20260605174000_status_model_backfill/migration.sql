-- Epic 01 (Status & workflow model) — PR-2: BACKFILL.
--
-- Populates the new lifecycle columns added in PR-1 from the legacy fused
-- `applications.status`, per the mapping table in
-- docs/backlog/process-alignment/plans/01-status-and-workflow-model.md §5.1.
--
-- HARD INVARIANTS (see PR brief):
--   * This migration writes ONLY the new columns:
--       applications.form_status, applications.application_type,
--       applications.archived_at, assessments.status, assessments.outcome.
--     It NEVER writes applications.status — the legacy column stays the source
--     of truth until PR-6. That makes this backfill idempotent and re-runnable
--     as a safety net.
--   * Every UPDATE is guarded so re-running is a no-op (deterministic mapping
--     keyed off the unchanged legacy status / unchanged heuristic columns).
--   * Transaction-safe: pure DML, no enum DDL, no ALTER TYPE — safe for
--     `prisma migrate deploy` (which wraps the file in one transaction).
--
-- NOTE ON DERIVATION SOURCES (verified against application code at authoring):
--   * NEW vs ROLLING_OVER — the runtime heuristic is
--     `isReassessment = !!invitation.bursaryAccountId`
--     (src/app/(auth)/register/actions.ts:131). Reassessment applications are
--     created with `is_reassessment = true` AND a non-null `bursary_account_id`
--     (src/lib/db/queries/reassessment.ts:320,325); new applications with
--     `is_reassessment = false` and a null `bursary_account_id`
--     (src/app/(portal)/actions.ts:145). We therefore treat an application as
--     ROLLING_OVER when EITHER signal is present (defensive OR), else NEW.
--   * QUALIFIES → AWARDED vs QUALIFIES_NOT_AWARDED (the §5.1 D-note) — on
--     QUALIFIES, `setApplicationOutcome` creates a BursaryAccount and links it
--     to the application for NEW apps, while ROLLING_OVER apps already carry one
--     (src/lib/applications/set-outcome-core.ts:160). In BOTH qualifying cases
--     the application ends up with a non-null `bursary_account_id`. So
--     "a BursaryAccount exists for that application" ==
--     `applications.bursary_account_id IS NOT NULL`. We use that join-free test.
--   * PRE_SUBMISSION form_status — derived from completed `application_sections`
--     (see the block below for the documented approximation).

-- ───────────────────────────────────────────────────────────────────────────
-- 1. application_type  (set for ALL applications; deterministic + idempotent)
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLING_OVER when the app is a reassessment or already tied to a bursary
-- account; otherwise NEW. Guarded to only touch rows whose stored value does
-- not already match the derived value, so re-runs write nothing.
UPDATE "applications"
SET "application_type" = 'ROLLING_OVER'
WHERE ("is_reassessment" = true OR "bursary_account_id" IS NOT NULL)
  AND "application_type" <> 'ROLLING_OVER';

UPDATE "applications"
SET "application_type" = 'NEW'
WHERE "is_reassessment" = false
  AND "bursary_account_id" IS NULL
  AND "application_type" <> 'NEW';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. form_status  (derived from the legacy fused status)
-- ───────────────────────────────────────────────────────────────────────────
-- Any legacy status other than PRE_SUBMISSION means the form was submitted
-- (the assessment/outcome states only exist post-submission). Map them all to
-- SUBMITTED. Guard on the current value so re-runs are no-ops.
UPDATE "applications"
SET "form_status" = 'SUBMITTED'
WHERE "status" <> 'PRE_SUBMISSION'
  AND "form_status" <> 'SUBMITTED';

-- PRE_SUBMISSION → derive from section completion.
--
-- APPROXIMATION (explicitly sanctioned by the PR brief; runtime derivation in
-- Epic 01 PR-3/4 supersedes this):
--   required_sections = 10 for NEW, 9 for ROLLING_OVER (= SECTION_ORDER minus
--   HIDDEN_REASSESSMENT_SECTIONS = {FAMILY_ID}; src/app/(portal)/apply/
--   [section]/page.tsx:60 and src/lib/db/queries/reassessment.ts:38).
--   complete = COUNT(application_sections WHERE is_complete) for the app.
--     complete >= required        → FILLED_IN  (all done, just not submitted)
--     complete BETWEEN 1 and req-1 → IN_PROGRESS
--     complete = 0                 → CREATED    (cannot distinguish CREATED vs
--                                                NOT_STARTED in SQL with no
--                                                login telemetry; default to the
--                                                safest pre-engagement state —
--                                                runtime corrects it on next
--                                                login/save)
-- We compute the completed-section count once per application via a CTE and the
-- required count from application_type, then guard each branch on the current
-- form_status so the whole block is idempotent.
WITH section_counts AS (
  SELECT
    a."id" AS application_id,
    CASE WHEN a."application_type" = 'ROLLING_OVER' THEN 9 ELSE 10 END AS required_count,
    COALESCE(sc.complete_count, 0) AS complete_count
  FROM "applications" a
  LEFT JOIN (
    SELECT "application_id", COUNT(*) AS complete_count
    FROM "application_sections"
    WHERE "is_complete" = true
    GROUP BY "application_id"
  ) sc ON sc."application_id" = a."id"
  WHERE a."status" = 'PRE_SUBMISSION'
)
UPDATE "applications" a
SET "form_status" = (
  CASE
    WHEN sc.complete_count >= sc.required_count THEN 'FILLED_IN'
    WHEN sc.complete_count >= 1                 THEN 'IN_PROGRESS'
    ELSE 'CREATED'
  END
)::"ApplicationFormStatus"
FROM section_counts sc
WHERE a."id" = sc.application_id
  AND a."form_status" <> (
    CASE
      WHEN sc.complete_count >= sc.required_count THEN 'FILLED_IN'
      WHEN sc.complete_count >= 1                 THEN 'IN_PROGRESS'
      ELSE 'CREATED'
    END
  )::"ApplicationFormStatus";

-- ───────────────────────────────────────────────────────────────────────────
-- 3. assessments.status  (derived from the legacy fused applications.status)
-- ───────────────────────────────────────────────────────────────────────────
-- Map the assessment-lifecycle portion of the old enum onto the real
-- AssessmentStatus. Joined via the 1:1 assessments.application_id. Each branch
-- is guarded on the assessment's current status so re-runs are no-ops.
--
--   legacy NOT_STARTED                         → IN_PROGRESS
--   legacy PAUSED                              → PAUSED
--   legacy COMPLETED / QUALIFIES / DNQ         → COMPLETED
UPDATE "assessments" asmt
SET "status" = 'IN_PROGRESS'
FROM "applications" a
WHERE asmt."application_id" = a."id"
  AND a."status" = 'NOT_STARTED'
  AND asmt."status" <> 'IN_PROGRESS';

UPDATE "assessments" asmt
SET "status" = 'PAUSED'
FROM "applications" a
WHERE asmt."application_id" = a."id"
  AND a."status" = 'PAUSED'
  AND asmt."status" <> 'PAUSED';

UPDATE "assessments" asmt
SET "status" = 'COMPLETED'
FROM "applications" a
WHERE asmt."application_id" = a."id"
  AND a."status" IN ('COMPLETED', 'QUALIFIES', 'DOES_NOT_QUALIFY')
  AND asmt."status" <> 'COMPLETED';

-- ───────────────────────────────────────────────────────────────────────────
-- 4. assessments.outcome  (extend the binary outcome to the 3-value lifecycle)
-- ───────────────────────────────────────────────────────────────────────────
-- QUALIFIES → AWARDED when the application has a BursaryAccount, else
-- QUALIFIES_NOT_AWARDED (the §5.1 D-note). DOES_NOT_QUALIFY stays as-is.
-- Guards skip rows already carrying the target value.
UPDATE "assessments" asmt
SET "outcome" = 'AWARDED'
FROM "applications" a
WHERE asmt."application_id" = a."id"
  AND a."status" = 'QUALIFIES'
  AND a."bursary_account_id" IS NOT NULL
  AND asmt."outcome" IS DISTINCT FROM 'AWARDED';

UPDATE "assessments" asmt
SET "outcome" = 'QUALIFIES_NOT_AWARDED'
FROM "applications" a
WHERE asmt."application_id" = a."id"
  AND a."status" = 'QUALIFIES'
  AND a."bursary_account_id" IS NULL
  AND asmt."outcome" IS DISTINCT FROM 'QUALIFIES_NOT_AWARDED';

UPDATE "assessments" asmt
SET "outcome" = 'DOES_NOT_QUALIFY'
FROM "applications" a
WHERE asmt."application_id" = a."id"
  AND a."status" = 'DOES_NOT_QUALIFY'
  AND asmt."outcome" IS DISTINCT FROM 'DOES_NOT_QUALIFY';

-- ───────────────────────────────────────────────────────────────────────────
-- 5. archived_at  (new applications that did not qualify are archived; §3)
-- ───────────────────────────────────────────────────────────────────────────
-- Per §3: DOES_NOT_QUALIFY on a NEW application → application archived. Use the
-- row's updated_at as the archive timestamp (deterministic; avoids stamping a
-- migration-run time onto historical rows). Idempotent: only NULL archived_at.
UPDATE "applications"
SET "archived_at" = "updated_at"
WHERE "status" = 'DOES_NOT_QUALIFY'
  AND "application_type" = 'NEW'
  AND "archived_at" IS NULL;
