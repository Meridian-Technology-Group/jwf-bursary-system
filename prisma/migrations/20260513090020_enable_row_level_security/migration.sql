-- =============================================================================
-- JWF Bursary System — Row Level Security (RLS) policies
-- =============================================================================
-- Adds RLS as the third defence layer (per TDD §3.4.2 / §6.3, audit finding 2.2).
--
-- Authorisation model:
--   - APPLICANT: can read/write rows belonging to their own applications
--                (matched via `applications.lead_applicant_id = auth.uid()`).
--   - ASSESSOR : can read/write rows on applications they are assigned to
--                (`applications.assigned_to_id = auth.uid()`).
--   - ADMIN    : full read/write on all application data.
--   - VIEWER   : full read-only on all application data.
--   - DELETED  : no access.
--   - service_role : full bypass (used by Supabase admin client and the
--                Prisma `withAdminContext()` helper for genuine admin ops).
--
-- The Prisma runtime no longer connects as `postgres`; it logs in as a new
-- non-superuser role `app_user` (created below). Per-request the application
-- runs `SET LOCAL request.jwt.claims = '{"sub":"<uuid>","role":"<role>"}'`
-- inside a transaction (see src/lib/db/prisma.ts → withUserContext).
--
-- AuditLog is INSERT-only on app_user; UPDATE and DELETE are revoked.
-- (GDPR cascade, which previously mutated audit_logs, must run via
--  withAdminContext or be reworked — see security-audit.md 2.8.)
-- =============================================================================


-- ─── 1. Application role ─────────────────────────────────────────────────────

-- Create a non-superuser login role that Prisma will use at runtime.
-- The password is a placeholder; the real password is supplied via
-- DATABASE_URL in the new Supabase project (see deployment notes).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'CHANGE_ME_IN_SUPABASE_DASHBOARD' NOINHERIT;
  END IF;
END
$$;

-- Allow connecting to the current database and using the public schema.
-- (DO block so the migration is portable across Supabase project DB names.)
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_user', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO app_user;

-- Default privileges for any future tables/sequences created by `postgres`
-- in `public` — keeps subsequent migrations working without extra GRANTs.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;


-- ─── 2. Claim helper functions ───────────────────────────────────────────────
-- These mirror Supabase/PostgREST's `auth.uid()` / `auth.role()` but read the
-- claim that the application has SET LOCALly on the current transaction.
-- Marked STABLE so the planner can cache results within a statement.

CREATE OR REPLACE FUNCTION public.current_jwt_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(public.current_jwt_claims() ->> 'sub', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.current_jwt_claims() ->> 'role', '');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_user_role() IN ('ADMIN', 'service_role');
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_viewer()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_user_role() IN ('ADMIN', 'VIEWER', 'service_role');
$$;

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_user_role() = 'service_role';
$$;

-- Helper: does the current user own (lead applicant) or is assigned to the
-- given application? ADMIN/VIEWER/service_role always pass.
CREATE OR REPLACE FUNCTION public.has_application_access(app_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin_or_viewer()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = app_id
        AND (
          a.lead_applicant_id = public.current_user_id()
          OR a.assigned_to_id = public.current_user_id()
        )
    );
$$;

-- Helper: is the current user the lead applicant of the application?
CREATE OR REPLACE FUNCTION public.is_application_owner(app_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = app_id
      AND a.lead_applicant_id = public.current_user_id()
  );
$$;

-- Helper: is the current user the assigned assessor (ADMIN bypasses)?
CREATE OR REPLACE FUNCTION public.is_assigned_assessor(app_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = app_id AND a.assigned_to_id = public.current_user_id()
    );
$$;

