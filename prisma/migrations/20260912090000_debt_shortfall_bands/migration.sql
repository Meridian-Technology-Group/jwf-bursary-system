-- Charlotte, 11 Sep 2026 — the debt-status table used INSTEAD of the
-- debt-over-NDI ratio when a household cannot cover its yearly debt repayment
-- out of disposable income.
--
-- Her rule: when NDI after notional spend is below total debt / 5, the ratio
-- "will be displayed but will become irrelevant", and the status comes from
-- the cash shortfall (yearly repayment minus NDI). Her worked example is DW:
-- 8,600 - 5,685 = 2,915, landing on VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK.
--
-- The boundary convention here is floor-INCLUSIVE and ceiling-EXCLUSIVE
-- ("200 <= Value < 500"), the opposite of the ratio ladders. That is how she
-- wrote it and it is deliberate.

CREATE TABLE "debt_shortfall_bands" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "floor_gbp" DECIMAL(10,2),
  "ceiling_gbp" DECIMAL(10,2),
  "status_label" TEXT NOT NULL,
  "effective_from" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "debt_shortfall_bands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "debt_shortfall_bands_ceiling_effective_from_key"
  ON "debt_shortfall_bands"("ceiling_gbp", "effective_from");

INSERT INTO "debt_shortfall_bands" ("id", "floor_gbp", "ceiling_gbp", "status_label", "effective_from")
VALUES
  (gen_random_uuid(), NULL, 200, 'SOME DEBT IMPACT, LIMITED CREDIT RISK', DATE '2026-09-12'),
  (gen_random_uuid(), 200, 500, 'MATERIAL DEBT IMPACT, FAIR CREDIT RISK', DATE '2026-09-12'),
  (gen_random_uuid(), 500, 1000, 'HEAVILY IN DEBT, FAIR CREDIT RISK', DATE '2026-09-12'),
  (gen_random_uuid(), 1000, 2000, 'VERY HEAVILY IN DEBT, HIGH CREDIT RISK', DATE '2026-09-12'),
  (gen_random_uuid(), 2000, 5000, 'VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK', DATE '2026-09-12'),
  (gen_random_uuid(), 5000, 8000, 'DEBT GETTING OUT OF CONTROL, NO SAFETY NET', DATE '2026-09-12'),
  (gen_random_uuid(), 8000, NULL, 'IN A DEBT SPIRAL, AT RISK OF BANKRUPTCY', DATE '2026-09-12');
