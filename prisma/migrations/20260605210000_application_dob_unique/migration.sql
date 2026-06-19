-- =============================================================================
-- JWF Bursary System — Per-child uniqueness incl. DOB / twins (Epic 04, PR-3)
-- =============================================================================
-- Plan: docs/backlog/process-alignment/plans/04-lead-applicant-contacts-and-invitations.md
--       §5.1 (twin key), §6 PR-5, §8 (DOB-backfill risk), D12.
--
-- D12: one account per child keyed on (childName + DOB). Twins (same first
-- name, distinct DOB) must each get a distinct application/account. Today the
-- key is `@@unique([roundId, leadApplicantId, childName])` — which COLLIDES for
-- twins. This migration tightens it to include DOB.
--
-- The NULL-DOB trap: child_dob is nullable and Postgres treats NULLs as DISTINCT
-- in a unique index, so naively adding child_dob to the tuple would WEAKEN
-- dedupe (two same-name NULL-dob rows would both be allowed). We avoid that with
-- TWO complementary constraints that together fully replace the old one without
-- weakening it:
--   1. a composite UNIQUE (round, lead, child_name, child_dob) — enforces the
--      non-NULL-DOB case (real twins differ by DOB ⇒ allowed; same DOB ⇒ blocked);
--   2. a PARTIAL UNIQUE (round, lead, child_name) WHERE child_dob IS NULL — at
--      most ONE same-name row may have an unknown DOB per (round, lead), so two
--      NULL-dob same-name rows still collide exactly as the old constraint did.
--
-- Sequence (additive → backfill → tighten, all in one deploy transaction):
--   A. BACKFILL applications.child_dob from the CHILD_DETAILS section JSONB
--      `dateOfBirth` (YYYY-MM-DD), only where currently NULL — mirrors the
--      submit-time promotion. Never overwrites an existing value.
--   B. CREATE the two new unique indexes.
--   C. DROP the old childName-only unique.
--
-- WHY THIS CANNOT BREAK EXISTING ROWS: the old constraint already forbade two
-- same-name rows per (round, lead). So after backfill there is at most one row
-- per (round, lead, child_name) — therefore neither new index can be violated
-- (a single row never collides with itself). READ-ONLY validation queries to
-- confirm on nonprod BEFORE merge are in the PR body; CI applies on merge.
-- =============================================================================

-- ── A. Backfill child_dob from CHILD_DETAILS JSONB (only where NULL) ──────────
-- The CHILD_DETAILS section stores the child's DOB as a 'YYYY-MM-DD' string at
-- data->>'dateOfBirth'. Promote it onto the first-class column so the new
-- composite key can disambiguate twins for existing rows too. We only touch
-- rows whose child_dob IS NULL and whose JSONB value parses as a valid date.
UPDATE "applications" AS a
SET "child_dob" = (s."data" ->> 'dateOfBirth')::date
FROM "application_sections" AS s
WHERE s."application_id" = a."id"
  AND s."section" = 'CHILD_DETAILS'
  AND a."child_dob" IS NULL
  AND (s."data" ->> 'dateOfBirth') ~ '^\d{4}-\d{2}-\d{2}$';

-- ── B. New uniqueness ─────────────────────────────────────────────────────────
-- B1: composite unique — the non-NULL-DOB case (Prisma-modelled).
CREATE UNIQUE INDEX "applications_round_id_lead_applicant_id_child_name_child_do_key"
  ON "applications"("round_id", "lead_applicant_id", "child_name", "child_dob");

-- B2: partial unique — forbids two same-name rows that BOTH have NULL DOB
-- (preserves the old dedupe for legacy/unknown-DOB rows; raw SQL because Prisma
-- cannot express a WHERE on a @@unique). Documented in schema.prisma on the
-- Application model.
CREATE UNIQUE INDEX "applications_round_lead_child_null_dob_key"
  ON "applications"("round_id", "lead_applicant_id", "child_name")
  WHERE "child_dob" IS NULL;

-- ── C. Drop the old childName-only unique (replaced by B1 + B2) ───────────────
DROP INDEX "applications_round_id_lead_applicant_id_child_name_key";
