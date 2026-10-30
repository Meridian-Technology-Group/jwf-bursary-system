-- 21 Oct 2026 (Charlotte): a seventh recommendation flag, High Frugality — a
-- family living below the bare essentials rather than claiming the support it
-- could get. Additive; existing rows read false.
ALTER TABLE "recommendations" ADD COLUMN "high_frugality_flag" BOOLEAN NOT NULL DEFAULT false;
