-- S18 (Charlotte, 19 Sep 2026): two new year-on-year reason codes,
-- 27 "Major change in income" and 35 "Major change in assets". Her existing
-- 27–41 renumber to 28–43; gap codes are unchanged.
--
-- Every existing DB `code` stays where it is, so nothing already recorded
-- against a reason code moves: only the display number inside the label and
-- the `sort_order` change. Each row keeps its group (category.ts buckets by DB
-- code). The two new rows take the next free codes, 242 and 243. Mirrors
-- prisma/seed-data/reason-codes.ts; explicit values keep this re-runnable
-- alongside the idempotent reference seed.

-- 1. Relabel the 15 rows whose display number shifts.
UPDATE "reason_codes" AS rc
SET "label" = v.label, "sort_order" = v.sort_order
FROM (VALUES
  (227, '28 - Mortgage now fully paid', 28),
  (228, '29 - New property asset acquired', 29),
  (229, '30 - Property asset has increased in value', 30),
  (230, '31 - Property asset sold', 31),
  (231, '32 - Additional asset not disclosed last year', 32),
  (232, '33 - Re-mortgage agreement', 33),
  (233, '34 - Change in accommodation arrangements', 34),
  (234, '36 - Failure to meet the deadline', 36),
  (235, '37 - Out of date documents used last year', 37),
  (236, '38 - Forged or tampered with documents', 38),
  (237, '39 - Failure to provide required documents', 39),
  (238, '40 - Reduced Payable fees due to new scholarship offer', 40),
  (239, '41 - Out of sync due to Internal/ Pastoral Bursary', 41),
  (240, '42 - Sibling on full/partial fees taking up most or all of NDI', 42),
  (241, '43 - Other', 43)
) AS v(code, label, sort_order)
WHERE rc."code" = v.code;

-- 2. The two new codes.
INSERT INTO "reason_codes" ("id", "code", "label", "is_deprecated", "sort_order")
VALUES
  (gen_random_uuid(), 242, '27 - Major change in income', false, 27),
  (gen_random_uuid(), 243, '35 - Major change in assets', false, 35)
ON CONFLICT ("code") DO UPDATE SET "label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order";
