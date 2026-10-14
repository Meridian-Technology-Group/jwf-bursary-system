-- Epic 22 P3 (CR-002 Phase 5 #5) — a record of each Reject and restart.
--
-- Reject and restart HARD-DELETES the rejected application (the unique
-- round/lead/child tuple can't hold two) and creates a blank one in its place,
-- so nothing remained to show the family "Submitted → Rejected → the new
-- attempt" on their schedule. This table keeps one short row per rejection:
-- the year, the child, the reference, the submitted and rejected dates, and the
-- replacement application. Nothing from the form, and not the assessor's note
-- (that stays in the audit log and the email).
--
-- Additive: a new empty table. Prod has never used Reject and restart, so no
-- backfill. Nothing here touches bursary_accounts.

-- CreateTable
CREATE TABLE "application_rejections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "round_id" UUID NOT NULL,
    "academic_year" TEXT NOT NULL,
    "lead_applicant_id" UUID NOT NULL,
    "bursary_account_id" UUID,
    "child_name" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "submitted_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejected_by" UUID,
    "replacement_application_id" UUID,
    "from_phase" TEXT NOT NULL,

    CONSTRAINT "application_rejections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_rejections_bursary_account_id_academic_year_idx" ON "application_rejections"("bursary_account_id", "academic_year");

-- CreateIndex
CREATE INDEX "application_rejections_lead_applicant_id_idx" ON "application_rejections"("lead_applicant_id");

-- AddForeignKey
ALTER TABLE "application_rejections" ADD CONSTRAINT "application_rejections_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_rejections" ADD CONSTRAINT "application_rejections_lead_applicant_id_fkey" FOREIGN KEY ("lead_applicant_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_rejections" ADD CONSTRAINT "application_rejections_bursary_account_id_fkey" FOREIGN KEY ("bursary_account_id") REFERENCES "bursary_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_rejections" ADD CONSTRAINT "application_rejections_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Row Level Security. The ensure_rls trigger force-enables RLS on every new
-- public table, so the policies ship here (a table without them reads empty).
--   READ : the lead applicant reads their own rows (for their schedule);
--          staff (ADMIN, VIEWER, ASSESSOR) read all.
--   WRITE: insert under the service-role context only (Reject and restart runs
--          in withAdminContext). No UPDATE or DELETE for app_user: rows go only
--          by cascade (GDPR erasure of the profile or account, a round delete).
-- =============================================================================

GRANT SELECT, INSERT ON public.application_rejections TO app_user;

ALTER TABLE public.application_rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY application_rejections_select ON public.application_rejections
  FOR SELECT TO app_user
  USING (
    public.is_admin_or_viewer()
    OR public.current_user_role() = 'ASSESSOR'
    OR lead_applicant_id = public.current_user_id()
  );

CREATE POLICY application_rejections_insert ON public.application_rejections
  FOR INSERT TO app_user
  WITH CHECK (public.is_service_role());
