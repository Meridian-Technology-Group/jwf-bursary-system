-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "assigned_to_id" UUID;

-- CreateIndex
CREATE INDEX "applications_assigned_to_id_idx" ON "applications"("assigned_to_id");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
