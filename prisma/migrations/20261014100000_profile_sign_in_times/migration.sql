-- Epic 22 P1 (CR-002 Phase 5) — "Last login" on My Bursary Application(s).
--
-- Supabase keeps only the CURRENT sign-in (auth.users.last_sign_in_at), so the
-- family's previous sign-in has to be remembered here. The portal layout copies
-- auth's value across on the first page load after each new sign-in:
-- previous_sign_in_at <- last_sign_in_at, last_sign_in_at <- auth's value.
--
-- Additive: two nullable columns, no backfill (recorded from deploy onwards),
-- no RLS change (profiles policies are row-level; the write runs under the
-- admin context).

ALTER TABLE "profiles" ADD COLUMN "last_sign_in_at" TIMESTAMPTZ(6);
ALTER TABLE "profiles" ADD COLUMN "previous_sign_in_at" TIMESTAMPTZ(6);
