-- =============================================================================
-- JWF Bursary System — unified Closed state on applications (item 2, Story 2.1)
-- =============================================================================
-- Stories: docs/backlog/stories/02-single-closed-state.md,
--          04-close-reason-dropdown.md (4.1), 10-purge-logic.md (10.1).
--
-- Adds the single terminal "Closed" state to `applications`:
--   closed_at        when the application was closed (NULL = not closed).
--                    Written exactly once — an already-closed application
--                    cannot be re-closed (guard in closeApplication), so the
--                    original close timestamp/reason are immutable, mirroring
--                    bursary_accounts.closed_at semantics.
--   closed_by        the ADMIN who closed it (FK profiles, kept on profile
--                    anonymisation via ON DELETE behaviour = FK to retained row).
--   close_reason_id  the admin-configured reason (FK close_reasons, item 4.3
--                    migration 20260709140000). Required at the application
--                    layer for every NEW close; nullable here because all
--                    pre-existing rows (and historical decline/withdraw
--                    outcomes, which are NOT backfilled — they keep their
--                    outcome/account representation) have no reason.
--   purged_at        when the reason-driven close purge (item 10) anonymised
--                    this application — the idempotency gate for the purge.
--
-- The derived review phase gains a CLOSED value with TOP precedence
-- (src/lib/applications/status.ts + queue-filter.ts): closed_at != NULL wins
-- over every outcome/assessment/form state.
--
-- Additive + nullable, zero backfill: existing rows are all "not closed".
-- CI applies this on merge to staging (.github/workflows/db-push.yml).
-- =============================================================================

ALTER TABLE "applications"
  ADD COLUMN "closed_at"       TIMESTAMPTZ(6),
  ADD COLUMN "closed_by"       UUID,
  ADD COLUMN "close_reason_id" UUID,
  ADD COLUMN "purged_at"       TIMESTAMPTZ(6);

ALTER TABLE "applications"
  ADD CONSTRAINT "applications_closed_by_fkey"
    FOREIGN KEY ("closed_by") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "applications"
  ADD CONSTRAINT "applications_close_reason_id_fkey"
    FOREIGN KEY ("close_reason_id") REFERENCES "close_reasons"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- The queue's non-CLOSED phase fragments all add `closed_at IS NULL`; the
-- CLOSED fragment selects `closed_at IS NOT NULL`. A partial index keeps the
-- closed slice cheap without widening the existing (round_id, form_status)
-- access path.
CREATE INDEX "applications_closed_at_idx"
  ON "applications"("closed_at")
  WHERE "closed_at" IS NOT NULL;
