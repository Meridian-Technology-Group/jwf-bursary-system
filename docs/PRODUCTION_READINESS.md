# John Whitgift Foundation Bursary System — Production Readiness Assessment

| Field | Value |
|---|---|
| **Document** | Production readiness assessment + remediation punch list |
| **Date** | 2026-05-17 |
| **Author** | Meridian Technology Group — pre-handoff audit |
| **Spine** | `docs/contract/feature-verification-checklist.md` (Foundation sign-off document) |
| **Target Go-Live** | w/c 22 June 2026 (MSA Schedule 1 §2 Gate G4) |
| **Branch reviewed** | `staging` (synced with `main` workflow) |
| **Verdict** | **HOLD** — Blockers prevent acceptance under Schedule 1 §5.4 |

---

## 1. Executive Verdict

**Recommendation: HOLD.** The system is not currently in a state where the Foundation could complete the Feature Verification Checklist with an "Accept" or "Accept with caveats" judgement. Multiple Blocker-class defects exist across feature parity, security, and ops. With focused remediation the system can be returned to acceptance condition, but the original 22 June Go-Live date is at material risk unless work begins immediately and scope is frozen on the existing feature set.

**What's actually strong.** Three years of design and engineering show through in real ways. The four-stage assessment engine (`src/lib/assessment/*`) is mathematically correct, well-tested (1,018 lines of tests across seven test files), and structurally pure — it is in good condition to run the contractual ten-case parity test (MSA Schedule 1 §3). The defence-in-depth security model promised by the TDD is now real, not aspirational: every personal-data table has RLS enabled, the runtime Prisma connection runs as a non-superuser `app_user` subject to those policies, and pre-signed document URLs are short-lived (5 min) with forced `Content-Disposition: attachment`. The GDPR delete cascade is thorough (Storage purge + DB anonymise + Supabase Auth user delete + audit-row anonymisation + retention guard). Security headers (HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy) are emitted on every response. Auth has 12-character password minima with HIBP k-anonymity checks, rate-limited login/reset, and Origin/Referer-checked logout. Audit logging is DB-immutable via `REVOKE UPDATE, DELETE` plus `FORCE ROW LEVEL SECURITY` on the `audit_logs` table.

**What blocks acceptance.** The system was recently moved to a fresh Supabase project, and the migration left both environments under-provisioned: **production has zero tables, zero migrations, and zero rows**, and **staging has lost its reference data (zero reason codes, zero family-type configs, zero school fees, zero council-tax defaults, zero rounds)** — so the assessor cannot complete a single assessment in either environment today, blocking UAT (Gate G2). Beyond the data state, a consistent pattern emerged in the audit: strong server-side foundations with critical UI-wiring gaps. The most material defects are (a) the application **submission flow is not wired** — `submitApplication` exists but no button in any rendered tree calls it; (b) the assessment engine has a **status-switch contamination bug** that retains hidden income fields when an earner is switched to "Unemployed" — this alone will fail the parity test; (c) **MFA is unimplemented** for ADMIN/ASSESSOR despite Schedule 4 §8 mandating it; (d) **six reference/config tables have RLS bypassed** (only RLS-enabled flag missing from the migration); (e) the **GDPR delete dialog is not imported anywhere** — server cascade exists, UI affordance does not; (f) **no production Supabase project, no custom domain, no Sentry, no incident-response runbook**. None of these are deep architectural rewrites; they are concentrated remediation work.

**Realistic path to acceptance.** With one focused engineer plus an ops day, the Blocker list below is ≈3 weeks of remediation work. Add the contractual independent security review and the parity test (both required under MSA clauses 14.6 and Schedule 1 §3), and a realistic Go-Live becomes mid-to-late July 2026 rather than 22 June. The 22 June date is achievable only if remediation starts within the next 5 working days, the Foundation supplies the ten parity-test cases on schedule (Schedule 1 §3 deadline: 15 May 2026, now past), and no additional scope is added.

---

## 2. Top-Line Scorecard

The Feature Verification Checklist has 32 sections across 4 parts. Each section is scored as the pessimistic verdict of its tickbox items.

| Part | Section | Verdict | Notes |
|---|---|---|---|
| **1 — Applicant Portal** | §1 Getting in | Pass | Invitation flow, registration, login, reset all working |
| | §2 Portal dashboard | Partial | Missing deadline, missing re-assessment banner, hard-coded "Continue" target |
| | §3 The 10-section form | Partial | All 10 sections present; sidebar shows 11 entries; family-ID stays in sidebar on re-assessment |
| | §4 Form fields | **Fail** | Entry-year picker absent; employment-status options don't match spec; DOB is masked text not picker |
| | §5 Adaptive form logic | **Fail** | Property ownership doesn't reveal mortgage; PAYE/SE doesn't branch uploads; income table fixed 14 rows |
| | §6 Document uploads | **Fail** | Multi-file slots not supported (single-file widget) |
| | §7 Pre-submission and submission | **Fail** | **Submission action exists but is not wired to any button** |
| | §8 Re-assessment | Partial | Pre-fill works; dashboard doesn't surface re-assessment status |
| **2 — Admin Console** | §9 Getting in (Assessor) | **Fail** | **MFA not implemented** (Schedule 4 §8 mandates it) |
| | §10 Admin dashboard | Pass | All 4 tile categories present |
| | §11 Managing rounds | **Fail** | **No code path opens a round** — they sit at DRAFT forever |
| | §12 Inviting applicants | Pass | Individual, batch, and internal-request flows all present |
| | §13 Application queue | Partial | Missing red-flag column, pagination, bulk select, distinct outcome filter |
| | §14 Tab 1: Applicant Data | **Fail** | **Inline document viewer broken** (forced download disposition) |
| | §15 Tab 2: Assessment | **Fail** | **Status-switch contamination bug** + benchmark warning never triggers + property category absent |
| | §16 Tab 3: Recommendation | Partial | Accommodation status and income category are free-text not dropdowns |
| | §17 Tab 4: History | **Fail** | Per-year schedule and prior-year drill-down absent |
| | §18 Sibling linking | Pass | Search, link, deduction, reorder, break all present |
| | §19 Internal/ad-hoc bursary | **Fail** | Calendar-year vs school-year type collision in form; no schooling-years field |
| | §20 Status workflow | Partial | "Under Review" state missing from enum; no bulk update |
| **3 — Reports/Exports/Settings** | §21 Reports | **Fail** | Only 5 of 7 canned reports present; no per-report export buttons |
| | §22 Exports for schools | Partial | XLSX/CSV correct; missing lead applicant name column |
| | §23 PDF generation | Pass | Working end-to-end with role + scope guards |
| | §24 Reference tables | **Fail** | Property classifications and income guidelines hardcoded — no Settings UI |
| | §25 Email templates | **Fail** | **Merge-field convention drift** (camelCase vs snake_case) likely ships literal `{{placeholders}}` |
| | §26 Audit log | Partial | No user filter; entity-type picker limited |
| | §27 GDPR deletion | **Fail** | **Dialog component not mounted on any page** |
| | §28 Email notifications | Partial | 6 of 7 templates trigger; REMINDER never sent; merge-field XSS hole |
| **4 — Cross-cutting** | §29 Privacy and data minimisation | Pass | Verified at query layer, not just UI |
| | §30 Mobile/accessibility/browsers | N/V | Requires runtime testing — not yet performed |
| | §31 Performance and stability | N/V | Requires runtime testing |
| | §32 Security touchpoints | Partial | HTTPS/logout/viewer-readonly all correct; document URL doesn't expire to the spec |
| **5 — Open Questions** | 10 stakeholder questions | Open | Listed in §11 of this document |

**Sections at "Fail": 14 of 32.** Sections at "Partial": 11 of 32. Sections at "Pass": 5 of 32. Sections requiring runtime testing: 2 of 32.

---

## 3. Top Blockers (must-fix before acceptance)

Each Blocker is presented as: **what + evidence + fix + effort**. Effort: S = under a day, M = 1–3 days, L = 1–2 weeks.

### B1 — Production Supabase project is empty
**Evidence:** `mcp__supabase-prod__list_tables` returns `{"tables":[]}`; `list_migrations` returns `[]`; `storage.buckets` returns `[]`. Project URL (`tdnojrqkbccikfipthmk.supabase.co`) is reachable but bare.
**Fix:** Set `PROD_DATABASE_URL` and `PROD_DIRECT_URL` as GitHub repo secrets. Trigger `db-push.yml` workflow with `target=production` (or push to `main` after the merge). Verify migrations applied via `mcp__supabase-prod__list_migrations`. Confirm region is UK/EEA. Confirm Pro tier active (PITR ≥30 days required by MSA 7.2).
**Effort:** S.
**Status**: RESOLVED

### B2 — Staging reference data is empty; storage bucket missing in both envs
**Evidence:** `SELECT count(*) FROM reason_codes, family_type_configs, school_fees, council_tax_defaults, rounds` returns 0 across the board in nonprod. Both nonprod and prod `storage.buckets` are empty. UAT (Gate G2, 18 May – 12 June) cannot proceed in the current state.
**Fix:** Split `prisma/seed.ts` into `seed-reference.ts` (idempotent, reference tables only) and `seed-demo.ts` (gated behind `ALLOW_DESTRUCTIVE_SEED=1`). Already documented in `docs/backlog/prisma-db-seed-is-destructive.md`. Run reference seed against both environments. Create `documents` bucket in both projects via Supabase dashboard or seed-script (currently the `ensureBucket()` lazy path is the only mechanism and is fragile).
**Effort:** S–M.
**Status**: RESOLVED

