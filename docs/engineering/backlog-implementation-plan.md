# Backlog Implementation Plan

> Cross-cutting sequencing plan for the open items in
> [`docs/backlog/`](../backlog/). Authored 2026-05-24. This is a
> *planning* artifact — the per-item files remain the source of truth for
> scope and rationale. Update the wave tables as items ship; close the
> underlying backlog file (move to `docs/archive/backlog/`) when done.

## Standing decisions baked into this plan

- **Migrations auto-apply on push.** `.github/workflows/db-push.yml` runs
  `prisma migrate deploy` against `supabase-nonprod` on push to `staging`
  and `supabase-prod` on push to `main`. Any migration-bearing PR applies
  to nonprod on merge — no manual step. (Confirmed via the now-closed
  `migrate-deploy-not-automated` item.)
- **The two big features are deferred.** #18 (Round Cockpit) and #20
  (dual-parent separated applications) are treated as dedicated epics
  *after* the cleanup waves below land. Rationale: #20 should build on a
  clean invitation surface and the email-toggle system; #18 overlaps the
  round-summary report and is a large self-contained UX rebuild. Neither
  is in Waves 0–2.

## The 20 open items

| # | Item | Sev | Type | Primary surface |
|---|------|-----|------|-----------------|
| 1 | prod-auth-rate-limiting-disabled | **high** | ops | Vercel KV provisioning |
| 2 | prod-resend-webhook-secret-unset | med | ops | Vercel env var |
| 3 | rate-limiter-fails-open-when-kv-unset | med | code | `src/lib/rate-limit.ts` |
| 3b | migrate-rate-limit-off-vercel-kv-sdk | low | deps | `src/lib/rate-limit.ts` (added 2026-05-24) |
| 4 | shared-generateInvitationToken-helper | low | refactor | invitation queries |
| 5 | invite-email-failure-leaves-orphan-rows | med | code | `(admin)/invitations/actions.ts` |
| 6 | revoke-staff-invitation-leaves-orphan-profile | low | code | `(admin)/users/actions.ts` |
| 7 | cron-pending-to-expired-invitations | low | feature | new Vercel Cron route |
| 8 | invitation-template-mention-expiry | low | copy+migration | INVITATION template |
| 9 | drop-applicantName-column | low | schema | backfill + readers + drop |
| 10 | audit-log-naming-inconsistencies | low | consistency | audit call sites |
| 11 | duplicate-outcome-setting-actions | **med** | correctness | two `setOutcome` actions |
| 12 | admin-email-event-toggles | med | feature | schema + `sendEmail` + Settings UI |
| 13 | applicant-missing-docs-response-no-assessor-email | low | feature | new template + action |
| 14 | automated-version-bumping | low | ci | release tooling |
| 15 | display-app-version-info | low | ui | build-info string + `/api/version` |
| 16 | round-summary-report-section | low | reporting | `/reports` tab |
| 17 | family-synopsis-auto-population | low | feature/docs | recommendation form |
| 18 | admin-round-cockpit-concept | med | UX (large) | `/rounds` rebuild — **DEFERRED** |
| 19 | applicant-form-spec-stale-vs-implementation | med | docs | spec reconciliation |
| 20 | dual-parent-separated-bursary-application | **high** | feature (XL) | end-to-end — **DEFERRED** |

## Dependencies & coupling that drive the sequence

- **#1 must precede #3's prod deploy.** #3 makes the app *fail loud /
  refuse to boot* in prod when KV is unset. Shipping #3 before KV is
  provisioned (#1) would brick prod. Order: provision KV → ship fail-loud.
- **#4 is foundational for the invitation cluster.** Trivial, low-risk;
  removes the duplicated token helper before #5/#7/#9 touch the same files.
- **#8 and #9 both edit the INVITATION template** (copy change vs.
  `{{applicant_name}}` → derived merge field). Keep them in one track so
  their template migrations don't collide.
- **#9 needs a backfill** of `firstName/lastName` from `applicantName`
  *before* the column drop — two steps (backfill migration, verify, then
  drop).
- **#12 should land before #13** so the new `MISSING_DOCS_RESPONDED`
  template is born under the toggle system. **#13 is independently
  blocked** by an out-of-folder RLS fix
  (`walkthrough-applicant-24-respond-page-rls-blocks-request-read`) — that
  must be fixed first or #13's email path is unreachable.
- **#11 starts with a ~30-min investigation** (is `setOutcome` dead
  code?). It's a correctness risk on the qualifying → `BursaryAccount`
  path, so it ranks above its "medium" peers.
- **#14 before #15.** #14 establishes the version source of truth + Sentry
  release; #15 surfaces it. Loosely coupled.
- **#16 vs #18.** The deferred Round Cockpit (#18) absorbs round
  situational awareness and would make #16 cheap or redundant. Decide #16
  only when #18 is scheduled — until then leave #16 parked.
