-- =============================================================================
-- JWF Bursary System — Next-year fee snapshot columns (Epic 07, PR-2)
-- =============================================================================
-- Plan: docs/backlog/process-alignment/plans/07-assessment-calculations-and-fees.md
--       §5.1 (current + next-year fees) / §5.2 (snapshot the next-year payable
--       figures on save).
--
-- The assessor now sees BOTH the current-year and the next-year annual fee for a
-- school (resolved from the versioned `school_fees` rows by the fee-year resolver
-- in src/lib/assessment/fee-year.ts), and the engine emits a parallel next-year
-- payable breakdown (D14 default: scholarship %/bursary held flat, only the gross
-- rises). We snapshot the next-year figures alongside the existing current-year
-- snapshot so the recommendation / PDF (Epic 08) can render the fee uplift without
-- recomputation.
--
-- DISCIPLINE (repo CLAUDE.md + PR brief):
--   * ADDITIVE ONLY. Three nullable columns, no default, no backfill. Existing
--     rows keep NULL (they predate the next-year concept); the app treats NULL as
--     "not snapshotted" and falls back to the live resolver / current-year figure.
--   * No data rewrite, no enum DDL, transaction-safe. Cannot break existing rows.
--   * Option A (reuse the versioned `school_fees` table) means there is NO change
--     to `school_fees` itself — the only new persistence is these snapshot columns
--     on `assessments`.
-- =============================================================================

ALTER TABLE "assessments"
  ADD COLUMN "next_year_annual_fees"          DECIMAL(10, 2),
  ADD COLUMN "next_year_yearly_payable_fees"  DECIMAL(10, 2),
  ADD COLUMN "next_year_monthly_payable_fees" DECIMAL(10, 2);
