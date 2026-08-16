-- Epic 14 D1 (CG-01) — per-round scenario windows.
--
-- New table round_windows keyed (round_id, scenario): opening date,
-- submission date and default tax year for each of Charlotte's four
-- operating scenarios. RLS policies ship IN THIS MIGRATION (the ensure_rls
-- event trigger force-enables RLS on every new table; a policy-less table
-- reads empty app-wide). Pattern: 20260710205004. Idempotent (guarded
-- CREATEs) because the objects are pre-applied to nonprod for the D1
-- browser pass; migrate deploy then records the migration cleanly.

DO $$ BEGIN
  CREATE TYPE "RoundScenario" AS ENUM ('NA_CURRENT', 'NA_NEXT_WINTER', 'NA_NEXT_SPRING', 'RA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "public"."round_windows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "round_id" UUID NOT NULL,
  "scenario" "RoundScenario" NOT NULL,
  "opens_on" DATE,
  "submit_by" DATE,
  "default_tax_year" TEXT,
  CONSTRAINT "round_windows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "round_windows_round_id_fkey" FOREIGN KEY ("round_id")
    REFERENCES "public"."rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "round_windows_round_id_scenario_key"
  ON "public"."round_windows"("round_id", "scenario");

-- ── RLS (same PR as the table — ensure_rls will have enabled it already) ────
ALTER TABLE public.round_windows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS round_windows_select ON public.round_windows;
CREATE POLICY round_windows_select ON public.round_windows
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS round_windows_modify ON public.round_windows;
CREATE POLICY round_windows_modify ON public.round_windows
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
