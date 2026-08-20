-- Epic 15 X1 (CI-02) — sent-emails log.
--
-- The system had NO email persistence (sends were console/Sentry events
-- only); Charlotte cannot see what has been sent. New append-style table
-- written best-effort by the three senders from this migration onward — no
-- backfill exists or is possible. RLS policies ship IN THIS MIGRATION
-- (ensure_rls force-enables RLS on every new table). Idempotent (guarded
-- CREATEs) because the objects are pre-applied to nonprod for the browser
-- pass; migrate deploy then records the migration cleanly.

DO $$ BEGIN
  CREATE TYPE "EmailLogStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "public"."email_log" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "to_email" TEXT NOT NULL,
  "template_type" "EmailTemplateType",
  "subject" TEXT NOT NULL,
  "status" "EmailLogStatus" NOT NULL,
  "error" TEXT,
  "resend_id" TEXT,
  CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_log_to_email_idx" ON "public"."email_log"("to_email");
CREATE INDEX IF NOT EXISTS "email_log_created_at_idx" ON "public"."email_log"("created_at");

-- ── RLS (same PR as the table) ──────────────────────────────────────────────
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Staff read the log; only the server (admin context) writes it. No UPDATE/
-- DELETE policy — the log is append-only at the app layer.
DROP POLICY IF EXISTS email_log_select ON public.email_log;
CREATE POLICY email_log_select ON public.email_log
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

DROP POLICY IF EXISTS email_log_insert ON public.email_log;
CREATE POLICY email_log_insert ON public.email_log
  FOR INSERT TO app_user
  WITH CHECK (public.is_admin());
