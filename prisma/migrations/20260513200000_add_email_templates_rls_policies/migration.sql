-- email_templates was created with RLS enabled but no policies, which
-- denied every read — including sendEmail's template lookup under
-- withAdminContext, because the pooler's `authenticator` role does
-- not have BYPASSRLS. Set the JWT claim alone is not enough; a policy
-- has to exist.
--
-- Reference data: admins and viewers can read; only admins (and
-- service_role) can modify. Mirrors the pattern used elsewhere
-- (invitations, audit_logs).

CREATE POLICY "email_templates_select"
  ON public.email_templates
  FOR SELECT
  USING (public.is_admin_or_viewer());

CREATE POLICY "email_templates_modify"
  ON public.email_templates
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
