-- =============================================================================
-- JWF Bursary System — Section ownership write-path foundation
-- =============================================================================
-- Backlog #20 (dual-parent-separated-bursary-application), PR 4a of the epic.
-- See docs/engineering/dual-parent-implementation-plan.md.
--
-- Makes "every section is owned by a contributor" a HARD invariant and relaxes
-- the section uniqueness so a SECONDARY contributor can later own its own
-- distinct copies of the parent-financial sections (PR 4b).
--
-- Purely ADDITIVE / forward-only:
--   a. Backfill a PRIMARY contributor for any application created since PR 1's
--      backfill that still lacks one (mirrors the PR 1 backfill exactly).
--   b. Backfill any application_sections.owner_contributor_id IS NULL to that
--      application's PRIMARY contributor.
--   c. owner_contributor_id -> NOT NULL (after the backfill covers 100%).
--   d. Drop UNIQUE(application_id, section); add
--      UNIQUE(application_id, section, owner_contributor_id). Because the column
--      is now NOT NULL there is NO NULL-distinct gap in the new unique.
--   e. Re-point the FK ON DELETE from SET NULL -> CASCADE (SET NULL is invalid
--      once the column is NOT NULL; CASCADE is consistent with the GDPR cascade
--      intentions for PR 6 — deleting a contributor removes its owned sections).
--
-- INERT for the secondary parent: no secondary portal yet (that is PR 4b) and
-- no behaviour change for the existing single-parent applicant flow.
-- =============================================================================


-- ─── a. Backfill: PRIMARY contributor for any application missing one ────────
-- Identical shape to the PR 1 backfill (20260524210000_add_application_contributor,
-- step 4). Covers applications created AFTER that migration ran but BEFORE the
-- application.create sites started calling ensurePrimaryContributor (PR 4a code).
-- ON CONFLICT keeps it idempotent and safe to re-run.

INSERT INTO "application_contributors"
  ("id", "application_id", "profile_id", "role", "status",
   "invited_by_id", "invited_at", "submitted_at", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  a."id",
  a."lead_applicant_id",
  'PRIMARY'::"ApplicationContributorRole",
  (CASE WHEN a."submitted_at" IS NOT NULL
        THEN 'SUBMITTED'
        ELSE 'IN_PROGRESS'
   END)::"ApplicationContributorStatus",
  NULL,
  a."created_at",
  a."submitted_at",
  now(),
  now()
FROM "applications" a
WHERE NOT EXISTS (
  SELECT 1 FROM "application_contributors" c
  WHERE c."application_id" = a."id"
    AND c."role" = 'PRIMARY'
)
ON CONFLICT ("application_id", "role") DO NOTHING;


-- ─── b. Backfill: point every NULL-owner section at its PRIMARY contributor ──

UPDATE "application_sections" s
SET "owner_contributor_id" = c."id"
FROM "application_contributors" c
WHERE c."application_id" = s."application_id"
  AND c."role" = 'PRIMARY'
  AND s."owner_contributor_id" IS NULL;


-- ─── c. Safety check: NO remaining NULLs before SET NOT NULL ─────────────────
-- Hard-fail the migration (rather than silently proceed) if any section row
-- still has a NULL owner — that would mean an application with no PRIMARY
-- contributor, which steps (a)/(b) should have made impossible.

DO $$
DECLARE
  null_owner_count integer;
BEGIN
  SELECT count(*) INTO null_owner_count
  FROM "application_sections"
  WHERE "owner_contributor_id" IS NULL;

  IF null_owner_count > 0 THEN
    RAISE EXCEPTION
      'Cannot SET NOT NULL: % application_sections rows still have a NULL owner_contributor_id after backfill',
      null_owner_count;
  END IF;
END $$;


-- ─── d. owner_contributor_id -> NOT NULL ─────────────────────────────────────

ALTER TABLE "application_sections"
  ALTER COLUMN "owner_contributor_id" SET NOT NULL;


-- ─── e. Relax section uniqueness ─────────────────────────────────────────────
-- Prisma implemented @@unique([applicationId, section]) as a UNIQUE INDEX named
-- "application_sections_application_id_section_key" (verified against the live
-- nonprod DB). Drop it and add the contributor-scoped unique. Because
-- owner_contributor_id is NOT NULL there is no NULL-distinct gap.

DROP INDEX IF EXISTS "application_sections_application_id_section_key";

CREATE UNIQUE INDEX "application_sections_application_id_section_owner_contributor_id_key"
  ON "application_sections" ("application_id", "section", "owner_contributor_id");


-- ─── f. FK ON DELETE: SET NULL -> CASCADE ────────────────────────────────────
-- PR 1 created the FK as ON DELETE SET NULL while the column was nullable. With
-- the column now NOT NULL, SET NULL is invalid. Switch to CASCADE so deleting a
-- contributor removes its owned section rows — consistent with the GDPR cascade
-- intentions for PR 6. Drop and re-add so schema.prisma and the DB agree exactly.

ALTER TABLE "application_sections"
  DROP CONSTRAINT IF EXISTS "application_sections_owner_contributor_id_fkey";

ALTER TABLE "application_sections"
  ADD CONSTRAINT "application_sections_owner_contributor_id_fkey"
    FOREIGN KEY ("owner_contributor_id") REFERENCES "application_contributors"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
