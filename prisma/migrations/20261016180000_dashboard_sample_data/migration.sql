-- Epic 23 T9 — dashboard illustrative data (Charlotte, 6 Sep 2026: "a tab where
-- we could store some 'fictive data'"; D-18).
--
-- One row per illustrative dashboard panel (key → payload). Edited in Settings →
-- Dashboard sample data (ADMIN only). A panel shows its sample, badged
-- "Illustrative data", only while the panel's real count is zero.
--
-- RLS: the ensure_rls event trigger force-enables RLS on every new public table,
-- so the policies ship here (pattern: 20260710205004): staff read
-- (ADMIN / VIEWER / ASSESSOR — the dashboard is a staff page); ADMIN writes.
--
-- Seed: her Dashboard.xlsx figures (labels and numbers only, no personal data),
-- INSERT … ON CONFLICT DO NOTHING so a row she has edited is never overwritten.
-- Kept in sync with src/lib/dashboard/sample-data.ts (SAMPLE_DEFAULTS).
--
-- Prod blast radius: one new table, three rows.

-- CreateTable
CREATE TABLE "dashboard_sample_data" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "dashboard_sample_data_pkey" PRIMARY KEY ("key")
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_sample_data TO app_user;

ALTER TABLE public.dashboard_sample_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dashboard_sample_data_select ON public.dashboard_sample_data;
CREATE POLICY dashboard_sample_data_select ON public.dashboard_sample_data
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS dashboard_sample_data_modify ON public.dashboard_sample_data;
CREATE POLICY dashboard_sample_data_modify ON public.dashboard_sample_data
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.dashboard_sample_data (key, payload) VALUES
  ('closed_reasons_top5', $json${"rows":[{"label":"Assessment confirms above threshold, does not qualify for bursary support","share":0.65},{"label":"Qualifies for a bursary but not part of admissions’ final shortlist","share":0.2},{"label":"Recipient accepted offer from another school","share":0.07},{"label":"Applicant no longer interested in bursary support","share":0.05},{"label":"Applicant missed deadline(s) & gave up","share":0.01}]}$json$::jsonb),
  ('yoy_changes_top10', $json${"rows":[{"label":"9 - Self-employed net profit decrease","count":125},{"label":"10 - Bonus change year on year","count":89},{"label":"13 - New job and decreased pay","count":82},{"label":"11 - Increase in Benefits","count":79},{"label":"15 - Increased savings","count":56},{"label":"8 - Sudden unemployment","count":35},{"label":"17 - Early Pension drawing","count":12},{"label":"30 - Forged or tampered with documents","count":5},{"label":"4 - One of their children has left school since last year","count":4},{"label":"22 - Mortgage now fully paid","count":2}]}$json$::jsonb),
  ('rolling_committed_spend', $json${"exOp":288954,"ts":1871000,"ws":2227000}$json$::jsonb)
ON CONFLICT (key) DO NOTHING;
