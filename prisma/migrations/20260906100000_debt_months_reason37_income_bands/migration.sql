-- Charlotte's three gating changes of 6 Sep 2026 (RE: Benchmark Bands):
--
-- 1. Repayment months are COMPUTED per assessment now
--    (((total debt − total savings) / NDI) × 12, `minRepaymentMonthsWithoutFees`),
--    never stored per band — null the values the 20260905220000 migration
--    derived for the 2026-09-07 debt generation.
UPDATE "debt_ratio_bands"
SET "min_repayment_months" = NULL
WHERE "effective_from" = DATE '2026-09-07'
  AND "min_repayment_months" IS NOT NULL;

-- 2. New reason code 37 (DB code 137) in the Fees & Adjustments group.
--    Mirrors prisma/seed-data/reason-codes.ts; ON CONFLICT keeps this
--    re-runnable alongside the idempotent reference seed.
INSERT INTO "reason_codes" ("id", "code", "label", "is_deprecated", "sort_order")
VALUES (gen_random_uuid(), 137, '37 - Sibling on full/partial fees taking up most or all of NDI', false, 37)
ON CONFLICT ("code") DO UPDATE SET "label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order";

-- 3. Income categories: the category-1 ceiling moves from £27,000 to £31,000;
--    every other boundary, category and percentage carries forward. New
--    generation (2026-09-08), mirrored in the seed's
--    `incomeCategoryBandsRespec`; generation-guarded for idempotence.
INSERT INTO "income_category_bands" ("id", "band_floor", "band_ceiling", "category", "fees_benchmark_pct", "effective_from")
SELECT gen_random_uuid(), v.floor, v.ceiling, v.category, v.pct, DATE '2026-09-08'
FROM (VALUES
  (NULL::numeric, 31000::numeric, 1, 2::numeric),
  (31000, 40000, 2, 3),
  (40000, 50000, 3, 6),
  (50000, 60000, 4, 10),
  (60000, 70000, 5, 15),
  (70000, 80000, 6, 19),
  (80000, 90000, 7, 23),
  (90000, 100000, 8, 27),
  (100000, 110000, 9, 30),
  (110000, 120000, 10, 30),
  (120000, 140000, 11, 30),
  (140000, NULL, 12, 30)
) AS v(floor, ceiling, category, pct)
WHERE NOT EXISTS (
  SELECT 1 FROM "income_category_bands" WHERE "effective_from" = DATE '2026-09-08'
);
