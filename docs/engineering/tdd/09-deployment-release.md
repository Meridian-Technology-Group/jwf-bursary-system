## 9. Deployment & Release Strategy

### 9.1 Environments

| Environment | Purpose | Platform | Database | URL |
|-------------|---------|----------|----------|-----|
| **Local** | Development | `next dev` on developer machine | Supabase local (Docker via `supabase start`) or dev project | `localhost:3000` |
| **Preview** | PR review and feature testing | Vercel preview deployment (automatic per PR) | Supabase development project | `*.vercel.app` (auto-generated) |
| **Staging** | Pre-production testing, UAT, migration dry runs | Vercel staging deployment (auto-deploy from `main`) | Supabase staging project (London) | `staging.bursary.jwf.org.uk` (example) |
| **Production** | Live system | Vercel production deployment (manual promote from staging or deploy from release tag) | Supabase production project (London) | `bursary.jwf.org.uk` (example) |

**Supabase project separation:** Each environment has its own Supabase project with its own database, auth, and storage. This ensures:
- Development and testing never touch production data
- Schema migrations can be tested on staging before production
- Secrets and API keys are environment-specific

**Environment variables:** Managed via Vercel's environment variable system. Each environment has its own set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never exposed to client)
- `DATABASE_URL` (Prisma connection string via Supavisor pooler)
- `DIRECT_URL` (Prisma direct connection for migrations)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### 9.2 CI/CD Pipeline

```
Developer pushes branch
         │
         ▼
┌─────────────────────────────────────────────┐
│           GitHub Actions Workflow            │
│                                             │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Lint   │  │   Type   │  │   Unit    │  │
│  │ (ESLint)│  │  Check   │  │  Tests    │  │
│  │         │  │  (tsc)   │  │ (Vitest)  │  │
│  └────┬────┘  └────┬─────┘  └─────┬─────┘  │
│       └─────────────┴──────────────┘         │
│                     │ all pass               │
│                     ▼                        │
│            ┌────────────────┐                │
│            │  Integration   │                │
│            │  Tests         │                │
│            │  (Vitest)      │                │
│            └───────┬────────┘                │
│                    │ pass                    │
│                    ▼                        │
│            ┌────────────────┐                │
│            │  Build         │                │
│            │  (next build)  │                │
│            └───────┬────────┘                │
└────────────────────┼────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    PR branch                main branch
         │                       │
         ▼                       ▼
┌──────────────────┐   ┌──────────────────┐
│  Vercel Preview  │   │  Vercel Staging  │
│  Deployment      │   │  Deployment      │
│  (auto)          │   │  (auto)          │
└──────────────────┘   └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  E2E Tests       │
                       │  (Playwright     │
                       │   vs staging)    │
                       └────────┬─────────┘
                                │ pass
                                ▼
                       ┌──────────────────┐
                       │  Manual approval │
                       │  to promote to   │
                       │  production      │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Vercel          │
                       │  Production      │
                       │  Deployment      │
                       └──────────────────┘
```

**Database migrations:** Prisma migrations are applied as a separate step — not automatically on deploy:

1. Developer creates migration locally: `npx prisma migrate dev --name description`
2. Migration file committed to repo (`prisma/migrations/`)
3. On merge to `main`: a GitHub Actions step runs `npx prisma migrate deploy` against the staging database
4. Before production promote: migration is run against production database (manually triggered or via a deploy script)

This prevents accidental schema changes on production and allows migration verification on staging first.

**Zero-downtime deployments:** Vercel's deployment model is inherently zero-downtime — a new deployment is built and verified, then traffic is atomically switched to the new version. For database migrations that alter schema, backwards-compatible migration practices are used:
- Add new columns as nullable (or with defaults), deploy code that uses them, then backfill
- Never rename or drop columns in the same deployment that removes code using them
- Use a two-phase approach: deploy code that handles both old and new schema → run migration → deploy code that removes old schema handling

### 9.3 Monitoring & Alerting

| Concern | Tool | Detail |
|---------|------|--------|
| **Application errors** | Vercel + Sentry (or similar) | Unhandled exceptions in server components, server actions, and API routes are captured with stack traces, user context, and request metadata. Alerts on error rate spikes. |
| **Performance** | Vercel Analytics | Core Web Vitals (LCP, FID, CLS) for the applicant portal. Server function duration for API routes. |
| **Uptime** | Vercel / external monitor (e.g. Checkly, UptimeRobot) | HTTP checks on the portal login page and admin dashboard. Alert if response time > 5s or status ≠ 200. Target: 99.5% uptime (NF-04). |
| **Database** | Supabase Dashboard | Connection pool utilisation, query performance (pg_stat_statements), storage usage, replication lag. Alerts on high connection count or slow queries. |
| **Auth** | Supabase Auth logs | Failed login attempts, account lockouts, MFA failures. Alerts on unusual patterns (brute force attempts). |
| **Email** | Resend Dashboard + webhooks | Delivery rate, bounce rate, complaint rate. Resend webhook notifications for bounces/complaints are received at `/api/webhooks/resend` and logged. |
| **Storage** | Supabase Dashboard | Bucket size, upload/download metrics. |

**Alerting channels:** Email to the development team. For critical production issues (site down, database unreachable), an escalation to the Foundation's IT contact.

### 9.4 Backup & Recovery

| Concern | Strategy | Detail |
|---------|----------|--------|
| **Database backups** | Supabase automatic daily backups | Included with Supabase Pro plan. Configured for 30-day retention (NF-13). Point-in-time recovery (PITR) available for Pro plan — restores to any point within the retention window. |
| **Database backup testing** | Monthly | Restore a backup to a temporary Supabase project to verify integrity. |
| **Document storage** | Supabase Storage (S3-backed) | S3 provides 99.999999999% (11 nines) durability. No additional backup needed for the files themselves. |
| **Application code** | Git (GitHub) | Full history of all code, migrations, and configuration. Any version can be redeployed to Vercel. |
| **Secrets** | Vercel environment variables + Supabase project settings | Not stored in code. If Vercel settings are lost, secrets can be regenerated from Supabase dashboard. |
| **Disaster recovery target** | RTO: 4 hours, RPO: 24 hours | **RTO (Recovery Time Objective):** The system can be restored from backup and redeployed within 4 hours. **RPO (Recovery Point Objective):** Maximum data loss is 24 hours (daily backup interval). With PITR enabled, RPO improves to minutes. |
| **Disaster recovery procedure** | Documented runbook | 1. Restore database from latest backup (or PITR). 2. Verify Supabase Storage is intact (S3 durability). 3. Redeploy the latest passing build from GitHub via Vercel. 4. Verify auth, database connectivity, and storage access. 5. Run smoke tests (login, load an application, load an assessment). |

---
