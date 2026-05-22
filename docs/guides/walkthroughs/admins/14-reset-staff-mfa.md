# 14 — Reset another staff member's MFA

Backlink: [[README#Operations]]

When an assessor loses their authenticator device, an admin can
clear their MFA factor so they can re-enrol on next sign-in.

> **NOTE:** MFA itself is currently in the backlog as **B8**.
> Until B8 ships, no application-level MFA reset UI exists; the
> procedure below is a manual database operation against Supabase.
> Update this guide alongside the B8 implementation.

## Prerequisites

- Signed in as `ADMIN`.
- Access to the Supabase dashboard for the relevant environment, or
  the Supabase MCP wired into your local tooling.
- You know which staff member needs the reset (email or `user.id`).

## Manual reset via Supabase dashboard

1. Open the Supabase project (`supabase-prod` for production,
   `supabase-nonprod` for staging) → **Authentication → Users**.
2. Find the user by email. Note their `user.id`.
3. Open the **SQL Editor** and run:
   ```sql
   DELETE FROM auth.mfa_factors
   WHERE user_id = '<the user.id>';
   ```
4. Confirm the row count returned is `>= 1`.

## Manual reset via Supabase MCP

1. Use the appropriate MCP server (`supabase-nonprod` or
   `supabase-prod`).
2. Call `execute_sql` with:
   ```sql
   DELETE FROM auth.mfa_factors
   WHERE user_id = '<the user.id>';
   ```

## Verification

- Ask the staff member to sign in. They should be prompted to enrol
  a new MFA factor.
- The audit log entry for the deletion is **not** in the application
  audit log (this is a direct DB op); record the action manually in
  your operations log.

## Cross-references

- See `docs/archive/backlog/b8-mfa-for-admin-and-assessor.md` for the
  upcoming application-level reset flow.
- See [[13-audit-log-review]] for normal application audit trail.
