-- =============================================================================
-- JWF Bursary System — Application contributors (dual-parent foundation)
-- =============================================================================
-- Backlog #20 (dual-parent-separated-bursary-application), PR 1 of 6.
-- See docs/engineering/dual-parent-implementation-plan.md.
--
-- Purely ADDITIVE. Introduces the contributor model that links a parent /
-- guardian Profile to an Application, supporting the separated/divorced case
-- where each parent supplies their own financials through their own login.
--
--   * Exactly one PRIMARY contributor per application (the existing lead
--     applicant) — enforced by a UNIQUE on (application_id, role).
--   * AT MOST one SECONDARY contributor per application (wired up in later PRs).
--
-- This migration also adds a nullable `owner_contributor_id` discriminator to
-- `application_sections` and backfills every existing section to its
-- application's PRIMARY contributor. The existing
-- UNIQUE(application_id, section) constraint is intentionally UNCHANGED here —
-- relaxing it (so a SECONDARY can own a distinct copy of the parent-financial
-- sections) and wiring the write path to populate the column happen in PR 4.
-- Nothing reads `owner_contributor_id` until then, so this is a safe,
-- forward-only foundation with no behaviour change.
-- =============================================================================


-- ─── 1. Enums ────────────────────────────────────────────────────────────────
-- New types, created and used within this migration (CREATE TYPE then
-- reference is safe in a single transaction). Unlike ALTER TYPE ... ADD VALUE,
-- new enum types have no "unsafe use of new value" restriction.

CREATE TYPE "ApplicationContributorRole"   AS ENUM ('PRIMARY', 'SECONDARY');
CREATE TYPE "ApplicationContributorStatus" AS ENUM ('INVITED', 'IN_PROGRESS', 'SUBMITTED');


-- ─── 2. application_contributors table ───────────────────────────────────────

CREATE TABLE "application_contributors" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "profile_id"     uuid NOT NULL,
  "role"           "ApplicationContributorRole" NOT NULL,
  "status"         "ApplicationContributorStatus" NOT NULL DEFAULT 'INVITED',
  "invited_by_id"  uuid,
  "invited_at"     timestamptz(6),
  "submitted_at"   timestamptz(6),
  "created_at"     timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at"     timestamptz(6) NOT NULL DEFAULT now(),

  -- At most one contributor per role per application (=> one PRIMARY, one SECONDARY).
  CONSTRAINT "application_contributors_application_id_role_key"
    UNIQUE ("application_id", "role"),
  -- A profile can only be linked once to a given application.
  CONSTRAINT "application_contributors_application_id_profile_id_key"
    UNIQUE ("application_id", "profile_id"),

  CONSTRAINT "application_contributors_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "application_contributors_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_contributors_invited_by_id_fkey"
    FOREIGN KEY ("invited_by_id") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "application_contributors_application_id_idx"
  ON "application_contributors" ("application_id");
CREATE INDEX "application_contributors_profile_id_idx"
  ON "application_contributors" ("profile_id");


-- ─── 3. application_sections.owner_contributor_id ────────────────────────────

ALTER TABLE "application_sections"
  ADD COLUMN "owner_contributor_id" uuid;

ALTER TABLE "application_sections"
  ADD CONSTRAINT "application_sections_owner_contributor_id_fkey"
    FOREIGN KEY ("owner_contributor_id") REFERENCES "application_contributors"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "application_sections_owner_contributor_id_idx"
  ON "application_sections" ("owner_contributor_id");


-- ─── 4. Backfill: one PRIMARY contributor per existing application ───────────
-- profile_id   = the application's lead applicant
-- status       = SUBMITTED if the application has been submitted, else IN_PROGRESS
-- invited_at   = the application's created_at (best available signal)
-- submitted_at = the application's submitted_at (NULL if not yet submitted)

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
ON CONFLICT ("application_id", "role") DO NOTHING;


-- ─── 5. Backfill: point every existing section at its PRIMARY contributor ────

UPDATE "application_sections" s
SET "owner_contributor_id" = c."id"
FROM "application_contributors" c
WHERE c."application_id" = s."application_id"
  AND c."role" = 'PRIMARY'
  AND s."owner_contributor_id" IS NULL;


-- ─── 6. RLS ──────────────────────────────────────────────────────────────────
-- Enable RLS on the new table and grant the standard CRUD set to app_user,
-- mirroring the established policy style (see 20260513090020_*).
--
-- Visibility tracks application access: a contributor row is visible to admin/
-- viewer, to the assigned assessor, to the application's lead applicant, and to
-- the linked profile themselves. Writes are admin/service_role only for now —
-- the staff "add second parent" action (PR 3) runs via withAdminContext, so a
-- narrower app_user write policy is deferred until the secondary portal (PR 4)
-- needs the contributor to update their own status.

GRANT SELECT, INSERT, UPDATE, DELETE ON "application_contributors" TO app_user;

ALTER TABLE "application_contributors" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "application_contributors_select" ON "application_contributors"
  FOR SELECT TO app_user
  USING (
    public.is_admin_or_viewer()
    OR public.has_application_access("application_id")
    OR "profile_id" = public.current_user_id()
  );

CREATE POLICY "application_contributors_write" ON "application_contributors"
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
