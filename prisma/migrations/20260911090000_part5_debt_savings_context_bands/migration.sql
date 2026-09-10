-- Charlotte's Part 5 respec, final form (10 Sep 2026): TEN commentary tables.
--
-- Her 8 Sep two-variant split (savings above/below debt) did not survive the
-- zero cases — a household with no debt at all still read "DEBT CUSHIONED BY
-- SAVINGS", and one with no savings read wording about using them up. Her
-- replacement is a 2x2 of contexts, the both-positive cell splitting again on
-- savings versus debt:
--
--                     SAVINGS = 0             SAVINGS > 0
--   DEBT = 0          tables 1 & 2            tables 3 & 4
--   DEBT > 0          tables 5 & 6            tables 7-10
--
-- Five contexts, each with a debt-status and a lifestyle-squeeze table. She
-- confirmed on 9 Sep these "cover all possible situations, they can't be any
-- other".
--
-- The INSERT rows below are GENERATED from prisma/seed-data/profiling-reference.ts
-- rather than transcribed, so the seed and the migration cannot disagree.
-- Regenerate rather than hand-editing.

-- 1. The context discriminator.
CREATE TYPE "DebtSavingsContext" AS ENUM (
  'NO_DEBT_NO_SAVINGS',
  'NO_DEBT_WITH_SAVINGS',
  'DEBT_NO_SAVINGS',
  'DEBT_SAVINGS_BELOW_DEBT',
  'DEBT_SAVINGS_ABOVE_DEBT'
);

ALTER TABLE "debt_ratio_bands"
  ADD COLUMN "debt_savings_context" "DebtSavingsContext" NOT NULL DEFAULT 'DEBT_SAVINGS_BELOW_DEBT';

ALTER TABLE "lifestyle_squeeze_bands"
  ADD COLUMN "debt_savings_context" "DebtSavingsContext" NOT NULL DEFAULT 'DEBT_SAVINGS_BELOW_DEBT';

-- 2. Widen the natural key so the same ceiling exists once per context.
--    (ratio_ceiling is nullable and Postgres treats NULLs as distinct, so the
--    open-ended top row was never covered by this index before or after.)
DROP INDEX "debt_ratio_bands_ratio_ceiling_effective_from_key";
CREATE UNIQUE INDEX "debt_ratio_bands_ceiling_effective_from_context_key"
  ON "debt_ratio_bands"("ratio_ceiling", "effective_from", "debt_savings_context");

DROP INDEX "lifestyle_squeeze_bands_ratio_ceiling_effective_from_key";
CREATE UNIQUE INDEX "lifestyle_squeeze_bands_ceiling_effective_from_context_key"
  ON "lifestyle_squeeze_bands"("ratio_ceiling", "effective_from", "debt_savings_context");

-- 3. Her ten tables, effective 2026-09-11.
INSERT INTO "debt_ratio_bands"
  ("id", "ratio_floor", "ratio_ceiling", "min_repayment_months", "status_label", "debt_savings_context", "effective_from")