### B3 — Applicant submission flow is not wired
**Evidence:** `submitApplication` action exists at `src/app/(portal)/apply/actions.ts:273-402`. `SubmitApplicationButton` component exists at `src/app/(portal)/apply/review/submit-button.tsx`. Neither is imported by any rendered component. The Declaration page's "Save and Continue" button (`section-page-client.tsx:218`) calls `saveSection` and navigates to `nextHref` (which is `/` for DECLARATION). Result: no applicant can transition an application to SUBMITTED.
**Fix:** Wire `SubmitApplicationButton` into the review page and/or the Declaration section's terminal action. Confirm `status → SUBMITTED`, `submittedAt` set, confirmation email sent, post-submission read-only enforced server-side at the section page (not just at the action).
**Effort:** S.
**Status**: RESOLVED on `feature/b3-wire-applicant-submission` (pending staging smoke test). DECLARATION's terminal action now chains `saveSection` → `submitApplication`; section pages redirect SUBMITTED → `/submitted` server-side; unused `submit-button.tsx` removed.

### B4 — Assessment status-switch contamination
**Evidence:** `src/components/admin/earner-form.tsx` hides/shows `netPay`, `netDividends`, `netSelfEmployedProfit`, `pensionAmount`, `benefitsIncluded` based on employment status, but the underlying form state is never reset on status change. `src/components/admin/assessment-form.tsx:494-512` reads those fields unconditionally and feeds them into Stage 1. Concrete failure: enter £30,000 net pay under PAYE, switch to Unemployed — the form looks empty, but Stage 1 still sums £30,000 silently. Directly fails the §15 "Unemployed earner" edge-case test.
**Fix:** On `employmentStatus` change in `earner-form.tsx`, zero the fields that are no longer visible. Confirm with a test in `src/lib/assessment/__tests__/`. **Must be fixed before the parity test** — otherwise real-world assessments will diverge from the spreadsheet whenever an assessor flips a status.
**Effort:** S.
**Status**: RESOLVED on `fix/b4-earner-status-switch-contamination`. Extracted pure `resetEarnerFieldsForStatus(values, nextStatus)` from the visibility predicates; wired the Select's onValueChange to push through it. 7 unit tests covering every transition (PAYE→UNEMPLOYED, Director, Sole, OAP/Past, BENEFITS, etc.) live in `src/components/admin/__tests__/earner-form-reset.test.ts`.

### B5 — No code path opens a round
**Evidence:** `RoundStatus` enum includes `DRAFT`, `OPEN`, `CLOSED`. `createRoundAction` sets `status: DRAFT` (`src/app/(admin)/rounds/actions.ts:53-109`). No action transitions `DRAFT → OPEN`. `getActiveRound` falls back to "most recent of any status", masking the gap. Result: rounds sit at DRAFT forever; applicants registering against a DRAFT round may silently encounter undefined behaviour.
**Fix:** Add an "Open round" action (UI + server). Enforce DB-level "only one OPEN at a time" constraint or guard at the action layer. Either drop `OPEN` from the enum and rely on `DRAFT → CLOSED` only, or implement the full lifecycle. Spec calls for the latter (§11).
**Status**: RESOLVED on `feature/b5-open-close-round`. `openRoundAction` (DRAFT → OPEN) and a state-guarded `closeRoundAction` (OPEN → CLOSED) ship alongside `createRoundAction`; "only one OPEN at a time" enforced as an action-layer guard (explicit `findFirst` for `status: OPEN`) — no schema change. Both actions are ADMIN-gated and stamp `ROUND_OPENED` / `ROUND_CLOSED` audit log entries. UI: Open / Close buttons (with confirmation dialogs) wired into `RoundActionsCell` (list) and `RoundDetailActions` (detail). Out-of-scope observation: `getActiveRound` in `src/lib/db/queries/reports.ts` will still fall back to the most-recent round of any status when no OPEN round exists, so it can return a DRAFT or CLOSED round — left as-is per task scope.
**Effort:** S.

### B6 — Document inline viewer broken
**Evidence:** `src/app/api/documents/[id]/url/route.ts:74-76` sets `download: document.filename` on the signed URL, which produces `Content-Disposition: attachment`. Browsers download instead of preview. The Tab 1 "view inline" requirement (§14) cannot be satisfied.
**Fix:** Provide two endpoints (or one with a `?download=true` query param): one with attachment disposition for explicit download, one without for inline preview. Apply the same role/ownership/audit checks to both.
**Effort:** S.
**Status**: RESOLVED on `fix/b6-document-inline-viewer`. `GET /api/documents/[id]/url` now defaults to an inline-disposition signed URL and only attaches `Content-Disposition: attachment` when `?download=true` is passed. Auth/ownership/audit checks are unchanged; audit metadata records the disposition. `DocumentViewer` Download button fetches a fresh download URL on click; all other callsites use the default inline URL.

### B7 — GDPR delete dialog not mounted
**Evidence:** `gdprDeleteApplicantAction` exists at `src/app/(admin)/applications/[id]/actions.ts:471-671` and is well-engineered (Storage purge + DB anonymise + Auth user delete + audit-row anonymisation + retention guard). `GdprDeleteDialog` component exists at `src/components/admin/gdpr-delete-dialog.tsx` with two-step confirmation. Neither is imported by any rendered page. §27 cannot be ticked off — no UI affordance exists.
**Fix:** Mount `GdprDeleteDialog` on the application detail page (admin tab or layout-level action menu). Smoke-test the full path including the auth-user delete.
**Status**: RESOLVED on `feature/b7-mount-gdpr-delete-dialog` (pending staging smoke test). New `GdprDeleteAction` client wrapper (`src/components/admin/gdpr-delete-action.tsx`) renders a destructive-zone affordance in the application detail layout, ADMIN-only (`user.role === Role.ADMIN`). On confirm it invokes the existing `gdprDeleteApplicantAction`; on success the wrapper redirects to `/queue` via a minimal additive `onSuccess` prop added to `GdprDeleteDialog`.
**Effort:** S.

### B8 — MFA not implemented for ADMIN/ASSESSOR
**Evidence:** `grep -ri "mfa\|enrollFactor\|aal2"` across `src/` returns zero matches. `src/middleware.ts` reads role from `app_metadata` but does not gate on `aal2`. Login flow at `src/app/(auth)/login/page.tsx:65` is single-factor only. MSA Schedule 4 §8 makes MFA mandatory for these roles. §9 checkbox cannot be ticked.
**Fix:** Enrol Supabase TOTP factor on first staff login (`supabase.auth.mfa.enroll`); gate `/admin/*` middleware on `aal2`; force `mfa.challenge` + `mfa.verify` before issuing the session; provide backup-codes flow. ~3 days work plus admin enrolment.
**Effort:** M.

### B9 — Six reference/config tables silently world-writable
**Evidence:** Supabase advisor + `prisma/migrations/20260513090020_enable_row_level_security/migration.sql` review: `rounds`, `family_type_configs`, `school_fees`, `council_tax_defaults`, `reason_codes`, `email_templates` are granted `INSERT/UPDATE/DELETE` to `app_user` but never appear in any `ALTER TABLE … ENABLE ROW LEVEL SECURITY` statement. Policies that were later added (`20260513200000_add_email_templates_rls_policies`) are ineffective without table-level RLS enabled. Any authenticated user — including an APPLICANT — can in principle rewrite school fees, family-type config rates, or email template bodies.
**Fix:** New migration: `ALTER TABLE public.<each> ENABLE ROW LEVEL SECURITY` for all six tables. Add policies: SELECT allowed for `authenticated`, INSERT/UPDATE/DELETE gated by `public.is_admin()`. Verify with `SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND relkind='r' AND NOT relrowsecurity;` returning empty for personal-data and config tables.
**Effort:** S.

### B10 — No virus scanning on uploads
**Evidence:** `grep -r 'virus\|clamav\|malware'` returns nothing. MSA Schedule 4 §8 explicitly commits to "virus scanning of uploads". Magic-byte sniffing in `src/lib/storage/sniff.ts` is good defence against MIME spoofing, but does not detect payloads inside legitimately-shaped PDFs/images. Any document downloaded by an assessor is unscanned.
**Fix:** Integrate ClamAV via Supabase Edge Function or a queue, or call out to a cloud scanning API (VirusTotal/Cloudmersive) for low-volume MVP. Add `Document.virusScanStatus` column (`PENDING|CLEAN|INFECTED|FAILED`). Refuse to sign URLs for unscanned/infected files.
**Effort:** M–L.

