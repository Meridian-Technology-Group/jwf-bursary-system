# JWF Bursary System — Security Audit

**Auditor:** Security Engineer (defensive review)
**Date:** 2026-05-12
**Scope:** Application code in `src/`, Prisma schema/migrations, configuration. Defensive audit prior to launch.
**Methodology:** Source-code review against the TDD's stated invariants. Documentation was used to identify the *expected* controls; the *actual* state was verified in code. Where a control was promised by TDD/PRD but not present in code, the finding is graded against the sensitivity of the data the control was supposed to protect.

---

## 1. Executive Summary

The application has a clean structural foundation: a single-Prisma-client SSR architecture, server-side role gates, parameterised queries, Zod validation on form actions, and a thoughtful two-layer applicant/assessor data model. Several of the trickier privacy features — separate name-reveal endpoint, queue masking, GDPR delete cascade — are implemented and correct in intent.

However, the system **does not yet meet the security posture the TDD describes**, and several gaps would be unacceptable for a system holding minors' financial and identity data. Pre-launch remediation is required.

**Top 3 risks (ranked by exploitability × blast radius):**

1. **Critical IDOR on document signed-URL endpoint** (`GET /api/documents/[id]/url`) — any authenticated user can download any other family's documents (passports, P60s, bank statements) by iterating UUIDs. Defence-in-depth fails completely here because Supabase Storage is accessed via the service-role key.
2. **No Row-Level Security (RLS) policies exist** despite the TDD committing to RLS as "gate 3". The system is single-layer-authorisation only — every IDOR, every missing ownership check in application code becomes an immediate full data-disclosure issue. The TDD-promised "defence in depth" model does not exist.
3. **IDOR on applicant form save/load and assessor save actions** — Server actions accept `applicationId` / `assessmentId` from the client without verifying caller ownership/assignment. A logged-in applicant can read or overwrite another family's section data; an assessor can mutate another assessor's assessment.

Additional material risks: no security headers (no CSP, HSTS, etc.); no rate limiting on login or password-reset; MFA promised by TDD §3.4 not implemented; GDPR delete does not invalidate the Supabase Auth user; weak password policy (8 chars, no complexity); open-redirect in `/login`. Findings are detailed below.

---

## 2. Findings

### 2.1 CRITICAL — IDOR on document signed-URL generation (cross-tenant document disclosure)

- **Severity:** Critical
- **Location:** `src/app/api/documents/[id]/url/route.ts:20-62`
- **Description:** The endpoint fetches a document record by ID and returns a 60-minute signed Supabase Storage URL with **no ownership or role check**. Any authenticated user (including any applicant) who knows or guesses a `Document.id` UUID can download that document. Documents include passports, birth certificates, P60s, bank statements, tax returns, and benefit letters. UUIDv4 is high-entropy but the endpoint is also reachable by ASSESSORs who legitimately see Document IDs in the queue/detail UI; a malicious assessor or compromised assessor account can pivot to documents on applications not assigned to them.
- **Evidence:**
  ```ts
  // src/app/api/documents/[id]/url/route.ts
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, storagePath: true, filename: true },
  });
  // ...no leadApplicantId / assignedToId / role check before signing URL
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(document.storagePath, EXPIRY_SECONDS);
  ```
- **Recommendation:**
  ```ts
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true, storagePath: true, filename: true,
      application: { select: { leadApplicantId: true, assignedToId: true } },
    },
  });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = document.application.leadApplicantId === user.id;
  const isAdminRole = user.role === Role.ADMIN || user.role === Role.VIEWER;
  const isAssignedAssessor =
    user.role === Role.ASSESSOR && document.application.assignedToId === user.id;

  if (!isOwner && !isAdminRole && !isAssignedAssessor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Also: AUDIT LOG every successful signed-URL grant (DM-04 traceability).
  ```
  Additionally, drop the expiry to ~5 minutes (60 min is excessive — once the URL leaves the application it cannot be revoked).
- **References:** DM-04, NF-09 violated; TDD §3.4 "DEFENCE IN DEPTH" violated; UK GDPR Art. 32 (security of processing).

---

### 2.2 CRITICAL — No Row-Level Security policies exist

