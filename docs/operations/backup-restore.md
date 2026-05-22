# Backup & Restore

> **STATUS: STUB** — MSA Schedule 1 §4 deliverable + NF-13. To be completed
> before go-live (B15), including one logged restore drill.

## Purpose
How database and storage backups are taken, retained, and restored.

## To complete
- [ ] Supabase backup policy: daily automated backups + point-in-time recovery
      (NF-13 requires ≥30-day retention; confirm Pro tier on prod).
- [ ] Storage (documents bucket) backup considerations.
- [ ] Restore procedure, step by step (PITR to a timestamp; verifying integrity).
- [ ] **Restore drill:** execute one restore against nonprod and log the date,
      duration, and outcome here (required evidence for sign-off).
- [ ] RPO/RTO statement.