### B11 — Entry-year picker missing from portal; employment dropdown wrong values
**Evidence:** §4 checklist mandates a school-year dropdown (Y6/Y7/Y9/Y12/Other) and a 7-option employment dropdown (PAYE/Benefits/Self-Employed Director/Self-Employed Sole/Old Age Pension/Past Employment Pension/Unemployed). The portal has no `entryYear` field at all (`Application.entryYear` is set only at admin invitation time, `(admin)/invitations/actions.ts:687`). `parent-details-form.tsx:60-67` offers EMPLOYED / UNEMPLOYED / SELF_EMPLOYED / SELF_EMPLOYED_CIS / SELF_EMPLOYED_AND_EMPLOYED / RETIRED — a different vocabulary that cannot map cleanly to the assessor-side `EmploymentStatus` enum that drives Stage 1 income.
**Fix:** Add `entryYear` field to child-details section. Reconcile the portal employment-status vocabulary with the assessor-side enum and Stage 1 income calculation (the assessor enum is the source of truth for the calculator). This may also reshape the income table in §32 of the form (currently a fixed 14-row list that does not adapt to employment type — §5 also asks it to).
**Effort:** M.

### B12 — Multi-file upload slots not supported
**Evidence:** `file-upload.tsx:228-231` reads `e.target.files?.[0]` — single file only. Comment in `assets-liabilities-form.tsx:73`: "FileUpload is single-file; the array is kept for multi-upload in a future WP." Three monthly bank statements (§6) and any other multi-file slot cannot be uploaded.
**Fix:** Extend `FileUpload` to accept `multiple` files, render each as a separate row, allow individual delete. Schema already supports arrays (`parent1BankStatementDocumentIds`).
**Effort:** S–M.
**Status**: RESOLVED on `feature/b12-multi-file-upload`. `FileUpload` now exposes a discriminated `multiple?: boolean` prop — single-file callsites are unchanged; multi-file mode renders one row per upload with individual remove, supports drag-and-drop of multiple files, and caps concurrent uploads at 5. Both bank-statement slots in `assets-liabilities-form.tsx` (P1 + P2) switched to `multiple` mode and now append to the array fields the schema already provides.

### B13 — Email merge-field convention drift
**Evidence:** Editor in `src/components/admin/settings/email-template-editor.tsx:180-198` advertises camelCase tags (`{{applicantName}}`, `{{childName}}`, `{{loginUrl}}`). Server-side `sendEmail` call sites pass snake_case keys (`applicant_name`, `child_name`, `registration_link`) — confirmed in `(portal)/apply/actions.ts:380`, `invitations/actions.ts:246`, `recommendation/actions.ts:173`. `replaceMergeFields()` in `src/lib/email/merge.ts:24-55` does literal `{{name}}` regex substitution — no normalisation. Net effect: if seeded templates use camelCase (per editor hint), every triggered email ships with literal `{{applicantName}}` tokens. If templates use snake_case, the editor hint is misleading to admins editing templates.
**Fix:** Pick one convention; rewrite call sites and seeded templates to match; remove the misleading hint. Add a test that asserts no `{{…}}` survives in any rendered email.
**Status**: RESOLVED on `fix/b13-email-merge-field-convention`. Convention is **snake_case** (call sites already use it; smallest diff). Editor hint chips in `src/components/admin/settings/email-template-editor.tsx` rewritten to snake_case with a comment pointing at the call-site source of truth. Seed data (`prisma/seed-data/email-templates.ts`) and the original seed migration (`20260513220100_seed_email_templates`) were already snake_case — confirmed and left unchanged. New migration `20260519161500_fix_email_template_merge_fields` defensively scrubs any camelCase drift in `email_templates.subject`/`body` via idempotent `regexp_replace` UPDATEs (no-op when no drift present). New vitest in `src/lib/email/__tests__/merge.test.ts` renders every seeded template with the snake_case keys its matching `sendEmail` call site passes and asserts zero `{{…}}` tokens survive. Orphan flagged separately: `REMINDER` template exists but no call site triggers it.
**Effort:** S.

### B14 — No custom domain; no production Vercel env vars; no Sentry
**Evidence:** `vercel.json` is region-only; no domain attached. `.env.local` and `.env.staging` reference only the nonprod Supabase project. `@sentry/nextjs` is not in `package.json` dependencies despite Schedule 5 listing Sentry as approved sub-processor and Schedule 2 budgeting £250/yr for it.
**Fix:** (1) Register `bursary.jwf.org.uk` (or Foundation-preferred domain), attach to Vercel as Production alias, set `NEXT_PUBLIC_APP_URL` and `RESEND_FROM_EMAIL` against that domain, verify the domain in Resend. (2) Populate Vercel Production scope with prod-project env vars per the matrix in §10 below. (3) `npm i @sentry/nextjs`; run `npx @sentry/wizard`; choose EU data residency; configure sourcemap upload; set up alert rules.
**Effort:** M.

### B15 — No incident-response runbook; no hypercare playbook; no user/admin guide
**Evidence:** MSA Schedule 1 §4 mandates: user guide, admin/assessor guide, technical/operational guide (deploy + env + backup + restore + incident response), data-model + API reference, open-source manifest, repo structure summary. None of these standalone artefacts exist in `docs/`. MSA clause 9.4 commits to a 2-week hypercare period with daily check-ins — no playbook documents the cadence, routing, or escalation tree.
**Fix:** Author the six required documents before G4. The technical/operational guide should at minimum cover: env-var matrix, deployment runbook, backup/restore procedure (with one executed drill logged), incident severity classification mapped to MSA Schedule 3 SLAs, on-call contact, Zoho Desk routing.
**Effort:** L (estimate 1 person-week to draft, plus screenshot capture once the system is feature-stable).

---

## 4. Gate Readiness Scorecard (MSA Schedule 1 §2)

| Gate | Target | Required artefacts | Status today | Risk |
|---|---|---|---|---|
| **G1** Beta on staging | w/c 11 May 2026 | Feature-complete on staging-like environment, regression run completed, realistic sample data loaded | **At Risk** — Code feature-complete per memory; staging Supabase reset wiped reference data + storage bucket; no automated regression-run record; no E2E suite in CI | High |
| **G2** UAT | 18 May – 12 Jun 2026 | End-to-end real scenarios; ≥10 historical parity-test cases (Schedule 1 §3) | **Not Ready** — staging unusable for assessment work until B2 fixed; no UAT scenario doc; no parity-test fixtures committed; Foundation's 15 May deadline for supplying parity cases (Schedule 1 §3) is past | Critical |
| **G3** Hardening | 15–22 Jun 2026 | Independent security review + pen test (clause 14.6); WCAG 2.1 AA check; perf/load; email volume | **Not Ready** — no independent reviewer engaged; no a11y or perf artefacts; existing internal security audit (`docs/security-audit.md`, dated 2026-05-12) lists items still open; all prod-infra setup must also fit this 5-day window | Critical |
| **G4** Go-Live | w/c 22 Jun 2026 | Cutover to live domain, assessor onboarding, hypercare start | **Not Ready** — no domain, no prod Supabase, no Sentry, no runbooks, no user/admin guide | Blocked by upstream gates |

**Forecast:** With Blockers B1–B15 remediated and ~3 weeks of focused engineering plus the independent security review and parity test, realistic Go-Live is **mid-to-late July 2026**.

---

## 5. Live Environment State

### 5.1 Supabase

| | Nonprod (`lmkmgoqezgeeyjodbvzn`) | Prod (`tdnojrqkbccikfipthmk`) |
|---|---|---|
| Region | UK (eu-west-2 / London) ✓ | Unknown — project empty |
| Tables | 22 (all RLS-enabled flag set, but see B9) | **0** |
| Migrations applied (Prisma `_prisma_migrations`) | 10 (last one `done=false`) | **0** |
| Reference data | reason_codes 0, family_type_configs 0, school_fees 0, council_tax_defaults 0 | n/a |
| Operational data | rounds 0, bursary_accounts 0, applications 0, assessments 0 | n/a |
| Email templates | 8 (includes INVITE_STAFF; merge fields suspect — see B13) | n/a |
| Audit logs | 15 | n/a |
| Profiles | 10 (5 ASSESSOR, 3 ADMIN, 2 APPLICANT; **no VIEWER for testing**) | n/a |
| Storage buckets | **none** (bucket created on first upload via fallback path) | **none** |
| Edge functions | 0 | 0 |
| Security advisors | 18 issues (6 RLS-enabled-no-policy, 7 mutable search_path, 5 SECURITY DEFINER exposed to anon) + leaked-password protection disabled | 2 issues (`rls_auto_enable` exposed to anon/authenticated) |
| Performance advisors | 11 unindexed FKs, 6 unused indexes, 8 multiple-permissive-policies warnings | 0 |

### 5.2 Vercel

| | Value |
|---|---|
| Linked project (`.vercel/project.json`) | `prj_FW9lGOF1sNN3Z6iQbHAcR1aBaU3b` ("jwf-bursary-system") under team `team_QapwZgDAoudbH4cd156Bgroq` |
| Region | `lhr1` (London) ✓ |
| Custom domain | **None attached** |
| `.env.staging` references | A **different** Vercel project ID `prj_b44il278VDS4npQCvlC8Yic8FERX` — likely stale; needs clarification |

### 5.3 GitHub workflow state

| Workflow | Trigger | Status |
|---|---|---|
| `ci.yml` (lint/typecheck/test/Prisma validate) | PR + push to main/staging | Configured. Lint is `continue-on-error`. |
| `db-push.yml` (Prisma migrate deploy) | Push to staging (→ nonprod) or main (→ prod), or workflow_dispatch | Configured but **silently skips** if `STAGING_*` / `PROD_*` secrets are unset. Explains why prod is empty. |

