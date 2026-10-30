-- Epic 21 #4 (CR-002 Phase 4) — "End after this year" / "Add a year".
--
-- Deleting schedule rows alone does not stick: generateSchedule re-inserts
-- every missing year up to the natural horizon on Regenerate and on every award
-- lock. The account therefore records where an ADMIN ended its schedule, and
-- generation never plans past it.
--
-- NULL = natural horizon (to Year 13; Year 11 at the OP partnering school).
-- A number = the last scheduleYear kept.
--
-- Additive: one nullable column, no backfill, no RLS change (bursary_accounts
-- policies are row-level).

ALTER TABLE "bursary_accounts" ADD COLUMN "schedule_end_year" INTEGER;
