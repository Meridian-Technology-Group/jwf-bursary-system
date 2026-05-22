-- fix: widen WRITE policy on bursary_accounts to include ASSESSOR role
--
-- Context: the recommendation "Set Application Outcome" flow now promotes a
-- QUALIFIES application into an ongoing BursaryAccount in the same RLS
-- transaction as the outcome write (see fix/bursary-account-on-qualify).
-- That action is reachable by both ADMIN and ASSESSOR (requireRole in
-- recommendation/page.tsx + actions.ts).
--
-- Root cause: bursary_accounts_write is gated by is_admin() only, which is
-- false for an ASSESSOR claim. An assessor confirming QUALIFIES would have
-- the bursaryAccount.create INSERT denied by RLS, rolling back the entire
-- outcome transaction (status set + audit + account). Verified empirically
-- on supabase-nonprod: under an ASSESSOR JWT claim, is_admin() = false.
--
-- Fix: widen the write policy USING/WITH CHECK to also allow ASSESSOR,
-- mirroring the reference-table widening pattern
-- (20260520130000_allow_assessor_read_reference_data) and the
-- sibling_links assessor fix. VIEWER stays read-only (excluded from write).
--
-- Idempotent: DROP POLICY IF EXISTS before CREATE.

DROP POLICY IF EXISTS bursary_accounts_write ON public.bursary_accounts;
CREATE POLICY bursary_accounts_write ON public.bursary_accounts
  FOR ALL TO app_user
  USING (public.is_admin() OR public.current_user_role() = 'ASSESSOR')
  WITH CHECK (public.is_admin() OR public.current_user_role() = 'ASSESSOR');
