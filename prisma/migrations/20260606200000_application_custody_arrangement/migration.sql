-- Epic 09 (Decision D15): shared-custody arrangement on Application.
--
-- ADDITIVE + BACKFILLED. A brand-new enum type (CREATE TYPE) plus a NOT NULL
-- column with a constant DEFAULT 'SOLE'. CREATE TYPE for a NEW enum is safe in
-- the same migration as its first use — the Postgres "ADD VALUE cannot run in a
-- transaction block" restriction applies only to ALTER TYPE ... ADD VALUE on an
-- EXISTING enum, not to creating a fresh one. The column add is a metadata-only
-- operation in PG 11+ (constant default), so it does not rewrite the table.
-- Existing rows take 'SOLE', which the rules engine treats exactly as today's
-- single-/two-resident-parent behaviour (no behaviour change for any current
-- application).

-- CreateEnum
CREATE TYPE "CustodyArrangement" AS ENUM ('SOLE', 'SHARED_5050', 'SHARED_MAIN_LIMITED');

-- AlterTable
ALTER TABLE "applications"
  ADD COLUMN "custody_arrangement" "CustodyArrangement" NOT NULL DEFAULT 'SOLE';
