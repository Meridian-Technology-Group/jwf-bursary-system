# Runbook — Auth rate limiting via Vercel WAF

> Operational runbook for backlog item #1
> (`prod-auth-rate-limiting-disabled`). Replaces the deleted app-level
> limiter (`src/lib/rate-limit.ts`, Upstash + Vercel KV). Authored
> 2026-05-24.

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
| Action on exceed | deny (HTTP 429) | `--rate-limit-action deny` |

> Window is in **seconds** (Vercel's docs example: `--rate-limit-window 60`
> = "100 req/min"). 15 min = 900.

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

```bash
# /login (also covers /login/mfa, which is fine — same auth surface)
vercel firewall rules add "Auth rate limit — login" \
  --condition '{"type":"path","op":"pre","value":"/login"}' \
  --action rate_limit \
  --rate-limit-algo fixed_window \
  --rate-limit-window 900 \
  --rate-limit-requests 5 \
  --rate-limit-keys ip \
  --rate-limit-action deny --yes

# /reset-password
vercel firewall rules add "Auth rate limit — reset-password" \
  --condition '{"type":"path","op":"pre","value":"/reset-password"}' \
  --action rate_limit \
  --rate-limit-algo fixed_window \
  --rate-limit-window 900 \
  --rate-limit-requests 5 \
  --rate-limit-keys ip \
  --rate-limit-action deny --yes
```

> **Exact vs prefix:** `pre` on `/login` also throttles `/login/mfa`. That's
> acceptable (still an auth surface). If you want exact-path buckets, check
> the supported op via `vercel firewall rules list --expand` and use the
> exact-match op instead. The reset flow is a single `/reset-password` page.

> **Action choice:** `deny` returns a bare edge **429** before the server
> action runs — so the old friendly inline message ("Too many attempts, try
> again in 15 minutes") no longer appears; the user sees Vercel's 429. Use
> `--rate-limit-action challenge` instead if you'd rather present a
> challenge than a hard block. Either way the in-app message is gone (the
> code that rendered it is removed in PR step 1b).

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

From a single IP, hit `/login` >5 times inside 15 min:

```bash
for i in $(seq 1 7); do
  printf '%s ' "$i"
  curl -s -o /dev/null -w '%{http_code}\n' https://<prod-domain>/login
done
```

Expected: first 5 succeed (200/3xx), requests 6–7 return **429** (or a
challenge). A normal user making a handful of attempts is unaffected.
Cross-check in **Project → Firewall** that the rules show recent denials.

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
