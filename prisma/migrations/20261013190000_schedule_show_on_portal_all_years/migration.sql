-- Epic 21 #5 (CR-002 Phase 4, D-2) — the show-on-portal tick governs the
-- family's home page as well as the calendar, and now defaults ON for every
-- year (it defaulted on for years 1–2 only). Obeying the old default would
-- hide years 3+ from every family, so existing rows are ticked to match.
--
-- DATA MIGRATION (mass UPDATE): approved by Brian in PR before merge.
-- Prod at 13 Oct 2026: 5 of 9 rows. Migration staging: rerun by hand after
-- `migrate deploy` (this file IS the rerun).
--
-- A row an admin deliberately toggled keeps its setting: any row with a
-- SCHEDULE_SHOW_ON_PORTAL_TOGGLED audit entry is left alone. Only untouched
-- defaults are ticked. Idempotent.

UPDATE "bursary_schedule_entries" AS e
SET "show_on_portal" = true
WHERE e."show_on_portal" = false
  AND NOT EXISTS (
    SELECT 1
    FROM "audit_logs" AS a
    WHERE a."action" = 'SCHEDULE_SHOW_ON_PORTAL_TOGGLED'
      AND a."entity_id" = e."id"
  );
