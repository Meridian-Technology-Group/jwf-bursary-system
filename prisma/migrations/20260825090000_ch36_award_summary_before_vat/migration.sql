-- CH-36 (Epic 17 Lane 0, Charlotte's award-summary spec of 24 Aug 2026) —
-- the award summary is now computed entirely BEFORE VAT, with VAT applied
-- once at the end to the payable line, which is the only figure the parent
-- pays. This closes decision D8 and overturns ASSUMPTION(CALC-A5).
--
-- Consequence for storage: `scholarship_value_incl_vat` no longer describes
-- what the screen derives (a before-VAT scholarship spend), so a correctly
-- named column replaces it rather than quietly changing its meaning. Her
-- words: "we will never need to store the bursary award inclusive of VAT".
--
--   * scholarship_spend_before_vat  — NEW. autofill 4 = fees x scholarship%.
--   * net_fees_before_vat           — NEW. autofill 2 = fees - scholarship
--                                     spend - bursary award, floored at GBP 0.
--   * scholarship_value_incl_vat    — RETAINED, no longer written. Kept for
--                                     now (additive discipline); a later
--                                     gated migration drops it.
--   * bursary_spend_before_vat      — RETAINED and still written; under the
--                                     new model the assessor-entered bursary
--                                     award IS the before-VAT spend, so the
--                                     column name is already correct.
--
-- Both additive + nullable, so every existing row is untouched. Production
-- holds 0 recommendations at the time of writing, so nothing is reinterpreted
-- there; non-production rows keep their old `scholarship_value_incl_vat`
-- values, which are simply no longer read by the v2 surface.

ALTER TABLE "recommendations"
  ADD COLUMN IF NOT EXISTS "scholarship_spend_before_vat" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "net_fees_before_vat" DECIMAL(10,2);
