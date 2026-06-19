-- =============================================================================
-- JWF Bursary System — Lead-applicant contact register (Epic 04, PR-1)
-- =============================================================================
-- Plan: docs/backlog/process-alignment/plans/04-lead-applicant-contacts-and-invitations.md
--       §3 target, §5.1 schema, §6 PR-1, D1 (locked school/entry-year), D12 (twin key).
--
-- Introduces a first-class, admin-managed `contacts` table: the pre-application
-- record of a family (parent + child + school + entry-year + address) that
-- exists independently of any Application. It is the source from which an
-- invitation and a school/year-LOCKED application are seeded.
--
-- This migration is purely ADDITIVE and zero-backfill:
--   * new `contacts` table;
--   * nullable `applications.contact_id` (the contact an app was seeded from);
--   * nullable `invitations.contact_id` + `invitations.entry_year` /
--     `invitations.entry_year_group` (the invite now carries the locked
--     entry-year forward to application creation — D1, consumed in Epic 04 PR-2).
-- Existing rows get NULL for every new column, so nothing breaks. The DOB-based
-- per-child uniqueness on `applications` is a SEPARATE, backfilled migration in
-- Epic 04 PR-5 (never weakens existing dedupe).
--
-- The `contacts.profile_id + child_name + child_dob` UNIQUE keys one contact per
-- child per lead applicant (twins, same name + distinct DOB, get two contacts).
-- NOTE: profile_id is nullable (a contact precedes registration); Postgres treats
-- NULLs as DISTINCT, so this constraint does not dedupe not-yet-bound contacts —
-- the friendly app-layer guard in createContactAction covers that case.
--
-- CI applies this on merge to staging (.github/workflows/db-push.yml).
-- =============================================================================

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "contact_id" UUID;

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "entry_year" INTEGER,
ADD COLUMN     "entry_year_group" "EntryYearGroup";

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "child_name" TEXT NOT NULL,
    "child_dob" DATE,
    "school" "School" NOT NULL,
    "entry_year" INTEGER NOT NULL,
    "entry_year_group" "EntryYearGroup",
    "address_line1" TEXT,
    "address_line2" TEXT,
    "town" TEXT,
    "postcode" TEXT,
    "profile_id" UUID,
    "bursary_account_id" UUID,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_profile_id_idx" ON "contacts"("profile_id");

-- CreateIndex
CREATE INDEX "contacts_bursary_account_id_idx" ON "contacts"("bursary_account_id");

-- CreateIndex
CREATE INDEX "contacts_created_by_idx" ON "contacts"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_profile_id_child_name_child_dob_key" ON "contacts"("profile_id", "child_name", "child_dob");

-- CreateIndex
CREATE INDEX "invitations_contact_id_idx" ON "invitations"("contact_id");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_bursary_account_id_fkey" FOREIGN KEY ("bursary_account_id") REFERENCES "bursary_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Row Level Security — contacts are staff-managed operational data.
-- Mirrors public.staff_invitations: staff (ADMIN/VIEWER/ASSESSOR) may read;
-- only ADMIN (and service_role, which bypasses RLS) may write. The CRUD server
-- actions run under withAdminContext (service_role) so these policies are
-- defence-in-depth, not the primary gate.
-- =============================================================================

-- Grants for the app_user role (RLS still applies on top of these).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO app_user;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- SELECT: staff only (ADMIN / VIEWER / ASSESSOR).
CREATE POLICY contacts_select ON public.contacts
  FOR SELECT TO app_user
  USING (
    public.is_admin_or_viewer()
    OR public.current_user_role() = 'ASSESSOR'
  );

-- INSERT: ADMIN / service_role only.
CREATE POLICY contacts_insert ON public.contacts
  FOR INSERT TO app_user
  WITH CHECK (public.is_admin());

-- UPDATE: ADMIN / service_role only.
CREATE POLICY contacts_update ON public.contacts
  FOR UPDATE TO app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: ADMIN / service_role only.
CREATE POLICY contacts_delete ON public.contacts
  FOR DELETE TO app_user
  USING (public.is_admin());
