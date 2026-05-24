# Runbook — Auth rate limiting via Vercel WAF

> Operational runbook for backlog item #1
> (`prod-auth-rate-limiting-disabled`). Replaces the deleted app-level
> limiter (`src/lib/rate-limit.ts`, Upstash + Vercel KV). Authored
> 2026-05-24.
>
> **STATUS: LIVE in Production (2026-05-24).** Both rules created via the
> `vercel firewall` CLI, published, and verified — a 6th `POST /login`
> from one IP within 15 min is blocked at the edge (HTTP 403) while 1–5
> pass through. CLI v50.9.x lacks the `firewall` subcommand; this was run
> with `npx vercel@latest` (v54), which reuses the existing global auth +
> linked project. The procedure below is the reference for re-running,
> tuning, or rollback.

## TL;DR — the mechanism is NOT `vercel.json`

The original plan assumed the WAF rate-limit rule could be declared in
`vercel.json`. **It cannot.** Vercel's `vercel.json` WAF surface
(`routes[].mitigate`) only supports binary actions (`deny` / `challenge`)
on header/path conditions — there is **no `rateLimit` object** (window /
limit / keys) in the `vercel.json` schema. Every rate-limit example Vercel
publishes uses one of:

- **CLI** — `vercel firewall rules add … --action rate_limit` ← we use this
- **REST/SDK** — `vercel.security.updateFirewallConfig` (`mitigate.rateLimit`)
- **`@vercel/firewall`** `checkRateLimit()` (code SDK referencing a
  dashboard-defined Rate Limit ID)

WAF rules are **project-level firewall state**, not code. Consequences:

- They are **not** committed to the repo and do **not** promote
  `staging → main` with a git merge. Each must be created against the
  project and **published** explicitly.
- "Verify on a preview deploy, then promote" does not map — firewall config
  is not git-branch-scoped. Test against the project, publish to production.
- **Owner is Brian** (or anyone with a Vercel token + project access). This
  is an outward-facing production change; per `CLAUDE.md`, Claude does not
  run it without explicit approval and a token.

## Plan parameters (mirror the deleted limiter exactly)

The old limiter used **two independent buckets**, each 5 requests / 15-min
fixed window, keyed by IP:

- `login:${ip}` on `/login`
- `reset-password:${ip}` on `/reset-password`

We reproduce this with **two rules** (one per path) so the buckets stay
independent — matching prior behaviour.

| Setting | Value | CLI flag |
|---|---|---|
| Algorithm | fixed window | `--rate-limit-algo fixed_window` |
| Window | 900 s (15 min) | `--rate-limit-window 900` |
| Requests | 5 | `--rate-limit-requests 5` |
| Key | client IP | `--rate-limit-keys ip` |
| Action on exceed | deny → **HTTP 403** | `--rate-limit-action deny` |

