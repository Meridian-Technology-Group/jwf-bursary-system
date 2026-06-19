-- Epic 08 — outcome email templates for the 3-value AssessmentOutcome lifecycle.
--
-- Epic 01 introduced the three outcomes (DOES_NOT_QUALIFY | QUALIFIES_NOT_AWARDED
-- | AWARDED) but the outcome emails were still the legacy binary pair
-- (OUTCOME_QUALIFIES / OUTCOME_DNQ). Add the two new template types so each
-- outcome can map to its own letter.
--
-- ADD VALUE is split from any DML that USES the new values (the template seed in
-- 20260606180200_seed_outcome_email_templates) — Postgres requires a new enum
-- value to be committed before it can be referenced in the same transaction.
-- IF NOT EXISTS makes this safe to re-run.
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'OUTCOME_AWARDED';
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'OUTCOME_QUALIFIES_NOT_AWARDED';
