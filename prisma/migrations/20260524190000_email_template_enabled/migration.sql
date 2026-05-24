-- Backlog #12 (admin-email-event-toggles): add a per-template enable/disable
-- flag so admins can suppress specific event-based emails (e.g. OUTCOME_DNQ)
-- without a code change. The single send chokepoint (src/lib/email/send.ts)
-- short-circuits to a success-shaped no-op when `enabled` is false.
--
-- DEFAULT true is deliberate: every existing row keeps sending, preserving
-- current behaviour. INVITATION / INVITE_STAFF remain non-disableable at the
-- application layer (LOCKED_EMAIL_TEMPLATE_TYPES), not via a DB constraint.

-- AlterTable
ALTER TABLE "public"."email_templates" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
