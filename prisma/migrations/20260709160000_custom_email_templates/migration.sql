-- =============================================================================
-- JWF Bursary System — Custom email templates (item 9, stories 9.1–9.4)
-- =============================================================================
-- Plan: docs/backlog/stories/09-email-template-management.md
--
-- Today `email_templates.type` is the `EmailTemplateType` enum, `@unique`, and
-- NOT NULL — every row is one of the 16 system templates the app looks up by
-- type when sending (src/lib/email/send.ts). This migration lets an ADMIN
-- create fully custom templates (no enum value) alongside those system rows:
--
--   * `type` becomes NULLable — custom rows carry `type = NULL`. The existing
--     unique index on `type` is unaffected: Postgres treats NULLs as distinct,
--     so any number of custom (type-less) rows can coexist, while each
--     EmailTemplateType enum value still resolves to exactly one row (the
--     invariant every `findUnique({ where: { type } })` send-path call relies
--     on — story 9.3's last acceptance criterion).
--   * `is_system` (default true) distinguishes seeded/system rows from
--     admin-created ones. Existing rows are all system rows, so the default
--     covers them with no backfill needed.
--   * `name` is the admin-facing label for a custom template (system rows
--     don't need one — they're labelled via TEMPLATE_LABELS in the UI keyed
--     off `type`). Uniqueness is enforced only among ACTIVE custom rows via
--     the partial index below (case-insensitive, ignores soft-deleted rows so
--     a deleted name can be reused).
--   * `deleted_at` is a soft-delete tombstone (story 9.2/9.4): the migration
--     seed and `getAllEmailTemplates` both check `deleted_at IS NULL`, so a
--     deleted custom template is never resurrected by a re-run of the
--     `*_seed_email_templates` baseline (which only touches system rows) and
--     never appears in a picker again.
--   * `created_by` records who created a custom template (nullable, FK to
--     profiles, ON DELETE SET NULL so removing a staff profile doesn't cascade
--     into deleting the templates they authored — mirrors the
--     `document_uploaded_by_contributor` precedent).
--
-- No backfill required: `is_system` defaults to true (covers all 16 existing
-- system rows), and `type`/`name`/`deleted_at`/`created_by` are all nullable.
-- CI applies this on merge to staging (.github/workflows/db-push.yml).
-- =============================================================================

ALTER TABLE "email_templates"
  ALTER COLUMN "type" DROP NOT NULL,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6),
  ADD COLUMN "created_by" UUID;

ALTER TABLE "email_templates"
  ADD CONSTRAINT "email_templates_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Case-insensitive uniqueness among ACTIVE custom templates only. System rows
-- have `name IS NULL` so they never participate; a soft-deleted custom row's
-- name is excluded so admins can reuse it for a new template.
CREATE UNIQUE INDEX "email_templates_name_active_key"
  ON "email_templates" (lower("name"))
  WHERE "name" IS NOT NULL AND "deleted_at" IS NULL;
