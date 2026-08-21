-- Epic 15 M1 (CH-10/11/14): the assessment's own school (switchable by the
-- assessor mid-assessment — Trinity→Whitgift recalculation) and the entry
-- SCHOOL year (Year 6–13, not a calendar year). Additive; IF NOT EXISTS +
-- NULL-guarded backfills so pre-applying to nonprod and the later
-- migrate-deploy re-run are both safe.

ALTER TABLE "assessments"
  ADD COLUMN IF NOT EXISTS "assessment_school" "School",
  ADD COLUMN IF NOT EXISTS "entry_school_year" INTEGER;

-- Backfill EXISTING assessments so in-flight work keeps its effective
-- behaviour (their fees were resolved from the application's school; their
-- year group from the application). NEW assessments start NULL — the
-- assessor must pick both (CH-11: no prefill).
UPDATE "assessments" s
SET "assessment_school" = a."school"
FROM "applications" a
WHERE a."id" = s."application_id"
  AND s."assessment_school" IS NULL;

UPDATE "assessments" s
SET "entry_school_year" = CASE a."entry_year_group"
    WHEN 'Y6' THEN 6
    WHEN 'Y7' THEN 7
    WHEN 'Y9' THEN 9
    WHEN 'Y12' THEN 12
    ELSE NULL
  END
FROM "applications" a
WHERE a."id" = s."application_id"
  AND s."entry_school_year" IS NULL;
