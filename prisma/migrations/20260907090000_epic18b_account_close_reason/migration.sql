-- Epic 18b — a manually-closed bursary account records why (her April–May
-- leavers window). Null for the automatic schedule-complete close.
ALTER TABLE "bursary_accounts" ADD COLUMN "close_reason_id" UUID;
ALTER TABLE "bursary_accounts" ADD CONSTRAINT "bursary_accounts_close_reason_id_fkey"
  FOREIGN KEY ("close_reason_id") REFERENCES "close_reasons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
