-- CH-21/22 (Epic 15 M4 follow-up, Brian-approved engine change) — assessor's
-- manual £ overrides on two notional-spend lines:
--   * rent_add_back_override  — overrides the C57 rent add-back (the 4-option
--     dropdown stays and supplies the value whenever the override is NULL).
--   * council_tax_override    — overrides the C59 annual council-tax deduct
--     (NULL = the reference-band default; the C60 support add-back recharges
--     the same effective figure).
-- Both additive + nullable: every existing row keeps byte-identical engine
-- behaviour (NULL = no override). Idempotent guards per migration discipline.

ALTER TABLE "assessments"
  ADD COLUMN IF NOT EXISTS "rent_add_back_override" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "council_tax_override" DECIMAL(10,2);
