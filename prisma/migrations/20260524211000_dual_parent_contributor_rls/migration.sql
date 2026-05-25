-- =============================================================================
-- JWF Bursary System — Dual-parent contributor RLS (privacy isolation)
-- =============================================================================
-- Backlog #20, PR 2 of 6. See docs/engineering/dual-parent-implementation-plan.md.
--
-- Establishes STRICT PRIVACY SEPARATION between the two parents of a child
-- (decision #2): the SECONDARY contributor sees only THEIR OWN parent-financial
-- sections + THEIR OWN uploaded documents + the child's name (for context),
-- and NOTHING of the PRIMARY's data. Reciprocally, the PRIMARY (lead applicant)
-- no longer sees the SECONDARY's owned sections or uploaded documents. The
-- assigned assessor, ADMIN and VIEWER continue to see BOTH parents' data.
--
-- This migration is INERT until a SECONDARY contributor exists (created by the
-- staff "add second parent" action in PR 3) and the write path tags section
-- ownership (PR 4). With no SECONDARY present, `app_secondary_contributor_id()`
-- returns NULL and every policy below collapses to the pre-existing behaviour:
--   * lead applicant sees their whole application (no exclusion),
--   * staff/assessor see everything,
--   * the new secondary branches match nothing.
-- It is therefore a safe, forward-only change that adds the isolation machinery
-- ahead of the features that rely on it.
--
-- Builds on 20260524210000_add_application_contributor (contributor table +
-- application_sections.owner_contributor_id) and reuses the helper functions
-- and policy style from 20260513090020_enable_row_level_security.
-- =============================================================================


-- ─── 1. Helper functions ─────────────────────────────────────────────────────
-- SECURITY DEFINER + STABLE, mirroring has_application_access / is_application_owner.

-- The SECONDARY contributor's id for an application, or NULL if none exists.
CREATE OR REPLACE FUNCTION public.app_secondary_contributor_id(app_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.application_contributors c
  WHERE c.application_id = app_id
    AND c.role = 'SECONDARY'
  LIMIT 1;
$$;

-- Is the current user the SECONDARY contributor of the given application?
CREATE OR REPLACE FUNCTION public.is_secondary_contributor(app_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.application_contributors c
    WHERE c.application_id = app_id
      AND c.role = 'SECONDARY'
      AND c.profile_id = public.current_user_id()
  );
$$;

-- Was the given document (identified by its uploader) uploaded by the
-- SECONDARY contributor of the given application? Used to hide the secondary's
-- documents from the PRIMARY (lead applicant).
CREATE OR REPLACE FUNCTION public.is_secondary_uploaded_document(app_id uuid, uploader uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.application_contributors c
    WHERE c.application_id = app_id
      AND c.role = 'SECONDARY'
      AND c.profile_id = uploader
  );
$$;

GRANT EXECUTE ON FUNCTION public.app_secondary_contributor_id(uuid)            TO app_user;
GRANT EXECUTE ON FUNCTION public.is_secondary_contributor(uuid)               TO app_user;
GRANT EXECUTE ON FUNCTION public.is_secondary_uploaded_document(uuid, uuid)   TO app_user;


-- ─── 2. application_sections — replace the broad ALL policy ───────────────────
-- Old: application_sections_all USING/​WITH CHECK has_application_access(application_id).
-- New: staff + assessor see all; the lead applicant sees their application
-- EXCEPT rows owned by the SECONDARY; the SECONDARY sees ONLY rows they own.
--
-- `owner_contributor_id IS DISTINCT FROM app_secondary_contributor_id(...)`
-- correctly yields TRUE for primary-owned rows (different id) and for NULL-owned
-- rows when there is no secondary, and FALSE only for the secondary's own rows.

DROP POLICY IF EXISTS application_sections_all ON public.application_sections;

CREATE POLICY application_sections_access ON public.application_sections
  FOR ALL TO app_user
  USING (
    public.is_admin_or_viewer()
    OR public.is_assigned_assessor(application_id)
    OR (
      public.is_application_owner(application_id)
      AND (
        public.app_secondary_contributor_id(application_id) IS NULL
        OR owner_contributor_id IS DISTINCT FROM public.app_secondary_contributor_id(application_id)
      )
    )
    OR (
      public.is_secondary_contributor(application_id)
      AND owner_contributor_id = public.app_secondary_contributor_id(application_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_assigned_assessor(application_id)
    OR (
      public.is_application_owner(application_id)
      AND (
        public.app_secondary_contributor_id(application_id) IS NULL
        OR owner_contributor_id IS DISTINCT FROM public.app_secondary_contributor_id(application_id)
      )
    )
    OR (
      public.is_secondary_contributor(application_id)
      AND owner_contributor_id = public.app_secondary_contributor_id(application_id)
    )
  );


-- ─── 3. documents — replace the broad ALL policy ──────────────────────────────
-- Old: documents_all USING/​WITH CHECK has_application_access(application_id).
-- New: staff + assessor see all; the lead applicant sees their application's
-- documents EXCEPT those uploaded by the SECONDARY; the SECONDARY sees ONLY
-- documents they uploaded (and only on an application where they are the
-- secondary contributor).

DROP POLICY IF EXISTS documents_all ON public.documents;

CREATE POLICY documents_access ON public.documents
  FOR ALL TO app_user
  USING (
    public.is_admin_or_viewer()
    OR public.is_assigned_assessor(application_id)
    OR (
      public.is_application_owner(application_id)
      AND NOT (
        public.is_secondary_uploaded_document(application_id, uploaded_by)
      )
    )
    OR (
      public.is_secondary_contributor(application_id)
      AND uploaded_by = public.current_user_id()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_assigned_assessor(application_id)
    OR (
      public.is_application_owner(application_id)
      AND NOT (
        public.is_secondary_uploaded_document(application_id, uploaded_by)
      )
    )
    OR (
      public.is_secondary_contributor(application_id)
      AND uploaded_by = public.current_user_id()
    )
  );


-- ─── 4. applications — let the SECONDARY read the child context row ───────────
-- The secondary parent legitimately knows the child's name/DOB/school. RLS is
-- row-level, not column-level: granting SELECT on this row exposes
-- reference / childName / childDob / school / status / *Id (UUIDs) / timestamps.
-- It does NOT expose parent contact details (those live in PARENT_DETAILS JSONB,
-- still owner-scoped above) and the UUIDs cannot be pivoted to PII because
-- profiles_select does not grant the secondary read access to other profiles.
-- SELECT only — the secondary cannot mutate the application.

CREATE POLICY applications_secondary_select ON public.applications
  FOR SELECT TO app_user
  USING (public.is_secondary_contributor(id));


-- ─── 5. Storage RLS — namespace + isolate secondary documents ─────────────────
-- Convention (enforced by the app layer in PR 4): the SECONDARY's files are
-- stored under `{applicationId}/secondary/...`; the PRIMARY's remain under
-- `{applicationId}/{slot}/...`. Storage policies run under Supabase's real JWT,
-- so they use auth.uid() / auth.jwt() and query application_contributors directly
-- (NOT the request.jwt.claims helpers).
--
-- Changes:
--   a. Narrow the existing lead-applicant SELECT branch so the PRIMARY cannot
--      read objects under the `secondary/` sub-path.
--   b. Add a SELECT/INSERT/DELETE branch letting the SECONDARY read/write ONLY
--      their own `{applicationId}/secondary/...` objects (owner = auth.uid()).
-- ADMIN/VIEWER and the assigned assessor keep full visibility (unchanged select
-- branch covers staff; the assessor matched via assigned_to_id already).

-- a. Replace the SELECT policy with a secondary-aware version.
DROP POLICY IF EXISTS "documents bucket — select" ON storage.objects;

CREATE POLICY "documents bucket — select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMIN', 'VIEWER')
      -- assigned assessor: full visibility (incl. the secondary sub-path)
      OR EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id::text = split_part(name, '/', 1)
          AND a.assigned_to_id = auth.uid()
      )
      -- lead applicant: their application EXCEPT the secondary sub-path
      OR (
        split_part(name, '/', 2) <> 'secondary'
        AND EXISTS (
          SELECT 1 FROM public.applications a
          WHERE a.id::text = split_part(name, '/', 1)
            AND a.lead_applicant_id = auth.uid()
        )
      )
      -- secondary contributor: ONLY their own objects under secondary/
      OR (
        split_part(name, '/', 2) = 'secondary'
        AND owner = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.application_contributors c
          WHERE c.application_id::text = split_part(name, '/', 1)
            AND c.profile_id = auth.uid()
            AND c.role = 'SECONDARY'
        )
      )
    )
  );

-- b. Replace the INSERT policy so the SECONDARY can upload under their sub-path.
DROP POLICY IF EXISTS "documents bucket — insert" ON storage.objects;

CREATE POLICY "documents bucket — insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
      -- lead applicant: their application, NOT the secondary sub-path
      OR (
        split_part(name, '/', 2) <> 'secondary'
        AND EXISTS (
          SELECT 1 FROM public.applications a
          WHERE a.id::text = split_part(name, '/', 1)
            AND (a.lead_applicant_id = auth.uid() OR a.assigned_to_id = auth.uid())
        )
      )
      -- secondary contributor: ONLY under their own secondary/ sub-path
      OR (
        split_part(name, '/', 2) = 'secondary'
        AND EXISTS (
          SELECT 1 FROM public.application_contributors c
          WHERE c.application_id::text = split_part(name, '/', 1)
            AND c.profile_id = auth.uid()
            AND c.role = 'SECONDARY'
        )
      )
    )
  );

-- c. Replace the DELETE policy: lead deletes their own (non-secondary) objects;
--    secondary deletes their own secondary/ objects; ADMIN deletes any.
DROP POLICY IF EXISTS "documents bucket — delete" ON storage.objects;

CREATE POLICY "documents bucket — delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
      OR (
        split_part(name, '/', 2) <> 'secondary'
        AND EXISTS (
          SELECT 1 FROM public.applications a
          WHERE a.id::text = split_part(name, '/', 1)
            AND a.lead_applicant_id = auth.uid()
        )
      )
      OR (
        split_part(name, '/', 2) = 'secondary'
        AND owner = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.application_contributors c
          WHERE c.application_id::text = split_part(name, '/', 1)
            AND c.profile_id = auth.uid()
            AND c.role = 'SECONDARY'
        )
      )
    )
  );
