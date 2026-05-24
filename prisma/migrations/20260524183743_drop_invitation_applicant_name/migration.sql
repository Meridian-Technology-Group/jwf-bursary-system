-- Backlog #9 (step 2 of 2): drop the legacy Invitation.applicant_name column.
-- Step 1 (20260524182500_backfill_invitation_names) backfilled first_name /
-- last_name from applicant_name, and all readers/writers now use the
-- structured fields (PR #9a). Backfill verified on nonprod (0 unbackfilled)
-- before this drop. Forward-only and irreversible.

ALTER TABLE "public"."invitations" DROP COLUMN "applicant_name";