---

## 6. Contract Checklist — Verdict Tables (Part 1, Applicant Portal)

Severity: B = Blocker, I = Important, M = Minor, Q = Question. Verdict: P = Pass, Pt = Partial, F = Fail, N/V = not verifiable statically.

### §1 Getting in (Applicant)
| Item | V | Evidence | Sev |
|---|---|---|---|
| No "Sign up" on Portal home | P | `(auth)/login/page.tsx:98-189` | — |
| Email pre-filled on invitation link | P | `register/applicant-register-form.tsx:107-112` | — |
| Time-limited / expired link error | P | `register/actions.ts:99-112` | — |
| Set password during registration | P | `applicant-register-form.tsx:152-190`; 12-char + HIBP | — |
| Login with email + password | P | `login/page.tsx:65-95` | — |
| Password reset via email | P | `reset-password/page.tsx:40-47` | — |
| Mobile rendering of auth pages | N/V | Tailwind responsive classes present; runtime check needed | — |

### §2 Portal dashboard
| Item | V | Evidence | Sev |
|---|---|---|---|
| Status visible after login | P | `(portal)/page.tsx:82-96` | — |
| Section-by-section progress with ticks | Pt | Dashboard only shows aggregate; sidebar has ticks | M |
| Deadline shown | F | No reference to round.applicationCloseDate anywhere | I |
| "Continue Application" CTA | Pt | Hard-coded `/apply/child-details`, not first incomplete section | M |
| Re-assessment marker | F | `application.isReassessment` not read on dashboard | I |

### §3 The 10-section form
| Item | V | Evidence | Sev |
|---|---|---|---|
| Exactly 10 sections in spec'd order | P | `[section]/page.tsx:56-67` SECTION_ORDER | — |
| Free navigation between sections | P | Sidebar entries all links | — |
| Save progress at any point | P | `saveSection` + `saveSectionDraft` | — |
| Session timeout doesn't lose data | P | Server-side persistence per save | — |
| Left sidebar with 10 sections + status | Pt | Renders 11 entries (10 + synthetic Review + Declaration & Submit) | M |
| Mobile collapsed stepper | P | `portal-mobile-header.tsx` Sheet drawer | — |
| Each section has Next/Previous | P | `section-form.tsx:220-260` | — |

### §4 Form fields and entry
| Item | V | Evidence | Sev |
|---|---|---|---|
| School dropdown limited to Trinity/Whitgift | P | `child-details-form.tsx:88-91` | — |
| Entry year dropdown (Y6/Y7/Y9/Y12/Other) | F | **No `entryYear` field in any section schema** | **B** |
| Employment status dropdown per spec list | F | `parent-details-form.tsx:60-67` uses wrong enum values | **B** |
| Dependent children / elderly as table rows | P | `dependent-children-form.tsx:328-459` | — |
| Declaration text + tick-box | P | `declaration-form.tsx:21-32, 57-84` | — |
| DOB date picker | Pt | `date-input.tsx` is masked text input, not calendar | I |
| Currency formatted as £ | P | `currency-input.tsx` | — |
| Inline validation near field | P | `<FormMessage />` per field; `onBlur` mode | — |

### §5 Form logic adapts to answers
| Item | V | Evidence | Sev |
|---|---|---|---|
| Sole parent toggle hides Parent 2 | P | `parent-details-form.tsx:571-636` ConditionalField | — |
| Own property reveals mortgage + value | F | `assets-liabilities-form.tsx:119-156, 198-217` always shown | I |
| PAYE vs SE reveals different uploads | Pt | `parents-income-form.tsx:99-114` gates on **amounts**, not status | I |
| Dependent tables only when applicable | P | `hasElderlyAtHome` / `numberOfDependentChildren` watches | — |
| Gross income table adapts to employment | F | `INCOME_FIELDS` is fixed 14-row list | I |
| Changes happen live (no save needed) | P | `useWatch` + ConditionalField | — |

### §6 Document uploads
| Item | V | Evidence | Sev |
|---|---|---|---|
| Named upload slots | P | `file-upload.tsx:47-49`; concrete slot strings | — |
| Multi-file upload to single slot | F | `file-upload.tsx:228-231` reads `files?.[0]` only | **B** |
| Only PDF / JPEG / PNG accepted | P | `ACCEPTED_MIME` + magic-byte sniff `sniff.ts` | — |
| 20 MB cap | P | `file-upload.tsx:70,81-83` | — |
| Upload progress + success/error | P | `file-upload.tsx:347-485` | — |
| Filled slot visual indicator | P | Green card with check | — |
| Empty required slots flagged on review | P | `(portal)/apply/review/page.tsx:425-435` | — |
| Mobile camera capture | N/V | No `capture="environment"` on input; runtime-dependent | — |
| Distinct test filenames at applicant side | N/V | Tester-controlled | — |

### §7 Pre-submission review and submission
| Item | V | Evidence | Sev |
|---|---|---|---|
| Review page listing incomplete items by section | P | `review/page.tsx:498-559` | — |
| Each incomplete item clickable, jumps to section | P | `#fieldRef` hash + `section-page-client.tsx:227-264` | — |
| Submit disabled until everything in place | P | `review/page.tsx:662-688` | — |
| Declaration tickbox required | P | `declaration-form.tsx:57-84` | — |
| **Actual submission wiring** | **F** | **`SubmitApplicationButton` not imported anywhere; `submitApplication` action never invoked from rendered tree** | **B** |
| Confirmation page with summary | Pt | `submitted/page.tsx` shows ref + date + child name but no read-only echo | I |
| Confirmation email sent | P | `(portal)/apply/actions.ts:376-395` — but unreachable per the line above | — |
| Read-only post-submission | Pt | `getOwnedApplicationContext` filters PRE_SUBMISSION but section pages still render editable forms; saves silently fail | I |
| Dashboard reflects "Submitted" with date | P | `StatusBadge` mapped from `application.status` | — |

### §8 Re-assessment
| Item | V | Evidence | Sev |
|---|---|---|---|
| Re-assessment invitation email | P | `(admin)/invitations/actions.ts:670-709` | — |
| Dashboard makes re-assessment clear | F | `isReassessment` not read on dashboard | I |
| Pre-fill lead applicant address | P | `reassessment.ts:17-22` PREPOPULATED_SECTIONS | — |
| Pre-fill child name/DOB/school | P | CHILD_DETAILS pre-populated + BursaryAccount carry-over | — |
| Pre-fill names of dependents | P | DEPENDENT_CHILDREN + DEPENDENT_ELDERLY | — |
| Financial sections start blank | P | FINANCIAL_SECTIONS upsert with `data: {}` | — |
| Family ID hidden on re-assessment | Pt | URL redirects but sidebar still shows entry | M |
| Pre-filled fields editable | P | Same form components; no read-only flag | — |

---

## 7. Contract Checklist — Verdict Tables (Part 2, Admin Console)

### §9 Getting in (Assessor)
| Item | V | Evidence | Sev |
|---|---|---|---|
| Email + password | P | `(auth)/login/page.tsx` | — |
| MFA required for assessors | F | **No TOTP/MFA enforcement anywhere; no `aal2` check in middleware** | **B** |
| Password reset via email | P | `reset-password/actions.ts` | — |
| Lockout / rate-limit after failures | Pt | IP-based 5/15min via KV; **fails open if KV unconfigured** | I |
| Applicant blocked from /admin | P | `middleware.ts:135-145` | — |
| Viewer role read-only | P | `assessment-form.tsx` `isViewer` gates | — |

### §10 Admin dashboard
| Item | V | Evidence | Sev |
|---|---|---|---|
| At-a-glance tiles for current round | P | `(admin)/admin/page.tsx:227-288` | — |
| Outcome distribution Qualifies / DNQ | Pt | Counts shown but no dedicated chart | M |
| Quick links to queue, rounds, invitations, reports | Pt | Tiles link to queue + rounds only | M |
| Recent activity panel | P | `ActivityFeed` reads audit log | — |

### §11 Managing rounds
| Item | V | Evidence | Sev |
|---|---|---|---|
| Create round (year, open, close, decision) | P | `rounds/actions.ts:53-109` | — |
| Edit round dates before close | P | `updateRoundAction` | — |
| Close round | P | `closeRoundAction` | — |
| List with status | P | `rounds/page.tsx` | — |
| Historical rounds viewable | P | `listRounds` returns all | — |
| **Only one active at a time** | **F** | **No action transitions DRAFT → OPEN; rounds sit at DRAFT** | **B** |

### §12 Inviting applicants
| Item | V | Evidence | Sev |
|---|---|---|---|
| Individual invite | P | `send-invitation-form.tsx` + `invitations/actions.ts` | — |
| Send generates link + email | P | `Invitation.token` + Resend | — |
| Email contains link/deadline/instructions | P | Template stored; merge-field issue (see §25) | — |
| Batch re-assessment invitation | P | `batchReassessmentInviteAction:284` | — |
| Internal/pastoral invite | P | `InternalRequestDialog` | — |
| Invitation status tracking | P | `Invitation.status` enum | — |