- **Severity:** Critical (architectural)
- **Location:** `prisma/migrations/*` — no RLS policies anywhere; `src/lib/db/prisma.ts:7-11` (Prisma client uses pooled Postgres connection, not Supabase JS); `src/lib/auth/supabase-admin.ts` (the only Supabase client used for data-bearing calls is the service-role admin client).
- **Description:** The TDD (3.4.2, 6.3) commits to RLS policies on every personal-data table as the third defence layer. **No policies exist in any migration.** The Prisma client connects via `DATABASE_URL` (Supabase Postgres pooler) as the `postgres` superuser, which is exempt from RLS entirely. All Storage access uses `SUPABASE_SERVICE_ROLE_KEY`. Therefore there is exactly ONE authorisation layer: the application-code role/ownership checks. Any IDOR, missing filter, or compromised assessor session is immediately a full disclosure.
- **Evidence:**
  ```
  $ grep -ri "row.level\|policy\|RLS\|enable row" prisma/migrations
  (no results)

  $ ls prisma/migrations/
  20260301180442_initial_schema/
  20260301225224_add_admin_role_and_assignment/
  20260302000000_sync_role_to_app_metadata/
  ```
  The only `auth.*` reference is in the role-sync trigger migration (a `SECURITY DEFINER` plpgsql function that bypasses RLS by design).
- **Recommendation:** Two viable paths:
  1. **Document and accept** that authorisation is single-layer (application code only). This is defensible *only if* every server action and route handler is audited for ownership and the team commits to that discipline (and to fixing all IDORs listed in this report).
  2. **Implement RLS** for genuine defence-in-depth. This requires:
     - Add RLS policies in a new migration for `profiles`, `applications`, `application_sections`, `documents`, `assessments`, `assessment_earners`, `assessment_properties`, `assessment_checklists`, `recommendations`, `recommendation_reason_codes`, `bursary_accounts`, `sibling_links`, `invitations`, `audit_logs`. AuditLog must be `INSERT-only` with `GRANT INSERT` and explicit `REVOKE UPDATE, DELETE`.
     - Switch user-context queries to a connection string that uses a non-superuser role (e.g. `authenticated` or a custom `app_user`) and pass the JWT via `set_config('request.jwt.claims', ...)` (see PostgREST/Supabase pattern). Keep `service_role` only for genuine admin operations (invites, GDPR cascade).
     - Update Prisma to use a per-request transaction that sets the JWT claim before queries.
  Option (1) is faster; option (2) is what the TDD promised stakeholders.
- **References:** TDD 3.4.2 and 6.3 violated.

---

### 2.3 CRITICAL — IDOR on applicant section save/load (cross-family form data tampering)

- **Severity:** Critical
- **Location:** `src/app/(portal)/apply/actions.ts:77-160`
- **Description:** `saveSection`, `saveSectionDraft`, `getSection`, `getSectionStatus` accept `applicationId` from the client and never verify that the current user owns the application. The applicationId is rendered into the page DOM (`section-page-client.tsx:51, 220`) and is therefore visible/manipulable by the client. A logged-in applicant can substitute another applicant's UUID and:
  - **Read** any section's stored JSON (income, assets, IDs, declarations) via `getSection`.
  - **Overwrite** another family's data via `saveSection` / `saveSectionDraft`.
- **Evidence:**
  ```ts
  // src/app/(portal)/apply/actions.ts (saveSection)
  export async function saveSection(
    applicationId: string | null,
    section: ApplicationSectionType,
    data: unknown,
  ): Promise<SaveSectionResult> {
    const appId = applicationId ?? (await resolveApplicationId());
    if (!appId) return { success: false, errors: ["No active application found."] };
    // ...no check that appId belongs to the current user
    await upsertSection(appId, section, result.data, true);
  ```
  Compare with `submitApplication` (same file, lines 234-237) which does check ownership — the pattern is known to the team but not applied consistently.
- **Recommendation:** Reject the client-supplied `applicationId` entirely. Always resolve from the session:
  ```ts
  async function getOwnedApplicationId(): Promise<string | null> {
    const user = await getCurrentUser();
    if (!user) return null;
    const app = await prisma.application.findFirst({
      where: { leadApplicantId: user.id, status: "PRE_SUBMISSION" },
      select: { id: true },
    });
    return app?.id ?? null;
  }
  ```
  Then drop the `applicationId` parameter from every section action. If you must accept it (e.g. assessor-on-behalf flows in future), require an ownership check on every call.
- **References:** OWASP API1:2023 BOLA; UK GDPR Art. 5(1)(f).

---

### 2.4 HIGH — IDOR on assessor save/complete/pause assessment actions

