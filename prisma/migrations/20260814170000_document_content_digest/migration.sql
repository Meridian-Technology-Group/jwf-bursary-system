-- =============================================================================
-- JWF Bursary System — document content digest (Epic 13, D2 / CF-28)
-- =============================================================================
-- Charlotte received applications where the SAME Universal Credit PDF had been
-- uploaded for all three "monthly payment" slots. D2 makes the form require 3
-- monthly documents + the 12-month statement; this column is what lets the
-- server tell three DIFFERENT files from one file uploaded three times.
--
-- `content_digest` is a hex sha-256 fingerprint of the stored object, computed
-- server-side in POST /api/documents/confirm from the bytes that leg already
-- reads for the magic-byte sniff (docs/security-audit.md §2.10) — no second
-- download. See src/lib/documents/content-digest.ts for exactly what is hashed.
--
-- Additive + nullable + NO backfill: every existing row keeps NULL, and NULL is
-- read as "unknown, not a match", so historical documents simply opt out of
-- duplicate detection rather than being flagged against each other. The staff
-- multipart upload path also leaves it NULL for now.
--
-- The index supports the only query shape there is: "does this application
-- already hold this digest?" — always applicationId + digest, never digest
-- alone (a fingerprint must never be able to link two families' uploads).
--
-- No RLS work is needed: `documents` already has its policies and this adds a
-- column to an existing table, not a new table.
--
-- CI applies this on merge to staging (.github/workflows/db-push.yml).
-- =============================================================================

ALTER TABLE "documents"
  ADD COLUMN "content_digest" TEXT;

CREATE INDEX "documents_application_id_content_digest_idx"
  ON "documents" ("application_id", "content_digest");
