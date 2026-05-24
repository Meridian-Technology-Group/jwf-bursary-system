-- Dual-parent (separated/divorced) feature, PR 3 (backlog #20):
-- extend the EmailTemplateType enum with the three secondary-parent template
-- types so staff can invite a second parent, confirm receipt of their data,
-- and send a gentle reminder.
--
-- Must run in its own migration: Postgres requires `ALTER TYPE ... ADD VALUE`
-- to be committed before the new value can be referenced by subsequent DDL/DML
-- in the same transaction. The template-seed INSERTs that use these values
-- live in a SEPARATE, later migration
-- (20260524220200_seed_secondary_parent_templates) so `prisma migrate deploy`
-- does not fail with "unsafe use of new value of enum type". Mirrors
-- 20260524200000_add_missing_docs_responded_enum.
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'SECONDARY_PARENT_INVITE';
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'SECONDARY_PARENT_REMINDER';
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'SECONDARY_PARENT_RECEIVED';
