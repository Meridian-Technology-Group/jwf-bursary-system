-- Charlotte's 7 Oct 2026 batch 4 ("Batch 4 - 22 records with a gap of £20,000
-- or higher", 16:33 UTC): two more gap codes, one in Pastoral Leniency and one
-- in Contextual. Purely additive in code space (118, 119); recommendations
-- link to gap_reasons by uuid, so no stored link changes.
--
-- Her groups are kept together in display order, so the Ukraine code takes
-- display 7 and everything after it moves down one place:
--
--   display  code  label
--   4–6      104–106  (Pastoral Leniency, unchanged)
--   7        119   Pastoral Exceptional Leniency - Ukraine or war refugee scheme (NEW)
--   8–11     107, 108, 109, 112  (Internal Bursary Bias)
--   12–18    110, 111, 113, 114, 115, 116, 117  (Contextual)
--   19       118   Household at a financial crossroads for the better- award at risk (NEW)
--
-- Labels are her exact text: the migration matches gap codes by label.

-- 1. The two new codes.
INSERT INTO "gap_reasons" ("id", "code", "label", "is_deprecated", "sort_order")
VALUES
  (gen_random_uuid(), 118, 'Household at a financial crossroads for the better- award at risk', false, 19),
  (gen_random_uuid(), 119, 'Pastoral Exceptional Leniency - Ukraine or war refugee scheme', false, 7)
ON CONFLICT ("code") DO UPDATE
  SET "label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order", "is_deprecated" = false;

-- 2. Move the codes after display 6 down one place.
UPDATE "gap_reasons" SET "sort_order" = 8  WHERE "code" = 107;
UPDATE "gap_reasons" SET "sort_order" = 9  WHERE "code" = 108;
UPDATE "gap_reasons" SET "sort_order" = 10 WHERE "code" = 109;
UPDATE "gap_reasons" SET "sort_order" = 11 WHERE "code" = 112;
UPDATE "gap_reasons" SET "sort_order" = 12 WHERE "code" = 110;
UPDATE "gap_reasons" SET "sort_order" = 13 WHERE "code" = 111;
UPDATE "gap_reasons" SET "sort_order" = 14 WHERE "code" = 113;
UPDATE "gap_reasons" SET "sort_order" = 15 WHERE "code" = 114;
UPDATE "gap_reasons" SET "sort_order" = 16 WHERE "code" = 115;
UPDATE "gap_reasons" SET "sort_order" = 17 WHERE "code" = 116;
UPDATE "gap_reasons" SET "sort_order" = 18 WHERE "code" = 117;
