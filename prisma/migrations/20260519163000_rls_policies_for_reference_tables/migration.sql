-- B9 — Six reference/config tables silently world-writable
--
-- Five of the six tables called out by the audit (rounds,
-- family_type_configs, school_fees, council_tax_defaults, reason_codes)
-- have row-level security enabled but no policies attached, which under
-- Postgres semantics is default-deny: app_user can neither read nor write.
-- This worked accidentally because every production read of these tables
-- happens under service_role via withAdminContext, which bypasses RLS.
-- The exception is `rounds`, which the applicant portal dashboard reads
-- under withUserContext (app_user role) — that read currently returns
-- zero rows but the dashboard code masks it by falling back to nulls.
--
-- email_templates was already correctly policied in
-- 20260513200000_add_email_templates_rls_policies, so it is not touched
-- by this migration.
--
-- Policy shape (mirrors audit_logs / invitations / email_templates):
--   - All policies are scoped TO app_user (the runtime Prisma role).
--     service_role bypasses RLS entirely, so admin-context queries
--     (settings page mutations, assessment engine reference reads,
--     registration flow's round lookup) are unaffected by this migration.
--   - rounds.SELECT is open to any authenticated app_user because the
--     applicant portal dashboard renders the current round's academic
--     year. Writes (open / close / create) are admin-only — already
--     enforced at the action layer; this is defence in depth at the
--     row level.
--   - The remaining four (family_type_configs, school_fees,
--     council_tax_defaults, reason_codes) are read only from admin/
--     assessor/viewer surfaces (the assessment engine and the admin
--     settings page). Mirroring the email_templates pattern, SELECT
--     is gated by is_admin_or_viewer(); writes by is_admin().
--   - Each policy is wrapped in a DROP POLICY IF EXISTS guard so
--     re-applying the migration after a hand-fix is a no-op (we hit
--     the 42710 trap once already on B3).

-- ─── rounds ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS rounds_select ON public.rounds;
CREATE POLICY rounds_select ON public.rounds
  FOR SELECT TO app_user
  USING (true);

DROP POLICY IF EXISTS rounds_modify ON public.rounds;
CREATE POLICY rounds_modify ON public.rounds
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── family_type_configs ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS family_type_configs_select ON public.family_type_configs;
CREATE POLICY family_type_configs_select ON public.family_type_configs
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer());

DROP POLICY IF EXISTS family_type_configs_modify ON public.family_type_configs;
CREATE POLICY family_type_configs_modify ON public.family_type_configs
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── school_fees ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS school_fees_select ON public.school_fees;
CREATE POLICY school_fees_select ON public.school_fees
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer());

DROP POLICY IF EXISTS school_fees_modify ON public.school_fees;
CREATE POLICY school_fees_modify ON public.school_fees
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── council_tax_defaults ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS council_tax_defaults_select ON public.council_tax_defaults;
CREATE POLICY council_tax_defaults_select ON public.council_tax_defaults
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer());

DROP POLICY IF EXISTS council_tax_defaults_modify ON public.council_tax_defaults;
CREATE POLICY council_tax_defaults_modify ON public.council_tax_defaults
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── reason_codes ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS reason_codes_select ON public.reason_codes;
CREATE POLICY reason_codes_select ON public.reason_codes
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer());

DROP POLICY IF EXISTS reason_codes_modify ON public.reason_codes;
CREATE POLICY reason_codes_modify ON public.reason_codes
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
