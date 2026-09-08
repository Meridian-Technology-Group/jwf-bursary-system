-- Charlotte's 8 Sep 2026 Part 5 respec, step 1 of 2: the SCHEMA + REFERENCE DATA.
-- (The calc change — debt/5 and the dropped savings netting — lands separately;
-- this migration alone leaves live assessment output unchanged, because every
-- existing row becomes SAVINGS_BELOW_DEBT and that is the variant the current
-- resolver asks for by default.)
--
-- Her ask: the debt-status and lifestyle-squeeze commentary tables each gain a
-- second variant, selected per assessment by whether total savings exceed total
-- debt. Four tables in total. The ratio is identical across a pair; only the
-- wording of the status label differs.

-- 1. The variant discriminator.
CREATE TYPE "SavingsVariant" AS ENUM ('SAVINGS_BELOW_DEBT', 'SAVINGS_ABOVE_DEBT');

ALTER TABLE "debt_ratio_bands"
  ADD COLUMN "savings_variant" "SavingsVariant" NOT NULL DEFAULT 'SAVINGS_BELOW_DEBT';

ALTER TABLE "lifestyle_squeeze_bands"
  ADD COLUMN "savings_variant" "SavingsVariant" NOT NULL DEFAULT 'SAVINGS_BELOW_DEBT';

-- 2. Widen the natural key so the same ceiling can exist once per variant.
--    (ratio_ceiling is nullable and Postgres treats NULLs as distinct, so the
--    open-ended top row was never covered by this index before or after.)
DROP INDEX "debt_ratio_bands_ratio_ceiling_effective_from_key";
CREATE UNIQUE INDEX "debt_ratio_bands_ratio_ceiling_effective_from_savings_variant_key"
  ON "debt_ratio_bands"("ratio_ceiling", "effective_from", "savings_variant");

DROP INDEX "lifestyle_squeeze_bands_ratio_ceiling_effective_from_key";
CREATE UNIQUE INDEX "lifestyle_squeeze_bands_ratio_ceiling_effective_from_savings_var_key"
  ON "lifestyle_squeeze_bands"("ratio_ceiling", "effective_from", "savings_variant");

