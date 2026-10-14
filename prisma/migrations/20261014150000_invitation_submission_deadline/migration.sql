-- Licence fix (14 Oct 2026): a per-invitation "Submit by" date.
--
-- Additive only: one nullable column, no backfill, no default. Existing rows
-- keep NULL, which means "no per-invitation date" — the round chain applies,
-- exactly as before. The table's existing grants (table-level) and RLS
-- policies (row-level: invitations_staff, invitations_applicant_select)
-- already cover a new column, so no policy changes are needed.
ALTER TABLE "invitations" ADD COLUMN "submission_deadline_at" TIMESTAMPTZ(6);
