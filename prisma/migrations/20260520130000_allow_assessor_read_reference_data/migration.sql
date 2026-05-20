-- fix: widen SELECT policies on reference tables to include ASSESSOR role
--
-- Root cause: the four reference/config tables (family_type_configs,
-- school_fees, council_tax_defaults, reason_codes) have SELECT policies
-- gated by is_admin_or_viewer(), which evaluates to true only for ADMIN,
-- VIEWER, and service_role. ASSESSOR is excluded.
--
-- Impact: when an assessor reads these tables under withUserContext
-- (app_user role with ASSESSOR claims), they receive zero rows. This
-- empties the Family Type Category picker (assessor guide step 09,
-- assessment workspace) and the Reason Code picker (assessor guide step 20,
-- recommendation) in the UI.
--
-- Fix: widen each SELECT policy USING clause to also allow ASSESSOR.
-- The established idiom in this codebase (see profiles_select,
-- applications_select, audit_logs_select) is:
--   public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR'
-- No new helper function is introduced — is_admin_or_viewer() already
-- covers ADMIN + VIEWER + service_role; we simply OR in the ASSESSOR check.
--
-- Write policies (is_admin()) are NOT changed.
-- Each statement is idempotent (DROP POLICY IF EXISTS before CREATE).
--
-- Pre-applied to supabase-nonprod; prisma migrate deploy will skip it there.

-- ─── family_type_configs ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS family_type_configs_select ON public.family_type_configs;
CREATE POLICY family_type_configs_select ON public.family_type_configs
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');


-- ─── school_fees ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS school_fees_select ON public.school_fees;
CREATE POLICY school_fees_select ON public.school_fees
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');


-- ─── council_tax_defaults ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS council_tax_defaults_select ON public.council_tax_defaults;
CREATE POLICY council_tax_defaults_select ON public.council_tax_defaults
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');


-- ─── reason_codes ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS reason_codes_select ON public.reason_codes;
CREATE POLICY reason_codes_select ON public.reason_codes
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');