VALUES
  (gen_random_uuid(), NULL, 0, NULL, 'ZERO DEBT, NO CREDIT RISK', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0, 0.1, NULL, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.1, 0.2, NULL, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.2, 0.3, NULL, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.3, 0.4, NULL, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.4, 0.5, NULL, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.5, 0.6, NULL, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.6, 0.7, NULL, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.7, 0.8, NULL, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.8, 0.9, NULL, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.9, 1, NULL, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 1, NULL, NULL, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), NULL, 0, NULL, 'ZERO DEBT, NO CREDIT RISK', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0, 0.1, NULL, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.1, 0.2, NULL, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.2, 0.3, NULL, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.3, 0.4, NULL, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.4, 0.5, NULL, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.5, 0.6, NULL, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.6, 0.7, NULL, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.7, 0.8, NULL, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.8, 0.9, NULL, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.9, 1, NULL, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 1, NULL, NULL, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), NULL, 0, NULL, 'n/a', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0, 0.1, NULL, 'SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.1, 0.2, NULL, 'MANAGEABLE DEBT, LOW CREDIT RISK', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.2, 0.3, NULL, 'MANAGEABLE DEBT, MEDIUM CREDIT RISK', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.3, 0.4, NULL, 'MATERIAL DEBT IMPACT, FAIR CREDIT RISK', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.4, 0.5, NULL, 'MATERIAL DEBT IMPACT, HIGH CREDIT RISK', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.5, 0.6, NULL, 'HEAVILY IN DEBT, FAIR CREDIT RISK', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.6, 0.7, NULL, 'HEAVILY IN DEBT, HIGH CREDIT RISK', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.7, 0.8, NULL, 'VERY HEAVILY IN DEBT, HIGH CREDIT RISK', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.8, 0.9, NULL, 'VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0.9, 1, NULL, 'DEBT GETTING OUT OF CONTROL, NO SAFETY NET', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 1, NULL, NULL, 'IN A DEBT SPIRAL, AT RISK OF BANKRUPTCY', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), NULL, 0, NULL, 'ZERO DEBT, NO CREDIT RISK', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0, 0.1, NULL, 'SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.1, 0.2, NULL, 'MANAGEABLE DEBT, LOW CREDIT RISK', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.2, 0.3, NULL, 'MANAGEABLE DEBT, MEDIUM CREDIT RISK', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.3, 0.4, NULL, 'MATERIAL DEBT IMPACT, FAIR CREDIT RISK', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.4, 0.5, NULL, 'MATERIAL DEBT IMPACT, HIGH CREDIT RISK', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.5, 0.6, NULL, 'HEAVILY IN DEBT, FAIR CREDIT RISK', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.6, 0.7, NULL, 'HEAVILY IN DEBT, HIGH CREDIT RISK', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.7, 0.8, NULL, 'VERY HEAVILY IN DEBT, HIGH CREDIT RISK', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.8, 0.9, NULL, 'VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.9, 1, NULL, 'DEBT GETTING OUT OF CONTROL, NO SAFETY NET', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 1, NULL, NULL, 'IN A DEBT SPIRAL, AT RISK OF BANKRUPTCY', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), NULL, 0, NULL, 'DEBT CUSHIONED BY SAVINGS, NO CREDIT RISK', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0, 0.1, NULL, 'SMALL DEBT CUSHIONED BY SAVINGS, NEGLIGIBLE SAVINGS USE', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.1, 0.2, NULL, 'MANAGEABLE DEBT CUSHIONED BY SAVINGS, LOW SAVINGS USE', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.2, 0.3, NULL, 'MANAGEABLE DEBT CUSHIONED BY SAVINGS, MEDIUM SAVINGS USE', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.3, 0.4, NULL, 'MANAGEABLE DEBT CUSHIONED BY SAVINGS, FAIR SAVINGS USE', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.4, 0.5, NULL, 'MATERIAL DEBT CUSHIONED BY SAVINGS, HIGH SAVINGS USE', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.5, 0.6, NULL, 'HEAVILY IN DEBT, USING UP SAVINGS', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.6, 0.7, NULL, 'HEAVILY IN DEBT, USING UP SAVINGS', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.7, 0.8, NULL, 'VERY HEAVILY IN DEBT, SAVINGS DEPLETING', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.8, 0.9, NULL, 'VERY HEAVILY IN DEBT, SAVINGS DEPLETING', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0.9, 1, NULL, 'DEBT GETTING OUT OF CONTROL, SAVINGS DEPLETING FAST', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 1, NULL, NULL, 'IN A DEBT SPIRAL, SAVINGS DEPLETING FAST', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11')

INSERT INTO "lifestyle_squeeze_bands"
  ("id", "ratio_floor", "ratio_ceiling", "status_label", "debt_savings_context", "effective_from")
