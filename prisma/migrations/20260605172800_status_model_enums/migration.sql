-- Epic 01 (Status & workflow model) — PR-1, part 1 of 2: ENUMS ONLY.
--
-- Splits the conflated ApplicationStatus lifecycle into three independent
-- lifecycles (form / assessment / outcome). This migration only touches enum
-- types; the column additions that REFERENCE these enums live in the next,
-- separately-committed migration (20260605172900_status_model_columns).
--
-- WHY SPLIT: Postgres forbids USING a value added via `ALTER TYPE ... ADD VALUE`
-- within the same transaction in which it was added. `prisma migrate deploy`
-- wraps each migration file in a single transaction. By isolating every enum
-- mutation in this migration, the new AssessmentStatus / AssessmentOutcome
-- values are committed before any later DDL/DML references them. This mirrors
-- the project convention in 20260524200000_add_missing_docs_responded_enum and
-- 20260513184725_add_staff_invitation_enum.
--
-- This migration is purely ADDITIVE: it creates two new enum types and appends
-- values to two existing ones. Nothing existing is renamed or dropped. The
-- deprecated ApplicationStatus enum and the existing
-- QUALIFIES / DOES_NOT_QUALIFY outcome values are intentionally retained; they
-- are backfilled/retired in later Epic 01 PRs.

-- CreateEnum
CREATE TYPE "ApplicationFormStatus" AS ENUM ('CREATED', 'NOT_STARTED', 'IN_PROGRESS', 'FILLED_IN', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('NEW', 'ROLLING_OVER');

-- AlterEnum: add IN_PROGRESS to the assessment lifecycle.
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

-- AlterEnum: extend the binary outcome to the three-value outcome lifecycle.
-- (QUALIFIES / DOES_NOT_QUALIFY are kept for now and retired in a later PR.)
ALTER TYPE "AssessmentOutcome" ADD VALUE IF NOT EXISTS 'QUALIFIES_NOT_AWARDED';
ALTER TYPE "AssessmentOutcome" ADD VALUE IF NOT EXISTS 'AWARDED';
