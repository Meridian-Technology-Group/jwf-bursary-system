-- CH-54 (Epic 17) — a twelfth income category, per Charlotte on 25 Aug 2026:
-- "could you add an extra income category from £120K to £140K category 11, and
-- above £140K net : category 12?"
--
-- The open-ended top band (£120,000+, category 11) is split in two:
--   £120,000 – £140,000  → category 11
--   above £140,000       → category 12
--
-- fees_benchmark_pct stays at 30 for both; she asked for bands, not new
-- percentages. Idempotent: the UPDATE is a no-op once the ceiling is set, and
-- the INSERT is guarded.

UPDATE "income_category_bands"
   SET "band_ceiling" = 140000, "category" = 11
 WHERE "band_floor" = 120000
   AND "band_ceiling" IS NULL;

INSERT INTO "income_category_bands"
  ("id", "band_floor", "band_ceiling", "category", "fees_benchmark_pct", "effective_from")
SELECT gen_random_uuid(), 140000, NULL, 12, 30,
       (SELECT MIN("effective_from") FROM "income_category_bands")
 WHERE NOT EXISTS (
   SELECT 1 FROM "income_category_bands" WHERE "band_floor" = 140000
 );