VALUES
  (gen_random_uuid(), NULL, 0, 'n/a', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0, 40, 'AFFORDABLE, NEGLIGIBLE IMPACT ON LIFESTYLE', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 40, 50, 'AFFORDABLE, SOME IMPACT ON LIFESTYLE', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 50, 60, 'FAMILY LIFESTYLE IMPACTED, SOME RESTRICTIONS', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 60, 80, 'IMPORTANT LIFESTYLE SQUEEZE, MAIN SPEND RESTRICTIONS DUE TO FEES', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 80, 90, 'VERY HIGH LIFESTYLE SQUEEZE, FEES WILL FEEL LIKE A SACRIFICE', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 90, 100, 'SEVERE LIFESTYLE SQUEEZE, LIKELY STRUGGLES AHEAD', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 100, 200, 'LIFESTYLE ONLY MAINTAINED BY STARTING TO BORROW', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 200, NULL, 'LIFESTYLE FORCING HOUSEHOLD TO GET INTO DEBT', 'NO_DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), NULL, 0, 'n/a', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0, 40, 'AFFORDABLE, NEGLIGIBLE IMPACT ON LIFESTYLE', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 40, 50, 'AFFORDABLE, SOME IMPACT ON LIFESTYLE', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 50, 60, 'FAMILY LIFESTYLE IMPACTED, SOME RESTRICTIONS', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 60, 80, 'IMPORTANT LIFESTYLE SQUEEZE, MAIN SPEND RESTRICTIONS DUE TO FEES', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 80, 90, 'VERY HIGH LIFESTYLE SQUEEZE, FEES WILL FEEL LIKE A SACRIFICE', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 90, 100, 'SEVERE LIFESTYLE SQUEEZE, DIPPING INTO SAVINGS', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 100, 200, 'LIFESTYLE ONLY MAINTAINED BY USING UP SAVINGS OR STARTING TO BORROW', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 200, NULL, 'LIFESTYLE FORCING HOUSEHOLD TO GET INTO DEBT ONCE SAVINGS HAVE DEPLETED', 'NO_DEBT_WITH_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), NULL, 0, 'IN FINANCIAL SURVIVAL MODE, DEBT WARNING RED FLAG, NO MONEY FOR FEES', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 0, 40, 'AFFORDABLE, NEGLIGIBLE IMPACT ON LIFESTYLE', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 40, 50, 'AFFORDABLE, SOME IMPACT ON LIFESTYLE', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 50, 60, 'FAMILY LIFESTYLE IMPACTED, SOME RESTRICTIONS', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 60, 80, 'IMPORTANT LIFESTYLE SQUEEZE, MAIN SPEND RESTRICTIONS DUE TO FEES', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 80, 90, 'VERY HIGH LIFESTYLE SQUEEZE, FEES WILL FEEL LIKE A SACRIFICE', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 90, 100, 'SEVERE LIFESTYLE SQUEEZE, LIKELY STRUGGLES AHEAD', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 100, 200, 'LIFESTYLE ONLY MAINTAINED BY INCREASING DEBT, CREDIT RISK FLAG', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), 200, NULL, 'IN FINANCIAL SURVIVAL MODE, DEBT WARNING RED FLAG, NO MONEY FOR FEES', 'DEBT_NO_SAVINGS', DATE '2026-09-11'),
  (gen_random_uuid(), NULL, 0, 'IN FINANCIAL SURVIVAL MODE, DEBT WARNING RED FLAG, NO MONEY FOR FEES', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0, 40, 'AFFORDABLE, NEGLIGIBLE IMPACT ON LIFESTYLE', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 40, 50, 'AFFORDABLE, SOME IMPACT ON LIFESTYLE', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 50, 60, 'FAMILY LIFESTYLE IMPACTED, SOME RESTRICTIONS', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 60, 80, 'IMPORTANT LIFESTYLE SQUEEZE, MAIN SPEND RESTRICTIONS DUE TO FEES', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 80, 90, 'VERY HIGH LIFESTYLE SQUEEZE, FEES WILL FEEL LIKE A SACRIFICE, USING SAVINGS', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 90, 100, 'SEVERE LIFESTYLE SQUEEZE, LIKELY STRUGGLES AHEAD, INCREASED SAVINGS USE', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 100, 200, 'LIFESTYLE ONLY MAINTAINED BY INCREASING DEBT AND USING UP SAVINGS, CREDIT RISK FLAG', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 200, NULL, 'IN FINANCIAL SURVIVAL MODE, DEBT WARNING RED FLAG, NO MONEY FOR FEES', 'DEBT_SAVINGS_BELOW_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), NULL, 0, 'LIFESTYLE FUELLED WITH SAVINGS ONLY OR EXTENDED BORROWING', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 0, 40, 'AFFORDABLE, NEGLIGIBLE IMPACT ON LIFESTYLE', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 40, 50, 'AFFORDABLE, SOME IMPACT ON LIFESTYLE', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 50, 60, 'FAMILY LIFESTYLE IMPACTED, SOME RESTRICTIONS', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 60, 80, 'IMPORTANT LIFESTYLE SQUEEZE, MAIN SPEND RESTRICTIONS DUE TO FEES', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 80, 90, 'VERY HIGH LIFESTYLE SQUEEZE, FEES WILL FEEL LIKE A SACRIFICE, USING SAVINGS', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 90, 100, 'SEVERE LIFESTYLE SQUEEZE, LIKELY STRUGGLES AHEAD, INCREASED SAVINGS USE', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 100, 200, 'LIFESTYLE ONLY MAINTAINED BY INCREASED BORROWING OR HIGH SAVINGS USE', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11'),
  (gen_random_uuid(), 200, NULL, 'LIFESTYLE FRUSTRATINGLY PLAGUED BY UNUSUALLY HIGH LEVEL OF DEBT, SAVINGS LIKELY TO DRY UP QUICKLY', 'DEBT_SAVINGS_ABOVE_DEBT', DATE '2026-09-11')