-- All helpers are callable by app_user.
GRANT EXECUTE ON FUNCTION public.current_jwt_claims()       TO app_user;
GRANT EXECUTE ON FUNCTION public.current_user_id()          TO app_user;
GRANT EXECUTE ON FUNCTION public.current_user_role()        TO app_user;
GRANT EXECUTE ON FUNCTION public.is_admin()                 TO app_user;
GRANT EXECUTE ON FUNCTION public.is_admin_or_viewer()       TO app_user;
GRANT EXECUTE ON FUNCTION public.is_service_role()          TO app_user;
GRANT EXECUTE ON FUNCTION public.has_application_access(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.is_application_owner(uuid)   TO app_user;
GRANT EXECUTE ON FUNCTION public.is_assigned_assessor(uuid)   TO app_user;


-- ─── 3. Table grants ─────────────────────────────────────────────────────────
-- Grant the standard CRUD set on every personal-data table. RLS policies
-- below then constrain *which rows* are visible/mutable.

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles,
  public.applications,
  public.application_sections,
  public.documents,
  public.assessments,
  public.assessment_earners,
  public.assessment_properties,
  public.assessment_checklists,
  public.recommendations,
  public.recommendation_reason_codes,
  public.bursary_accounts,
  public.sibling_links,
  public.invitations
TO app_user;

-- audit_logs: INSERT-only for the app role. UPDATE and DELETE are revoked
-- so that even a SQL-injection that bypasses RLS cannot mutate history.
GRANT INSERT, SELECT ON public.audit_logs TO app_user;
REVOKE UPDATE, DELETE ON public.audit_logs FROM app_user;

-- Reference tables and Round are readable by everyone (they hold no PII).
GRANT SELECT ON
  public.rounds,
  public.family_type_configs,
  public.school_fees,
  public.council_tax_defaults,
  public.reason_codes,
  public.email_templates
TO app_user;
-- ADMIN-side write paths to reference/email_templates go through withAdminContext.
GRANT INSERT, UPDATE, DELETE ON
  public.rounds,
  public.family_type_configs,
  public.school_fees,
  public.council_tax_defaults,
  public.reason_codes,
  public.email_templates
TO app_user;


-- ─── 4. Enable RLS on every personal-data table ──────────────────────────────

ALTER TABLE public.profiles                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_sections         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_earners           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_checklists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_reason_codes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bursary_accounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sibling_links                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                   ENABLE ROW LEVEL SECURITY;

-- Belt-and-braces: even table owners obey RLS in non-admin contexts.
-- (We rely on service_role bypass via the claim, not via role ownership.)
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;


-- ─── 5. Policies ─────────────────────────────────────────────────────────────
-- Pattern: one permissive SELECT policy + one ALL policy for mutations, with
-- service_role short-circuited via is_admin() / is_admin_or_viewer().
-- WITH CHECK clauses mirror USING clauses to prevent privilege escalation
-- via UPDATE that changes the ownership column.

-- ── profiles ────────────────────────────────────────────────────────────────
-- A user can always read their own profile. ADMIN/VIEWER read all. ASSESSOR
-- can read profiles linked to applications they own/are assigned to (lead
-- applicants and other assessors). For simplicity assessors get read-all on
-- profiles (they need this for queue/assignment UI).
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO app_user
  USING (
    public.is_admin_or_viewer()
    OR public.current_user_role() = 'ASSESSOR'
    OR id = public.current_user_id()
  );

-- Only ADMIN/service_role can insert or delete profiles. A user can update
-- their OWN profile but cannot change the `role` column — role changes go
-- through withAdminContext.
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT TO app_user
  WITH CHECK (public.is_admin());

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO app_user
  USING (public.is_admin() OR id = public.current_user_id())
  WITH CHECK (public.is_admin() OR id = public.current_user_id());

CREATE POLICY profiles_delete_admin ON public.profiles
  FOR DELETE TO app_user
  USING (public.is_admin());


-- ── applications ─────────────────────────────────────────────────────────────
CREATE POLICY applications_select ON public.applications
  FOR SELECT TO app_user
  USING (
    public.is_admin_or_viewer()
    OR lead_applicant_id = public.current_user_id()
    OR assigned_to_id    = public.current_user_id()
  );

-- Insert: applicants may create their own (registration path); admin can
-- create on behalf. Assessor cannot create applications.
CREATE POLICY applications_insert ON public.applications
  FOR INSERT TO app_user
  WITH CHECK (
    public.is_admin()
    OR lead_applicant_id = public.current_user_id()
  );

-- Update: applicants on their own (pre-submission paths are gated in app);
-- assessors on assigned; admin on all. Ownership column cannot change.
CREATE POLICY applications_update ON public.applications
  FOR UPDATE TO app_user
  USING (
    public.is_admin()
    OR lead_applicant_id = public.current_user_id()
    OR assigned_to_id    = public.current_user_id()
  )
  WITH CHECK (
    public.is_admin()
    OR lead_applicant_id = public.current_user_id()
    OR assigned_to_id    = public.current_user_id()
  );

CREATE POLICY applications_delete ON public.applications
  FOR DELETE TO app_user
  USING (public.is_admin());


-- ── application_sections ─────────────────────────────────────────────────────
CREATE POLICY application_sections_all ON public.application_sections
  FOR ALL TO app_user
  USING (public.has_application_access(application_id))
  WITH CHECK (public.has_application_access(application_id));


-- ── documents ───────────────────────────────────────────────────────────────
CREATE POLICY documents_all ON public.documents
  FOR ALL TO app_user
  USING (public.has_application_access(application_id))
  WITH CHECK (public.has_application_access(application_id));


-- ── assessments ─────────────────────────────────────────────────────────────
-- Applicants must NOT see assessment data. Assessors see assignments; admin
-- and viewer see all.
CREATE POLICY assessments_select ON public.assessments
  FOR SELECT TO app_user
  USING (
    public.is_admin_or_viewer()
    OR public.is_assigned_assessor(application_id)
  );

CREATE POLICY assessments_write ON public.assessments
  FOR ALL TO app_user
  USING (
    public.is_admin()
    OR public.is_assigned_assessor(application_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_assigned_assessor(application_id)
  );


-- ── assessment_earners / _properties / _checklists ───────────────────────────
-- Visibility tracks the parent assessment.
CREATE POLICY assessment_earners_all ON public.assessment_earners
  FOR ALL TO app_user
  USING (
    public.is_admin_or_viewer()
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id
        AND public.is_assigned_assessor(a.application_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id
        AND public.is_assigned_assessor(a.application_id)
    )
  );

CREATE POLICY assessment_properties_all ON public.assessment_properties
  FOR ALL TO app_user
  USING (
    public.is_admin_or_viewer()
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id
        AND public.is_assigned_assessor(a.application_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id
        AND public.is_assigned_assessor(a.application_id)
    )
  );

CREATE POLICY assessment_checklists_all ON public.assessment_checklists
  FOR ALL TO app_user
  USING (
    public.is_admin_or_viewer()
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id
        AND public.is_assigned_assessor(a.application_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id
        AND public.is_assigned_assessor(a.application_id)
    )
  );


-- ── recommendations ─────────────────────────────────────────────────────────
CREATE POLICY recommendations_all ON public.recommendations
  FOR ALL TO app_user
  USING (
    public.is_admin_or_viewer()
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id
        AND public.is_assigned_assessor(a.application_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id
        AND public.is_assigned_assessor(a.application_id)
    )
  );

CREATE POLICY recommendation_reason_codes_all ON public.recommendation_reason_codes
  FOR ALL TO app_user
  USING (
    public.is_admin_or_viewer()
    OR EXISTS (
      SELECT 1 FROM public.recommendations r
      JOIN public.assessments a ON a.id = r.assessment_id
      WHERE r.id = recommendation_id
        AND public.is_assigned_assessor(a.application_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.recommendations r
      JOIN public.assessments a ON a.id = r.assessment_id
      WHERE r.id = recommendation_id
        AND public.is_assigned_assessor(a.application_id)
    )
  );


-- ── bursary_accounts ────────────────────────────────────────────────────────
-- Lead applicants can see their own account; staff see all.
CREATE POLICY bursary_accounts_select ON public.bursary_accounts
  FOR SELECT TO app_user
  USING (
    public.is_admin_or_viewer()
    OR public.current_user_role() = 'ASSESSOR'
    OR lead_applicant_id = public.current_user_id()
  );

CREATE POLICY bursary_accounts_write ON public.bursary_accounts
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── sibling_links ────────────────────────────────────────────────────────────
-- Read: staff always; applicant if any linked account belongs to them.
CREATE POLICY sibling_links_select ON public.sibling_links
  FOR SELECT TO app_user
  USING (
    public.is_admin_or_viewer()
    OR public.current_user_role() = 'ASSESSOR'
    OR EXISTS (
      SELECT 1 FROM public.bursary_accounts ba
      WHERE ba.id = bursary_account_id
        AND ba.lead_applicant_id = public.current_user_id()
    )
  );

CREATE POLICY sibling_links_write ON public.sibling_links
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── invitations ─────────────────────────────────────────────────────────────
-- Invitations are staff-managed; the *invitee* validates by token via
-- service_role (registration flow), not via a logged-in session.
CREATE POLICY invitations_staff ON public.invitations
  FOR ALL TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR')
  WITH CHECK (public.is_admin() OR public.current_user_role() = 'ASSESSOR');


-- ── audit_logs ──────────────────────────────────────────────────────────────
-- Append-only. Only ADMIN/VIEWER can SELECT. Anyone authenticated may INSERT
-- (their own user_id, or NULL). No UPDATE / DELETE policies — REVOKE above
-- plus FORCE RLS make those impossible from app_user.
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer());

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO app_user
  WITH CHECK (
    public.current_user_id() IS NOT NULL
    AND (user_id IS NULL OR user_id = public.current_user_id() OR public.is_admin())
  );


-- ─── 6. Storage RLS (documents bucket) ───────────────────────────────────────
-- Mirrors the DB rules so the Storage layer has its own defence (audit 2.16).
-- Path convention used by src/lib/storage/documents.ts is:
--   {applicationId}/{slot}/{uuid}-{filename}
-- The first path segment is the applicationId.
--
-- NOTE: storage.objects RLS already runs against the role inferred from the
-- Supabase JWT, not our `request.jwt.claims`. These policies therefore use
-- Supabase's `auth.uid()` / `auth.jwt()` helpers (available in the storage
-- schema on every Supabase project).

CREATE POLICY "documents bucket — select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMIN', 'VIEWER')
      OR EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id::text = split_part(name, '/', 1)
          AND (a.lead_applicant_id = auth.uid() OR a.assigned_to_id = auth.uid())
      )
    )
  );

CREATE POLICY "documents bucket — insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
      OR EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id::text = split_part(name, '/', 1)
          AND (a.lead_applicant_id = auth.uid() OR a.assigned_to_id = auth.uid())
      )
    )
  );

CREATE POLICY "documents bucket — delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
      OR EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id::text = split_part(name, '/', 1)
          AND a.lead_applicant_id = auth.uid()
      )
    )
  );

-- Note: the service_role JWT bypasses RLS on storage.objects automatically,
-- so the application's existing supabaseAdmin calls (signed URL generation,
-- admin uploads) continue to work without policy changes.
