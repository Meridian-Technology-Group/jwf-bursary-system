-- Epic 14 B3 (CG-26) — five invitation template variants, part 1 of 2.
-- New enum values only: PostgreSQL refuses to USE an enum value added in the
-- same transaction, so the seed rows live in the follow-up migration.
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'INVITATION_NEW_TS';
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'INVITATION_NEW_WS';
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'INVITATION_INTERNAL_TS';
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'INVITATION_INTERNAL_WS';
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'INVITATION_ROLLING';
