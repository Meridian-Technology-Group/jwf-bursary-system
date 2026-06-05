-- =============================================================================
-- JWF Bursary System — Per-application submission deadline (Epic 03, PR-1)
-- =============================================================================
-- Plan: docs/backlog/process-alignment/plans/03-round-management.md
--       §3 "Per-application submission deadline", §5.1 schema, §10 acceptance.
--
-- Adds an OPTIONAL per-applicant submit-by override to `applications`. When set,
-- it overrides the round-level intake window (`rounds.close_date`) FOR THIS
-- APPLICATION ONLY — used when an individual applicant is granted an extended
-- (or earlier) deadline to submit their form.
--
-- Effective submission deadline (derived in code, not the DB) =
--   submission_deadline_at ?? round.close_date (end-of-day)
-- See src/lib/rounds/submission-deadline.ts (effectiveSubmissionDeadline()).
--
-- Three-clock model (must stay distinct — Epic 01/03):
--   * rounds.close_date            — round-level intake window (date-only)
--   * applications.submission_deadline_at (THIS) — per-app form submit-by (timestamptz)
--   * assessments.paused_until     — post-submission doc deadline (Epic 01)
-- None of these mutates applications.submitted_at.
--
-- Additive + nullable + no default: existing rows get NULL ("use the round"),
-- so this is a zero-backfill, non-breaking change. Timestamptz (date+time) so an
-- Epic 05 parent "submit by Friday 5pm" countdown has a time component and we
-- avoid the midnight-UTC/BST off-by-one class of bug (00 §F). CI applies this on
-- merge to staging (.github/workflows/db-push.yml).
-- =============================================================================

ALTER TABLE "applications"
  ADD COLUMN "submission_deadline_at" TIMESTAMPTZ(6);
