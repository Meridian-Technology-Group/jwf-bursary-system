# API Reference

Reference for the application's HTTP endpoints and Next.js **server actions**:
route, method, auth/role requirements, request/response shape, side effects, and
audit-log behaviour. Source of truth is `src/app/api/**` (route handlers) and
`src/app/**/actions.ts` (server actions).

> **New to Supabase / this stack?** Two layers do the heavy lifting:
>
> - **Server actions** are the primary mutation surface — async functions
>   marked `"use server"` invoked directly from React components (no manual
>   `fetch`). They run on the server with the user's session cookie available.
>   **Route handlers** (`route.ts` / `route.tsx`) are classic HTTP endpoints,
>   used here for file streaming, downloads, webhooks, and a few JSON GETs.
> - **RLS context.** Most server-side DB work runs inside `withUserContext` or
>   `withAdminContext` so that Postgres Row-Level Security applies. These are
>   explained in [data-model.md → RLS model](data-model.md#row-level-security-rls-model);
>   below we just note which wrapper an endpoint uses.

See also: [`tdd/07-system-components.md`](tdd/07-system-components.md).

---

## Auth & conventions

### Role gates

Five application roles (the `Role` enum): `APPLICANT`, `ASSESSOR`, `VIEWER`,
`ADMIN`, plus the tombstone `DELETED`. Gating happens at three layers:

1. **Edge middleware** ([`src/middleware.ts`](../../src/middleware.ts)) — runs
   on every non-API, non-asset request. Reads the role from the Supabase JWT
   `app_metadata.role` (no DB query). `/(portal)/*` ⇒ `APPLICANT`;
   `/(admin)/*` ⇒ `ADMIN`/`ASSESSOR`/`VIEWER`. `DELETED` users are signed out.
   API routes are explicitly **bypassed** by the middleware matcher — each route
   handler does its own auth.
2. **MFA / `aal2` gate** — for admin routes, when staff-MFA is enforced (on in
   production by default; behind `STAFF_MFA_ENFORCED` / `VERCEL_ENV` elsewhere),
   the middleware decodes the `aal` claim from the validated access token and
   redirects staff still at `aal1` to `/login/mfa` to enrol or challenge a TOTP
   factor. Applicants are never `aal2`-gated. Fail-closed: any decode failure is
   treated as `aal1`.
3. **Server-side authority** ([`src/lib/auth/roles.ts`](../../src/lib/auth/roles.ts)):
   - `getCurrentUser()` — resolves the authoritative `Profile` (incl. role) via
     `supabase.auth.getUser()` + a `withAdminContext` profile lookup. Returns
     `null` if unauthenticated.
   - `requireRole(roles[])` — returns the user or **redirects** (to `/login` or
     the role-appropriate home). Throws a Next redirect, so in a route-handler
     context it is wrapped in `try/catch` to convert to a 403.
   - `requireApplicationAccess(user, applicationId)` — ADMIN/VIEWER pass
     immediately; ASSESSOR must be the assigned assessor (checked via
     `withAdminContext`); else redirect. This is the ownership gate layered on
     top of the coarse role gate.

### Return-shape & error conventions

- **Server actions** return a discriminated union. The common shapes:
  `{ success: true } | { success: false; error: string }`, and for
  form-validated actions `{ success, error?, fieldErrors? }` where `fieldErrors`
  is Zod's `flatten().fieldErrors`. Some actions return extra data on success
  (e.g. `{ success: true, assessmentId }`). Actions that finish by navigating
  call `redirect()` instead of returning success — so the client only ever
  observes the error object.
- **Route handlers** return JSON `{ error: string }` with conventional status
  codes: `400` bad input, `401` unauthenticated, `403` forbidden / wrong role
  / not owner, `404` not found, `409` conflict (e.g. editing a submitted
  application), `422` unprocessable (file validation), `500` server error. File
  routes return the binary with `Content-Type` + `Content-Disposition` and
  `Cache-Control: no-store`.
- **Error hygiene.** Raw Prisma/driver errors are logged server-side and
  replaced with sanitised client messages, so SQL/table/RLS detail never leaks
  (see e.g. the siblings routes).

### Rate limiting

Auth rate limiting is enforced **at the edge by Vercel WAF** (configured in
`vercel.json`), not in application code: a **fixed-window rule — 5 requests /
15 minutes, keyed by IP** — on the `/login` and `/reset-password` paths. Because
it runs at the edge, brute-force attempts are blocked before they reach a
Function, and there is no store to provision or env var to set. See
[`docs/operations/environment-variables.md`](../operations/environment-variables.md)
and the deployment runbook for the rule definition and go-live check.

> **Migration note:** the former application-layer limiter
> (`src/lib/rate-limit.ts`, Upstash Ratelimit over Vercel KV, with
> `checkLoginRateLimit` / `checkResetPasswordRateLimit` pre-checks) is being
> removed in favour of WAF — see
> [`docs/backlog/prod-auth-rate-limiting-disabled.md`](../backlog/prod-auth-rate-limiting-disabled.md).
> Until that lands, the pre-checks may still exist in code but are superseded by
> the WAF rule as the authoritative throttle.

### Audit logging

Mutations write an `AuditLog` row via `createAuditLog(tx, …)`
([`src/lib/audit/log.ts`](../../src/lib/audit/log.ts)), always inside the same
RLS transaction as the change. The helper is **non-blocking** — it swallows its
own errors so an audit failure never breaks the operation. Per-endpoint audit
`action` keys are listed below.

---

## Route handlers (`src/app/api/**`)

| Path | Method | Purpose | Auth / guard | Response | Audit |
|---|---|---|---|---|---|
| `/api/documents` | POST | Applicant uploads a document (multipart) | `getCurrentUser`; must be **lead applicant** of the target app; app not `SUBMITTED` | `201` Document JSON | — |
| `/api/admin/documents` | POST | Assessor uploads on behalf of an applicant | `getCurrentUser` + **ASSESSOR**; `requireApplicationAccess` | `201` Document JSON | `DOCUMENT_UPLOADED_BY_ASSESSOR` |
| `/api/documents/[id]` | DELETE | Delete a document (Storage + DB) | lead applicant only; app not `SUBMITTED` | `200 {success}` | `DOCUMENT_DELETED` |
| `/api/documents/[id]/url` | GET | Mint a 5-min signed Storage URL | owner / ADMIN / VIEWER / assigned assessor | `{url, filename, expiresIn}` | `DOCUMENT_URL_GRANTED` |
| `/api/documents/[id]/verify` | POST | Toggle `isVerified` | ASSESSOR (assigned) or ADMIN | `{isVerified}` | `DOCUMENT_VERIFIED` / `DOCUMENT_UNVERIFIED` |
| `/api/applications/names` | GET | Reveal child + lead-applicant names for queue | **ASSESSOR** only | name array | `NAME_REVEAL` |
| `/api/exports/recommendations` | GET | Download XLSX/CSV of round recommendations | ASSESSOR or VIEWER | file stream | — |
| `/api/pdf/recommendation/[applicationId]` | GET | Stream recommendation PDF | ADMIN/ASSESSOR/VIEWER; `requireApplicationAccess` | `application/pdf` | — |
| `/api/siblings` | GET / POST | List / create sibling links | GET: ADMIN/ASSESSOR/VIEWER; POST: ADMIN/ASSESSOR | JSON / `201` | POST: `SIBLING_LINK_CREATED` |
| `/api/siblings/[id]` | DELETE / PATCH | Remove link / reorder family group | ADMIN/ASSESSOR | `{success}` | `SIBLING_LINK_REMOVED` / `SIBLING_PRIORITY_REORDERED` |
| `/api/siblings/search` | GET | Search bursary accounts (`?q=`) | ADMIN/ASSESSOR/VIEWER | account array (`[]` if `q<2`) | — |
| `/api/webhooks/resend` | POST | Resend delivery-event webhook | **Svix signature** (`RESEND_WEBHOOK_SECRET`); no session | `200 {received}` | — (logs only) |
| `/api/auth/logout` | POST | Sign out + redirect to `/login` | session; **same-origin** (Origin/Referer) | `303` redirect | — |

### Detail notes

**Document upload (`POST /api/documents`).** Multipart fields `file`,
`applicationId`, `slot`. Validates ≤ 20 MB and MIME ∈ {PDF, JPEG, PNG}, then
**magic-byte sniffs** the first bytes and rejects if the content doesn't match
the declared type (defends against spoofed `Content-Type`). Uploads to Storage
(`uploadDocument`, `service_role`), then records the row under `withUserContext`.
`409` if the application is already `SUBMITTED`; `403` if not the owner.

**Admin document upload (`POST /api/admin/documents`).** Same validation, but
the lead-applicant ownership check is replaced with `requireApplicationAccess`
(assigned-assessor scoping). ASSESSOR role required (ADMIN is *not* accepted by
this route's explicit `role !== ASSESSOR` check).

**Signed URL (`GET /api/documents/[id]/url`).** Issues a Supabase Storage
**pre-signed URL with a 5-minute (`300 s`) expiry** via the admin client. Default
is an inline URL (for the Tab-1 viewer); `?download=true` adds
`Content-Disposition: attachment`. Every grant is audited
(`DOCUMENT_URL_GRANTED`, with inline/attachment disposition). Note the separate
storage helper `getSignedUrl()` defaults to 60 min, but this route hard-codes
300 s.

**Exports (`GET /api/exports/recommendations`).** Query: `roundId` (required),
`school` (`TRINITY`/`WHITGIFT`, optional), `format` (`xlsx` default, or `csv`).
Streams `recommendations-<year>-<date>.{xlsx,csv}` with `no-store`. `404` if the
round is unknown. Built via ExcelJS in a single `withUserContext` transaction.

**Recommendation PDF.** `runtime = "nodejs"` (the `@react-pdf/renderer` library
is not edge-compatible). `requireRole` is wrapped in `try/catch` so a redirect
becomes a `403`. `requireApplicationAccess` scopes assessors. `404` if there is
no assessment or no recommendation. Sets `X-Generated-By: <user.id>` and
`no-store, no-cache`.

**Names reveal.** Returns `{ id, childName, leadApplicantName }[]` for the
requested `applicationIds[]`. Every reveal writes a `NAME_REVEAL` audit row with
the ids and count — the queue is name-blind by default for fairness, and each
unblinding is traceable.

**Resend webhook.** Reads the **raw** body once (needed for signature
verification before parsing). Requires `RESEND_WEBHOOK_SECRET`; **rejects with
`401`** if the secret is unset or the Svix headers/signature are missing or
invalid. Valid events are logged (recipient email hashed) and `200`-acked so
Resend does not retry. No PII persisted, no DB write today.

**Logout.** A POST route handler (not an action) so cookies clear before the
redirect, in the correct order for Supabase SSR. **CSRF defence:** rejects with
`403` if the `Origin` (or `Referer` fallback) does not match the deployment
origin.

---

## Server actions

Grouped by area. Each action authenticates, authorises, mutates under the
appropriate RLS wrapper, audits, and revalidates affected paths. Unless stated
otherwise, the return shape is `{ success } | { success, error }` /
`{ success, error?, fieldErrors? }`.

### Authentication & registration

| Action | File | Purpose / inputs | Guard | Side effects & audit |
|---|---|---|---|---|
| `checkLoginRateLimit()` | `(auth)/login/actions.ts` | IP rate-limit pre-check for sign-in — **deprecated, superseded by the WAF rule; slated for removal** | none (pre-auth) | reads limiter; **rate-limited** (`login:<ip>`) |
| `isStaffMfaEnforcedAction()` | `(auth)/login/actions.ts` | Exposes the MFA flag to the client login page | none | none |
| `checkResetPasswordRateLimit()` | `(auth)/reset-password/actions.ts` | IP rate-limit pre-check for reset email — **deprecated, superseded by the WAF rule; slated for removal** | none | **rate-limited** (`reset-password:<ip>`) |
| `verifyEnrolmentAction(fd)` | `(auth)/login/mfa/actions.ts` | Confirm a freshly-enrolled TOTP factor (`factorId`, `code`) | session (SSR) | challenge + verify → elevates session to `aal2` |
| `challengeAndVerifyAction(fd)` | `(auth)/login/mfa/actions.ts` | Challenge an existing TOTP factor (`factorId`, `code`) | session (SSR) | verify → `aal2` |
| `validateApplicantInvitationAction(token)` | `(auth)/register/actions.ts` | Validate applicant token; return prefill (incl. `isReassessment`) | token only (pre-auth, `withAdminContext`) | none |
| `acceptApplicantInvitationAction(input)` | `(auth)/register/actions.ts` | Complete applicant registration (`token`, names, `password`) | token + password policy (12-char + HIBP, fails open) | sets password on the pre-provisioned auth user; creates/​prepopulates the Application; marks invite `ACCEPTED`; **`ACCEPT_INVITATION`** |
| `createProfileAction(input)` | `(auth)/register/actions.ts` | Magic-link branch: insert a Profile | `withAdminContext` (no JWT yet) | profile insert |
| `validateStaffInvitationAction(token)` | `(auth)/register/staff/actions.ts` | Validate staff token; return email/role | token only | none |
| `acceptStaffInvitationAction(input)` | `(auth)/register/staff/actions.ts` | Complete staff registration | token + password policy | sets password; updates Profile; marks invite `ACCEPTED`; **`ACCEPT_STAFF_INVITATION`** |

Registration uses a **silent-invite pattern**: the `auth.users` row is created
up front (with `email_confirm: true` so Supabase fires no OTP email), and only
the branded Resend email reaches the user. Acceptance sets the chosen password
on that existing user.

### Applicant portal — apply (`(portal)/apply/actions.ts`)

All resolve the caller's own `PRE_SUBMISSION` application server-side and
**ignore any client-supplied applicationId** (IDOR defence). Run under
`withUserContext`.

| Action | Purpose / inputs | Guard | Audit |
|---|---|---|---|
| `saveSection(_appId, section, data)` | Zod-validate + upsert one section, mark complete | owns a PRE_SUBMISSION app | — |
| `saveSectionDraft(_appId, section, data)` | Upsert a partial draft (not complete) | owns app | — |
| `getSection(_appId, section)` | Load one section's data | owns app | — |
| `getSectionStatus(_appId)` | Completion status of all 10 sections | owns app | — |
| `submitApplication(applicationId)` | Validate all 10 sections + no error-severity gaps; set `SUBMITTED`; promote `entryYearGroup`/`entryYear` onto columns; email `CONFIRMATION` | must be the lead applicant; idempotent if already submitted | **`APPLICATION_SUBMITTED`** (written in a separate `withAdminContext` tx *after* the status commits, so an audit failure can never roll back the submission) |

`submitApplication` returns `never` — it `redirect()`s to `/submitted`, or
throws an `Error` (a JSON `GAPS_BLOCKING_SUBMISSION` payload when blocked by
document/structural gaps) that the client surfaces.

### Applicant portal — dashboard (`(portal)/actions.ts`)

| Action | Purpose | Guard | Audit |
|---|---|---|---|
| `startApplicationAction(fd)` | Onboarding card: create a first-year Application from the accepted invitation (`school`, `childName`) → redirect to the form | `requireRole([APPLICANT])` | — |
| `beginReassessmentAction()` | Consume a PENDING re-assessment invite; create the prepopulated re-assessment Application → redirect | `requireRole([APPLICANT])`; `withAdminContext` (cross-app prepopulation) | **`ACCEPT_INVITATION`** |
| `submitMissingDocsResponse(applicationId)` | Applicant signals re-uploaded docs: `PAUSED → NOT_STARTED` | APPLICANT + owns app + status `PAUSED` | **`MISSING_DOCS_RESPONDED`** |

### Admin — applications & status (`(admin)/applications/[id]/actions.ts`)

Transitions validated against `VALID_TRANSITIONS`. Mutations require ADMIN or
ASSESSOR unless noted; run under `withUserContext` (the GDPR action uses
`withAdminContext`).

| Action | Purpose / transition | Guard | Email | Audit |
|---|---|---|---|---|
| `updateApplicationStatus(id, status, ctx?)` | Generic validated transition | ADMIN/ASSESSOR | — | **`APPLICATION_STATUS_CHANGED`** |
| `pauseApplication(id, missingSlots[], msg?)` | `→ PAUSED`, request missing docs | ADMIN/ASSESSOR | `MISSING_DOCS` | **`APPLICATION_PAUSED`** |
| `resumeApplication(id)` | `PAUSED → NOT_STARTED` | ADMIN/ASSESSOR | — | **`APPLICATION_RESUMED`** |
| `setOutcome(id, outcome)` | `COMPLETED → QUALIFIES \| DOES_NOT_QUALIFY` | ADMIN/ASSESSOR | `OUTCOME_QUALIFIES` / `OUTCOME_DNQ` | **`APPLICATION_OUTCOME_SET`** |
| `assignApplicationAction(id, assessorId\|null)` | Assign / unassign an assessor | **ADMIN only** | — | **`APPLICATION_ASSESSOR_ASSIGNED`** |
| `gdprDeleteApplicantAction(id)` | Article-17 erasure cascade (see below) | ADMIN/ASSESSOR | — | **`GDPR_DELETION`** |

**`gdprDeleteApplicantAction`** runs under `withAdminContext`. It enforces a
**7-year retention guard** (refuses if `submittedAt` is within the last 7
years), deletes Storage files, then in one admin transaction: deletes
assessment children + recommendation + assessment + sections + document rows;
**anonymises** the Application (`childName → "[Child Removed]"`, `childDob →
null`); deletes linked invitations; nulls `AuditLog.userId` for the applicant;
anonymises the Profile (names/phone null, email → `[deleted-…]@removed.invalid`,
role → `DELETED`). It then deletes the Supabase Auth user. Retains: Round,
aggregate stats, ReasonCode reference data. Storage/auth failures are non-fatal
and recorded in the audit metadata.

### Admin — assessment (`(admin)/applications/[id]/assessment/actions.ts`)

All: ADMIN/ASSESSOR + `requireApplicationAccess`; `withUserContext`; revalidate
the assessment path.

| Action | Purpose | Audit |
|---|---|---|
| `beginAssessmentAction(applicationId)` | Create the Assessment → `{success, assessmentId}` | **`ASSESSMENT_BEGIN`** |
| `saveAssessmentAction(assessmentId, applicationId, data)` | Partial save of financial inputs/results | **`ASSESSMENT_SAVE`** (metadata lists changed fields) |
| `completeAssessmentAction(assessmentId, applicationId)` | Mark `COMPLETED` | **`ASSESSMENT_COMPLETE`** |
| `pauseAssessmentAction(assessmentId, applicationId)` | Mark `PAUSED` | **`ASSESSMENT_PAUSE`** |

### Admin — recommendation (`(admin)/applications/[id]/recommendation/actions.ts`)

ADMIN/ASSESSOR; `withUserContext`.

| Action | Purpose | Email | Audit |
|---|---|---|---|
| `saveRecommendationAction(applicationId, data)` | Upsert the recommendation (resolves assessmentId + roundId from the app); `reasonCodeIds` set the junction rows | — | **`RECOMMENDATION_SAVE`** |
| `setApplicationOutcomeAction(applicationId, outcome)` | Set `QUALIFIES`/`DOES_NOT_QUALIFY`; on first `QUALIFIES` (and no existing account) **create a `BursaryAccount`** and link it | `OUTCOME_QUALIFIES` / `OUTCOME_DNQ` | **`application.outcome.set`** |

The bursary-account creation here is why the `bursary_accounts` write RLS policy
was widened to ASSESSOR (migration `20260522103852`).

### Admin — rounds (`(admin)/rounds/actions.ts`)

**ADMIN only**; `withUserContext`. Zod-validated `academicYear` (`YYYY/YY`),
dates with ordering refines.

| Action | Purpose | Audit |
|---|---|---|
| `createRoundAction(fd)` | Create a round → redirect `/rounds` (unique-violation message on duplicate year) | **`CREATE_ROUND`** |
| `updateRoundAction(id, fd)` | Edit a round → redirect `/rounds/[id]` | **`UPDATE_ROUND`** |
| `openRoundAction(id)` | `DRAFT → OPEN`; refuses if another round is OPEN | **`ROUND_OPENED`** |
| `closeRoundAction(id)` | `OPEN → CLOSED` | **`ROUND_CLOSED`** |

### Admin — invitations (`(admin)/invitations/actions.ts`)

**ADMIN only** (except as noted); `withAdminContext`; hardened with
auth-user-up-front + rollback on any DB failure.

| Action | Purpose | Audit |
|---|---|---|
| `createInvitationAction(fd)` | Create auth user + Profile + applicant Invitation; email `INVITATION` with `?token=` link | **`CREATE_INVITATION`** |
| `batchReassessmentInviteAction(roundId)` | Invite all active bursary holders not yet invited for the round; per-row rollback; returns `{sent, failed, errors}` | **`BATCH_REASSESSMENT_INVITE`** (per row) |
| `resendInvitationAction(invitationId)` | Regenerate token + 30-day TTL, re-email; PENDING only | **`RESEND_INVITATION`** |
| `revokeInvitationAction(invitationId)` | PENDING → `EXPIRED`; soft-delete the unused auth user | **`REVOKE_INVITATION`** |
| `createReassessmentApplicationAction(bursaryAccountId, roundId)` | Create + prepopulate a re-assessment Application from a bursary account | **`CREATE_REASSESSMENT_APPLICATION`** |

### Admin — queue (`(admin)/queue/actions.ts`)

| Action | Purpose | Guard | Audit |
|---|---|---|---|
| `createInternalRequestAction(fd)` | Internal bursary request: find/create parent Profile (+ auth user, with rollback), create `isInternal` Application, Invitation, email `INVITATION`; returns `{success, reference}` | **ADMIN or ASSESSOR** | **`INTERNAL_REQUEST_CREATED`** |

Inputs (Zod): `parentEmail`, `parentName`, `childName`, `school`, `roundId`,
`entryYearGroup`, `entryYear` (2020–2040), optional `reason`.

### Admin — settings (`(admin)/settings/actions.ts`)

**ADMIN only**; `withUserContext`; reference writes are **versioned inserts**
(new `effectiveFrom` row), never in-place updates — except reason codes and
email templates, which update by id/type. Each revalidates `/settings`.

| Action | Purpose | Audit |
|---|---|---|
| `upsertFamilyTypeConfigAction(fd)` | New `FamilyTypeConfig` version (`category`, rent/utilities/food) | **`SETTINGS_FAMILY_TYPE_CONFIG_UPSERT`** |
| `upsertSchoolFeesAction(fd)` | New `SchoolFees` version | **`SETTINGS_SCHOOL_FEES_UPSERT`** |
| `updateCouncilTaxAction(fd)` | New `CouncilTaxDefault` version | **`SETTINGS_COUNCIL_TAX_UPDATE`** |
| `upsertReasonCodeAction(fd)` | Create/update a `ReasonCode` (handles deprecation); unique-violation message on dup `code` | **`SETTINGS_REASON_CODE_CREATE` / `SETTINGS_REASON_CODE_UPDATE`** |
| `upsertEmailTemplateAction(fd)` | Update an `EmailTemplate` subject/body by `type` | **`SETTINGS_EMAIL_TEMPLATE_UPDATE`** |

### Admin — users / staff (`(admin)/users/actions.ts`)

**ADMIN only**.

| Action | Purpose | Context | Audit |
|---|---|---|---|
| `inviteStaffAction(fd)` | Invite ASSESSOR/VIEWER: auth user + Profile + StaffInvitation (rollback on failure); email `INVITE_STAFF` | `withAdminContext` | **`INVITE_STAFF`** |
| `resendStaffInvitationAction(id)` | Regenerate staff token + re-email; PENDING only | `withAdminContext` | **`RESEND_STAFF_INVITATION`** |
| `revokeStaffInvitationAction(id)` | PENDING → `EXPIRED` | `withAdminContext` | **`REVOKE_STAFF_INVITATION`** |
| `updateStaffRoleAction(fd)` | Change a staff role (ADMIN/ASSESSOR/VIEWER); cannot change own; the DB trigger syncs `app_metadata` | `withUserContext` | **`UPDATE_STAFF_ROLE`** |
| `resetStaffMfaAction(fd)` | Delete a staff member's TOTP factors (lost device); logs them out everywhere; staff-only target | `withAdminContext` + `supabase.auth.admin.mfa.*` | **`RESET_STAFF_MFA`** |
| `deactivateStaffAction(fd)` | Role → `DELETED` and unassign all their applications; cannot deactivate self | `withUserContext` | **`DEACTIVATE_STAFF`** |

> ADMIN cannot be created via the invite UI — `inviteStaffAction` accepts only
> `ASSESSOR`/`VIEWER`. A user is promoted to ADMIN later via
> `updateStaffRoleAction`.

---

## Audit action key reference

`AuditLog.action` keys are SCREAMING_SNAKE and `entityType` is the PascalCase
model name. Both are defined as a single typed source of truth in
`src/lib/audit/actions.ts` (`AUDIT_ACTIONS` / `AUDIT_ENTITY_TYPES`); call sites
import the constants so a typo is a compile error. Keys by area:

- **Documents** — `DOCUMENT_UPLOADED_BY_ASSESSOR`, `DOCUMENT_DELETED`,
  `DOCUMENT_URL_GRANTED`, `DOCUMENT_VERIFIED`, `DOCUMENT_UNVERIFIED`.
- **Applications** — `APPLICATION_SUBMITTED`, `APPLICATION_STATUS_CHANGED`,
  `APPLICATION_PAUSED`, `APPLICATION_RESUMED`, `APPLICATION_OUTCOME_SET`,
  `APPLICATION_ASSESSOR_ASSIGNED`, `MISSING_DOCS_RESPONDED`, `NAME_REVEAL`,
  `GDPR_DELETION`.
- **Assessment / recommendation** — `ASSESSMENT_BEGIN`, `ASSESSMENT_SAVE`,
  `ASSESSMENT_CHECKLIST_SAVE`, `ASSESSMENT_COMPLETE`, `ASSESSMENT_PAUSE`,
  `RECOMMENDATION_SAVE`.
- **Invitations** — `CREATE_INVITATION`, `BATCH_REASSESSMENT_INVITE`,
  `RESEND_INVITATION`, `REVOKE_INVITATION`, `ACCEPT_INVITATION`,
  `CREATE_REASSESSMENT_APPLICATION`, `INTERNAL_REQUEST_CREATED`.
- **Staff** — `INVITE_STAFF`, `RESEND_STAFF_INVITATION`,
  `REVOKE_STAFF_INVITATION`, `ACCEPT_STAFF_INVITATION`, `UPDATE_STAFF_ROLE`,
  `RESET_STAFF_MFA`, `DEACTIVATE_STAFF`.
- **Rounds** — `CREATE_ROUND`, `UPDATE_ROUND`, `ROUND_OPENED`, `ROUND_CLOSED`.
- **Settings** — `SETTINGS_FAMILY_TYPE_CONFIG_UPSERT`,
  `SETTINGS_SCHOOL_FEES_UPSERT`, `SETTINGS_COUNCIL_TAX_UPDATE`,
  `SETTINGS_REASON_CODE_CREATE`, `SETTINGS_REASON_CODE_UPDATE`,
  `SETTINGS_EMAIL_TEMPLATE_UPDATE`, `UPDATE_EMAIL_TEMPLATE_ENABLED`.
- **Siblings** — `SIBLING_LINK_CREATED`, `SIBLING_LINK_REMOVED`,
  `SIBLING_PRIORITY_REORDERED` (`entityType` is `SiblingLink`).

---

## Known inconsistencies (verify before relying on)

- **Audit naming is now standardised (backlog #10).** `action` is
  SCREAMING_SNAKE and `entityType` is the PascalCase model name, both centralised
  in `src/lib/audit/actions.ts`. The change is **forward-only**: historical rows
  keep their legacy values (`assessment.save`, `SIBLING_LINK`, `settings.*`), and
  the audit page maps those legacy values to the same label/colour/grouping via
  `LEGACY_ACTION_ALIASES` / `LEGACY_ENTITY_TYPE_ALIASES`. When querying the raw
  table directly for reporting, match both the new key and its legacy alias for
  rows written before the change.
- **Outcome set in two places.** `setOutcome` (applications actions) and
  `setApplicationOutcomeAction` (recommendation actions) both move an
  application to QUALIFIES/DOES_NOT_QUALIFY and email — but only the latter
  creates the `BursaryAccount`, and they use different transition validation
  and audit keys (`APPLICATION_OUTCOME_SET` vs `application.outcome.set`).
  Confirm which path the UI invokes for a given flow before changing either.
- **Rate limiting is auth-only and edge-enforced via Vercel WAF.** The
  fixed-window WAF rule throttles `/login` and `/reset-password` by IP; it does
  not fail open on a missing env var (there is none) — the only failure mode is
  the rule being absent/disabled in the Vercel project, which the go-live
  checklist guards. Document/export/PDF routes have no throttle.
