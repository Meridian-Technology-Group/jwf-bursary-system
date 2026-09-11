-- RLS policies for debt_shortfall_bands, which shipped without them in
-- 20260912090000 and broke every v2 assessment on the environment.
--
-- This repo has an `ensure_rls` event trigger that force-enables row level
-- security on every new public table. A new table therefore arrives with RLS
-- ON and NO policies, which does not error: it silently returns zero rows to
-- app_user. The reference bundle then reports "Missing: Debt shortfall bands"
-- and refuses to calculate, so the whole assessment surface goes down.
--
-- Policies mirror debt_ratio_bands exactly, since this is the same class of
-- reference data with the same audience:
--   SELECT  admin, viewer or assessor
--   ALL     admin only
--
-- The lesson is in CLAUDE.md and was not applied: policies must ship in the
-- SAME migration as the table.

CREATE POLICY "debt_shortfall_bands_select" ON "debt_shortfall_bands"
  FOR SELECT TO app_user
  USING (is_admin_or_viewer() OR current_user_role() = 'ASSESSOR');

CREATE POLICY "debt_shortfall_bands_modify" ON "debt_shortfall_bands"
  FOR ALL TO app_user
  USING (is_admin())
  WITH CHECK (is_admin());