### §13 Application queue
| Item | V | Evidence | Sev |
|---|---|---|---|
| Table with required columns | P | `application-table.tsx:337-377` | — |
| Names hidden by default | P | Conditional on `namesRevealed` | — |
| Show Names toggle audit-logged | P | `/api/applications/names` writes `NAME_REVEAL` | — |
| Red flag indicator column | F | Flags exist on Assessment, not surfaced in queue | I |
| Filter by status/school/round/outcome | Pt | Outcome filter missing as distinct control | M |
| Sort by any column | P | TanStack table | — |
| Pagination | F | No `getPaginationRowModel`; entire set rendered | I |
| Row click opens detail | Pt | Open button only; row click not bound | M |
| Multi-row select + bulk action | F | No checkboxes, no bulk endpoint | I |

### §14 Tab 1: Applicant Data + Document round-trip
| Item | V | Evidence | Sev |
|---|---|---|---|
| Read-only 10-section view | Pt | `applications/[id]/page.tsx` exists; per-section read-only rendering not deep-verified | Q |
| Document list | P | `document-list-client.tsx` | — |
| **View inline** | **F** | **Signed URL forces `attachment` disposition (`url/route.ts:75`)** | **B** |
| Download | P | Same signed URL | — |
| Page nav + zoom controls | Pt | Zoom for images only; PDFs depend on iframe (which fails due to download disposition) | I |
| Mark as verified | P | `/api/documents/[id]/verify` | — |
| Assessor upload on behalf | P | `/api/admin/documents/route.ts` | — |
| Request docs email (customisable) | P | `missing-docs-dialog.tsx` | — |
| Slot fidelity | P | `Document.slot` stored as written | — |
| Filename matches | P | `Document.filename` unchanged | — |
| Inline content matches uploaded | N/V | Inline path broken; runtime check would be needed | Q |
| Parent 1 / Parent 2 doc separation | P | Slot string is opaque per upload | — |
| Multi-file slot shows all | P | All rows surfaced from `documents` query | — |
| Replace file (overwrite) | Pt | New row per upload; no replace semantic | I |
| Add to multi-file slot preserves earlier | P | Each upload = new row | — |
| Upload date matches | P | `uploadedAt @default(now())` | — |
| Tab 2 doc picker matches Tab 1 labels | P | Same `documents` list passed | — |
| Assessor-uploaded files distinguished | Pt | `uploadedBy` recorded; no UI badge | M |
| Cross-account isolation | P | RLS + `is_owner / is_admin / is_assigned_assessor` checks | — |
| Downloaded vs inline-viewed match | N/V | Same signed URL drives both | — |

### §15 Tab 2: Assessment (calculation engine)
| Item | V | Evidence | Sev |
|---|---|---|---|
| Split-screen layout | P | `assessment/page.tsx:331-334` | — |
| Document picker on left | P | `DocumentListClient` | — |
| Header shows reference not name | Pt | Anonymised earner labels verified; header runtime check needed | Q |
| Parent 1 / Parent 2 labels | P | `earner-form.tsx:50-58` hard-coded | — |
| Family type auto-fills rent/utilities/food | P | `assessment-form.tsx:385-393` | — |
| School auto-fills annual fees | P | `defaultAnnualFees` from `getConfigsForAssessment` | — |
| Entry year auto-calculates schooling years | Pt | Form-side `calcSchoolingYears` diverges from canonical `schooling-years.ts` table | I |
| Council tax defaults Band D Croydon | P | `defaultCouncilTax` from reference query | — |
| Auto-populated values editable | P | Inputs editable; overrides persisted | — |
| Per-earner inputs match employment type | P | `earner-form.tsx:61-81` visibility predicates | — |
| Included benefits input | P | `benefits-inc` field | — |
| Excluded benefits input | P | `benefits-exc` field | — |
| Live per-earner total | P | `calcEarnerTotal` | — |
| Live household total | P | `calculation-display.tsx:188-198` | — |
| Mortgage-free checkbox | P | Section C toggle + `stage2-assets.ts:54-58` | — |
| Additional property count + income | P | Section C fields | — |
| Cash savings + ISAs/PEPs/shares | P | Section C fields | — |
| School-age children divisor | P | `calculateDerivedSavings` | — |
| Derived savings annual shown | Pt | Computed and persisted but never displayed | M |
| Notional rent + council tax shown | P | Auto-populated readback boxes | — |
| Stage 2 net assets live | P | `calculation-display.tsx:200-211` | — |
| Stage 3 HNDI live | P | Lines 213-222 | — |
| Stage 4 required bursary live | P | Lines 224-233 | — |
| Payable fees breakdown | P | Lines 236-269 | — |
| Yearly + monthly shown | P | Lines 273-289 | — |
| Manual adjustment £ field | P | Section D | — |
| Reason required when adjustment ≠ 0 | Pt | Conditional in UI; not enforced server-side | I |
| Adjustment reflected in final fees | P | `payable-fees.ts:55` | — |
| Property category 1-12 dropdown | Pt | **Field does not exist in Assessment form; only Recommendation form** | I |
| £750K threshold advisory | Pt | Only in Recommendation form; uses hard-coded category 8, not £ | M |
| Save at any point | P | Auto-save + manual | — |
| Status dropdown | Pt | Badges + Pause/Complete buttons; no single dropdown | M |
| Outcome selector on Completed | Pt | In Recommendation tab, not Assessment tab as spec'd | M |
| Reload integrity | P | Stage results persisted; reference defaults only when null | — |
| **Stage 1 = sum of net pay** | P | `stage1-income.ts:22-32` | — |
| Stage 2 = S1 - rent - council tax + savings | P | `stage2-assets.ts:42-77` | — |
| Stage 3 = S2 - utilities - food | P | `stage3-living.ts:19-25` | — |
| Stage 4 = annualFees - HNDI, floored | P | `stage4-bursary.ts:21-29` | — |
| Net yearly = gross - scholarship - bursary | P | `payable-fees.ts:47-48` | — |
| Yearly payable = net + VAT | P | Lines 50-52 | — |
| Monthly = yearly / 12 | P | Line 53 | — |
| **Sole parent (Parent 2 ignored)** | **F** | **No sole-parent toggle in assessment form; both parents always sum** | I |
| **Unemployed earner zeroed** | **F** | **`earner-form.tsx`: switching to Unemployed hides fields but does NOT reset netPay/dividends/etc; hidden values continue to feed Stage 1** | **B** |
| Included vs excluded benefits | P | Only `benefitsIncluded` in `stage1-income.ts:27` | — |
| Mortgage-free sign correct | P | `stage2-assets.ts:54-58` cancels correctly | — |
| Additional property +£5K → Stage 2 +£5K | P | Lines 60-63 | — |
| Savings divisor formula | P | `calculateDerivedSavings`: `(cash + isas) / children / years` | — |
| Override survives save+reload | P | Persisted Decimal; re-applied on reload | — |
| Scholarship 100% → net £0 pre-VAT | P | `Math.max(0, ...)` | — |
| Bursary > net fees floors at 0 | P | Same | — |
| Required bursary floors at 0 | P | `stage4-bursary.ts:25` | — |
| Manual adjustment sign convention | P | Hint matches code | — |
| Adjustment vs VAT order | Pt | Applied **after** VAT; spec ambiguous | Q |
| Live recalc on every change | P | `useMemo` + 150ms debounce | — |
| Save+reload integrity | Pt | Subtle risk: defaults re-pull from reference table on reload if not overridden — historical drift | I |
| Sibling fees deducted from HNDI | P | `sibling.ts:22-27` | — |
| Child 2 sees Child 1's fees | P | Filter by `priorityOrder < own.priorityOrder` | — |
| Child 1 unaffected by linking | P | Older-sibling filter excludes self | — |
| Three-child chain | P | Reduce sums older siblings | — |
| Re-order primary recalculates | P | `priorityOrder` is sort key | — |
| Benchmark warning when below | Pt | `BenchmarkDisplay` supports it but **`assessment/page.tsx:101` passes `currentYearlyPayableFees={undefined}` so warning never fires** | I |
| No warning when above | P | When defined and above, info banner shown | — |
| Benchmark = year-1 original | P | `BursaryAccount.benchmarkPayableFees` persisted | — |
| 10 historical parity cases supplied | N/V | Foundation obligation; deadline 15 May 2026 passed | I |
| All within 5% | N/V | Pending cases | I |
| Assessor agrees engine fit | N/V | Pending | — |

### §16 Tab 3: Recommendation
| Item | V | Evidence | Sev |
|---|---|---|---|
| Family synopsis auto-suggested | Pt | Field exists as free textarea; no auto-population | M |
| Accommodation status dropdown | F | Free-text Input not dropdown (`recommendation-form.tsx:428-433`) | I |
| Income shown as band | F | Free-text Input not band selector (lines 437-444) | I |
| Property category 1-12 | P | Dropdown lines 454-469 | — |
| Bursary award / fees pre-filled, editable | Pt | Pre-filled but **read-only** (lines 376-400) | M |
| Red flag checkboxes | Pt | Display-only mirror of Assessment values | M |
| ~35 reason codes multi-select | P | `ReasonCodeSelector` | — |
| Deprecated codes hidden from new, visible on historical | F | Historical refs to deprecated codes silently drop from picker | I |
| Free-text summary | P | `summary` Textarea | — |
| Save Draft / Complete | Pt | Single Save; outcome via separate dialog; no explicit Draft state | M |

