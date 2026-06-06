-- Epic 01 PR-6a — residual outcome remap (DATA ONLY, no DDL).
--
-- Before PR-3 introduced the central status service (which dual-wrote the
-- 3-value assessments.outcome), a small number of rows could carry the legacy
-- enum value assessments.outcome = 'QUALIFIES' (the pre-3-value lifecycle).
-- PR-6b will DROP the 'QUALIFIES' value from the AssessmentOutcome enum, so any
-- residual rows must first be remapped onto the 3-value model.
--
-- Discriminator (same as PR-2 backfill / set-outcome-core): an application that
-- is linked to a BursaryAccount was AWARDED; otherwise it merely
-- QUALIFIES_NOT_AWARDED.
--
-- This migration is:
--   * ADDITIVE / data-only      — it changes column VALUES, never schema. No
--                                 enum value is added or dropped here (6b does
--                                 the enum/column DDL).
--   * IDEMPOTENT                — re-running it is a no-op once no 'QUALIFIES'
--                                 rows remain (the WHERE clauses match nothing).
--   * GUARDED                   — scoped strictly to outcome = 'QUALIFIES'.
--
-- (~1 such row observed on nonprod earlier.)

-- AWARDED: the application has a bursary account (the award signal).
UPDATE "assessments" AS a
SET "outcome" = 'AWARDED'
FROM "applications" AS app
WHERE a."application_id" = app."id"
  AND a."outcome" = 'QUALIFIES'
  AND app."bursary_account_id" IS NOT NULL;

-- QUALIFIES_NOT_AWARDED: eligible but no account linked.
UPDATE "assessments" AS a
SET "outcome" = 'QUALIFIES_NOT_AWARDED'
FROM "applications" AS app
WHERE a."application_id" = app."id"
  AND a."outcome" = 'QUALIFIES'
  AND app."bursary_account_id" IS NULL;