-- 3. Her new generation of all four tables, effective 2026-09-09.
--    Kept in sync with prisma/seed-data/profiling-reference.ts.
--
--    C.4 debt bands are RE-THRESHOLDED (uniform 0.1 steps to 1.0, then
--    open-ended) — that is her "ranking levels changed" note. C.5 lifestyle
--    bands keep the 7 Sep thresholds verbatim; only the labels differ between
--    variants, exactly as she says ("no change in rankings applied to the
--    Lifestyle table").

-- 3a. Debt-over-NDI — savings BELOW debt (uncushioned; credit-risk wording).
INSERT INTO "debt_ratio_bands"
  ("id", "ratio_floor", "ratio_ceiling", "min_repayment_months", "status_label", "savings_variant", "effective_from")
VALUES
  (gen_random_uuid(), NULL, 0,   NULL, 'ZERO DEBT, NO CREDIT RISK',                      'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0,    0.1, NULL, 'SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK',       'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.1,  0.2, NULL, 'MANAGEABLE DEBT, LOW CREDIT RISK',               'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.2,  0.3, NULL, 'MANAGEABLE DEBT, MEDIUM CREDIT RISK',            'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.3,  0.4, NULL, 'MATERIAL DEBT IMPACT, FAIR CREDIT RISK',         'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.4,  0.5, NULL, 'MATERIAL DEBT IMPACT, HIGH CREDIT RISK',         'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.5,  0.6, NULL, 'HEAVILY IN DEBT, FAIR CREDIT RISK',              'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.6,  0.7, NULL, 'HEAVILY IN DEBT, HIGH CREDIT RISK',              'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.7,  0.8, NULL, 'VERY HEAVILY IN DEBT, HIGH CREDIT RISK',         'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.8,  0.9, NULL, 'VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK',    'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.9,  1,   NULL, 'DEBT GETTING OUT OF CONTROL, NO SAFETY NET',     'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 1,    NULL,NULL, 'IN A DEBT SPIRAL, AT RISK OF BANKRUPTCY',        'SAVINGS_BELOW_DEBT', DATE '2026-09-09');

-- 3b. Debt-over-NDI — savings ABOVE debt (cushioned; savings-use wording).
INSERT INTO "debt_ratio_bands"
  ("id", "ratio_floor", "ratio_ceiling", "min_repayment_months", "status_label", "savings_variant", "effective_from")
VALUES
  (gen_random_uuid(), NULL, 0,   NULL, 'DEBT CUSHIONED BY SAVINGS, NO CREDIT RISK',                  'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0,    0.1, NULL, 'SMALL DEBT CUSHIONED BY SAVINGS, NEGLIGIBLE SAVINGS USE',    'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.1,  0.2, NULL, 'MANAGEABLE DEBT CUSHIONED BY SAVINGS, LOW SAVINGS USE',      'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.2,  0.3, NULL, 'MANAGEABLE DEBT CUSHIONED BY SAVINGS, MEDIUM SAVINGS USE',   'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.3,  0.4, NULL, 'MANAGEABLE DEBT CUSHIONED BY SAVINGS, FAIR SAVINGS USE',     'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.4,  0.5, NULL, 'MATERIAL DEBT CUSHIONED BY SAVINGS, HIGH SAVINGS USE',       'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.5,  0.6, NULL, 'HEAVILY IN DEBT, USING UP SAVINGS',                          'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.6,  0.7, NULL, 'HEAVILY IN DEBT, USING UP SAVINGS',                          'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.7,  0.8, NULL, 'VERY HEAVILY IN DEBT, SAVINGS DEPLETING',                    'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.8,  0.9, NULL, 'VERY HEAVILY IN DEBT, SAVINGS DEPLETING',                    'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0.9,  1,   NULL, 'DEBT GETTING OUT OF CONTROL, SAVINGS DEPLETING FAST',        'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 1,    NULL,NULL, 'IN A DEBT SPIRAL, SAVINGS DEPLETING FAST',                   'SAVINGS_ABOVE_DEBT', DATE '2026-09-09');

-- 3c. Lifestyle squeeze — savings BELOW debt (7 Sep labels, carried forward).
INSERT INTO "lifestyle_squeeze_bands"
  ("id", "ratio_floor", "ratio_ceiling", "status_label", "savings_variant", "effective_from")
VALUES
  (gen_random_uuid(), NULL, 0,    'IN FINANCIAL SURVIVAL MODE, WARNING DEBT RED FLAG, NO MONEY FOR FEES',        'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0,    40,   'AFFORDABLE, NEGLIGIBLE IMPACT ON LIFESTYLE',                                  'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 40,   50,   'AFFORDABLE, SOME IMPACT ON LIFESTYLE',                                        'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 50,   60,   'FAMILY LIFESTYLE IMPACTED, SOME RESTRICTIONS',                                'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 60,   80,   'IMPORTANT LIFESTYLE SQUEEZE, MAIN SPEND RESTRICTIONS DUE TO FEES',            'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 80,   90,   'VERY HIGH LIFESTYLE SQUEEZE, FEES WILL FEEL LIKE A SACRIFICE',                'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 90,   100,  'SEVERE LIFESTYLE SQUEEZE, LIKELY STRUGGLES AHEAD',                            'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 100,  200,  'LIFESTYLE ONLY MAINTAINED BY INCREASING DEBT, CREDIT RISK FLAG',              'SAVINGS_BELOW_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 200,  NULL, 'LIFESTYLE FRUSTRATINGLY PLAGUED BY UNUSUALLY HIGH LEVEL OF DEBT, HIGH RISK',  'SAVINGS_BELOW_DEBT', DATE '2026-09-09');

-- 3d. Lifestyle squeeze — savings ABOVE debt (same thresholds, savings wording).
INSERT INTO "lifestyle_squeeze_bands"
  ("id", "ratio_floor", "ratio_ceiling", "status_label", "savings_variant", "effective_from")
VALUES
  (gen_random_uuid(), NULL, 0,    'LIFESTYLE FUELLED WITH SAVINGS ONLY OR EXTENDED BORROWING',                                        'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 0,    40,   'AFFORDABLE, NEGLIGIBLE IMPACT ON LIFESTYLE',                                                       'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 40,   50,   'AFFORDABLE, SOME IMPACT ON LIFESTYLE',                                                             'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 50,   60,   'FAMILY LIFESTYLE IMPACTED, SOME RESTRICTIONS',                                                     'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 60,   80,   'IMPORTANT LIFESTYLE SQUEEZE, MAIN SPEND RESTRICTIONS DUE TO FEES',                                 'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 80,   90,   'VERY HIGH LIFESTYLE SQUEEZE, FEES WILL FEEL LIKE A SACRIFICE, USING SAVINGS',                      'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 90,   100,  'SEVERE LIFESTYLE SQUEEZE, LIKELY STRUGGLES AHEAD, INCREASED SAVINGS USE',                          'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 100,  200,  'LIFESTYLE ONLY MAINTAINED BY INCREASED BORROWING OR HIGH SAVINGS USE',                             'SAVINGS_ABOVE_DEBT', DATE '2026-09-09'),
  (gen_random_uuid(), 200,  NULL, 'LIFESTYLE FRUSTRATINGLY PLAGUED BY UNUSUALLY HIGH LEVEL OF DEBT, SAVINGS LIKELY TO DRY UP QUICKLY','SAVINGS_ABOVE_DEBT', DATE '2026-09-09');
