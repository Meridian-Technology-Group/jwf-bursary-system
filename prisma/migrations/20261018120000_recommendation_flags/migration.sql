-- 17 Oct 2026 (Charlotte): Inconsistency, Pastoral and Acute Crisis flags on the
-- recommendation, beside Dishonesty and Credit Risk. Additive; existing rows read false.
ALTER TABLE "recommendations" ADD COLUMN "inconsistency_flag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "recommendations" ADD COLUMN "pastoral_flag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "recommendations" ADD COLUMN "acute_crisis_flag" BOOLEAN NOT NULL DEFAULT false;
