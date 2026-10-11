-- GT migration M1 PR-D (docs/migration/gt/02-target-model.md): migrated-account
-- mode and the data-migration ledger. Additive only.

-- 1. Where a migrated application came from (E5): 'GRANT_TRACKER' or
--    'MANUAL_PB'. NULL for everything created in this system, so every
--    existing row is unaffected.
ALTER TABLE "applications" ADD COLUMN "migration_source" TEXT;

-- 2. The ledger (04-toolkit.md §4): one row per entity a migration run
--    created, so a rollback deletes exactly those. No FKs, deliberately: it
--    must outlive the rows it describes.
CREATE TABLE "data_migration_ledger" (
    "id" UUID NOT NULL,
    "run_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "account_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_migration_ledger_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "data_migration_ledger_state_check" CHECK ("state" IN ('intent', 'done', 'rolled_back'))
);

CREATE INDEX "data_migration_ledger_run_id_phase_idx" ON "data_migration_ledger"("run_id", "phase");
CREATE INDEX "data_migration_ledger_account_key_idx" ON "data_migration_ledger"("account_key");
CREATE UNIQUE INDEX "data_migration_ledger_entity_type_entity_id_key" ON "data_migration_ledger"("entity_type", "entity_id");

-- 3. Access. The toolkit writes as the owner role over DIRECT_URL, which RLS
--    does not apply to. The app (app_user) only ever reads it, and only ADMIN:
--    a rollback trusts this table, so no app path may edit it. The default
--    privileges grant app_user full DML on new tables; take the writes back.
--    Policies ship here, not in a follow-up: `ensure_rls` force-enables RLS on
--    every new table, and a table with RLS and no policy silently reads empty.
REVOKE INSERT, UPDATE, DELETE ON public.data_migration_ledger FROM app_user;
GRANT SELECT ON public.data_migration_ledger TO app_user;

ALTER TABLE public.data_migration_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY data_migration_ledger_select ON public.data_migration_ledger
  FOR SELECT TO app_user
  USING (public.is_admin());