- **Severity:** High
- **Location:** `src/app/(admin)/applications/[id]/assessment/actions.ts:56-130` (`saveAssessmentAction`, `completeAssessmentAction`, `pauseAssessmentAction`, `beginAssessmentAction`)
- **Description:** These actions take `assessmentId` and `applicationId` from the client and rely only on `requireRole([ADMIN, ASSESSOR])`. The page-level "assigned-to" check lives in the layout (`(admin)/applications/[id]/layout.tsx:107-115`); when the action is invoked directly (via fetch or a forged form post), the layout does not run. An ASSESSOR with no assignment can therefore modify any assessment. ADMIN can intentionally; ASSESSOR cannot, per the role definition.
- **Evidence:**
  ```ts
  // src/app/(admin)/applications/[id]/assessment/actions.ts
  export async function saveAssessmentAction(
    assessmentId: string,
    applicationId: string,
    data: AssessmentSaveInput,
  ) {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
    await saveAssessment(assessmentId, { ...data, status: data.status ?? "NOT_STARTED" });
    // no assignedToId check
  }
  ```
- **Recommendation:** Reuse `requireApplicationAccess` from `src/lib/auth/roles.ts:156` (already written, but never called from the assessment actions):
  ```ts
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
  await requireApplicationAccess(user, applicationId);
  // ... existing code ...
  ```
  Apply this to *every* mutating server action that accepts an applicationId/assessmentId.
- **References:** OWASP API1:2023 BOLA, API5:2023 BFLA.

---

### 2.5 HIGH — No Content-Security-Policy / HSTS / other security headers

- **Severity:** High
- **Location:** `next.config.mjs` (empty), `vercel.json` (regions only), no `headers()` export.
- **Description:** The application sends none of the recommended security headers: no CSP, no HSTS, no `X-Content-Type-Options: nosniff`, no `Referrer-Policy`, no `Permissions-Policy`, no `X-Frame-Options`. A reflected-XSS bug, malicious dependency, or compromised CDN script has nothing to defeat. TDD NF-08 requires CSP.
- **Evidence:**
  ```js
  // next.config.mjs (entire file)
  const nextConfig = {};
  export default nextConfig;
  ```
- **Recommendation:**
  ```js
  // next.config.mjs
  const securityHeaders = [
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'", // tighten with nonce post-launch
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.supabase.co",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
      ].join("; "),
    },
  ];

  const nextConfig = {
    async headers() {
      return [{ source: "/:path*", headers: securityHeaders }];
    },
  };
  ```
  Tighten `script-src` to a nonce-based policy once the React tree allows it.
- **References:** TDD NF-08; OWASP Secure Headers Project.

---

### 2.6 HIGH — Weak password policy; no rate limiting on auth endpoints

- **Severity:** High
- **Location:** `src/app/(auth)/register/actions.ts:103-108` (8-char minimum, no complexity); `src/app/(auth)/login/page.tsx`, `src/app/(auth)/reset-password/page.tsx` (no rate limiting); `package.json` (no rate-limit library).
- **Description:**
  - Registration enforces only "8 chars". No complexity or HIBP check. NIST 800-63B permits short minima only if checked against a breach corpus; that check is absent.
  - There is no per-IP or per-account rate limiting on `/login` (Supabase's defaults apply but are coarse), no lockout after N failed attempts, no rate limit on `/reset-password` (the email enumeration vector is partially mitigated by the page's "If an account exists..." message — keep that).
  - Effect: credential stuffing and password spraying against parent accounts is feasible. Parents reuse passwords from breaches; the impact is unauthorised access to a family's financial and identity documents.
- **Recommendation:**
  - Raise minimum to 12 characters; check against HIBP Pwned Passwords (k-anonymity API) on registration and password change.
  - Add a rate-limit middleware (e.g. `@upstash/ratelimit` with Vercel KV or Supabase): 5 attempts / 15 minutes per IP for `/login` and `/reset-password`; account lockout for 30 minutes after 10 failed attempts in 1 hour.
  - Configure Supabase Auth's built-in rate limits in the dashboard if not already set.
- **References:** NIST 800-63B §5.1.1.2; OWASP ASVS V2.

---

### 2.7 HIGH — MFA for assessor role not implemented despite TDD commitment

- **Severity:** High
- **Location:** No code references found (`grep -rn "MFA\|mfa\|totp\|TOTP" src` returns 0 hits); TDD §3.4 specifies MFA for ASSESSOR.
- **Description:** Assessor accounts can read and modify highly sensitive financial data for many families. A single phished assessor credential exposes the entire round. TDD §3.4 commits to TOTP MFA for the ASSESSOR role; nothing in the codebase enforces or even surfaces MFA.
- **Recommendation:** Use Supabase Auth's built-in MFA (TOTP factor). Enrol all assessor accounts and enforce verification at sign-in via `aal2` claim. In middleware:
  ```ts
  // After role check, for staff routes:
  if ((role === "ASSESSOR" || role === "ADMIN") &&
      user.app_metadata?.aal !== "aal2") {
    return redirect("/mfa/enrol");
  }
  ```
  Provide a one-time enrolment flow on first sign-in.
