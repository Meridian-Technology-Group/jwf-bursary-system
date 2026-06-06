-- =============================================================================
-- JWF Bursary System — T&Cs acceptance per submission (Epic 05, PR-2)
-- =============================================================================
-- Plan: docs/backlog/process-alignment/plans/05-parent-portal-experience.md
--       §5.1 (schema), Decision D10 (display + record acceptance per submission).
--
-- D10: the supplied Terms & Conditions are displayed on the home page AND
-- acceptance is recorded PER SUBMISSION. This migration adds the two columns the
-- submit path stamps and the submitted summary / submission PDF read:
--   - terms_accepted_at : when the parent accepted the T&Cs for this submission
--   - terms_version     : which T&Cs document/version was accepted (so a later
--                         document swap never rewrites a historic acceptance)
--
-- Purely ADDITIVE and NULLABLE — no backfill, no default, no data dependency.
-- Existing rows keep NULL (submitted before this column existed); the submitted
-- summary degrades gracefully when the acceptance is absent. CI applies on merge.
-- =============================================================================

ALTER TABLE "applications"
  ADD COLUMN "terms_accepted_at" TIMESTAMPTZ(6),
  ADD COLUMN "terms_version" TEXT;
