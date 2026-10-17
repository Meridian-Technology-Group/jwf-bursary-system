-- Debt status and lifestyle squeeze changes (Charlotte, 17 Oct 2026).
--
-- (1) The debt shortfall table splits in two by the sign of NDI after notional
--     spend. Existing rows become the positive-NDI table (unchanged wording);
--     a new negative-NDI table is seeded with her wording.
-- (2) The lifestyle-squeeze tables for the two no-debt contexts get a new
--     version whose bottom row (ratio below 0%) reads her label instead of
--     "n/a". Every other row is copied from the current version.
--
-- Additive: a new enum and column (defaulted), a widened unique key, and new
-- rows. Nothing existing is updated or deleted.

-- ── (1) Shortfall table ────────────────────────────────────────────────────
CREATE TYPE "DebtShortfallTable" AS ENUM ('NDI_NEGATIVE', 'NDI_POSITIVE');

ALTER TABLE "debt_shortfall_bands"
  ADD COLUMN "shortfall_table" "DebtShortfallTable" NOT NULL DEFAULT 'NDI_POSITIVE';

DROP INDEX IF EXISTS "debt_shortfall_bands_ceiling_effective_from_key";
CREATE UNIQUE INDEX "debt_shortfall_bands_ceiling_effective_from_table_key"
  ON "debt_shortfall_bands"("ceiling_gbp", "effective_from", "shortfall_table");

-- Her table (1): floor-inclusive, ceiling-exclusive, as the 11 Sep table.
INSERT INTO "debt_shortfall_bands" ("id", "floor_gbp", "ceiling_gbp", "status_label", "shortfall_table", "effective_from")
SELECT gen_random_uuid(), v.floor_gbp, v.ceiling_gbp, v.status_label, 'NDI_NEGATIVE', DATE '2026-10-17'
FROM (VALUES
  (NULL::numeric, 200::numeric, 'SMALL DEBT POSITION SUSPECTED OR MAY GET EXTERNAL FINANCIAL SUPPORT'),
  (200, 500, 'SMALL DEBT POSITION SUSPECTED OR MAY GET EXTERNAL FINANCIAL SUPPORT'),
  (500, 1000, 'SOME DEBT POSITION SUSPECTED OR MAY HAVE AN EXTERNAL INCOME SOURCE'),
  (1000, 2000, 'DEBT POSITION UNDECLARED OR FREE EXTERNAL INCOME MAY BE GRANTED'),
  (2000, 5000, 'DEBT POSITION UNDECLARED OR FREE EXTERNAL INCOME MAY BE GRANTED'),
  (5000, 8000, 'DEBT POSITION TO BE SCRUTINISED OR SOME EXTERNAL INCOME SOURCE SUSPECTED'),
  (8000, NULL, 'DEBT POSITION TO BE SCRUTINISED OR MATERIAL EXTERNAL INCOME SOURCE SUSPECTED')
) AS v(floor_gbp, ceiling_gbp, status_label)
WHERE NOT EXISTS (
  SELECT 1 FROM "debt_shortfall_bands" WHERE "shortfall_table" = 'NDI_NEGATIVE'
);

-- ── (2) Lifestyle squeeze: new version of the two no-debt tables ───────────
-- Copies each context's current (newest) version, replacing only the bottom
-- row's label, and only where that row still reads "n/a".
INSERT INTO "lifestyle_squeeze_bands" ("id", "ratio_floor", "ratio_ceiling", "status_label", "debt_savings_context", "effective_from")
SELECT gen_random_uuid(),
       b."ratio_floor",
       b."ratio_ceiling",
       CASE
         WHEN b."ratio_floor" IS NULL AND b."status_label" = 'n/a' AND b."debt_savings_context" = 'NO_DEBT_NO_SAVINGS'
           THEN 'LIFESTYLE ONLY MAINTAINED BY STARTING TO BORROW OR FREE EXTERNAL FINANCIAL SUPPORT'
         WHEN b."ratio_floor" IS NULL AND b."status_label" = 'n/a' AND b."debt_savings_context" = 'NO_DEBT_WITH_SAVINGS'
           THEN 'LIFESTYLE ONLY MAINTAINED BY DIPPING INTO SAVINGS'
         ELSE b."status_label"
       END,
       b."debt_savings_context",
       DATE '2026-10-17'
FROM "lifestyle_squeeze_bands" b
JOIN (
  SELECT "debt_savings_context", max("effective_from") AS newest
  FROM "lifestyle_squeeze_bands"
  WHERE "debt_savings_context" IN ('NO_DEBT_NO_SAVINGS', 'NO_DEBT_WITH_SAVINGS')
  GROUP BY "debt_savings_context"
) cur ON cur."debt_savings_context" = b."debt_savings_context" AND cur.newest = b."effective_from"
WHERE cur.newest < DATE '2026-10-17';
