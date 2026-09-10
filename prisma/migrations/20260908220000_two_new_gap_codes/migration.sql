-- Charlotte's 8 Sep 2026 addition ("two new gap codes"): her gap list grows
-- from 11 to 13. Purely additive — no existing code is renumbered, because
-- recommendations link to gap_reasons by uuid and `code` is unique.
--
-- Her display numbering is therefore NOT `code − 100` any more:
--
--   display  code  label
--   7        107   Internal Bursary Bias - Bereavement
--   8        108   Internal Bursary Bias - Severe Illness
--   9        109   Internal Bursary Bias - Family crippled with debt, top pupil
--   10       112   Internal Bursary Bias - Acrimonious Separation      (NEW)
--   11       110   Affordability Adjusted Calculation Preferred
--   12       111   Theoretical Benchmark Calculation Preferred
--   13       113   Immaterial gap, less than £100                      (NEW)
--
-- `sort_order` carries her display order (it is what getGapReasons orders by);
-- the code → group mapping lives in src/lib/reason-codes/gap-category.ts and
-- is now explicit membership rather than a numeric range, since her groups are
-- no longer contiguous in code space.

-- 1. The two new codes.
INSERT INTO "gap_reasons" ("id", "code", "label", "is_deprecated", "sort_order")
VALUES
  (gen_random_uuid(), 112, 'Internal Bursary Bias - Acrimonious Separation', false, 10),
  (gen_random_uuid(), 113, 'Immaterial gap, less than £100', false, 13)
ON CONFLICT ("code") DO UPDATE
  SET "label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order", "is_deprecated" = false;

-- 2. Shift the two Contextual codes down one place each to make room for
--    Acrimonious Separation at display position 10.
UPDATE "gap_reasons" SET "sort_order" = 11 WHERE "code" = 110;
UPDATE "gap_reasons" SET "sort_order" = 12 WHERE "code" = 111;
