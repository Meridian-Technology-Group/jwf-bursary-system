# CLAUDE.md — Git Workflow (MANDATORY)

This project uses a **GitHub Flow + long-lived staging** pattern. Claude MUST follow it for all code work. Deviations require explicit user approval per session.

## Environments

| Branch | Vercel | Supabase | Purpose |
|---|---|---|---|
| `main` | Production | `supabase-prod` | Live. Protected. No direct commits. |
| `staging` | Preview (aliased) | `supabase-nonprod` | Client testing. Long-lived integration branch. |
| `feature/*`, `fix/*`, `chore/*` | Auto preview deploy | `supabase-nonprod` | Ephemeral work branches. |

## Rules Claude MUST follow

1. **Never commit directly to `main` or `staging`.** Always branch first.
2. **Branch from `staging`** for new work, not `main`:
   ```
   git checkout staging && git pull
   git checkout -b feature/<short-kebab-name>
   ```
3. **Branch naming**: `feature/*` (new functionality), `fix/*` (bug fixes), `chore/*` (deps, config, refactor), `hotfix/*` (urgent prod fix — branch from `main`).
4. **Commits**: Conventional Commits style (`feat:`, `fix:`, `chore:`, `docs:`, `sec:`, `refactor:`). Match the style already in `git log`.
5. **PRs target `staging`**, not `main`. Use `gh pr create --base staging`.
6. **Only the user merges `staging` → `main`.** Claude must NOT open or merge `staging` → `main` PRs without an explicit instruction naming that promotion.
7. **Schema changes (Prisma)**: every new migration ships in the same PR as the code that needs it. Never modify an existing migration that has been applied to staging or prod — generate a new one.
8. **Hotfixes**: branch from `main`, PR to `main`, then immediately backport with a second PR from a `chore/backport-*` branch to `staging`.

## Workflow Claude executes

When the user asks Claude to start non-trivial work:

1. Confirm the current branch is clean and synced (`git status`, `git pull`).
2. If on `main` or `staging`, create a new work branch off `staging` before touching code.
3. Make focused commits as work progresses.
4. When the user signals "done" / "ready to ship":
   - Push the branch.
   - Open a PR targeting `staging` with a clear title and body.
   - Report the PR URL.
5. Do NOT auto-merge. The user reviews and merges.

## Promotion to production

Only when the user explicitly says "promote staging to main" or equivalent:
- Open PR from `staging` → `main`.
- Body includes a checklist of commits being promoted (from `git log main..staging --oneline`).
- User merges.

## Schema / migration discipline

- Prisma migrations live in `prisma/migrations/`.
- `prisma migrate dev` locally to author migrations; commit the generated SQL.
- `prisma migrate deploy` runs in CI/deploy against the target Supabase project.
- Never run `prisma migrate deploy` against prod from a local machine without user approval.
- Never run `prisma migrate reset` against staging or prod.

## Environment variables

- Vercel Production env → `supabase-prod` URL/keys.
- Vercel Preview env → `supabase-nonprod` URL/keys.
- Never add a Supabase service-role key to client-exposed (`NEXT_PUBLIC_*`) vars.
- Adding/changing env vars: tell the user; do not assume `vercel env add` is approved.

## What Claude does NOT do without explicit approval

- Force-push to any branch.
- Delete branches other than the one just merged.
- Merge own PRs.
- Run destructive DB operations (`migrate reset`, `DROP`, mass `UPDATE`/`DELETE`) against staging or prod.
- Push to `main` or `staging` directly.
- Bypass branch protection or pre-commit hooks (`--no-verify`).
