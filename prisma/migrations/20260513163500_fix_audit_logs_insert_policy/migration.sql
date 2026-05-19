-- Fix: allow service_role / admin to insert audit_logs even when the JWT
-- claim has no `sub` (current_user_id() returns NULL).
--
-- The original policy required `current_user_id() IS NOT NULL` as a top-level
-- conjunct, which rejected every insert from withAdminContext (where the JWT
-- claim only carries `role = 'service_role'`). is_admin() is true for both
-- ADMIN users and service_role; we now allow either path:
--   - is_admin() callers: always allowed
--   - everyone else: must have a JWT sub AND user_id must be NULL or theirs.

DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT
  TO app_user
  WITH CHECK (
    public.is_admin()
    OR (
      public.current_user_id() IS NOT NULL
      AND (
        user_id IS NULL
        OR user_id = public.current_user_id()
      )
    )
  );
