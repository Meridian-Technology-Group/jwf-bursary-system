-- =============================================================================
-- JWF Bursary System — Staff invitation table
-- =============================================================================
-- Adds a new `staff_invitations` table to support the branded Resend invite
-- flow for staff (ADMIN / ASSESSOR / VIEWER). Separate from `invitations`
-- (applicant flow) so the column shapes stay clean.
--
-- RLS pattern mirrors public.invitations from the row-level-security
-- migration: only staff (ADMIN / ASSESSOR / VIEWER) can SELECT, only
-- ADMIN/service_role can INSERT or UPDATE.  The invitee themselves
-- validate by token via withAdminContext (service_role), not via a
-- logged-in session.
-- =============================================================================


-- ─── 1. Table ───────────────────────────────────────────────────────────────

CREATE TABLE "staff_invitations" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"         text NOT NULL,
  "role"          "Role" NOT NULL,
  "first_name"    text,
  "last_name"     text,
  "token"         text NOT NULL,
  "auth_user_id"  uuid NOT NULL,
  "status"        "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expires_at"    timestamptz(6) NOT NULL,
  "accepted_at"   timestamptz(6),
  "created_by"    uuid NOT NULL,
  "created_at"    timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT "staff_invitations_token_key" UNIQUE ("token"),
  CONSTRAINT "staff_invitations_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "staff_invitations_token_idx" ON "staff_invitations" ("token");
CREATE INDEX "staff_invitations_email_idx" ON "staff_invitations" ("email");


-- ─── 2. Grants for the app_user role ────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_invitations TO app_user;


-- ─── 3. Row Level Security ──────────────────────────────────────────────────

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- SELECT: staff only.
CREATE POLICY staff_invitations_select ON public.staff_invitations
  FOR SELECT TO app_user
  USING (
    public.is_admin_or_viewer()
    OR public.current_user_role() = 'ASSESSOR'
  );

-- INSERT: ADMIN / service_role only.
CREATE POLICY staff_invitations_insert ON public.staff_invitations
  FOR INSERT TO app_user
  WITH CHECK (public.is_admin());

-- UPDATE: ADMIN / service_role only (token acceptance happens under
-- withAdminContext during the registration handshake).
CREATE POLICY staff_invitations_update ON public.staff_invitations
  FOR UPDATE TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: ADMIN / service_role only.
CREATE POLICY staff_invitations_delete ON public.staff_invitations
  FOR DELETE TO app_user
  USING (public.is_admin());
