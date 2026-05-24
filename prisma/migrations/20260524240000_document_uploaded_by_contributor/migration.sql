-- =============================================================================
-- JWF Bursary System — Document → uploading-contributor anchor
-- =============================================================================
-- Backlog #20 (dual-parent-separated-bursary-application), PR 4b of the epic.
-- See docs/engineering/dual-parent-implementation-plan.md.
--
-- Adds a STABLE anchor for "which contributor uploaded this document" so the
-- document route handlers (the real enforcement layer — storage RLS is only a
-- backstop) can decide cross-contributor access by a direct equality check
-- instead of re-deriving the uploader's contributor role at access time. The
-- PR 2 security audit flagged that re-derivation as fragile (a profile's
-- contributor role on an application could in principle change), so we record
-- the owning contributor explicitly at upload time.
--
-- Purely ADDITIVE / forward-only:
--   a. Add nullable column documents.uploaded_by_contributor_id (FK →
--      application_contributors.id, ON DELETE SET NULL).
--   b. Backfill every existing document to its application's PRIMARY contributor
--      (all pre-existing documents were uploaded by the lead applicant).
--   c. Index it for the route-handler lookups.
--
-- The column stays NULLABLE: a NULL means "legacy / unknown uploader", which the
-- route handlers treat as PRIMARY-owned (the safe default — only the lead
-- applicant, assessor, admin, viewer can reach a NULL-contributor document; the
-- secondary's branch requires an exact contributor match). New writes always set
-- it, so NULLs only ever describe rows created before this migration.
--
-- INERT for the existing single-parent flow: a document owned by the PRIMARY
-- contributor is visible to exactly the same parties as before.
-- =============================================================================


-- ─── a. Add the column ───────────────────────────────────────────────────────

ALTER TABLE "documents"
  ADD COLUMN "uploaded_by_contributor_id" UUID;


-- ─── b. Backfill: existing documents → their application's PRIMARY contributor ─

UPDATE "documents" d
SET "uploaded_by_contributor_id" = c."id"
FROM "application_contributors" c
WHERE c."application_id" = d."application_id"
  AND c."role" = 'PRIMARY'
  AND d."uploaded_by_contributor_id" IS NULL;


-- ─── c. FK + index ───────────────────────────────────────────────────────────
-- ON DELETE SET NULL: removing a contributor (e.g. GDPR cascade in PR 6) leaves
-- the document row intact but un-anchored; the route handlers degrade to the
-- safe PRIMARY-owned default. The document's own deletion is handled by the
-- separate GDPR document cascade, not by this FK.

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_uploaded_by_contributor_id_fkey"
    FOREIGN KEY ("uploaded_by_contributor_id") REFERENCES "application_contributors"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "documents_uploaded_by_contributor_id_idx"
  ON "documents" ("uploaded_by_contributor_id");
