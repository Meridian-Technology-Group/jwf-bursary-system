-- Epic 21 #6 rework (14 Oct 2026), part 2 of 2: one MAIN synopsis per account.
--
-- Charlotte (13 Oct 2026) asked for one editable "Main synopsis" per account
-- instead of the first build's timeline of per-year entries and staff notes.
--
-- DATA MIGRATION (rewrites existing rows; Brian's approval needed before merge):
--   1. Each account's newest YEAR entry becomes its MAIN entry IN PLACE. The
--      row id is kept, so the Grant Tracker toolkit's ledger on migration
--      staging (271 YEAR entries written by `mig backfill-synopsis`) still
--      points at live rows and rollback stays exact.
--   2. The remaining YEAR entries and every NOTE are removed. A YEAR entry's
--      text is a copy of that year's `assessments.synopsis`, which is
--      untouched, so nothing is lost. NOTEs were test notes only.
--   3. A partial unique index enforces one MAIN per account.
--
-- Blast radius (14 Oct 2026):
--   nonprod (staging): 0 rows in the table, so a no-op.
--   prod:              the table arrives empty with 20261013200000, so a no-op.
--   migration staging: applied by hand; 271 YEAR -> 271 MAIN (one per
--                      account), 1 NOTE (test note on TS-NOWS01) removed.

-- 1. Newest YEAR entry per account -> MAIN (skipped where a MAIN already exists).
WITH ranked AS (
  SELECT
    id,
    bursary_account_id,
    row_number() OVER (
      PARTITION BY bursary_account_id
      ORDER BY academic_year DESC NULLS LAST, updated_at DESC, id
    ) AS rn
  FROM "account_synopsis_entries"
  WHERE kind = 'YEAR'
)
UPDATE "account_synopsis_entries" e
SET kind = 'MAIN',
    assessment_id = NULL,
    academic_year = NULL
FROM ranked r
WHERE e.id = r.id
  AND r.rn = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "account_synopsis_entries" m
    WHERE m.bursary_account_id = r.bursary_account_id
      AND m.kind = 'MAIN'
  );

-- 2. The retired kinds go.
DELETE FROM "account_synopsis_entries" WHERE kind IN ('YEAR', 'NOTE');

-- 3. One MAIN per account. Raw SQL: Prisma cannot express a WHERE on a
--    @@unique (documented on the AccountSynopsisEntry model).
CREATE UNIQUE INDEX "account_synopsis_entries_one_main_per_account"
  ON "account_synopsis_entries" ("bursary_account_id")
  WHERE kind = 'MAIN';