> Window is in **seconds** (range 10–3600; Vercel's docs example:
> `--rate-limit-window 60` = "100 req/min"). 15 min = 900.
>
> **Two conditions per rule (AND'd):** `path` *and* `method=POST`. The
> method condition is essential — without it the rule counts **every**
> request to the path, including GET page loads, and a user refreshing the
> login page could exhaust the budget. The old app limiter only ran on the
> form submission (the server action = a POST to the page route), so
> matching `method eq POST` reproduces that exactly: only login/reset
> *attempts* count, not page views.
>
> **Action returns HTTP 403**, not 429 — Vercel's `deny` mitigation blocks
> at the edge with 403 Forbidden. (`--rate-limit-action` has no 429 option;
> use `challenge` if you'd prefer a challenge page over a hard block.)

## Prerequisites

```bash
npm i -g vercel        # or use npx vercel@latest
vercel login           # auth as a member of the JWF team
vercel link            # link cwd to the production project (once)
```

Confirm you're on **Vercel Pro** (rate-limit action is GA on Pro) and
targeting the **production** project, not a preview-only scope.

## Step 1 — Stage the two rules

`vercel firewall rules add` **stages** a draft; nothing is live until
`publish`. Path op `pre` = prefix match.

If your installed CLI lacks the `firewall` subcommand (pre-v52-ish),
prefix each command with `npx vercel@latest` — it reuses the global auth +
the linked project in `.vercel/project.json`.

```bash
# /login — POST only (also covers /login/mfa, same auth surface)
vercel firewall rules add "Auth rate limit — login" \
  --description "Throttle login attempts: 5 POSTs / 15 min per IP. Replaces app-level limiter (backlog #1)." \
  --condition '{"type":"path","op":"pre","value":"/login"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --action rate_limit \
  --rate-limit-algo fixed_window \
  --rate-limit-window 900 \
  --rate-limit-requests 5 \
  --rate-limit-keys ip \
  --rate-limit-action deny --yes

# /reset-password — POST only
vercel firewall rules add "Auth rate limit — reset-password" \
  --description "Throttle password-reset requests: 5 POSTs / 15 min per IP. Replaces app-level limiter (backlog #1)." \
  --condition '{"type":"path","op":"pre","value":"/reset-password"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --action rate_limit \
  --rate-limit-algo fixed_window \
  --rate-limit-window 900 \
  --rate-limit-requests 5 \
  --rate-limit-keys ip \
  --rate-limit-action deny --yes
```

> **Why `method eq POST`:** without it the rule counts GET page loads too,
> which would throttle users who merely refresh the login page. The server
> action (the actual attempt) is a POST to the page route, so matching POST
> reproduces the old limiter's behaviour exactly.

> **`pre` vs exact path:** `pre` on `/login` also covers `/login/mfa` — fine,
> same auth surface, and login + MFA submissions share one 5/15-min bucket.

> **The old inline message is gone.** A blocked request gets Vercel's edge
> **403** before the server action runs, so the friendly "Too many attempts"
> copy (removed with the limiter in step 1b) no longer shows. Use
> `--rate-limit-action challenge` instead if you'd rather present a
> challenge page than a hard 403.

## Step 2 — Review the staged changes

```bash
vercel firewall diff                  # what will publish
vercel firewall rules list --expand   # full conditions + actions
```

## Step 3 — Publish to production

```bash
vercel firewall publish --yes
```

This makes the staged rules active **in production**.

## Step 4 — Verify (post-publish, against production)

The rule matches **POST**, so test with POST (a raw POST isn't a valid
Next.js server action — the app returns 405 — but that still proves the
request reached the function; what we're checking is the edge block on the
6th). From a single IP, >5 POSTs inside 15 min:

```bash
for i in $(seq 1 7); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    https://jwf-bursary-system.vercel.app/login \
    -H 'content-type: application/x-www-form-urlencoded' --data 'waf-verification=1')
  printf '  attempt %d -> HTTP %s\n' "$i" "$code"
  sleep 0.4
done
```

Expected (and observed 2026-05-24): attempts 1–5 reach the app (**405**),
attempts 6–7 are blocked at the edge (**403**). A normal user making a
couple of real attempts is unaffected; GET page loads are never counted.
Note this throttles the *testing* IP for ~15 min (self-expiring).
Cross-check `vercel firewall overview` (Firewall: Enabled, 2 active rules).

## Rollback

```bash
vercel firewall rules disable "Auth rate limit — login"
vercel firewall rules disable "Auth rate limit — reset-password"
vercel firewall publish --yes
# or remove outright: vercel firewall rules remove "<name>" --yes && vercel firewall publish --yes
```

## Go-live checklist line (deployment runbook)

Add to `docs/operations/deployment.md`'s go-live checklist (replaces the old
"confirm `KV_REST_API_*` set" item):

- [ ] **WAF auth rate-limit rules active in Production** — `vercel firewall
  rules list` shows both "Auth rate limit" rules enabled and published;
  spot-check a 429 on the 6th `/login` attempt from one IP.
