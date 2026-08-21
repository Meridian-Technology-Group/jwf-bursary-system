-- =============================================================================
-- JWF Bursary System — Application reference becomes a non-unique label (C4a)
-- =============================================================================
-- Epic 13, decision D13-1a (Brian, 2026-08-14), implemented per
-- docs/backlog/uat-aug-2026/sprint-01-implementation-plan.md §5 C4a.
--
-- **The reference is a label, not an identity.** Identity is the UUID primary
-- key (`applications.id`), and NO foreign key anywhere in the schema points at
-- `reference` — every relation joins on `id`. Dropping uniqueness therefore
-- removes no integrity guarantee that anything depends on; database uniqueness
-- continues to rest on the primary keys, which already carry it.
--
-- Why it must go: `Application.reference` is re-edited once a bursary is
-- awarded so it matches the external fees system (e.g. `TS-SMITH05-Smith, Bob`)
-- for reconciliation. Two applications may legitimately carry the same
-- reconciliation label — a sibling pair billed under one fees account, or the
-- same child across two rounds — so uniqueness is enforced at NO layer:
-- this migration removes it from the database, and the same PR removes the
-- case-insensitive pre-check from `updateApplicationReferenceAction`.
--
-- Three statements:
--   1. Drop `applications_reference_key`       — the `@unique` from
--      20260301180442_initial_schema (Prisma emits `@unique` as a unique index,
--      not a table constraint, so DROP INDEX is the right verb).
--   2. Drop `applications_reference_lower_key` — the raw functional unique
--      index from 20260709130000_reference_case_insensitive_unique. That
--      migration's Story 11.2 uniqueness requirement is superseded by D13-1a.
--   3. Create `applications_reference_lower_idx` — the SAME functional
--      expression, NON-unique, so case-insensitive reference search
--      (`listApplications`' `contains` + `mode: "insensitive"` filter) keeps an
--      index to use instead of falling back to a sequential scan.
--
-- `BursaryAccount.reference` is a DIFFERENT column and is deliberately NOT
-- touched here — it keeps its unique index. (C4b removes that column outright
-- in a separate PR.)
--
-- Purely permissive: dropping a unique index can never fail on existing data,
-- and the replacement index is non-unique, so it cannot fail either. No
-- backfill, no data check, and nothing to verify against prod before applying.
-- Reversal is `DROP INDEX applications_reference_lower_idx` followed by
-- recreating the two unique indexes — which WOULD require a duplicate check.
--
-- CONCURRENTLY is not used: `prisma migrate deploy` runs each migration inside
-- a transaction and `CREATE INDEX CONCURRENTLY` cannot run in one. The table is
-- small (tens of rows per round) and this is a non-prod-first deployment path,
-- so the brief ACCESS EXCLUSIVE lock is acceptable.
-- =============================================================================

-- 1. Drop the case-sensitive `@unique` (schema.prisma `Application.reference`).
DROP INDEX IF EXISTS "applications_reference_key";

-- 2. Drop the case-insensitive functional unique index (Story 11.2).
DROP INDEX IF EXISTS "applications_reference_lower_key";

-- 3. Replace with the same expression, non-unique, so search stays fast.
CREATE INDEX IF NOT EXISTS "applications_reference_lower_idx"
  ON "applications" (lower("reference"));
