-- Contact register: add a parent "title" (Mr/Mrs/…) and split the child name
-- into title / first name / surname. `child_name` is retained as the derived
-- single-string backing store (first + surname) that existing consumers
-- (invitations, applications, email merge fields) continue to read.

ALTER TABLE "contacts" ADD COLUMN "title" TEXT;
ALTER TABLE "contacts" ADD COLUMN "child_title" TEXT;
ALTER TABLE "contacts" ADD COLUMN "child_first_name" TEXT;
ALTER TABLE "contacts" ADD COLUMN "child_last_name" TEXT;

-- Backfill the split fields from the existing single `child_name`. The last
-- whitespace-delimited token becomes the surname; everything before it the
-- first name. A single-token name leaves first name NULL and surname = token.
UPDATE "contacts"
SET
  "child_last_name" = regexp_replace(btrim("child_name"), '^.*\s+(\S+)$', '\1'),
  "child_first_name" = CASE
    WHEN btrim("child_name") ~ '\s'
      THEN regexp_replace(btrim("child_name"), '\s+\S+$', '')
    ELSE NULL
  END
WHERE "child_name" IS NOT NULL AND btrim("child_name") <> '';
