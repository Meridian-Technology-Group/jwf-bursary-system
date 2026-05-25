-- =============================================================================
-- JWF Bursary System — Assessor "proceed without second parent" override
-- =============================================================================
-- Backlog #20 (dual-parent-separated-bursary-application), PR 5 of the epic.
-- See docs/engineering/dual-parent-implementation-plan.md (PR 5 section).
--
-- Stores the per-application assessor decision to PROCEED WITH AN ASSESSMENT
-- when a SECONDARY contributor was invited but has not SUBMITTED (decision #3).
-- Without this flag the assessment "Begin" gate stays BLOCKED while a secondary
-- exists and is not submitted; setting it (with a required reason, audit-logged
-- by the server action) unblocks the assessment and falls the calculation back
-- to primary-only / single-earner mode.
--
-- Purely ADDITIVE / forward-only:
--   a. Add boolean column assessments.secondary_parent_override DEFAULT false.
--   b. Add nullable text column assessments.secondary_parent_override_reason.
--
-- INERT for the existing single-parent flow: an application with NO secondary
-- contributor never consults this flag (the gate is satisfied by the primary
-- being SUBMITTED, exactly as today). The default `false` means every existing
-- assessment row is treated as "no override", which is the correct prior state.
-- =============================================================================


-- ─── a. Override flag ────────────────────────────────────────────────────────

ALTER TABLE "assessments"
  ADD COLUMN "secondary_parent_override" BOOLEAN NOT NULL DEFAULT false;


-- ─── b. Override reason (required at write time by the server action) ─────────

ALTER TABLE "assessments"
  ADD COLUMN "secondary_parent_override_reason" TEXT;
