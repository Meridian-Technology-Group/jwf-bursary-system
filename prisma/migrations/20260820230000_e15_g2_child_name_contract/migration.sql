-- Epic 15 G2 (CH-09): the invitation data contract requires the child's
-- first name, surname and DOB. Carry the split identity through the
-- invitation onto the application so nothing downstream has to
-- whitespace-split `child_name`. Additive; legacy rows stay NULL.
--
-- IF NOT EXISTS because the columns are pre-applied to nonprod for browser
-- verification before this migration lands via db-push (same pattern as
-- 20260816 sibling_details).

ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "child_first_name" TEXT,
  ADD COLUMN IF NOT EXISTS "child_last_name" TEXT,
  ADD COLUMN IF NOT EXISTS "child_dob" DATE;

ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "child_first_name" TEXT,
  ADD COLUMN IF NOT EXISTS "child_last_name" TEXT;
