-- =============================================================================
-- JWF Bursary System — Fix dual-parent storage RLS path parsing
-- =============================================================================
-- Backlog #20, PR 2 of 6 (follow-up within the same PR; the previous migration
-- 20260524211100_dual_parent_contributor_rls was already applied to the shared
-- nonprod/staging DB, so per the migration discipline it is left untouched and
-- this corrects it forward).
--
-- A security audit found the storage policies in
-- 20260524211000_dual_parent_contributor_rls (and, pre-existing, in
-- 20260513090020_enable_row_level_security) parsed the WRONG path segments.
-- The application stores objects as `documents/{applicationId}/{slot}/{file}`
-- (see src/lib/storage/documents.ts — the bucket name is part of the object
-- `name`). So:
--     split_part(name,'/',1) = 'documents'   (the bucket literal, NOT the appId)
--     split_part(name,'/',2) = applicationId
--     split_part(name,'/',3) = slot, or 'secondary' for the secondary sub-path
-- The previous policies compared a UUID to the literal 'documents' and to
-- 'secondary' at the wrong index, so every per-application branch was dead.
--
-- Two corrections:
--   1. Shift every split_part index by +1 to account for the `documents/`
--      prefix, so the application-scoped branches actually engage.
--   2. Drop the `owner = auth.uid()` precision from the secondary branches.
--      App uploads go through the service-role admin client
--      (createSupabaseAdminClient), which does NOT populate storage.objects.owner
--      with the end user's uid — so `owner = auth.uid()` would never match an
--      app-uploaded file. Isolation for the secondary sub-path therefore rests
--      on (a) the `secondary/` namespace + (b) the contributor check, which is
--      sufficient because only the secondary may INSERT under that namespace.
--
-- IMPORTANT — storage RLS is a DEFENCE-IN-DEPTH BACKSTOP, not the enforcing
-- layer. All reads/writes/deletes in the app go through the service-role client,
-- which bypasses Storage RLS entirely; real authorization is enforced in the
-- document route handlers. PR 4 (secondary portal) MUST add contributor-ownership
-- checks to those handlers (e.g. src/app/api/documents/[id]/url) so the primary
-- cannot obtain a signed URL for a secondary file by guessing its path. These
-- policies exist so that IF a user-context client ever hits Storage, access is
-- denied-by-default and correctly scoped.
-- =============================================================================


-- ─── documents bucket — SELECT ───────────────────────────────────────────────
DROP POLICY IF EXISTS "documents bucket — select" ON storage.objects;

CREATE POLICY "documents bucket — select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMIN', 'VIEWER')
      -- assigned assessor: full visibility (primary + secondary sub-path)
      OR EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id::text = split_part(name, '/', 2)
          AND a.assigned_to_id = auth.uid()
      )
      -- lead applicant: their application EXCEPT the secondary sub-path
      OR (
        split_part(name, '/', 3) <> 'secondary'
        AND EXISTS (
          SELECT 1 FROM public.applications a
          WHERE a.id::text = split_part(name, '/', 2)
            AND a.lead_applicant_id = auth.uid()
        )
      )
      -- secondary contributor: ONLY the secondary sub-path of an application
      -- on which they are the SECONDARY contributor
      OR (
        split_part(name, '/', 3) = 'secondary'
        AND EXISTS (
          SELECT 1 FROM public.application_contributors c
          WHERE c.application_id::text = split_part(name, '/', 2)
            AND c.profile_id = auth.uid()
            AND c.role = 'SECONDARY'
        )
      )
    )
  );


-- ─── documents bucket — INSERT ───────────────────────────────────────────────
DROP POLICY IF EXISTS "documents bucket — insert" ON storage.objects;

CREATE POLICY "documents bucket — insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
      -- lead applicant or assigned assessor: NOT the secondary sub-path
      OR (
        split_part(name, '/', 3) <> 'secondary'
        AND EXISTS (
          SELECT 1 FROM public.applications a
          WHERE a.id::text = split_part(name, '/', 2)
            AND (a.lead_applicant_id = auth.uid() OR a.assigned_to_id = auth.uid())
        )
      )
      -- secondary contributor: ONLY under their own secondary/ sub-path
      OR (
        split_part(name, '/', 3) = 'secondary'
        AND EXISTS (
          SELECT 1 FROM public.application_contributors c
          WHERE c.application_id::text = split_part(name, '/', 2)
            AND c.profile_id = auth.uid()
            AND c.role = 'SECONDARY'
        )
      )
    )
  );


-- ─── documents bucket — DELETE ───────────────────────────────────────────────
DROP POLICY IF EXISTS "documents bucket — delete" ON storage.objects;

CREATE POLICY "documents bucket — delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
      -- lead applicant: their own application's non-secondary objects
      OR (
        split_part(name, '/', 3) <> 'secondary'
        AND EXISTS (
          SELECT 1 FROM public.applications a
          WHERE a.id::text = split_part(name, '/', 2)
            AND a.lead_applicant_id = auth.uid()
        )
      )
      -- secondary contributor: their own secondary/ objects
      OR (
        split_part(name, '/', 3) = 'secondary'
        AND EXISTS (
          SELECT 1 FROM public.application_contributors c
          WHERE c.application_id::text = split_part(name, '/', 2)
            AND c.profile_id = auth.uid()
            AND c.role = 'SECONDARY'
        )
      )
    )
  );
