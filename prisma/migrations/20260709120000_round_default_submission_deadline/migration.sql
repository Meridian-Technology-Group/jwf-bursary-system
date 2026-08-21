-- =============================================================================
-- JWF Bursary System — Round-level default submission-by date (Item 12)
-- =============================================================================
-- Plan: docs/backlog/stories/12-round-default-deadline.md,
--       docs/backlog/stories/00-implementation-plan.md §"Item 12".
--
-- Adds an OPTIONAL default submit-by date on `rounds`, inherited by every
-- application in the round unless it has its own
-- `applications.submission_deadline_at` override (Epic 03, PR-1). This is a
-- date-only value (no time-of-day) — normalised to end-of-day in code, exactly
-- like `rounds.close_date` — because the story decided the default carries no
-- time component.
--
-- Effective submission deadline (derived in code, not the DB) =
--   application.submission_deadline_at
--     ?? end-of-day(round.default_submission_deadline)  (THIS)
--     ?? end-of-day(round.close_date)                    (fallback — D-1)
-- See src/lib/rounds/submission-deadline.ts (effectiveSubmissionDeadline()).
--
-- Additive + nullable + no default: existing rounds get NULL ("no round
-- default"; applications fall back to close_date as before), so this is a
-- zero-backfill, non-breaking change. CI applies this on merge to staging
-- (.github/workflows/db-push.yml).
-- =============================================================================

ALTER TABLE "rounds"
  ADD COLUMN "default_submission_deadline" DATE;
