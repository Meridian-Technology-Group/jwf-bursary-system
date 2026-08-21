-- Epic 14 C4 (CG-22, field-map LA-8 №2) — the workbook's three sibling rows
-- need somewhere to live: [{ name, school, netPayableFees }] per assessment.
-- Additive + nullable; no new table, so no RLS work (assessments policies
-- already cover it). IF NOT EXISTS because the column is pre-applied to
-- nonprod for the C4 browser pass; migrate deploy then records it cleanly.
ALTER TABLE "public"."assessments"
  ADD COLUMN IF NOT EXISTS "sibling_details" JSONB;
