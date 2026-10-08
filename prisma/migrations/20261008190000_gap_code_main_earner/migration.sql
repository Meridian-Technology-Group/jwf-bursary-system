-- Charlotte's 8 Oct 2026 email ("New gap code", 18:04 UTC): one more gap code,
-- in Internal Bursary Bias. Purely additive in code space (120);
-- recommendations link to gap_reasons by uuid, so no stored link changes.
--
-- It takes display 12, at the end of its group, so the Contextual codes move
-- down one place:
--
--   display  code  label
--   8–11     107, 108, 109, 112  (Internal Bursary Bias, unchanged)
--   12       120   Internal Bursary Bias - Main Earner losing income source (NEW)
--   13–20    110, 111, 113, 114, 115, 116, 117, 118  (Contextual)
--
-- The label is her exact text: the migration matches gap codes by label.

-- 1. The new code.
INSERT INTO "gap_reasons" ("id", "code", "label", "is_deprecated", "sort_order")
VALUES
  (gen_random_uuid(), 120, 'Internal Bursary Bias - Main Earner losing income source', false, 12)
ON CONFLICT ("code") DO UPDATE
  SET "label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order", "is_deprecated" = false;

-- 2. Move the Contextual codes down one place.
UPDATE "gap_reasons" SET "sort_order" = 13 WHERE "code" = 110;
UPDATE "gap_reasons" SET "sort_order" = 14 WHERE "code" = 111;
UPDATE "gap_reasons" SET "sort_order" = 15 WHERE "code" = 113;
UPDATE "gap_reasons" SET "sort_order" = 16 WHERE "code" = 114;
UPDATE "gap_reasons" SET "sort_order" = 17 WHERE "code" = 115;
UPDATE "gap_reasons" SET "sort_order" = 18 WHERE "code" = 116;
UPDATE "gap_reasons" SET "sort_order" = 19 WHERE "code" = 117;
UPDATE "gap_reasons" SET "sort_order" = 20 WHERE "code" = 118;
