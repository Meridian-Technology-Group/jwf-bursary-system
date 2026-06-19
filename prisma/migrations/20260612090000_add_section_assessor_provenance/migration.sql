-- =============================================================================
-- JWF Bursary System — assessor edit-on-behalf provenance (CR-001, PR A)
-- =============================================================================
-- Plan: docs/engineering/cr-001-edit-on-behalf-implementation-plan.md
--
-- Records WHICH form fields were entered or amended by staff on the
-- applicant's behalf. A flat dot-path map keyed by field path, e.g.
--   { "parent1Income.salary": { editedBy, editedByName, editedAt } }
-- Merged into on each staff save; a path's entry is cleared when the
-- applicant re-edits that field pre-submission (their own value supersedes
-- the staff one, so it no longer needs flagging).
--
-- Purely ADDITIVE with a constant DEFAULT '{}' — metadata-only in PG 11+
-- (no table rewrite), no backfill, no data dependency. Existing rows take
-- the empty map (nothing staff-entered). CI applies on merge.
-- =============================================================================

ALTER TABLE "application_sections"
  ADD COLUMN "assessor_provenance" JSONB NOT NULL DEFAULT '{}';
