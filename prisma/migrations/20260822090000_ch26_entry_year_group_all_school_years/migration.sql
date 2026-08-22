-- CH-26 (Charlotte, 2026-08-22) — the entry school year must offer every year
-- from Year 6 to Year 13, because an internal bursary request can arrive for a
-- child in ANY school year. The enum previously carried only the four common
-- entry points (Y6/Y7/Y9/Y12) plus OTHER, which forced staff to record a Year 8
-- or Year 10 entrant as "Other" and lost the schooling-years derivation.
--
-- Purely additive: existing values (including OTHER, which is retained for
-- historic rows and genuinely unknown cases) are untouched, so every existing
-- row keeps identical behaviour. `ADD VALUE IF NOT EXISTS` is idempotent and
-- the new values are not referenced in this migration, so it is safe inside
-- the transaction `prisma migrate deploy` wraps it in (PG 12+).
--
-- BEFORE is used so the enum sorts in school order rather than append order —
-- ORDER BY on the enum column then reads Y6, Y7, Y8 … Y13, OTHER.

ALTER TYPE "EntryYearGroup" ADD VALUE IF NOT EXISTS 'Y8' BEFORE 'Y9';
ALTER TYPE "EntryYearGroup" ADD VALUE IF NOT EXISTS 'Y10' BEFORE 'Y12';
ALTER TYPE "EntryYearGroup" ADD VALUE IF NOT EXISTS 'Y11' BEFORE 'Y12';
ALTER TYPE "EntryYearGroup" ADD VALUE IF NOT EXISTS 'Y13' BEFORE 'OTHER';