- **#20 builds on the invitation cluster + #12.** Do invitation hygiene
  (#4/#5/#6/#8/#9) and the email-toggle system (#12) before the dual-parent
  epic so it inherits clean foundations.

## Wave 0 — Production safety (do first; mostly ops)

The system is live with PII and **rate limiting off in prod** — the only
"affects users today / high" cluster.

> **Vercel KV is sunset (2026-05-24).** Provision **Upstash for Redis via the
> Vercel Marketplace**, not the old "Vercel KV" product. The Marketplace
> integration still injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`, so
> provisioning alone lights up prod rate limiting with **no code change** — the
> env-var contract is preserved. The deprecated `@vercel/kv` *SDK* is separate
> debt (item #3b), folded into the #3 PR since both edit `rate-limit.ts`.

| # | Action | Owner | Gate |
|---|--------|-------|------|
| 1 | Install **Upstash for Redis** (Vercel Marketplace) → connect to Production; verify `KV_REST_API_URL` / `KV_REST_API_TOKEN` are injected | **Brian** (env/integration needs approval per CLAUDE.md) | — |
| 2 | Set `RESEND_WEBHOOK_SECRET` in Production | **Brian** | — |
| 3 + 3b | Fail-loud-in-prod **and** migrate `@vercel/kv` → `@upstash/redis` in `lib/rate-limit.ts` (one PR) + Sentry breadcrumb + go-live checklist line | Claude | **merge gated on #1 done** |

## Wave 1 — Parallel cleanup tracks (independent file sets)

Four tracks that touch disjoint code and can run concurrently.

**Track A — Invitation hygiene** (sequential within the track; shared files):

1. #4 shared token helper (land first — trivial)
2. #5 orphan rows on email failure — *decision needed: hard-rollback vs.
   `FAILED`-status row*
3. #6 staff-revoke cleanup (mirror the applicant flow)
4. #7 expire-invitations Vercel Cron (cover `Invitation` + `StaffInvitation`)
5. #8 INVITATION template copy (single-use + 30-day) — *Foundation copy
   sign-off needed*
6. #9 backfill `firstName/lastName`, switch readers to derived name, drop
   `applicantName` (two-step, after #8 settles the merge field)

**Track B — Correctness:** #11 duplicate outcome actions → investigate,
then delete dead code *or* collapse onto one shared core + add the
"qualifying outcome creates exactly one BursaryAccount + canonical audit
row" invariant test.

**Track C — Release & observability:** #14 versioning policy + tooling
(recommend conventional-commits-driven `changesets`/`semantic-release`,
since history already follows Conventional Commits) → then #15 build-info
string + `/api/version` tied to the Sentry release.

**Track D — Docs (no code):** #19 reconcile `applicant-form.md` field-by-
field against the live portal. #17-option-2 (correct README/PRD framing)
folds in here *if* we decline to build the auto-suggest.

## Wave 2 — Features on cleaned foundations

- #12 email event toggles: `enabled` column migration + gate in
  `sendEmail` + Settings UI + audit row. *Decision needed: which types are
  "locked"* (proposal: lock `INVITE_STAFF` + `INVITATION`).
- #10 audit naming normalization + centralized vocab module (pairs with
  touching audit code during #12; forward-only).
- #13 missing-docs-responded email — **only after** its RLS blocker is
  fixed and #12 has landed.
- #17-option-1 (build the family-synopsis auto-suggest) — if we choose the
  higher-value path over docs-only.

## Deferred epics (post-cleanup, dedicated multi-PR efforts)

- **#18 Round Cockpit** — large UX rebuild of `/rounds` and `/rounds/[id]`;
  new `round-watchlist` query + ~7 components. Schedule after Waves 0–2.
  Revisit #16 (round-summary report) at the same time — build the cheap
  version or close `won't-do` if the cockpit + School Comparison suffice.
- **#20 Dual-parent (separated) applications** — XL, multi-PR, sequenced
  internally per its backlog doc: data model + `ApplicationContributor` +
  RLS → invite flow → scoped secondary portal → assessor dual-view +
  gating → calculation mapping → comms (new templates, under #12's toggle)
  → re-assessment carry-forward → GDPR cascade. Open policy questions
  (joint-asset double-counting, identity matching, sole-parent
  reconciliation) must be answered with the Foundation before/while
  building.

## Decisions needed from owner / Foundation

| Blocks | Decision |
|--------|----------|
| #5 | Hard rollback vs. `FAILED`-status row on invitation email failure? |
| #8, #12 | Foundation copy approval for the invitation paragraph; which email types are non-disableable. |
| #16 | Build it, or close `won't-do` in favour of the (deferred) cockpit? |
| #17 | Build the synopsis auto-suggest (option 1) or just fix the docs (option 2)? |
| #20 | The open policy questions in `dual-parent-separated-bursary-application.md`. |