### §17 Tab 4: History & Audit Trail
| Item | V | Evidence | Sev |
|---|---|---|---|
| **Year-by-year schedule** | **F** | `history/page.tsx` shows only audit timeline | I |
| **Click into prior year full view** | **F** | No navigation surface | I |
| Chronological per-app audit log | P | `getAuditLogsForEntity` | — |
| Audit log read-only | P | No mutation handlers; DB-level immutability | — |

### §18 Sibling linking
| Item | V | Evidence | Sev |
|---|---|---|---|
| Search by name / ref / email | P | `/api/siblings/search` + `SiblingLinker` | — |
| Click result creates link | P | "Link as Sibling" → siblings API | — |
| Visible listing per record | P | `SiblingList` table | — |
| Auto-deduct eldest's fees | P | `applySiblingDeductions` | — |
| Three-sibling chain | P | Reduce over array | — |
| Cross-school works | P | No school filter | — |
| Re-order priority | P | `reorderSiblingPriority` | — |
| Break link | P | DELETE on `/api/siblings/[id]` | — |

### §19 Internal/ad-hoc bursary requests
| Item | V | Evidence | Sev |
|---|---|---|---|
| Outside standard round | P | `Application.isInternal=true` | — |
| Non-standard entry year (e.g. Y10) | F | Form uses **calendar year 2020-2040**, not school year | I |
| Schooling-years-remaining editable | F | Field absent from internal request dialog | I |
| Rolls into standard cycle | P | `isInternal` flag-only | — |
| Same WS-/TS- reference format | P | Shared reference assignment | — |

### §20 Status workflow
| Item | V | Evidence | Sev |
|---|---|---|---|
| Pre-Submission → Submitted → Under Review → Completed | Pt | No "Under Review" state; uses NOT_STARTED as proxy | I |
| Paused state | P | `ApplicationStatus.PAUSED` + actions | — |
| Audit-logged | P | `APPLICATION_STATUS_CHANGED` logged | — |
| Bulk status updates | F | No endpoint, no UI | I |

---

## 8. Contract Checklist — Verdict Tables (Part 3, Reports/Exports/Settings)

### §21 Reports & analytics
| Item | V | Evidence | Sev |
|---|---|---|---|
| Round summary | F | Not on reports page | I |
| Bursary awards | F | No report card | I |
| Income distribution | P | `getIncomeBandDistribution` `reports.ts:390-430` | — |
| Property category distribution | Pt | No £750K threshold highlight | M |
| Reason code frequency | P | `getReasonCodeFrequency:471-501` | — |
| Active bursaries final-year | F | No query, no card | I |
| Sibling bursary summary | F | No query, no card | I |
| Round filter | P | `RoundSelector` | — |
| School filter on reports | F | Not present | I |
| Export CSV/XLSX per report | F | Reports page has no Export buttons | I |
| Export PNG for charts | F | No image-export code | I |
| Reference numbers by default | P | No names in report flows | — |
| Ad-hoc builder (optional) | F | Not implemented (Should-have RP-08) | M |

### §22 Exports for schools
| Item | V | Evidence | Sev |
|---|---|---|---|
| CSV or XLSX export | P | `/api/exports/recommendations/route.ts` | — |
| Required columns | Pt | 14 cols present; **missing lead applicant name** | I |
| Income/property as CATEGORY | P | `exports.ts:124-127` | — |
| Round + school filters | P | `ExportFilterForm` | — |
| Clean formatting | P | `xlsx.ts:66-138` | — |
| Completed recs only | P | `exports.ts:50-54` filter | — |

### §23 PDF generation
| Item | V | Evidence | Sev |
|---|---|---|---|
| Download button | P | `recommendation/page.tsx:151` → `/api/pdf/recommendation/{id}` | — |
| Complete summary | P | `recommendation-pdf.tsx` includes all required blocks | — |
| Opens in standard readers | P | `application/pdf` content-type via @react-pdf | — |
| Role + scope guards | P | `requireRole([ADMIN, ASSESSOR, VIEWER])` + `requireApplicationAccess` | — |

### §24 Reference tables
| Item | V | Evidence | Sev |
|---|---|---|---|
| Family type categories 1-6 | P | `FamilyTypeConfig` model + settings tab | — |
| School fees w/ effective dates | P | `SchoolFees` model + tab | — |
| Council tax default | P | `CouncilTaxDefault` model + form | — |
| **Property classifications 1-12 editable** | **F** | **No `PropertyClassification` model; no settings tab; hardcoded ints** | I |
| **Income guideline thresholds editable** | **F** | **No model; bands hardcoded in `reports.ts:402-409`** | I |
| Reason codes (add/edit/deprecate/sort) | P | `ReasonCode` model + UI | — |
| One-click save | P | `revalidatePath('/settings')` | — |
| Historical snapshot preserved | P | Reference values stored on Assessment row at save time | — |

### §25 Email templates
| Item | V | Evidence | Sev |
|---|---|---|---|
| Invitation | P | `EmailTemplateType.INVITATION` | — |
| Submission confirmation | P | `CONFIRMATION` | — |
| Missing-docs request | P | `MISSING_DOCS` | — |
| Outcome Qualifies | P | `OUTCOME_QUALIFIES` | — |
| Outcome DNQ | P | `OUTCOME_DNQ` | — |
| Re-assessment invite | P | `REASSESSMENT` | — |
| Reminder | Pt | Template exists; **no code sends it** | I |
| Subject editable | P | `email-template-editor.tsx:149-159` | — |
| Body editable | P | Plain Textarea (Q1 in §11 of this doc) | — |
| Merge-field list visible | P | `email-template-editor.tsx:180-198` | — |
| Save → effective for future sends | P | `upsertEmailTemplateAction`; `sendEmail` loads from DB | — |
| **Merge-field naming consistency** | **F** | **Editor camelCase vs call-sites snake_case — likely ships literal `{{placeholders}}`** | **B** |

### §26 Audit log
| Item | V | Evidence | Sev |
|---|---|---|---|
| System-wide audit page | P | `audit/page.tsx` | — |
| Filter by user | F | No userId filter | I |
| Filter by action type | P | Free-text contains | — |
| Filter by entity type | P | Hardcoded select | — |
| Filter by date range | P | startDate/endDate | — |
| Read-only | P | No mutation UI; DB-level immutability | — |
| Name-reveal recorded | P | `api/applications/names/route.ts:45` `NAME_REVEAL` | — |

### §27 GDPR right to deletion
| Item | V | Evidence | Sev |
|---|---|---|---|
| **Delete Applicant Data action available** | **F** | **`gdprDeleteApplicantAction` exists; `GdprDeleteDialog` NOT imported anywhere — no UI affordance** | **B** |
| Two-step confirmation dialog | N/V | Component exists but unmounted | I |
| Dialog lists what's deleted | P (code) | `gdpr-delete-dialog.tsx:155-195` itemises | — |
| App removed from queue/reports | P | `actions.ts:577` anonymises childName/childDob; `revalidatePath('/queue')` | — |
| Login disabled (auth user removed) | P | `actions.ts:622-624` `admin.auth.admin.deleteUser` | — |
| Audit entry with no personal data | P | `actions.ts:644-658` GDPR_DELETION row | — |
| 7-year retention guard | P | `actions.ts:512-522` | — |
| Storage files removed | P | `actions.ts:528-536` iterates documents | — |

### §28 Email notifications end-to-end
| Item | V | Evidence | Sev |
|---|---|---|---|
| Invitation fires | P | `invitations/actions.ts:246` | — |
| Submission confirmation fires | P | `(portal)/apply/actions.ts:377` — but **unreachable** due to B3 | — |
| Missing-docs request fires | P | `applications/[id]/actions.ts:209` | — |
| Outcome notification fires | P | `applications/[id]/actions.ts:364` | — |
| Re-assessment invite fires | P | `invitations/actions.ts:399` | — |
| Reminder fires | F | No call site | I |
| Merge fields substituted | Pt | See B13 — convention drift | **B** |
| Delivery latency reasonable | N/V | Runtime check needed | Q |

---

## 9. Contract Checklist — Verdict Tables (Part 4, Cross-Cutting)

### §29 Privacy and data minimisation
| Item | V | Evidence | Sev |
|---|---|---|---|
| Names hidden in queue by default | P | `listApplications` select omits names | — |
| Show Names toggle audit-logged | P | `NAME_REVEAL` rows | — |
| Assessment workspace uses ref, "Parent 1/2" labels | P | `ApplicationWithDetails` omits childName; earner labels hard-coded | — |
| Reports default to ref numbers | P | No name-pulling code in reports flow | — |
| Export shows income/property as categories | P | `exports.ts` uses incomeCategory/propertyCategory strings | — |
| Schools have no login | P | No school role in schema | — |

### §30 Mobile, accessibility, browsers
All items: **N/V** — requires runtime testing on actual devices/browsers. Not yet performed. Recommend WCAG 2.1 AA audit as part of G3 hardening per MSA Schedule 1 §2.

### §31 Performance and stability
All items: **N/V** — requires runtime testing. Recommend Lighthouse + WebPageTest baseline + assessment-workspace load test (20 MB document upload, hour-long session integrity) as part of G3.

