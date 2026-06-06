-- Epic 10 (PR-2) — forward-schedule entity for rolling bursary accounts.
--
-- Additive only:
--   * two BRAND-NEW enums (CREATE TYPE — safe in one migration; the PG
--     ADD-VALUE-in-txn rule only bars adding values to an EXISTING enum)
--   * a nullable column on bursary_accounts (schedule_years, no default)
--   * a new bursary_schedule_entries table (all FKs/indexes self-contained)
-- No backfill required; existing accounts simply have no schedule entries until
-- a (re-)award generates them. Cannot break existing rows.

-- New enums
CREATE TYPE "ScheduleEntryType" AS ENUM ('ANNUAL');
CREATE TYPE "ScheduleEntryStatus" AS ENUM ('SCHEDULED', 'RECEIVED', 'COMPLETE');

-- Account horizon (D19). Nullable for legacy accounts.
ALTER TABLE "bursary_accounts" ADD COLUMN "schedule_years" INTEGER;

-- Schedule grid (illustration's Year 1..N rows)
CREATE TABLE "bursary_schedule_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bursary_account_id" UUID NOT NULL,
    "schedule_year" INTEGER NOT NULL,
    "academic_year" TEXT NOT NULL,
    "type" "ScheduleEntryType" NOT NULL DEFAULT 'ANNUAL',
    "status" "ScheduleEntryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "manually_created" BOOLEAN NOT NULL DEFAULT false,
    "available_on" DATE,
    "required_by" DATE,
    "received_on" DATE,
    "show_on_portal" BOOLEAN NOT NULL DEFAULT false,
    "round_id" UUID,
    "application_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "bursary_schedule_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bursary_schedule_entries_bursary_account_id_schedule_year_key"
    ON "bursary_schedule_entries" ("bursary_account_id", "schedule_year");
CREATE INDEX "bursary_schedule_entries_bursary_account_id_idx"
    ON "bursary_schedule_entries" ("bursary_account_id");
CREATE INDEX "bursary_schedule_entries_round_id_idx"
    ON "bursary_schedule_entries" ("round_id");

ALTER TABLE "bursary_schedule_entries"
    ADD CONSTRAINT "bursary_schedule_entries_bursary_account_id_fkey"
    FOREIGN KEY ("bursary_account_id") REFERENCES "bursary_accounts" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Row Level Security — mirrors public.sibling_links.
--   READ : staff always; an applicant if the parent account is theirs (so the
--          portal can read showOnPortal rows for their own child — Epic 05).
--   WRITE: ADMIN / service_role only. The generation/close server paths run
--          under withAdminContext (service_role bypasses RLS), so these
--          policies are defence-in-depth, not the primary gate.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bursary_schedule_entries TO app_user;

ALTER TABLE public.bursary_schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY bursary_schedule_entries_select ON public.bursary_schedule_entries
  FOR SELECT TO app_user
  USING (
    public.is_admin_or_viewer()
    OR public.current_user_role() = 'ASSESSOR'
    OR EXISTS (
      SELECT 1 FROM public.bursary_accounts ba
      WHERE ba.id = bursary_account_id
        AND ba.lead_applicant_id = public.current_user_id()
    )
  );

CREATE POLICY bursary_schedule_entries_write ON public.bursary_schedule_entries
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
