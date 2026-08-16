-- Epic 14 C8 (CG-24, LA-7) — manual pre-system YoY history rows on the
-- bursary account. Additive + nullable JSONB; no new table, no RLS work.
-- IF NOT EXISTS because the column is pre-applied to nonprod for the C8
-- browser pass; migrate deploy then records it cleanly.
ALTER TABLE "public"."bursary_accounts"
  ADD COLUMN IF NOT EXISTS "pre_system_history" JSONB;
