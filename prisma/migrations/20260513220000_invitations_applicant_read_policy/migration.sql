-- Add an RLS SELECT policy so an APPLICANT can read their own accepted
-- invitation row from a logged-in session.
--
-- Why: the portal dashboard (src/app/(portal)/page.tsx) calls
-- getLatestAcceptedInvitationForUser() inside withUserContext to decide
-- whether to show the onboarding card or the "no invitation" fallback.
-- The original 20260513090020_enable_row_level_security migration only
-- granted invitations access to ADMIN/VIEWER/ASSESSOR — APPLICANTs
-- could not see their own row, so the portal always rendered the
-- fallback after a successful accept.
--
-- This policy is read-only for APPLICANT; writes remain staff-only via
-- the existing invitations_staff policy.

CREATE POLICY invitations_applicant_select ON public.invitations
  FOR SELECT TO app_user
  USING (
    public.current_user_role() = 'APPLICANT'
    AND auth_user_id = public.current_user_id()
  );
