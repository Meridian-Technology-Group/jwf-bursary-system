-- fix: allow the GDPR erasure cascade to anonymise audit_logs (Art. 17)
--
-- Root cause: gdprDeleteApplicantAction runs the erasure cascade inside
-- withAdminContext, which sets request.jwt.claims.role = 'service_role' so
-- RLS *policies* treat the txn as admin. But the underlying Postgres
-- connection role stays `app_user`, and table-level GRANTs are independent
-- of RLS. `app_user` was granted only INSERT, SELECT on audit_logs (UPDATE
-- and DELETE explicitly revoked in 20260513090020), so step (h) of the
-- cascade —
--   UPDATE audit_logs SET user_id = NULL WHERE user_id = <leadApplicant>
-- — throws "permission denied for table audit_logs" and rolls the entire
-- erasure transaction back. GDPR right-to-erasure was therefore completely
-- non-functional.
--
-- Fix (two parts, both required because GRANTs and RLS are independent):
--   1. GRANT UPDATE on audit_logs to app_user (table-level permission).
--   2. Add an UPDATE RLS policy. audit_logs has FORCE ROW LEVEL SECURITY and
--      currently has only SELECT + INSERT policies, so without an UPDATE
--      policy every UPDATE is denied by RLS regardless of the grant.
--
-- The policy is scoped to current_user_role() = 'service_role' — strictly
-- tighter than is_admin() (which would also let a logged-in ADMIN session,
-- running as app_user under withUserContext, tamper with audit history). The
-- GDPR cascade is the only path that runs as service_role, so this enables
-- the Art. 17 user-reference nulling and nothing broader. DELETE on
-- audit_logs remains revoked — history rows are anonymised, never removed.
--
-- Idempotent: DROP POLICY IF EXISTS before CREATE; GRANT is idempotent.

GRANT UPDATE ON public.audit_logs TO app_user;

DROP POLICY IF EXISTS audit_logs_update ON public.audit_logs;
CREATE POLICY audit_logs_update ON public.audit_logs
  FOR UPDATE TO app_user
  USING (public.current_user_role() = 'service_role')
  WITH CHECK (public.current_user_role() = 'service_role');
