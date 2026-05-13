-- =============================================================================
-- JWF Bursary System — Applicant invitation token + name columns
-- =============================================================================
-- Brings the applicant `invitations` table to parity with `staff_invitations`:
-- adds a single-use cryptographic `token` plus structured `first_name` /
-- `last_name` columns so the acceptance flow no longer relies on the raw
-- invitation UUID and the legacy `applicant_name` whitespace-split heuristic.
--
-- Existing PENDING rows are backfilled with a fresh base64url token so the
-- NOT NULL + UNIQUE flip is safe. ACCEPTED / EXPIRED rows are backfilled too
-- for index integrity but their tokens are functionally inert.
--
-- See docs/planning/APPLICANT_INVITATION_FLOW.md §4.1 for context.
-- =============================================================================

-- 1. Add new columns (nullable so the backfill can run).
ALTER TABLE "invitations"
  ADD COLUMN "token"      text,
  ADD COLUMN "first_name" text,
  ADD COLUMN "last_name"  text;

-- 2. Backfill token on every existing row so the NOT NULL flip is safe.
--    encode(gen_random_bytes(32), 'base64') produces standard base64; we
--    swap '+' → '-' and '/' → '_' to match the base64url tokens generated
--    by the application (Node's randomBytes(32).toString('base64url')).
UPDATE "invitations"
SET "token" = replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_')
WHERE "token" IS NULL;

-- 3. Lock token NOT NULL + UNIQUE, and add the supporting indexes.
ALTER TABLE "invitations" ALTER COLUMN "token" SET NOT NULL;
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations" ("token");
CREATE INDEX "invitations_email_idx" ON "invitations" ("email");
