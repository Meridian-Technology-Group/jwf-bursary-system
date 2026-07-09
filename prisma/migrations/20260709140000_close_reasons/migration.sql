-- =============================================================================
-- JWF Bursary System — close_reasons reference table (item 4.3, Story 4.3)
-- =============================================================================
-- Plan: docs/backlog/stories/04-close-reason-dropdown.md — Story 4.3.
--
-- Reference data table backing the admin-configurable close-reason dropdown
-- required by items 2/4/10: every close (Story 4.1 per-row, 4.2 bulk) must
-- pick a reason from this list, and each reason's `purge_on_close` flag
-- decides whether the close purges the applicant's PII (item 10, A2) or
-- retains all data. Reasons are soft-deactivated via `is_deprecated` — never
-- hard-deleted — so a previously-closed application keeps showing the
-- reason it was closed under even after that reason is removed from the
-- picker (Story 4.4).
--
-- Mirrors the reason_codes reference table shape (id/label/is_deprecated/
-- sort_order/created_at), with no dbgenerated default on `id` — Prisma
-- supplies the uuid client-side on create, same as reason_codes.
--
-- No relation to `applications` yet; the FK that records the chosen reason
-- against a closed application ships with the close action itself (A3),
-- per the orchestrator's PR sequencing.
-- =============================================================================

CREATE TABLE "close_reasons" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "purge_on_close" BOOLEAN NOT NULL DEFAULT false,
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "close_reasons_pkey" PRIMARY KEY ("id")
);

-- Natural key for the idempotent seed's upsert (there is no numeric code
-- like reason_codes.code — label is the only stable identifier Charlotte
-- will recognise when she sends the confirmed list).
CREATE UNIQUE INDEX "close_reasons_label_key" ON "close_reasons"("label");

-- =============================================================================
-- Row Level Security — mirrors public.reason_codes / public.bursary_schedule_entries.
--   READ : ADMIN / VIEWER / service_role (is_admin_or_viewer()) plus ASSESSOR,
--          because the per-row close action (Story 4.1) is available to
--          "ADMIN (or ASSESSOR, per existing close permissions)" and both
--          need the dropdown populated under withUserContext.
--   WRITE: ADMIN / service_role only — the Settings tab (Story 4.3) is
--          gated to ADMIN at the action layer; this is defence in depth.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.close_reasons TO app_user;

ALTER TABLE public.close_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY close_reasons_select ON public.close_reasons
  FOR SELECT TO app_user
  USING (public.is_admin_or_viewer() OR public.current_user_role() = 'ASSESSOR');

CREATE POLICY close_reasons_modify ON public.close_reasons
  FOR ALL TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
