-- =============================================================================
-- JWF Bursary System — Single assessment synopsis (Epic 06, PR-1)
-- =============================================================================
-- Plan: docs/backlog/process-alignment/plans/06-assessor-experience-and-ui.md
--       §5.1 (schema + backfill).
--
-- Collapses the EIGHT scattered freeform qualitative boxes into ONE editable
-- surface, `assessments.synopsis`:
--   * the six AssessmentChecklist tabs
--       (BURSARY_DETAILS, LIVING_CONDITIONS, DEBT, OTHER_FEES, STAFF,
--        FINANCIAL_PROFILE)
--   * Recommendation.family_synopsis
--   * Recommendation.summary
--
-- DISCIPLINE (repo CLAUDE.md + PR brief):
--   * ADDITIVE → BACKFILL. We ADD `assessments.synopsis` (nullable, no default)
--     and BACKFILL it by CONCATENATING the legacy text — never pick-one, so no
--     assessor note is lost.
--   * The legacy columns (assessment_checklists.notes, recommendations.
--     family_synopsis, recommendations.summary) and the AssessmentChecklist
--     table / ChecklistTab enum are LEFT IN PLACE (read-only legacy). A later
--     gated cutover (alongside Epic 08) drops them once verified in prod.
--   * IDEMPOTENT: the backfill only writes rows where `synopsis IS NULL`, so a
--     re-run (or a row that already has a synopsis) is a no-op. Deterministic
--     ordering (enum order, then family_synopsis, then summary) makes the output
--     stable.
--   * Transaction-safe: one ADD COLUMN + pure DML UPDATE. No enum DDL.
-- =============================================================================

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Additive column
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "assessments" ADD COLUMN "synopsis" TEXT;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Backfill — concatenate the eight legacy boxes into one synopsis
-- ───────────────────────────────────────────────────────────────────────────
-- For each assessment we build, in a fixed order:
--   ## <Tab label>
--   <notes>
-- for every checklist tab that has non-blank notes, then append the
-- recommendation family synopsis and summary under their own headings. Blank /
-- whitespace-only sources are skipped. The `summary` block is suppressed when it
-- is byte-identical to `family_synopsis` (de-dupe per §5.1). Tab labels mirror
-- the UI labels in src/components/admin/assessment-checklist.tsx so the
-- backfilled text stays legible and the assessor can edit/prune it.
--
-- Implemented with a single CTE that aggregates the checklist rows in canonical
-- ChecklistTab order, then string-concatenates the recommendation fields.
WITH checklist_blocks AS (
  SELECT
    c."assessment_id" AS assessment_id,
    string_agg(
      '## ' ||
      CASE c."tab"
        WHEN 'BURSARY_DETAILS'   THEN 'Bursary Assessment Details'
        WHEN 'LIVING_CONDITIONS' THEN 'Living Conditions / Other JWF Children'
        WHEN 'DEBT'              THEN 'Debt Situation'
        WHEN 'OTHER_FEES'        THEN 'Other Fees with the Foundation'
        WHEN 'STAFF'             THEN 'Staff Situation'
        WHEN 'FINANCIAL_PROFILE' THEN 'Financial Profile Impact'
        ELSE c."tab"::text
      END
      || E'\n' || c."notes",
      E'\n\n'
      ORDER BY
        CASE c."tab"
          WHEN 'BURSARY_DETAILS'   THEN 1
          WHEN 'LIVING_CONDITIONS' THEN 2
          WHEN 'DEBT'              THEN 3
          WHEN 'OTHER_FEES'        THEN 4
          WHEN 'STAFF'             THEN 5
          WHEN 'FINANCIAL_PROFILE' THEN 6
          ELSE 99
        END
    ) AS checklist_text
  FROM "assessment_checklists" c
  WHERE btrim(c."notes") <> ''
  GROUP BY c."assessment_id"
),
combined AS (
  SELECT
    a."id" AS assessment_id,
    -- Assemble the non-empty pieces, then strip leading/trailing blank lines.
    btrim(
      concat_ws(
        E'\n\n',
        cb.checklist_text,
        CASE
          WHEN btrim(COALESCE(r."family_synopsis", '')) <> ''
            THEN '## Family Synopsis' || E'\n' || r."family_synopsis"
          ELSE NULL
        END,
        CASE
          WHEN btrim(COALESCE(r."summary", '')) <> ''
               AND COALESCE(r."summary", '') IS DISTINCT FROM COALESCE(r."family_synopsis", '')
            THEN '## Recommendation Summary' || E'\n' || r."summary"
          ELSE NULL
        END
      )
    ) AS synopsis_text
  FROM "assessments" a
  LEFT JOIN checklist_blocks cb ON cb.assessment_id = a."id"
  LEFT JOIN "recommendations" r ON r."assessment_id" = a."id"
)
UPDATE "assessments" a
SET "synopsis" = combined.synopsis_text
FROM combined
WHERE a."id" = combined.assessment_id
  AND a."synopsis" IS NULL            -- idempotent: never overwrite an existing synopsis
  AND combined.synopsis_text <> '';    -- skip assessments with no legacy text
