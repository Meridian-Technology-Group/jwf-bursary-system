-- Epic 01 (Status & workflow model) — PR-1, part 2 of 2: COLUMNS.
--
-- Adds the new lifecycle columns that reference the enum types created/extended
-- in 20260605172800_status_model_enums (committed before this migration runs).
--
-- Purely ADDITIVE and non-blocking:
--   * applications.form_status       — defaulted (CREATED), NOT NULL.
--   * applications.application_type   — defaulted (NEW), NOT NULL.
--   * applications.archived_at        — nullable.
--   * assessments.paused_until        — nullable (persisted pause deadline).
--
-- The deprecated applications.status column is intentionally KEPT (it is still
-- the only status read by current runtime code); it is backfilled in PR-2 and
-- dropped in PR-6 once every reader is migrated. No backfill of the new columns
-- happens here — defaults seed sane values; PR-2 performs the deterministic
-- backfill from the legacy fused status.

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "application_type" "ApplicationType" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "archived_at" TIMESTAMPTZ(6),
ADD COLUMN     "form_status" "ApplicationFormStatus" NOT NULL DEFAULT 'CREATED';

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "paused_until" TIMESTAMPTZ(6);
