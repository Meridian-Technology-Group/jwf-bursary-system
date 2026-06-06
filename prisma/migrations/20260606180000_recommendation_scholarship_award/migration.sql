-- Epic 08 (Decision D9) — distinct £ scholarship award on the recommendation.
--
-- Additive + nullable: existing recommendations backfill to NULL (no scholarship
-- award recorded). The 0–100 Assessment.scholarshipPct remains the
-- fee-calculation lever; this column records the merit/academic scholarship as a
-- real £ figure alongside the means-tested bursary_award, which the rolling
-- BursaryAccount carries forward (Epic 10). No data migration required.
ALTER TABLE "recommendations"
  ADD COLUMN "scholarship_award" DECIMAL(10,2);
