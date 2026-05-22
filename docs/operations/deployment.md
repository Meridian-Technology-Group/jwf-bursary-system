# Deployment Runbook

> **STATUS: STUB** — MSA Schedule 1 §4 deliverable (technical/operational guide).
> To be completed before go-live (B15).

## Purpose
How the system is built and deployed across environments, and how schema
migrations reach each database.

## To complete
- [ ] Environment matrix: `main` → Vercel Production → `supabase-prod`;
      `staging` → Vercel Preview (aliased) → `supabase-nonprod`;
      `feature/*` → preview deploys. (See `CLAUDE.md` for the branch model.)
- [ ] Build pipeline: `ci.yml` (lint/typecheck/test) and the Vercel build
      (`prisma generate && next build`).
- [ ] **Migrations:** how `prisma migrate deploy` is run per environment and
      who runs it. NOTE the open item `backlog/migrate-deploy-not-automated.md`
      and that the Prisma CLI reads `.env` (must point at the intended DB).
- [ ] Promotion: `staging → main` PR process (user-initiated only).
- [ ] Rollback procedure and zero-downtime considerations (NF-15).

See also: [`tdd/09-deployment-release.md`](../engineering/tdd/09-deployment-release.md).
