-- CH-43 (Epic 17 Tranche C) — Charlotte's postcode district → area lookup.
--
-- Her ask (24 Aug 2026): "could there be a field at the top of the assessment
-- for the assessor to enter the first part of the post code and when this is
-- entered, for the value returned at this level to be the combination of the
-- first part of the post code + area. So for instance, the assessor types :
-- SM4, and the field within the summary view below reports : SM4-MORDEN."
--
-- Two additive changes:
--   * postcode_areas   — NEW reference table, seeded from her spreadsheet
--                        (94 districts). Her sheet's trailing "*** | OTHER" row
--                        is the FALLBACK rather than a district, so it is not a
--                        row here; resolvePostcodeArea returns "OTHER" for
--                        anything unlisted.
--   * assessments.postcode — NEW nullable text column. Free text, deliberately
--                        NOT constrained to postcode_areas: her list is Croydon
--                        and its surrounds, so an applicant from further afield
--                        must still save.
--
-- RLS is MANDATORY on a new public table here: the `ensure_rls` event trigger
-- force-enables RLS on creation, so a table shipped without policies reads
-- EMPTY app-wide. Policies mirror the other reference tables
-- (cf. affordability_bands): staff read, ADMIN writes.

CREATE TABLE IF NOT EXISTS "postcode_areas" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "district"   TEXT NOT NULL,
  "area"       TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "postcode_areas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "postcode_areas_district_key"
  ON "postcode_areas" ("district");

ALTER TABLE "postcode_areas" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "postcode_areas_select" ON "postcode_areas";
CREATE POLICY "postcode_areas_select" ON "postcode_areas"
  FOR SELECT TO app_user
  USING (is_admin_or_viewer() OR current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS "postcode_areas_modify" ON "postcode_areas";
CREATE POLICY "postcode_areas_modify" ON "postcode_areas"
  FOR ALL TO app_user
  USING (is_admin());

ALTER TABLE "assessments"
  ADD COLUMN IF NOT EXISTS "postcode" TEXT;