- **References:** TDD §3.4 violated; OWASP ASVS V2.8.

---

### 2.8 MEDIUM — GDPR deletion does not delete the Supabase Auth user

- **Severity:** Medium
- **Location:** `src/app/(admin)/applications/[id]/actions.ts:422-585` (`gdprDeleteApplicantAction`)
- **Description:** TDD GD-01..GD-05 requires "full cascade across all entity tables + Supabase Storage + Supabase Auth user". The current implementation anonymises the Profile (`role → DELETED`, email → `[deleted-{uuid}]@removed.invalid`) but **never calls `supabase.auth.admin.deleteUser(leadApplicantId)`**. The auth row in `auth.users` remains; the user can in theory still sign in (their app_metadata.role is now `DELETED`, but the JWT issuance still works — and there is no middleware branch for the `DELETED` role beyond redirecting to `/admin`, which means a `DELETED` user is treated like a staff member, not blocked outright).
  Additionally, the function uses `tx.auditLog.updateMany(...)` to anonymise the audit log's userId. This is reasonable for GDPR but **directly contradicts the TDD's "AuditLog is INSERT-only"** claim and undermines forensic integrity. Consider whether the team really wants mutable audit logs.
- **Evidence:**
  ```ts
  // src/app/(admin)/applications/[id]/actions.ts:540-557
  await tx.auditLog.updateMany({
    where: { userId: leadApplicantId },
    data: { userId: null },
  });
  // i. Anonymise Profile
  const anonymisedEmail = `[deleted-${leadApplicantId}]@removed.invalid`;
  await tx.profile.update({ where: { id: leadApplicantId }, data: { ... role: "DELETED" } });
  // No supabase.auth.admin.deleteUser(leadApplicantId)
  ```
  And in middleware:
  ```ts
  // src/middleware.ts:130
  if (role !== "ADMIN" && role !== "ASSESSOR" && role !== "VIEWER") {
    return redirect("/");
  }
  ```
  A `DELETED` user logging in lands on `/` (portal), which then redirects to `/admin` (because non-APPLICANT)... the behaviour is undefined and depends on whether the deleted account still has any valid Application row. At minimum the auth user should be revoked.
- **Recommendation:**
  ```ts
  // After the prisma.$transaction:
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(leadApplicantId);
  if (error) {
    console.error("[gdprDelete] auth user delete failed:", error);
    // Don't fail the operation — audit and flag for manual cleanup
  }
  ```
  Also add an explicit middleware branch:
  ```ts
  if (role === "DELETED") {
    await mw.supabase.auth.signOut();
    return redirect("/login?error=account_deleted");
  }
  ```
  Reconsider the AuditLog update — either keep it (and remove "INSERT-only" from the TDD), or keep the original userId and rely on the Profile anonymisation alone (the audit log no longer joins to a real identity).
- **References:** TDD GD-01..GD-05; UK GDPR Art. 17.

---

### 2.9 MEDIUM — Open redirect on `/login?next=…`

