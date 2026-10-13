-- Epic 21 #6 (CR-002 Phase 4) — the account's standing synopsis.
--
-- One timeline per bursary account across every year: a YEAR entry per
-- locked assessment (from that year's synopsis) plus free-text staff NOTEs.
-- A child table rather than a column on bursary_accounts, so writes never move
-- the account's updated_at (the GT migration toolkit's rollback guard keys on
-- it). Additive: a new enum and a new empty table.

-- CreateEnum
CREATE TYPE "AccountSynopsisKind" AS ENUM ('YEAR', 'NOTE');

-- CreateTable
CREATE TABLE "account_synopsis_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bursary_account_id" UUID NOT NULL,
    "kind" "AccountSynopsisKind" NOT NULL,
    "assessment_id" UUID,
    "academic_year" TEXT,
    "body" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_synopsis_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_synopsis_entries_assessment_id_key" ON "account_synopsis_entries"("assessment_id");

-- CreateIndex
CREATE INDEX "account_synopsis_entries_bursary_account_id_created_at_idx" ON "account_synopsis_entries"("bursary_account_id", "created_at");

-- AddForeignKey
ALTER TABLE "account_synopsis_entries" ADD CONSTRAINT "account_synopsis_entries_bursary_account_id_fkey" FOREIGN KEY ("bursary_account_id") REFERENCES "bursary_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_synopsis_entries" ADD CONSTRAINT "account_synopsis_entries_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Row Level Security. The ensure_rls trigger force-enables RLS on every new
-- public table, so the policies ship here (a table without them reads empty).
--   READ : staff only (ADMIN, VIEWER, ASSESSOR). Families never see it.
--   WRITE: ADMIN and ASSESSOR insert/update (assessors already write
--          bursary_accounts, 20260522103852). Editing a NOTE is ADMIN-only,
--          enforced in the action. No DELETE for app_user: entries are never
--          deleted (D-6); an account deletion cascades as the table owner.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON public.account_synopsis_entries TO app_user;

ALTER TABLE public.account_synopsis_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_synopsis_entries_select ON public.account_synopsis_entries
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

CREATE POLICY account_synopsis_entries_insert ON public.account_synopsis_entries
  FOR INSERT TO app_user
  WITH CHECK (public.is_admin() OR public.current_user_role() = 'ASSESSOR');

CREATE POLICY account_synopsis_entries_update ON public.account_synopsis_entries
  FOR UPDATE TO app_user
  USING (public.is_admin() OR public.current_user_role() = 'ASSESSOR')
  WITH CHECK (public.is_admin() OR public.current_user_role() = 'ASSESSOR');
