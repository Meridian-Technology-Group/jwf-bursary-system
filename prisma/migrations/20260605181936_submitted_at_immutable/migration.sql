-- =============================================================================
-- JWF Bursary System — Write-once submitted_at (Epic 01, PR-5)
-- =============================================================================
-- Plan: docs/backlog/process-alignment/plans/01-status-and-workflow-model.md
--       §5.1 "Immutability", §6 PR-5, §10 acceptance criterion.
--
-- Enforces that `applications.submitted_at` is IMMUTABLE once set: the
-- submission date is fixed at submit (apply/actions.ts) and must never change
-- thereafter. Today this holds "only by accident" (00-current-state-map §C);
-- this migration makes it a DURABLE, DB-level guarantee so no future code path,
-- backfill, or manual edit can rewrite a submission date.
--
-- Mechanism: a BEFORE UPDATE trigger on `applications` that raises ONLY when a
-- row whose submitted_at is already non-NULL has its submitted_at changed to a
-- DIFFERENT value. Two cases are explicitly allowed so the change is additive
-- and never blocks a legitimate write:
--
--   1. First write (NULL -> value): the submit transition. OLD.submitted_at is
--      NULL, so the guard does not fire.
--   2. Any UPDATE that does not change submitted_at (NEW = OLD, incl. clearing
--      it back to the same value via IS DISTINCT FROM semantics). The status
--      service (src/lib/applications/status.ts) updates `applications` rows
--      frequently (status / form_status / archived_at / outcome mirror); those
--      writes leave submitted_at untouched and MUST pass through unaffected.
--
-- `IS DISTINCT FROM` is NULL-safe: it is FALSE when both sides are equal
-- (including both NULL) and TRUE when they differ (including value -> NULL).
-- Combined with the `OLD.submitted_at IS NOT NULL` precondition, the trigger
-- only ever fires on a genuine "change an already-set submission date" attempt.
--
-- The app layer (apply/actions.ts) guards the same invariant first and returns a
-- friendly user-facing error; this trigger is the durable backstop that catches
-- everything else (other code paths, SQL, future migrations).
--
-- Idempotent / re-runnable: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS
-- before CREATE TRIGGER, so a non-interactive `prisma migrate deploy` (CI:
-- .github/workflows/db-push.yml) applies it cleanly inside the per-migration
-- transaction. Prisma does not model triggers, so schema.prisma is unchanged and
-- this migration is purely additive trigger DDL (no drift).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_submitted_at_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.submitted_at IS NOT NULL
     AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION
      'submitted_at is write-once and cannot be changed after submission (application %)',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submitted_at_immutable ON public.applications;

CREATE TRIGGER trg_submitted_at_immutable
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_submitted_at_immutable();