- **Severity:** Medium
- **Location:** `src/app/(auth)/login/page.tsx:29, 59-68`; partial mitigation in `src/app/(auth)/auth/callback/route.ts:47`.
- **Description:** The login page accepts `next` as a query string parameter and passes it directly to `router.push()`:
  ```ts
  const nextPath = searchParams.get("next") ?? null;
  // ...
  if (nextPath && !(isAdminRole && nextPath === "/")) {
    destination = nextPath; // unvalidated
  }
  router.push(destination);
  ```
  An attacker can craft `https://bursary.example.com/login?next=https://evil.example.com/phish` and after the victim authenticates, `router.push` will navigate to the attacker site. (Next.js's `router.push` accepts absolute URLs and will redirect the browser.) This is a classic phishing aid.
  The auth callback (`/auth/callback`) attempts to mitigate via `next.startsWith("/")` — this still allows protocol-relative `//evil.com` paths because `new URL("//evil.com", origin)` resolves to `https://evil.com/`.
- **Recommendation:**
  ```ts
  function safeNext(raw: string | null): string {
    if (!raw) return "/";
    // Reject anything other than a single-leading-slash, non-protocol-relative path.
    if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
    return raw;
  }
  // ...
  const destination = isAdminRole ? "/admin" : safeNext(nextPath);
  ```
  Apply the same fix to `auth/callback/route.ts`.
- **References:** OWASP A01:2021 (broken access control / redirect); CWE-601.

---

### 2.10 MEDIUM — File-type validation is MIME-only (header spoofable)

- **Severity:** Medium
- **Location:** `src/app/api/documents/route.ts:18, 63-68`; `src/app/api/admin/documents/route.ts:23, 74-79`
- **Description:** Validation checks `file.type` against an allow-list. `file.type` is the browser-supplied `Content-Type` and is trivially overridable by a malicious client. A file labelled `application/pdf` but containing HTML or an SVG with embedded JavaScript would be accepted and stored. While the bucket is private and served via signed URL, the browser still infers a content type from the URL or Storage's stored content-type; a malicious HTML/SVG could execute when previewed.
- **Recommendation:** Add magic-byte/server-side sniffing:
  ```ts
  // After reading file.arrayBuffer():
  const buf = Buffer.from(await file.arrayBuffer());
  const looksLikePdf = buf.slice(0, 5).toString() === "%PDF-";
  const looksLikeJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const looksLikePng =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (!looksLikePdf && !looksLikeJpeg && !looksLikePng) {
    return NextResponse.json({ error: "File contents do not match an allowed type" }, { status: 422 });
  }
  ```
  Force Storage `contentType` to the verified type (not `file.type`), and set `Content-Disposition: attachment` on all signed URLs to prevent in-browser rendering of any uploaded content. Defer virus scanning (NF-10) as TDD planned but document the gap.
- **References:** NF-10; OWASP Unrestricted File Upload.

---

### 2.11 MEDIUM — Storage bucket creation runs at request time (race condition + unnecessary admin call)

- **Severity:** Medium
- **Location:** `src/lib/storage/documents.ts:17-31` (`ensureBucket`).
- **Description:** First upload after a cold start attempts `createBucket("documents", { public: false })`. The "already exists" error is swallowed by string-matching. Concurrent first uploads can race; the function logs and rethrows on unexpected errors, potentially failing legitimate uploads while the bucket is still being created. The bucket should be provisioned out-of-band (Terraform / Supabase dashboard) and not depend on request-path code.
- **Recommendation:** Provision the bucket once during deployment (Supabase CLI: `supabase storage create documents --public=false`). Remove `ensureBucket()` entirely, or downgrade it to a startup-time check.
- **References:** Defence-in-depth (resilience).

---

### 2.12 MEDIUM — Admin document upload skips ownership context check

- **Severity:** Medium
- **Location:** `src/app/api/admin/documents/route.ts:82-91`
- **Description:** The endpoint requires `ASSESSOR` role but does not verify the application is assigned to that assessor. Any assessor can upload a document into any application by guessing/known UUID. This is less severe than 2.1 because uploads are limited to known applications and create an audit trail, but it still allows a malicious assessor to plant documents in cases not assigned to them.
- **Recommendation:** Add `requireApplicationAccess(user, applicationId)` before the storage upload. Same pattern as 2.4.
- **References:** TDD §3.4 defence-in-depth.

---

### 2.13 MEDIUM — Document verify endpoint missing ownership check

- **Severity:** Medium
- **Location:** `src/app/api/documents/[id]/verify/route.ts:18-65`
- **Description:** Any ASSESSOR can toggle the `isVerified` flag on any Document, regardless of whether the parent application is assigned to them. A malicious assessor could mark fraudulent documents as verified on other assessors' cases.
- **Recommendation:**
  ```ts
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true, isVerified: true, applicationId: true, slot: true,
      application: { select: { assignedToId: true } },
    },
  });
  if (user.role === Role.ASSESSOR && document.application.assignedToId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  ```

---

### 2.14 MEDIUM — Email contents (subject + plain-text body) logged at INFO/ERROR

- **Severity:** Medium
- **Location:** `src/lib/email/send.ts:96-115, 200-212, 260-274`; `src/app/api/webhooks/resend/route.ts:97-145` (subject + recipient on every webhook event).
- **Description:** `console.log/console.error` calls include `templateType`, recipient address, and Resend payloads. TDD §7.5.3 explicitly states message bodies should not be logged. Resend webhook handler logs the full `to` array, `subject`, and `email_id` on every delivery event — these will appear in Vercel logs/Datadog/whatever sink with full applicant emails and template type (which leaks decisions like `OUTCOME_DNQ` per template name). For minors' financial records this constitutes personal data processing that the system did not declare.
- **Recommendation:** Replace `console.*` with a structured logger that masks PII (hash email, suppress subject, drop body):
  ```ts
  logger.info({
    event: "email.sent",
    templateType,
    recipientHash: sha256(email).slice(0, 12),
    messageId: data?.id,
  });
  ```
  Never log `to`, `subject`, `body`, or merge data.
- **References:** TDD §7.5.3; UK GDPR Art. 5(1)(c) data minimisation.

---

### 2.15 MEDIUM — Resend webhook signature verification disabled

- **Severity:** Medium
- **Location:** `src/app/api/webhooks/resend/route.ts:178-212`
- **Description:** Signature verification is commented out pending `svix` install and `RESEND_WEBHOOK_SECRET`. The endpoint currently accepts any POSTed JSON that looks shaped like a Resend event and logs it. An attacker who finds the URL can flood logs, trigger console writes, or pollute future delivery-state tables.
- **Recommendation:** Install `svix`, set the secret, and enable the verification block before launch. Treat unsigned events as 401.
- **References:** OWASP A08:2021 software & data integrity failures.

---

### 2.16 LOW — Service-role key used for all Storage operations

- **Severity:** Low (architectural)
- **Location:** `src/lib/storage/documents.ts:10-12` and `src/lib/auth/supabase-admin.ts`
- **Description:** Every Storage upload, signed-URL grant, and delete uses the service-role key. This is acceptable given the absence of RLS (see 2.2), but it amplifies the impact of any IDOR (e.g. 2.1) because the storage layer has no defence of its own. Once RLS is added, downstream Storage policies should also be added so the bucket has its own access control independent of the application code.
- **Recommendation:** Pair with 2.2 — add Storage RLS policies once Postgres RLS is in place. Until then, document this clearly.

---

### 2.17 LOW — Permissive ApplicationSection `data` field accepts unbounded JSON

- **Severity:** Low
- **Location:** `prisma/schema.prisma:227` (`data Json @default("{}")`); `src/app/(portal)/apply/actions.ts:120-140` (`saveSectionDraft` writes user-supplied JSON without size limit).
- **Description:** `saveSectionDraft` calls `upsertSection` with arbitrary client-supplied `data`. There is no size cap. A malicious applicant can save megabytes of JSON per section per request, exhausting Postgres storage and potentially hitting Prisma's parameter size limit.
- **Recommendation:** Add a request body size check at the action entry point (`JSON.stringify(data).length < 200_000`) and a per-row size validation matched against the section's Zod schema even for drafts.

---

### 2.18 LOW — Applicant detail layout fetches names even for ASSESSOR who has not toggled reveal

- **Severity:** Low (privacy hygiene)
- **Location:** `src/lib/db/queries/applications.ts:108-156` (`getApplicationWithDetails`); used in `src/app/(admin)/applications/[id]/layout.tsx:98`, `assessment/page.tsx:116`, `recommendation/page.tsx:59`.
- **Description:** Queue masking is well implemented, but once an assessor opens a specific application, **all subsequent server-side queries fetch `childName` and `leadApplicant.firstName/lastName/email`** regardless of which tab. The Assessment tab in particular is supposed to render with only "Parent 1 / Parent 2" labels per NM-01..05; the underlying query still pulls names from the DB. The names are present in the SSR payload sent to the browser even when the UI does not render them.
- **Recommendation:** Split into two queries: a name-less default (used for Assessment tab and the layout header which only needs `reference`) and an explicit `getApplicationNamesForReveal()` audit-logged path (already exists for the queue — extend the pattern). Per NM-01 the query itself must exclude names; "render-side hiding" is not data minimisation.
- **References:** NM-01..05; UK GDPR Art. 5(1)(c).

---

### 2.19 LOW — `console.error` of stack traces with potentially sensitive context

- **Severity:** Low (information disclosure if logs are exposed)
- **Location:** Many files (`src/app/(portal)/apply/actions.ts:109, 134`, `src/app/api/documents/route.ts:135`, `src/app/api/documents/[id]/route.ts:71, 81`, etc.)
- **Description:** Errors are logged with `console.error("[label]", err)`, capturing full Prisma errors which include query parameters (and may include user-supplied form data depending on the error). Vercel forwards stdout/stderr to the runtime log, which is queryable by any team member with project access — this expands the GDPR processing footprint.
- **Recommendation:** Wrap errors before logging: log message + stack hash, not raw `err`. Strip Prisma's `meta.params`. Consider switching to `pino` with redaction paths.

---

### 2.20 LOW — Logout via POST without CSRF check

- **Severity:** Low (nuisance)
- **Location:** `src/app/api/auth/logout/route.ts:17-26`
- **Description:** The logout route accepts any POST, including cross-origin ones (browsers will send cookies on cross-origin POST forms unless SameSite=strict is set). A malicious site can force-log-out the user. Low impact (no data loss), but easy to fix.
- **Recommendation:** Verify `Origin`/`Referer` matches the app's origin, or require an anti-CSRF token. Server actions are CSRF-protected by Next.js; convert this to a server action.

---

### 2.21 INFORMATIONAL — Two-layer applicant/assessor type model is correctly isolated

The TDD DG-2 invariant (applicant-declared financials must be structurally incapable of reaching the calculator) is honoured: `src/lib/assessment/types.ts` defines `AssessmentInput`/`EarnerInput` independently of Prisma's `ApplicationSection` types and the applicant Zod schemas in `src/lib/schemas/`. Static grep finds no import path from `lib/schemas/*` into `lib/assessment/*`. Keep this — it's the strongest privacy guarantee in the codebase.

---

## 3. Positive Observations

These are working well and should be preserved through any refactor:

- **Single Prisma client singleton** (`src/lib/db/prisma.ts`) — no connection-pool exhaustion bugs.
- **Server-side role enforcement** via `requireRole` + Edge middleware — role is read from `app_metadata` (server-controlled JWT claim), not the spoofable `user_metadata`.
- **`getUser()` not `getSession()` in middleware** — correctly validates the JWT with Supabase rather than trusting the cookie.
- **Name-reveal endpoint pattern** (`/api/applications/names`) — correctly fetches names only on explicit toggle and writes a `NAME_REVEAL` audit log entry. Pattern is right; just extend it to the application-detail server queries (finding 2.18).
- **Applicant submit ownership check** (`apply/actions.ts:234-237`) — explicit ownership check exists; it just needs to be applied to draft/save actions too.
- **Two-layer assessment input types** — see 2.21.
- **Pre-signed URLs (rather than public bucket)** — fundamentally correct; the IDOR is in the authorization wrapper, not the storage model.
- **Parameterised queries everywhere** — no SQL injection surface. The single `$queryRaw` (`siblings.ts:239`) is a parameterless `SELECT gen_random_uuid()`.
- **No `dangerouslySetInnerHTML`, no `eval`, no `Function(...)`** — React's auto-escaping is doing its job.
- **Strong Zod validation on the portal** — all form sections have schemas; server actions validate before persisting.
- **Audit-log writes are non-blocking** — `createAuditLog` swallows errors. Reasonable, given audit failures should not block the action.
- **GDPR delete dialog** — a thoughtful 2-step confirm + transactional Prisma cascade. The cascade is comprehensive; only the auth-user deletion is missing (2.8).
- **Decimal-to-number serialization at the server/client boundary** — avoids Prisma type leakage and is consistent.
- **Invitation tokens are UUID + expiry checks + status check** — re-validated on registration, not just on landing.
- **No PII in client components** — Supabase admin client cleanly isolated to server.

---

## 4. Verification Matrix

| Invariant | Status | Notes |
|---|---|---|
| Edge middleware authenticates and routes by role group | **PASS** | `src/middleware.ts` validates JWT via `getUser()` and gates `/(portal)` and `/(admin)` correctly. Role taken from `app_metadata` (server-controlled). |
| MFA enforced for ASSESSOR | **FAIL** | No MFA implementation. See 2.7. |
| Three roles correctly modelled (APPLICANT/ASSESSOR/VIEWER) | **PASS** | Plus ADMIN and DELETED. Role enum and route gates align. |
| Server actions re-verify role/ownership (gate 2) | **PARTIAL** | Role: yes. Ownership: inconsistent. Sections, assessments, verify, admin upload all missing ownership checks. See 2.3, 2.4, 2.12, 2.13. |
| RLS policies on every personal-data table (gate 3) | **FAIL** | No RLS policies exist. See 2.2. |
| Prisma uses a subject-to-RLS connection | **FAIL** | Prisma connects via `DATABASE_URL` as `postgres` (RLS-exempt). |
| Applicants only see their own data | **PARTIAL** | Portal queries filter by `leadApplicantId` (good); applicant section save/load accepts client-supplied applicationId (BAD — 2.3). |
| AuditLog INSERT-only | **FAIL** | `gdprDeleteApplicantAction` calls `auditLog.updateMany`. See 2.8. |
| Invitation-based registration | **PASS** | `validateInvitationAction` and `registerWithInvitationAction` enforce token validity. No self-signup path. |
| IDOR — documents URL | **FAIL (Critical)** | See 2.1. |
| IDOR — documents POST | **PASS** | Ownership check at `documents/route.ts:82`. |
| IDOR — documents DELETE | **PASS** | Ownership check at `documents/[id]/route.ts:56`. |
| IDOR — documents verify | **FAIL** | See 2.13. |
| IDOR — admin documents upload | **FAIL** | See 2.12. |
| IDOR — application detail page (ASSESSOR scoping) | **PASS** | Layout enforces `assignedToId`. |
| IDOR — assessment server actions | **FAIL** | See 2.4. |
| IDOR — section save/load | **FAIL (Critical)** | See 2.3. |
| IDOR — exports | **PASS** | Role-gated; roundId-scoped; exports include all rows in the round which is the intended behaviour. |
| IDOR — PDF recommendation | **PARTIAL** | Role-gated for ADMIN/ASSESSOR/VIEWER; no `assignedToId` scoping for ASSESSOR — assessor can download any case's recommendation PDF. Same fix pattern as 2.4. |
| Name masking — queue query | **PASS** | `listApplications` excludes names; reveal goes through audit-logged endpoint. |
| Name masking — applicant detail / assessment query | **FAIL** | `getApplicationWithDetails` always selects names. See 2.18. |
| Storage bucket private | **PASS** | `createBucket(..., { public: false })`. |
| Pre-signed URL expiry | **PARTIAL** | 60 minutes as specified by TDD; recommend reducing to 5 minutes. |
| File type whitelist (PDF/JPEG/PNG) | **PARTIAL** | MIME-only — spoofable. See 2.10. |
| File size limit 20 MB server-side | **PASS** | Both upload routes enforce `MAX_SIZE_BYTES`. |
| Filename path-traversal safe | **PASS** | `safeFilename = file.name.replace(/[/\\]/g, "_")`. UUID prefix prevents collision. |
| Two-layer model (DG-2, AE-01) | **PASS** | See 2.21. |
| Right-to-deletion cascade | **PARTIAL** | DB + Storage cascade complete; Supabase Auth user not deleted. See 2.8. |
| 7-year retention check | **PASS** | Enforced in `gdprDeleteApplicantAction`. |
| 28-day rejected-purge automation | **NOT VERIFIED** | No scheduled job found; needs separate review of any cron/Vercel scheduler. |
| Prisma parameterised queries | **PASS** | No string-concatenation SQL. |
| XSS auto-escaping | **PASS** | No `dangerouslySetInnerHTML`. |
| Zod input validation on server actions | **PASS** (mostly) | Section save uses Zod; section draft does not validate beyond size (2.17). |
| CSP / security headers | **FAIL** | None configured. See 2.5. |
| CSRF on server actions | **PASS** | Next.js built-in. |
| CSRF on API routes (`/api/auth/logout`) | **FAIL** | See 2.20. |
| Open redirect (post-login / auth callback) | **FAIL** | See 2.9. |
| Cookie HttpOnly/Secure/SameSite | **PASS** (Supabase SSR defaults) | Cookies set by `@supabase/ssr`, which uses HttpOnly + SameSite=Lax + Secure (in production). No custom cookie code to break this. |
| Session timeout configuration | **NOT VERIFIED** | Defaults to Supabase project setting (1 hour access token, 7 day refresh). Confirm in Supabase dashboard. |
| Rate limiting on auth endpoints | **FAIL** | See 2.6. |
| Password policy | **FAIL** | 8-char minimum, no breach check. See 2.6. |
| Resend webhook signature verification | **FAIL** | Disabled. See 2.15. |
| No PII in logs | **FAIL** | See 2.14. |
| No secrets in client bundle | **PASS** | Service-role key only imported by server modules (`supabase-admin.ts`); browser client uses anon key. No client-component import path found. |

---

## 5. Suggested Remediation Order (Pre-Launch)

1. **Day 1:** Fix the document URL IDOR (2.1) and the section IDOR (2.3) — these are the highest-impact disclosure paths.
2. **Day 1:** Add `requireApplicationAccess` to all assessor mutating actions (2.4), verify route (2.13), admin upload route (2.12), PDF route.
3. **Day 2:** Configure security headers (2.5) and the open-redirect fix (2.9).
4. **Day 2:** Add rate limiting + breach-password check (2.6); fix webhook signature (2.15).
5. **Week 1:** Implement assessor MFA (2.7) and the GDPR auth-user delete + DELETED-role middleware branch (2.8).
6. **Week 2:** Magic-byte file validation (2.10); split name-bearing application queries (2.18); structured logging with redaction (2.14, 2.19).
7. **Decision point:** Commit to RLS (2.2) for true defence-in-depth, or formally document the single-layer authorisation posture and treat *every* server action as security-critical (with code-review enforcement).
