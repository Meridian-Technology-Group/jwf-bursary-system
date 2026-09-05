-- Savings-test respec (Charlotte, 5 Sep 2026): the SAVINGS_CUSHION now feeds
-- the savings test directly (it was display-only), so she raised the values
-- for every family category. A NEW generation (effective_from 2026-09-06) —
-- the 2026-09-01 rows are history, not edited. Mirrors
-- prisma/seed-data/profiling-reference.ts `savingsCushionRespecConfigs`
-- (keep the two in sync). ON CONFLICT keeps this re-runnable alongside the
-- idempotent reference seed, which upserts the same (category, cost_type,
-- effective_from) rows.
INSERT INTO "notional_cost_configs" ("id", "category", "cost_type", "amount", "effective_from")
VALUES
  (gen_random_uuid(), 1, 'SAVINGS_CUSHION', 37000, DATE '2026-09-06'),
  (gen_random_uuid(), 2, 'SAVINGS_CUSHION', 39000, DATE '2026-09-06'),
  (gen_random_uuid(), 3, 'SAVINGS_CUSHION', 41000, DATE '2026-09-06'),
  (gen_random_uuid(), 4, 'SAVINGS_CUSHION', 43000, DATE '2026-09-06'),
  (gen_random_uuid(), 5, 'SAVINGS_CUSHION', 45000, DATE '2026-09-06'),
  (gen_random_uuid(), 6, 'SAVINGS_CUSHION', 47000, DATE '2026-09-06')
ON CONFLICT ("category", "cost_type", "effective_from") DO UPDATE SET "amount" = EXCLUDED."amount";
