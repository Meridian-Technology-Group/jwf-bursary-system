-- GT migration PR-C (S9): a per-account annual fee, before VAT. The OP
-- partnering school has no fee table; each account's fee differs. NULL for
-- every existing account, which keeps reading the Settings fee table.
ALTER TABLE "bursary_accounts" ADD COLUMN "annual_fees_override" DECIMAL(10,2);
