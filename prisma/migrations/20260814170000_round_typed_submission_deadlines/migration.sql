-- =============================================================================
-- JWF Bursary System — application-type-aware round submission deadlines (E1)
-- =============================================================================
-- Epic 13, decision D13-8 (CF-11, CF-12), implemented per
-- docs/backlog/uat-aug-2026/sprint-01-implementation-plan.md §5 E1.
--
-- The Foundation runs two intakes inside one round on two different clocks:
-- brand-new applicants submit against one date, existing bursary holders
-- rolling over (annual re-assessment) against another — conventionally April.
-- One `rounds.default_submission_deadline` column cannot express that, so the
-- round default splits in two, keyed on `applications.application_type`
-- (NEW | ROLLING_OVER).
--
-- Q4 decided (Brian, 2026-08-14): the rolling-over deadline is ONE GLOBAL date
-- per round, defaulting to April — NOT per school. Two date columns are
-- therefore the entire model; there is deliberately no per-school structure and
-- no new table.
--
-- Effective submission deadline (derived in code, not the DB) =
--   application.submission_deadline_at                        (override)
--     ?? end-of-day(round default FOR THAT APPLICATION TYPE)  (THIS)
--     ?? end-of-day(round.close_date)                         (fallback — D-1)
-- See src/lib/rounds/submission-deadline.ts (effectiveSubmissionDeadline()).
-- Both new columns are DATE (no time-of-day), exactly like the column they
-- replace and like `close_date`, and are normalised to the LAST millisecond of
-- that calendar day in code. Reading them raw would put the deadline at the
-- START of the day and lock applicants out a day early.
--
-- ── Why additive, and why the legacy column survives ─────────────────────────
-- Additive + nullable + no default ⇒ no table rewrite, no long lock. The
-- backfill copies the existing single default into BOTH new columns, so every
-- round keeps precisely today's behaviour until an admin sets the two dates
-- apart: a round with no default still has none (NULL ⇒ close-date fallback),
-- and a round with one keeps it for both application types.
--
-- `default_submission_deadline` is intentionally NOT dropped here. This PR cuts
-- every READER over to the two new columns and keeps mirroring writes into the
-- legacy column (from the NEW value), so the change is reversible by reverting
-- code alone. The column drop ships as its own follow-up PR (E1b) after staging
-- verification — the Epic 01 PR-6 / #177 precedent.
--
-- ── RLS ──────────────────────────────────────────────────────────────────────
-- No new table, so no new policies. `rounds` keeps its existing policies from
-- 20260513090020_enable_row_level_security; adding columns does not change who
-- may read or write the row.
--
-- ── Data check ───────────────────────────────────────────────────────────────
-- Adding nullable columns cannot fail on existing data. The backfill is a plain
-- column-to-column copy over `rounds` (a handful of rows), and is idempotent —
-- re-running it would write the same values. Reversal is
--   ALTER TABLE public.rounds
--     DROP COLUMN default_submission_deadline_new,
--     DROP COLUMN default_submission_deadline_rolling;
-- which loses only any divergence an admin has since introduced between the two
-- dates; the legacy column still carries the NEW-application value.
-- =============================================================================

ALTER TABLE "rounds"
  ADD COLUMN IF NOT EXISTS "default_submission_deadline_new" DATE,
  ADD COLUMN IF NOT EXISTS "default_submission_deadline_rolling" DATE;

-- Backfill: every existing round keeps its current single default for BOTH
-- application types, so no round's effective deadlines move on deploy.
UPDATE "rounds"
   SET "default_submission_deadline_new" = "default_submission_deadline",
       "default_submission_deadline_rolling" = "default_submission_deadline"
 WHERE "default_submission_deadline" IS NOT NULL
   AND ("default_submission_deadline_new" IS NULL
        OR "default_submission_deadline_rolling" IS NULL);
