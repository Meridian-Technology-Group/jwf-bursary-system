-- Epic 18b (Charlotte's 6 Sep 2026 illustration) — the rolling-over track's
-- lock, the per-award fund type, and the archive close reason.

-- 1. The rolled-over lock state ("Locked as ROLLED-OVER award").
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'ROLLED_OVER';

-- 2. Which fund pays the award, chosen at the lock; per assessment year.
CREATE TYPE "AwardFundType" AS ENUM ('JWF', 'WSP_JWF', 'WFA', 'TBF');

ALTER TABLE "assessments" ADD COLUMN "award_fund_type" "AwardFundType";

-- 3. Why a CLOSED_ARCHIVED assessment was closed (her "prompt asking for
--    close reasons").
ALTER TABLE "assessments" ADD COLUMN "archive_close_reason_id" UUID;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_archive_close_reason_id_fkey"
  FOREIGN KEY ("archive_close_reason_id") REFERENCES "close_reasons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
