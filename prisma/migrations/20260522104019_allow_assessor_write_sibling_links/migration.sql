-- fix: widen WRITE policy on sibling_links to include ASSESSOR role
--
-- Root cause: sibling_links_write is gated by is_admin() only, which is
-- false for an ASSESSOR claim. But the Sibling Linker card is rendered
-- specifically for assessors (applications/[id]/page.tsx -> SiblingLinkerCard
-- isAssessor), and the sibling API routes accept ASSESSOR
-- (POST /api/siblings, PATCH/DELETE /api/siblings/[id]).
--
-- Impact, all three confirmed empirically:
--   - link  (INSERT) — denied with 42501, raw Prisma error surfaced in UI.
--   - reorder (UPDATE) — RLS makes the rows invisible, updateMany affects 0
--     rows and SUCCEEDS, so the change silently no-ops (reverts on reload).
--   - break  (DELETE) — same: delete affects 0 rows, no error, link stays.
--
-- Fix: widen the write policy USING/WITH CHECK to also allow ASSESSOR,
-- mirroring the reference-table widening pattern
-- (20260520130000_allow_assessor_read_reference_data) and invitations_staff.
-- VIEWER stays read-only (excluded from the write policy).
--
-- Idempotent: DROP POLICY IF EXISTS before CREATE.

DROP POLICY IF EXISTS sibling_links_write ON public.sibling_links;
CREATE POLICY sibling_links_write ON public.sibling_links
  FOR ALL TO app_user
  USING (public.is_admin() OR public.current_user_role() = 'ASSESSOR')
  WITH CHECK (public.is_admin() OR public.current_user_role() = 'ASSESSOR');
