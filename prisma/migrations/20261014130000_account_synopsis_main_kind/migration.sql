-- Epic 21 #6 rework (14 Oct 2026), part 1 of 2: ENUM ONLY.
--
-- The account's standing synopsis becomes ONE editable "Main synopsis" per
-- bursary account (kind MAIN). The data conversion and the one-MAIN-per-account
-- index live in the next migration (20261014130100_account_synopsis_main_backfill):
-- Postgres forbids using a value added by `ALTER TYPE ... ADD VALUE` in the
-- transaction that added it (project convention, see 20260605172800).
--
-- Additive and idempotent.

ALTER TYPE "AccountSynopsisKind" ADD VALUE IF NOT EXISTS 'MAIN';
