# Data Model & ERD

> **STATUS: STUB** — MSA Schedule 1 §4 deliverable (data-model reference). To be
> completed before go-live (B15). Source of truth is `prisma/schema.prisma`.

## Purpose
A human-readable reference for the database schema: entities, relationships,
enums, and the row-level security model.

## To complete
- [ ] Entity-relationship diagram (generate from `prisma/schema.prisma`).
- [ ] Per-entity table: purpose, key columns, and notable constraints
      (Round, BursaryAccount, Application, ApplicationSection, Document,
      Assessment + earners/property/checklists, Recommendation, ReasonCode,
      reference tables, Profile, Invitation, AuditLog).
- [ ] Enum catalogue (Role, RoundStatus, ApplicationStatus, AssessmentStatus,
      EmploymentStatus, EntryYearGroup, EmailTemplateType, …).
- [ ] RLS model: which tables have RLS, the `app_user` role, and the
      `is_admin` / `is_owner` / `is_assigned_assessor` policy helpers.
- [ ] Migration history pointer (`prisma/migrations/`) and the deploy path.

See also: [`tdd/06-data-design.md`](tdd/06-data-design.md).
