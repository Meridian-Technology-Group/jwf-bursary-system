-- Epic 21 F2 (CR-002 Phase 4, D-1) — rolling-over dates on future schedule
-- years.
--
-- Every schedule year after the award year is a rolling-over year, but it was
-- planned with the award round's dates shifted forward (the new-applicant
-- window: 21 Aug → 17 Sep every year). Charlotte, 12 Oct 2026: every
-- rolling-over year opens 15 April and closes 21 May of the spring before it,
-- e.g. 2027-28 → 15/04/2027–21/05/2027. New rows are planned that way
-- (`scheduleDatesForYear`); this re-dates the existing future rows to match.
--
-- DATA MIGRATION (mass UPDATE): approved by Brian in PR before merge.
-- Scope: SCHEDULED rows after the award year that are not yet linked to a
-- real round (once a round exists, its own dates take over). Prod at
-- 13 Oct 2026: 7 rows (2027-28 … 2032-33). Migration staging: rerun by hand
-- after `migrate deploy` (this file IS the rerun). Idempotent.

UPDATE "bursary_schedule_entries"
SET
  "available_on" = make_date(left("academic_year", 4)::int, 4, 15),
  "required_by"  = make_date(left("academic_year", 4)::int, 5, 21)
WHERE "status" = 'SCHEDULED'
  AND "schedule_year" >= 2
  AND "round_id" IS NULL
  AND "academic_year" ~ '^[0-9]{4}';
