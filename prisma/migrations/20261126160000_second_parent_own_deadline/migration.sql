-- The second parent's own submission deadline (Charlotte, 26 Nov 2026).
--
-- A second parent used to work to the APPLICATION's deadline, so one added
-- after the lead had finished was locked out on arrival. They now get their
-- own date: 7 days from the second-parent link, end of that London day,
-- ADMIN-editable. Null on PRIMARY rows.
--
-- Additive: a nullable column. No new policy needed — the row-level policies
-- on application_contributors already cover every column.

-- AlterTable
ALTER TABLE "application_contributors" ADD COLUMN "submission_deadline_at" TIMESTAMPTZ(6);

-- Backfill: every second parent still working on their part gets 7 days from
-- when this migration runs (end of that London day), so anyone already
-- invited — including those stuck behind the old access guard — has time to
-- finish. Touches unsubmitted SECONDARY rows only.
UPDATE "application_contributors"
SET "submission_deadline_at" =
  ((((now() AT TIME ZONE 'Europe/London')::date + 8)::timestamp) AT TIME ZONE 'Europe/London')
  - INTERVAL '1 millisecond'
WHERE "role" = 'SECONDARY'
  AND "status" <> 'SUBMITTED';
