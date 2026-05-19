-- Extend the EmailTemplateType enum with INVITE_STAFF.
--
-- Must run in its own migration because Postgres requires
-- `ALTER TYPE ... ADD VALUE` to be committed before the new value can be
-- referenced by subsequent DDL in the same transaction. Splitting this
-- into its own file lets the table-creation migration that follows
-- reference 'INVITE_STAFF' safely.
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'INVITE_STAFF';
