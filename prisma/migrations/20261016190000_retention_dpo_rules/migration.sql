-- Epic 23 T10 — retention rebuilt to the DPO-signed rules (16 Oct 2026).
--
-- Two additive changes. Purging stays OFF (RETENTION_PURGE_ENABLED unset):
-- nothing here deletes or rewrites data.
--
-- (1) applications.retention_stage / retention_stage_at — the stage an
--     application's data has reached (FORM_DOCS_PURGED, ANONYMISED,
--     ASSESSMENT_PURGED; NULL = none) and when, so the weekly cron never
--     repeats a stage and the Retention panel can show what is next.
--
-- (2) assessments.archived_at — when the assessment moved to CLOSED_ARCHIVED
--     (cleared on reversal). The retention anchor for an unsuccessful
--     application that was archived rather than closed (D-20): the archive is
--     reopenable, so applications.closed_at (final, write-once) cannot be used.
--     Backfilled for rows already archived from the transition's audit row
--     (bounded: status = CLOSED_ARCHIVED AND archived_at IS NULL; prod 0 rows,
--     nonprod 1, migration staging 0).
--
-- Both tables are already under RLS with policies; new columns inherit them.

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "retention_stage" TEXT,
ADD COLUMN     "retention_stage_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

UPDATE public.assessments a
SET archived_at = l.t
FROM (
  SELECT entity_id, max(created_at) AS t
  FROM public.audit_logs
  WHERE action = 'ASSESSMENT_LIFECYCLE_SET'
    AND metadata->>'toState' = 'CLOSED_ARCHIVED'
  GROUP BY entity_id
) l
WHERE l.entity_id = a.id
  AND a.status = 'CLOSED_ARCHIVED'
  AND a.archived_at IS NULL;
