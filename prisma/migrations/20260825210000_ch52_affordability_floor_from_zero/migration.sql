-- CH-52 (Epic 17 Tranche B) — Charlotte confirmed on 25 Aug 2026 that the
-- affordability grid's 0% applies "for an income from £0 to £29,000". The
-- bottom band started at £27,001 and the code covered £0–£27,000 with a
-- hard-coded shortcut instead.
--
-- Dropping the floor to 0 makes the table SAY what the system already does,
-- rather than leaving £0–£27,000 to a hard-coded shortcut in the engine. This
-- is deliberately documentary: behaviour is unchanged at the bottom, because
-- £0–£27,000 already resolved to £0 via that shortcut and £27,001–£29,000
-- already sat in this band at 0%. The shortcut is kept, so no displayed figure
-- moves.
--
-- Noted while doing this, NOT changed here: the leg applies
-- `basePct − 0.5 × (category − 1)`, which goes negative in the low bands for a
-- larger family (£28,000 at category 5 gives −2%, i.e. −£560). That is
-- intentional — `recommendedPayableFees` floors the min-of-three at £0 — but the
-- three legs are shown to the assessor, so a negative leg is visible. Changing
-- it would alter a figure Charlotte has signed off and is not part of CH-52.
--
-- Data-only and idempotent.

UPDATE "affordability_bands"
   SET "band_floor" = 0
 WHERE "band_ceiling" = 29000
   AND "band_floor" = 27001;
