-- Adds the school entry year-group (spec §4) as a first-class column on both
-- the per-round application and the persistent bursary account.
--
-- `entry_year_group` is the source of truth for schooling-years calculations
-- (Y6→7, Y7→6, Y9→4, Y12→1 total years; OTHER = manual). The existing
-- `entry_year` Int column is retained as the entry *calendar* year, which —
-- together with the year-group — lets the engine derive both "years remaining"
-- and the child's current year-group over time.
--
-- Nullable + additive: no backfill required (zero applications/accounts in prod).

-- CreateEnum
CREATE TYPE "EntryYearGroup" AS ENUM ('Y6', 'Y7', 'Y9', 'Y12', 'OTHER');

-- AlterTable
ALTER TABLE "bursary_accounts" ADD COLUMN "entry_year_group" "EntryYearGroup";

-- AlterTable
ALTER TABLE "applications" ADD COLUMN "entry_year_group" "EntryYearGroup";
