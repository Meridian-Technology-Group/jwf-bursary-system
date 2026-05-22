-- =============================================================================
-- Fix: audit_logs RLS blocks applicant APPLICATION_SUBMITTED write
-- =============================================================================
--
-- Root cause (two-part):
--
-- 1. INSERT policy WITH CHECK (correct on its own):
--    is_admin() OR (current_user_id() IS NOT NULL AND (user_id IS NULL OR user_id = current_user_id()))
--    An APPLICANT with a valid JWT sub satisfies the second branch, so the
--    INSERT itself is permitted.
--
-- 2. SELECT policy (USING): is_admin_or_viewer()
--    Prisma's create() issues INSERT ... RETURNING *. PostgreSQL evaluates the
--    SELECT/USING policy on rows returned by RETURNING. An APPLICANT fails
--    is_admin_or_viewer(), so PostgreSQL filters the RETURNING result to zero
--    rows. Prisma v6 treats an empty RETURNING response from create() as a
--    record-not-found error and throws — which aborts the Postgres transaction.
--    Because the INSERT and the application.update() share one transaction,
--    the abort rolls back the status change too. The try/catch in createAuditLog
--    catches the JS error, but the backend transaction is already in ABORTED
--    state; when prisma.$transaction tries to COMMIT, Postgres rejects it and
--    Prisma rolls the whole thing back.
--
-- Fix:
--   a. Replace audit_logs_select with a policy that also allows an authenticated
--      user to SELECT their own audit rows. This lets RETURNING succeed and
--      removes the ABORTED-transaction domino.
--   b. Keep the INSERT policy unchanged — it is already correct.
--
-- The code-side fix (submitApplication) moves the audit write into a separate
-- withAdminContext call AFTER the status-update transaction commits, so that
-- even a future audit failure can never roll back a successful submission.
-- =============================================================================

-- Drop and recreate the SELECT policy to widen access to own rows.
-- is_admin_or_viewer() — unchanged: staff can read all audit rows.
-- user_id = current_user_id() — new branch: authenticated users can read
-- their own audit rows (needed for INSERT ... RETURNING to succeed).
-- The NULL branch (user_id IS NULL) is intentionally excluded from the
-- per-user SELECT — system/admin audit rows with no user_id are staff-only.

DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO app_user
  USING (
    public.is_admin_or_viewer()
    OR (
      public.current_user_id() IS NOT NULL
      AND user_id = public.current_user_id()
    )
  );

-- Re-assert the INSERT policy idempotently (no change to logic, guards against
-- any drift from the 20260513163500 migration that may not have applied via
-- Prisma's migration tracker).

DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO app_user
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
