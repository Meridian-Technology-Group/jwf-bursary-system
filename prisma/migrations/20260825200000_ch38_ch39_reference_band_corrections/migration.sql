-- CH-38 + CH-39 (Epic 17 Tranche A) — two reference-band corrections Charlotte
-- supplied on 24 Aug 2026. Data-only; no schema change.
--
-- These ride a migration as well as `seed-reference.ts` because the seed is run
-- by hand per environment, whereas migrations deploy automatically via
-- db-push.yml. The seed remains the source of truth for a fresh database; this
-- brings existing databases to the same state without anyone remembering to run
-- it. Both are idempotent, so running either twice is a no-op.
--
-- Matching is on (effective_from, band_ceiling), the same key seed-reference.ts
-- uses, because band_floor is the column that moves.

-- ─── CH-38 · financial equity bands ────────────────────────────────────────
-- Her amended first seven levels. The single 0–50,000 "some savings" band
-- becomes three, and the two above it shift label:
--   0–3,000          negligible savings              (new)
--   3,000–20,000     within default cushion savings  (new)
--   20,000–50,000    fair savings                    (was "some savings", 0–50,000)
--   50,000–75,000    decent savings                  (was "fair savings")
--   75,000–100,000   comfortable savings             (was "decent savings")
-- Everything from 100,000 up already matched her table and is untouched.

UPDATE "financial_equity_bands"
   SET "band_floor" = 20000, "label" = 'fair savings'
 WHERE "band_ceiling" = 50000;

UPDATE "financial_equity_bands"
   SET "label" = 'decent savings'
 WHERE "band_ceiling" = 75000;

UPDATE "financial_equity_bands"
   SET "label" = 'comfortable savings'
 WHERE "band_ceiling" = 100000;

INSERT INTO "financial_equity_bands" ("id", "band_floor", "band_ceiling", "label", "effective_from")
SELECT gen_random_uuid(), 0, 3000, 'negligible savings',
       (SELECT MIN("effective_from") FROM "financial_equity_bands")
 WHERE NOT EXISTS (SELECT 1 FROM "financial_equity_bands" WHERE "band_ceiling" = 3000);

INSERT INTO "financial_equity_bands" ("id", "band_floor", "band_ceiling", "label", "effective_from")
SELECT gen_random_uuid(), 3000, 20000, 'within default cushion savings',
       (SELECT MIN("effective_from") FROM "financial_equity_bands")
 WHERE NOT EXISTS (SELECT 1 FROM "financial_equity_bands" WHERE "band_ceiling" = 20000);

-- ─── CH-39 · income category bands ─────────────────────────────────────────
-- Resolves ASSUMPTION(CALC-A1). The workbook's 7,8,7,8 tail was her own slip:
-- "it should show logically and incrementally from category 1 to category 11".
-- Eleven bands, eleven categories. Boundaries and fees_benchmark_pct untouched.

UPDATE "income_category_bands" SET "category" = 8  WHERE "band_ceiling" = 100000;
UPDATE "income_category_bands" SET "category" = 9  WHERE "band_ceiling" = 110000;
UPDATE "income_category_bands" SET "category" = 10 WHERE "band_ceiling" = 120000;
UPDATE "income_category_bands" SET "category" = 11 WHERE "band_ceiling" IS NULL;
