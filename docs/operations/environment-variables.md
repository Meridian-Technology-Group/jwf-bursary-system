# Environment Variables

> **STATUS: STUB** — MSA Schedule 1 §4 deliverable (technical/operational guide).
> To be completed before go-live (B15).

## Purpose
The authoritative list of environment variables, where each is set, and which
project/value each environment uses.

## To complete
- [ ] Variable matrix (name, scope, Production value source, Preview value
      source, notes). A draft matrix exists in the production-readiness
      assessment — lift and finalise it here.
- [ ] Supabase: `NEXT_PUBLIC_SUPABASE_URL`, anon key, `SUPABASE_SERVICE_ROLE_KEY`,
      `DATABASE_URL` (pooler :6543), `DIRECT_URL` (session pooler :5432) — distinct
      per env; never expose the service-role key to `NEXT_PUBLIC_*`.
- [ ] Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`.
- [ ] Rate limiting: `KV_REST_API_URL` / `KV_REST_API_TOKEN` (limiter is
      disabled when unset).
- [ ] App: `NEXT_PUBLIC_APP_URL`, `SUPABASE_STORAGE_BUCKET`, MFA flag
      `STAFF_MFA_ENFORCED`, Sentry DSN (when added).
- [ ] **Note:** the Prisma CLI reads `.env`; the app + seed scripts read
      `.env.local`. Keep them in sync and pointed at the intended project.
