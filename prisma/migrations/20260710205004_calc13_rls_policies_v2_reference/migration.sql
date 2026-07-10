-- CALC-13 — CALC v2 reference & gap-reason tables silently world-empty
--
-- The ten tables added by 20260710164653_calc01_reference_tables and
-- 20260710170021_calc02_assessment_capture (nine reference/config tables
-- plus the recommendation_gap_reasons junction) were created with RLS
-- enabled but zero policies attached. Under Postgres semantics this is
-- default-deny: app_user (the runtime Prisma role used by
-- withUserContext) can neither read nor write a single row. Every
-- assessor/admin surface that reads these tables under a *user* context
-- (not withAdminContext/service_role) sees an empty result set with no
-- error — the CALC v2 rule engine, band pickers, and gap-reason pickers
-- render as if the reference data does not exist.
--
-- Root cause of "RLS enabled" with no migration ever issuing
-- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for these tables: the
-- Supabase project carries a platform-level event trigger
-- (`ensure_rls` on `ddl_command_end`, calling `public.rls_auto_enable()`)
-- that force-enables RLS on every newly created table in `public`. This
-- trigger is NOT part of our Prisma migration history (it predates/sits
-- outside it) and is invisible to `prisma migrate diff`/`prisma validate`.
-- Confirmed live on supabase-nonprod via `pg_event_trigger` and the
-- `rls_enabled_no_policy` security advisor, which flagged exactly these
-- ten tables. IMPORTANT for whoever adds the next table: RLS will be
-- turned on for you automatically the moment the table is created —
-- explicit policies are mandatory in the SAME PR, or the table is
-- silently unreadable under withUserContext.
--
-- Policy shape:
--   - Nine reference/config tables (notional_cost_configs,
--     family_category_metas, affordability_bands, income_category_bands,
--     property_equity_bands, financial_equity_bands, debt_ratio_bands,
--     lifestyle_squeeze_bands, gap_reasons) mirror the existing
--     family_type_configs / school_fees / council_tax_defaults /
--     reason_codes pattern (20260519163000, widened for ASSESSOR by
--     20260520130000): SELECT gated by
--     `is_admin_or_viewer() OR current_user_role() = 'ASSESSOR'`
--     (these are read by both the admin settings surfaces and the
--     assessor-facing assessment workspace / recommendation screens);
--     writes (INSERT/UPDATE/DELETE via FOR ALL) gated by `is_admin()`.
--   - recommendation_gap_reasons is a per-recommendation junction table,
--     not reference data, so it mirrors recommendation_reason_codes_all
--     from 20260513090020_enable_row_level_security exactly (visibility
--     tracks the parent recommendation's assigned assessor).
--   - Each policy is wrapped in a DROP POLICY IF EXISTS guard so
--     re-applying after a hand-fix on nonprod is a no-op.
--
-- Not pre-applied anywhere: CI's `prisma migrate deploy`
-- (.github/workflows/db-push.yml) will apply it to supabase-nonprod on
-- merge to `staging`, and to supabase-prod on merge to `main`.


-- ─── notional_cost_configs ──────────────────────────────────────────────────────

ALTER TABLE public.notional_cost_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notional_cost_configs_select ON public.notional_cost_configs;
CREATE POLICY notional_cost_configs_select ON public.notional_cost_configs
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS notional_cost_configs_modify ON public.notional_cost_configs;
CREATE POLICY notional_cost_configs_modify ON public.notional_cost_configs
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── family_category_metas ──────────────────────────────────────────────────────

ALTER TABLE public.family_category_metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_category_metas_select ON public.family_category_metas;
CREATE POLICY family_category_metas_select ON public.family_category_metas
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS family_category_metas_modify ON public.family_category_metas;
CREATE POLICY family_category_metas_modify ON public.family_category_metas
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── affordability_bands ─────────────────────────────────────────────────────────

ALTER TABLE public.affordability_bands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS affordability_bands_select ON public.affordability_bands;
CREATE POLICY affordability_bands_select ON public.affordability_bands
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS affordability_bands_modify ON public.affordability_bands;
CREATE POLICY affordability_bands_modify ON public.affordability_bands
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── income_category_bands ───────────────────────────────────────────────────────

ALTER TABLE public.income_category_bands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS income_category_bands_select ON public.income_category_bands;
CREATE POLICY income_category_bands_select ON public.income_category_bands
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS income_category_bands_modify ON public.income_category_bands;
CREATE POLICY income_category_bands_modify ON public.income_category_bands
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── property_equity_bands ───────────────────────────────────────────────────────

ALTER TABLE public.property_equity_bands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_equity_bands_select ON public.property_equity_bands;
CREATE POLICY property_equity_bands_select ON public.property_equity_bands
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS property_equity_bands_modify ON public.property_equity_bands;
CREATE POLICY property_equity_bands_modify ON public.property_equity_bands
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── financial_equity_bands ──────────────────────────────────────────────────────

ALTER TABLE public.financial_equity_bands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_equity_bands_select ON public.financial_equity_bands;
CREATE POLICY financial_equity_bands_select ON public.financial_equity_bands
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS financial_equity_bands_modify ON public.financial_equity_bands;
CREATE POLICY financial_equity_bands_modify ON public.financial_equity_bands
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── debt_ratio_bands ────────────────────────────────────────────────────────────

ALTER TABLE public.debt_ratio_bands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS debt_ratio_bands_select ON public.debt_ratio_bands;
CREATE POLICY debt_ratio_bands_select ON public.debt_ratio_bands
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS debt_ratio_bands_modify ON public.debt_ratio_bands;
CREATE POLICY debt_ratio_bands_modify ON public.debt_ratio_bands
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── lifestyle_squeeze_bands ─────────────────────────────────────────────────────

ALTER TABLE public.lifestyle_squeeze_bands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lifestyle_squeeze_bands_select ON public.lifestyle_squeeze_bands;
CREATE POLICY lifestyle_squeeze_bands_select ON public.lifestyle_squeeze_bands
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS lifestyle_squeeze_bands_modify ON public.lifestyle_squeeze_bands;
CREATE POLICY lifestyle_squeeze_bands_modify ON public.lifestyle_squeeze_bands
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── gap_reasons ─────────────────────────────────────────────────────────────────

ALTER TABLE public.gap_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gap_reasons_select ON public.gap_reasons;
CREATE POLICY gap_reasons_select ON public.gap_reasons
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS gap_reasons_modify ON public.gap_reasons;
CREATE POLICY gap_reasons_modify ON public.gap_reasons
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── recommendation_gap_reasons ──────────────────────────────────────────────────
-- Junction table, not reference data — mirrors recommendation_reason_codes_all
-- (20260513090020_enable_row_level_security) verbatim, swapping the FK.
-- Visibility tracks the parent recommendation's assessment/assigned assessor.

ALTER TABLE public.recommendation_gap_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recommendation_gap_reasons_all ON public.recommendation_gap_reasons;
CREATE POLICY recommendation_gap_reasons_all ON public.recommendation_gap_reasons
  FOR ALL TO app_user
  USING (
    public.is_admin_or_viewer()
    OR EXISTS (
      SELECT 1 FROM public.recommendations r
      JOIN public.assessments a ON a.id = r.assessment_id
      WHERE r.id = recommendation_id
        AND public.is_assigned_assessor(a.application_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.recommendations r
      JOIN public.assessments a ON a.id = r.assessment_id
      WHERE r.id = recommendation_id
        AND public.is_assigned_assessor(a.application_id)
    )
  );