### §32 Security touchpoints visible from UI
| Item | V | Evidence | Sev |
|---|---|---|---|
| HTTPS everywhere | P | HSTS preload set; Vercel/Supabase managed | — |
| Logout actually logs out | P | `auth/logout/route.ts` with Origin/Referer check | — |
| Viewer-role read-only | P | `isViewer` gates write actions | — |
| Document URL doesn't open in fresh browser without auth | Pt | 5-min signed URL; expires fast but **forces download not preview** (see B6) | I |

---

## 10. Environment Variable Coverage Matrix

| Var | Type | Vercel Production | Vercel Preview | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes (prod project) | Yes (nonprod project) | Distinct per env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes | Yes | Distinct per env |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Yes | Yes | Server-only |
| `DATABASE_URL` | Secret | Yes (prod transaction pooler :6543) | Yes | Prisma runtime |
| `DIRECT_URL` | Secret | Yes (prod session pooler :5432) | Yes | Prisma migrations |
| `RESEND_API_KEY` | Secret | Yes (prod-domain key) | Yes | Distinct keys |
| `RESEND_FROM_EMAIL` | Server | Yes (`bursary@jwf.org.uk` on verified domain) | Yes | **Domain must be verified in Resend before G4** |
| `RESEND_WEBHOOK_SECRET` | Secret | **Yes — currently commented out in staging** | Yes | Required for webhook signature verification |
| `KV_REST_API_URL` | Server | **Yes — currently commented out in staging** | Yes | Vercel KV / Upstash for rate limiting; **rate limit fails open without this** |
| `KV_REST_API_TOKEN` | Secret | Yes | Yes | Pair with above |
| `NEXT_PUBLIC_APP_URL` | Public | Yes (prod domain) | Optional (falls back to `VERCEL_URL`) | **Missing from `.env.example`** |
| `SUPABASE_STORAGE_BUCKET` | Server | Optional (default `"documents"`) | Optional | **Missing from `.env.example`** |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Public/Secret | **Required (currently absent)** | Required | Contractually mandated, see B14 |

---

## 11. Open Questions for the Foundation (Checklist Part 5)

These items came up during the audit and require Foundation input before sign-off. They are not bugs — they are decision points.

1. **Email template editor format.** Plain text-with-merge-tags (current) vs WYSIWYG. Current implementation: Textarea + tag list — adequate but not rich.
2. **In-portal applicant notifications.** Email-only (current) vs in-portal notification badge. No badge code exists today.
3. **Family type category selection.** Manual assessor pick (current) vs auto-suggest from declared household. Auto-suggest not implemented.
4. **Manual adjustment reason format.** Free-text (current) vs dropdown of pre-defined reasons. Free-text not enforced server-side — see §15 verdict table; recommend dropdown + enforcement.
5. **Deprecated reason code visual treatment.** Currently: hidden from new-recommendation picker; historical references silently drop. Recommend: show greyed-out in the picker AND preserve historical selection labels (see §16 verdict — currently a Fail).
6. **PDF summary content.** Recommendation-only (current) vs full application+assessment+recommendation. Recommendation-only PDF is shipping.
7. **Property £750K threshold.** Advisory (current) vs blocking. Current: advisory in Recommendation form only, uses hard-coded category 8 not a £ comparison.
8. **Re-assessment pre-population vs staleness.** Pre-filled-editable (current) vs blank-to-force-re-entry. Current behaviour is pre-filled-editable.
9. **Locked post-submission view.** Read-only full echo vs "Submitted — awaiting outcome" summary. Currently the latter (see §7 verdict).
10. **Reference-table effective-date scheduling.** Edit-and-save-now (current) vs schedule-for-future-date. Schema supports `effectiveFrom` on FamilyTypeConfig and SchoolFees but UI applies immediately.

**Additional decision needed beyond Part 5:**

11. **Manual adjustment vs VAT order.** Code applies the adjustment **after** VAT and yearly aggregation. Spec is ambiguous. Confirm intended order for parity testing.
12. **Vercel project identity.** `.vercel/project.json` references `prj_FW9lG…`; `.env.staging` references `prj_b44il…`. Is one stale, or are there genuinely two Vercel projects?

---

## 12. Schedule 4 §8 TOM Compliance Scorecard

| TOM | Status | Notes |
|---|---|---|
| TLS 1.2+ in transit | Pass | Managed by Vercel/Supabase + HSTS preload |
| AES-256 at rest (DB + Storage) | Pass | Managed by Supabase |
| **MFA mandatory for admin & assessor** | **FAIL** | See B8 |
| RBAC least-privilege | Pass | 5 roles + middleware + RLS + `app_user` Prisma connection |
| Data minimisation (default-anon, audited reveals) | Pass | Verified at query layer not just UI |
| Time-limited signed URLs | Pass | 5-min expiry + `Content-Disposition: attachment` (though see B6 — disposition is too aggressive for inline preview) |
| Immutable audit trail | Partial | DB-level immutability solid; CRUD coverage incomplete (no logs on assessment edits, recommendation saves, status changes) |
| OWASP Top 10 hardening | Partial | Strong on injection/headers/RLS; weak on A04 (MFA), email-merge XSS, CSV formula injection |
| CSP headers | Partial | Present; `unsafe-inline` weakens script policy (acknowledged with TODO) |
| Rate-limited auth | Partial | Implemented but fails open if KV unconfigured |
| **Virus scanning of uploads** | **FAIL** | See B10 |
| Daily backups + PITR ≥30d | Pass (managed) | Confirm Pro tier on both nonprod and prod |
| Annual GDPR review | n/a (contractual) | — |
| Independent pen-test before Go-Live (clause 14.6) | Pending | Cannot proceed until B8/B9/B10 remediated |
| Sub-processors ISO 27001 / SOC 2 | Pass (vendor-side) | Document and attach to Schedule 5 cover note |

---

## 13. Documentation Gaps (MSA Schedule 1 §4)

| Deliverable | Status | Action |
|---|---|---|
| User guide (applicant) | Missing | Author `docs/user-guide.md` with screenshots |
| Admin / assessor guide | Missing | Author `docs/admin-guide.md` |
| Technical guide — deployment | Partial (TDD §9) | Lift into `docs/ops/deployment.md` |
| Technical guide — env config | Missing | Use the matrix in §10 above |
| Technical guide — backup/restore | Missing | Author `docs/ops/backup-restore.md`; execute one nonprod restore drill |
| Technical guide — incident response | Missing | Author `docs/ops/incident-response.md` mapped to MSA Schedule 3 SLAs |
| Data model + API reference | Partial | Generate ERD; document `src/app/api/**` |
| Open-source manifest (MSA 12.2) | Missing | `license-checker` against prod deps |
| Repo structure summary (MSA 13.1(c)) | Missing | One-page `docs/repo-structure.md` |
| Quarterly review template (MSA 9.6) | Missing | Author `docs/ops/quarterly-review-template.md` |
| Hypercare playbook (MSA 9.4) | Missing | Author `docs/ops/hypercare.md` for 2-week post-go-live cadence |

---

## 14. Prioritized Punch List

### Tier 1 — Blockers (must fix before Foundation acceptance)

| # | Item | Domain | Effort | Owner |
|---|---|---|---|---|
| B1 | Provision prod Supabase project; set CI secrets | Ops | S | Eng + Brian |
| B2 | Split seed (`seed-reference.ts` idempotent + `seed-demo.ts` gated); run reference seed against both envs; create `documents` Storage bucket in both | Data | S–M | Eng |
| B3 | Wire `SubmitApplicationButton` into review/declaration flow | Feature | S | Eng |
| B4 | Reset hidden earner fields on employment-status change | Feature/Calc | S | Eng |
| B5 | Add "Open round" action and one-active-at-a-time guard | Feature | S | Eng |
| B6 | Provide inline-preview document URL variant (no `attachment` disposition) | Feature | S | Eng |
| B7 | Mount `GdprDeleteDialog` on application detail | Feature | S | Eng |
| B8 | Implement MFA for ADMIN/ASSESSOR via Supabase TOTP + `aal2` gate | Security | M | Eng |
| B9 | Enable RLS on `rounds`, `family_type_configs`, `school_fees`, `council_tax_defaults`, `reason_codes`, `email_templates` + add admin-gated policies | Security | S | Eng |
| B10 | Add virus scanning on document uploads + `virusScanStatus` column | Security | M–L | Eng |
| B11 | Add entry-year picker to portal; reconcile employment-status vocabulary across portal/assessor | Feature | M | Eng |
| B12 | Extend `FileUpload` to support multi-file slots | Feature | S–M | Eng |
| B13 | Pick one merge-field convention; rewrite call sites and seeded templates; add test | Feature | S | Eng |
| B14 | Custom domain + populate Vercel Production env + wire Sentry | Ops | M | Eng + Brian |
| B15 | Author user guide, admin/assessor guide, ops runbook, hypercare playbook | Documentation | L | Eng (or Brian) |

### Tier 2 — Important (must fix before Go-Live; manual workaround may exist)

