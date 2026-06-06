-- Epic 01 PR-6b — drop the deprecated fused `applications.status` column + enum.
--
-- PR-6a (already live on staging) removed every reader/writer of the fused
-- `applications.status` column: the central status service stopped dual-writing
-- it, all readers moved to the lifecycle columns (`form_status`,
-- `assessments.status`, `assessments.outcome`), and the grep-gate is clean.
-- Residual `assessments.outcome = 'QUALIFIES'` rows were remapped in migration
-- 20260606220000_remap_residual_qualifies_outcome (0 remain on nonprod), so the
-- `ApplicationStatus` enum is now used by nothing but this one column.
--
-- The `(round_id, status)` index moves to `(round_id, form_status)` so the
-- round-scoped queue/cockpit access pattern keeps its index on the authoritative
-- form lifecycle. The whole migration is one implicit transaction (Prisma wraps
-- each migration in BEGIN/COMMIT), so it applies atomically.

-- DropIndex (the fused (round_id, status) index; would also cascade with the
-- column drop, but we drop it explicitly to match the schema diff).
DROP INDEX "applications_round_id_status_idx";

-- AlterTable: remove the deprecated fused column.
ALTER TABLE "applications" DROP COLUMN "status";

-- DropEnum: the type is now referenced by no column.
DROP TYPE "ApplicationStatus";

-- CreateIndex: round-scoped index on the authoritative form lifecycle.
CREATE INDEX "applications_round_id_form_status_idx" ON "applications"("round_id", "form_status");
