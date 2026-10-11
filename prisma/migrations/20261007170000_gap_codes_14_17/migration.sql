-- Charlotte's 7 Oct 2026 addition ("One new code to add to Gap Reasons", final
-- version 15:09 UTC): four new Contextual gap codes, display 14–17. Purely
-- additive, appended after 113 so no existing code is renumbered.
--
--   display  code  label
--   14       114   Additional wealth outside the scope of direct family
--   15       115   SE income partially or not declared to HMRC
--   16       116   Using cash injections from business in a questionable way
--   17       117   Multiple cash deposits seemingly undeclared
--
-- The code → group mapping lives in src/lib/reason-codes/gap-category.ts.

INSERT INTO "gap_reasons" ("id", "code", "label", "is_deprecated", "sort_order")
VALUES
  (gen_random_uuid(), 114, 'Additional wealth outside the scope of direct family', false, 14),
  (gen_random_uuid(), 115, 'SE income partially or not declared to HMRC', false, 15),
  (gen_random_uuid(), 116, 'Using cash injections from business in a questionable way', false, 16),
  (gen_random_uuid(), 117, 'Multiple cash deposits seemingly undeclared', false, 17)
ON CONFLICT ("code") DO UPDATE
  SET "label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order", "is_deprecated" = false;
