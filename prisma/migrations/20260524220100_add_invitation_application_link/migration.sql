-- Dual-parent (separated/divorced) feature, PR 3 (backlog #20):
-- link an invitation to a specific application so the "add second parent"
-- flow can route the secondary contributor's registration at the right
-- application.
--
-- Design decision — no separate "kind" discriminator column:
--   * applicant (first-year) invite  → application_id NULL, bursary_account_id NULL
--   * re-assessment invite           → application_id NULL, bursary_account_id SET
--   * secondary-parent invite        → application_id SET
-- These three states are mutually distinguishable from existing columns, so
-- `application_id IS NOT NULL` is a sufficient and simpler signal for
-- "secondary parent invite". Forward-only, additive: the column is nullable
-- and every existing (applicant / re-assessment) invitation leaves it NULL.
--
-- ON DELETE CASCADE: if the application is deleted (e.g. GDPR erasure), its
-- secondary-parent invitation is removed with it — the invitation has no
-- meaning without its application.

ALTER TABLE "invitations"
  ADD COLUMN "application_id" uuid;

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "invitations_application_id_idx"
  ON "invitations" ("application_id");