| # | Item | Domain | Effort |
|---|---|---|---|
| I1 | `db-push.yml` fails silently when secrets missing — change to fail hard for `main` branch | Ops | S |
| I2 | Persist last `done=false` migration in nonprod; investigate why it didn't complete | Ops | S |
| I3 | Address Supabase advisor: 7 functions with mutable `search_path`; 5 SECURITY DEFINER exposed to anon | Security | S |
| I4 | Enable Supabase Auth leaked-password protection | Security | S |
| I5 | Email merge-field stored-XSS — HTML-escape values before rendering | Security | S |
| I6 | CSV/XLSX formula injection — prefix `= + - @ \t \r` cells with apostrophe | Security | S |
| I7 | Rate-limiter must fail closed (or crash) in production if KV unconfigured | Security | S |
| I8 | Audit-log coverage gaps: add `createAuditLog` to assessment save, recommendation save, application status change, round status change | Security | S |
| I9 | Property ownership conditional reveal in assets section | Feature | S |
| I10 | PAYE vs SE conditional upload branching in income section | Feature | M |
| I11 | Income table adapts to employment type | Feature | M |
| I12 | DOB date picker (replace masked text input) | Feature | S |
| I13 | Portal dashboard: deadline + re-assessment banner + dynamic "Continue" target | Feature | S |
| I14 | Post-submission section pages should refuse to render editable forms (not just silently fail saves) | Feature | S |
| I15 | Confirmation page read-only echo of submitted data (or explicit decision to leave it summary-only per Q9) | Feature | M |
| I16 | Queue: red-flag column, pagination, bulk select, distinct outcome filter | Feature | M |
| I17 | Assessment Tab: sole-parent toggle | Feature | S |
| I18 | Assessment Tab: property-category dropdown + £750K £-based advisory | Feature | S |
| I19 | Schooling-years calc: use canonical `schooling-years.ts` table instead of calendar-year arithmetic | Calc | S |
| I20 | Benchmark warning: plumb live `currentYearlyPayableFees` to `BenchmarkDisplay` | Feature | S |
| I21 | Manual adjustment reason: enforce required server-side when adjustment ≠ 0 | Feature | S |
| I22 | Reference-table snapshot integrity: pin reference values on Assessment save so historical reload never re-pulls defaults | Calc | M |
| I23 | Recommendation: dropdown accommodation status; band-selector income category | Feature | S |
| I24 | Recommendation: editable bursary award / fees fields (currently read-only) | Feature | S |
| I25 | Recommendation: preserve deprecated reason-code labels on historical recs | Feature | S |
| I26 | History Tab: year-by-year schedule + drill-down to prior-year assessments | Feature | M |
| I27 | Internal request: school-year (not calendar year) field; add editable schooling-years field | Feature | S |
| I28 | Reports: add Round Summary, Bursary Awards, Active Bursaries Final Year, Sibling Bursary Summary | Feature | M–L |
| I29 | Reports: add per-report Export buttons (CSV, XLSX, PNG) + school filter | Feature | M |
| I30 | Exports: add lead applicant name column to recommendation export | Feature | S |
| I31 | Settings: add Property Classifications + Income Guideline Thresholds tabs (new models + UI) | Feature | M |
| I32 | Email: implement Reminder send path (queue action with bulk select) | Feature | S |
| I33 | Audit: add userId filter | Feature | S |
| I34 | Performance advisors: address 11 unindexed FKs and 8 multiple-permissive-policies warnings | DB | S–M |
| I35 | Run independent pen test (MSA clause 14.6) after B8/B9/B10 fixed | Security | External |
| I36 | Run WCAG 2.1 AA audit (G3 requirement) | a11y | External |
| I37 | Perf/load baseline (G3 requirement) | Perf | M |

### Tier 3 — Minor (post-launch polish)

| # | Item | Effort |
|---|---|---|
| M1 | Portal sidebar shows 11 entries instead of 10 (synthetic Review + Declaration & Submit) | S |
| M2 | Portal sidebar shows Family ID on re-assessment (URL redirects but link stays visible) | S |
| M3 | Dashboard: dedicated outcome distribution chart | S |
| M4 | Dashboard: quick links to invitations and reports tiles | S |
| M5 | Queue: row click opens detail (currently button only) | S |
| M6 | Document list: visual badge for assessor-uploaded files | S |
| M7 | Property category distribution chart: highlight £750K threshold | S |
| M8 | Recommendation: explicit Draft / Complete states (currently single Save) | S |
| M9 | Generic error responses (don't leak Prisma class names) | S |
| M10 | Webhook delivery event persistence to `EmailDeliveryEvent` table | M |
| M11 | Document DELETE endpoint: permit admin role (currently lead-applicant-only) | S |
| M12 | Name-reveal API: allow ADMIN and VIEWER (currently ASSESSOR-only) | S |
| M13 | Resolve Vercel project ID discrepancy between `.vercel/project.json` and `.env.staging` | S |
| M14 | Tighten CSP `unsafe-inline` to nonce-based policy (acknowledged TODO) | M |
| M15 | 16 raw `console.log/error` calls outside the structured logger | S |

---

## 15. Recommended Next Steps (Sequenced)

**Days 1–2: stand up production infra.** B1 + B14 (provision prod Supabase in UK region; populate Vercel Production env; register and attach custom domain; wire Sentry). I1 (`db-push.yml` fails hard for `main`). I2 (investigate the `done=false` migration in nonprod).

**Days 3–4: restore staging usability.** B2 (split the seed; run reference seed against nonprod; create `documents` Storage bucket in both projects). I3 + I4 (Supabase advisor sweep including leaked-password protection).

**Days 5–10: ship the Blocker feature fixes.** B3 (submit wiring), B4 (status-switch reset), B5 (round-open action), B6 (inline-preview URL), B7 (GDPR dialog mount), B9 (RLS on the six tables), B11 (entry year + employment vocabulary), B12 (multi-file upload), B13 (merge-field convention). Smoke-test the applicant journey end-to-end. Run the existing assessment test suite plus add tests for the reset behaviour.

**Days 11–14: ship Important calc fixes that gate parity.** I17 (sole-parent toggle), I19 (schooling-years source), I20 (benchmark wiring), I22 (reference snapshot integrity). Then run the calculator against the existing Okafor/Williams worked test cases — confirm parity-test-readiness on the engine itself.

**Days 15–17: security hardening that pen-test would otherwise flag.** B8 (MFA), B10 (virus scanning — at minimum integrate the gating column even if scanning is queue-based), I5 (email-merge HTML escape), I6 (CSV formula injection), I7 (rate-limit fail-closed), I8 (audit coverage gaps).

**Days 18–21: documentation sprint.** B15 (user guide, admin/assessor guide, ops runbook, hypercare playbook). I35 commission the independent pen test for the following week.

**Week 5: parity test + UAT.** Foundation supplies the ten historical cases (already overdue per Schedule 1 §3; lift the deadline by however many days slip). Run engine + side-by-side comparison report. Open UAT against the now-functional staging environment.

**Week 6: hardening, pen-test remediation, perf/a11y.** I36 (WCAG 2.1 AA), I37 (perf baseline). Address any pen-test findings.

**Week 7–8: Go-Live + hypercare.** Cutover, assessor onboarding, daily check-ins, Foundation sign-off via the checklist.

This sequence accepts that the **22 June Go-Live date will slip by approximately 3–4 weeks** to mid-to-late July 2026. The alternative — keep the original date and skip remediation — would put the system into Foundation hands in a state that cannot be signed off against the Feature Verification Checklist and would breach Schedule 4 §8 on day one.

---

## 16. Audit Methodology and Limitations

This assessment was produced by Meridian Technology Group against the `staging` branch on 2026-05-17. The methodology was:

1. **Spine.** Every verdict is anchored to `docs/contract/feature-verification-checklist.md` — the document the Foundation will use to sign off.
2. **Five parallel reviews.** Specialist agents covered: Applicant Portal §1–8 (Codebase Onboarding Engineer); Admin Console + Assessment Engine §9–20 (Codebase Onboarding Engineer); Reports/Settings/GDPR/Email §21–28 (Codebase Onboarding Engineer); Security & RLS posture (Security Engineer); Ops & deployment readiness (DevOps Automator).
3. **Live system probes.** Both Supabase projects were probed via MCP for: table inventory, migration state, RLS policies, security advisors, performance advisors, extensions, edge functions, storage buckets, reference-data row counts.
4. **Repo-level reviews.** `package.json`, `vercel.json`, `next.config.mjs`, both GitHub workflows, `.env.example/.local/.staging`, `prisma/schema.prisma`, all 11 migrations, the assessment calculator, the seed file, the existing `docs/security-audit.md` (dated 2026-05-12), backlog entries, and the full IMPLEMENTATION_PLAN were read directly.

**What this assessment did not do:** runtime testing on real browsers/devices (§30–31 of the checklist remain N/V), mobile emulator screenshots, performance load testing, formal accessibility audit, end-to-end UAT scenario execution, parity test against the Foundation's spreadsheet (Foundation owes the ten cases), independent security pen test (MSA clause 14.6 — external engagement).

**Confidence.** Findings tagged "Pass" or "Fail" are grounded in code evidence with file:line citations. Findings tagged "Partial" indicate the feature exists but deviates from spec in a stated way. Findings tagged "N/V" are bounded by the methodology — they may pass or fail when tested at runtime.
