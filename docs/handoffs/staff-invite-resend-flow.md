# Handoff — migrate staff invitations to the Resend + /register pattern

**Branch:** `feature/staff-invite-resend-flow` (off `security-hardening`)
**Status:** Not started — this doc is the spec.
**Why:** Supabase's `inviteUserByEmail` uses the implicit-flow OTP, which (a) gets eaten by email link scanners (Gmail/Outlook prefetch) producing `otp_expired` errors and (b) returns the access token in the URL fragment which our `/auth/callback` (PKCE-only) can't process. End result: invited staff land at `/login#access_token=...` with a live session and no way to set a password. The applicant invitation flow already solves this cleanly by creating the auth user silently and sending a branded Resend email with a tokenised registration link. This task replicates that pattern for staff.

---

## What "done" looks like

An admin clicks **Invite Staff**, enters email + role + (optional) name:

1. The action silently creates the Supabase auth user with a random throwaway password (`email_confirm: true` so no Supabase OTP fires).
2. The action creates a matching `Profile` row in `withAdminContext` (role = ADMIN / ASSESSOR / VIEWER as chosen).
3. The action creates a new `Invitation`-equivalent row (or extends the existing one — see "Schema decision" below) that carries a single-use token, expiry, and the FK to the auth user.
4. The action sends a branded email via Resend using a new `INVITE_STAFF` `EmailTemplate` row, with `registration_link = ${appUrl}/register/staff?token=...`.
5. The invitee clicks the link, lands on the new `/register/staff` page, sets a password, and is logged in straight to `/admin`.
6. `supabase.auth.admin.inviteUserByEmail` is removed from the codebase.

---

## File map

### Files you will edit

| Path | What changes |
|---|---|
| `src/app/(admin)/users/actions.ts` | `inviteStaffAction` rewritten end-to-end |
| `src/app/(admin)/users/page.tsx` | No change unless StaffInviteForm needs new fields |
| `prisma/schema.prisma` | Add `StaffInvitation` model OR extend `Invitation` — see decision below |
| `prisma/migrations/<ts>_add_staff_invitation/migration.sql` | New table or new columns |
| `prisma/seed-data/email-templates.ts` | Add `INVITE_STAFF` template |
| `prisma/seed.ts` | No change if templates seed runs on every seed (it does) |

### Files you will create

| Path | Purpose |
|---|---|
| `src/app/(auth)/register/staff/page.tsx` | The page invitees land on (Server Component shell) |
| `src/app/(auth)/register/staff/staff-register-form.tsx` | Client component: token validation + password set form |
| `src/app/(auth)/register/staff/actions.ts` | `validateStaffInvitationAction`, `acceptStaffInvitationAction` server actions |
| `src/lib/db/queries/staff-invitations.ts` | `getStaffInvitationByToken`, `markStaffInvitationAccepted` (mirroring the applicant invitation queries) |

### Files you will read (do not edit) — these are the patterns to mirror

| Path | Why |
|---|---|
| `src/app/(admin)/invitations/actions.ts` | The applicant invite action — copy its `createUser` + `sendEmail` shape |
| `src/lib/email/send.ts` | The `sendEmail(to, templateType, mergeData)` API you'll call |
| `src/app/(auth)/register/page.tsx` + `src/app/(auth)/register/actions.ts` | The applicant register page — copy its layout, validation, and `validateInvitationAction` / `registerWithInvitationAction` patterns |
| `prisma/seed-data/email-templates.ts` | Existing templates as the shape reference for `INVITE_STAFF` |
| `src/lib/auth/create-profile.ts` | The `createProfile(tx, ...)` helper you must use (do not bypass) |
| `prisma/schema.prisma` model `Invitation` | The shape to either extend or mirror |

---

## Schema decision (make this first)

You have two viable shapes. Pick one and stick with it.

### Option 1 — New `StaffInvitation` model (recommended)

Cleaner separation, no nullable fields polluting the applicant `Invitation`.

```prisma
model StaffInvitation {
  id            String          @id @default(uuid()) @db.Uuid
  email         String
  role          Role            // ADMIN | ASSESSOR | VIEWER
  firstName     String?         @map("first_name")
  lastName      String?         @map("last_name")
  token         String          @unique
  authUserId    String          @db.Uuid @map("auth_user_id")
  status        InvitationStatus @default(PENDING)   // reuse existing enum
  expiresAt     DateTime        @map("expires_at") @db.Timestamptz()
  acceptedAt    DateTime?       @map("accepted_at") @db.Timestamptz()
  createdBy     String          @db.Uuid @map("created_by")
  createdAt     DateTime        @default(now()) @map("created_at") @db.Timestamptz()

  inviter       Profile         @relation("StaffInvitationCreator", fields: [createdBy], references: [id])

  @@index([token])
  @@index([email])
  @@map("staff_invitations")
}
```

Also add an `enable_row_level_security` block + policies in the migration:
- `SELECT` policy: admins only (`is_admin()`)
- `INSERT` policy: admins only (created by them)
- `UPDATE` policy: status changes by service_role only (or restrict to creator)
- See `prisma/migrations/20260513090020_enable_row_level_security/migration.sql` for the policy idiom used everywhere else in this repo.

### Option 2 — Extend the existing `Invitation` model

Add nullable `role`, `firstName`, `lastName`. Mark existing applicant invitations as `role = NULL` (meaning "applicant"). Less code, more nullable columns, slightly more conditional logic at every callsite.

**Default to Option 1.** Only fall back to Option 2 if you discover a strong reason during implementation.

---

## Implementation order

Do this strictly in order; each step is a checkpoint where you can stop and verify.

### 1. Add the schema (≈10 min)

- Edit `prisma/schema.prisma` per Option 1 above.
- Run `npx prisma format`.
- Run `npx prisma migrate dev --name add_staff_invitation` against your local Supabase (or use the MCP `apply_migration` against non-prod).
- Confirm RLS policies are in place: `SELECT * FROM pg_policies WHERE tablename = 'staff_invitations'`.
- Run `npx tsc --noEmit` — should still pass.

### 2. Add the `INVITE_STAFF` email template (≈10 min)

- Edit `prisma/seed-data/email-templates.ts`. Add an entry with:
  - `templateType: "INVITE_STAFF"` (also add this to the `EmailTemplateType` enum in `prisma/schema.prisma` if it's not already in the enum — check first; the existing `INVITATION` template is for applicants).
  - Subject like `"You've been invited to the JWF Bursary Assessment System"`.
  - Body with `{{ registration_link }}`, `{{ first_name }}`, `{{ role }}` merge tags. Match the visual style of the existing `INVITATION` template.
- Re-run seed against non-prod: `npx prisma db seed` (uses DIRECT_URL — the postgres superuser — so it bypasses RLS). The seed file does `prisma.emailTemplate.deleteMany({})` then re-creates from the data file, so it's idempotent.

### 3. Add the lib queries (≈15 min)

`src/lib/db/queries/staff-invitations.ts`:

```ts
import type { Tx } from "@/lib/db/prisma";
import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";

export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createStaffInvitation(
  tx: Tx,
  input: {
    email: string;
    role: Role;
    firstName?: string;
    lastName?: string;
    authUserId: string;
    createdBy: string;
    ttlHours?: number;  // default 72
  },
) {
  const expiresAt = new Date(Date.now() + (input.ttlHours ?? 72) * 3600_000);
  return tx.staffInvitation.create({
    data: {
      email: input.email.toLowerCase(),
      role: input.role,
      firstName: input.firstName,
      lastName: input.lastName,
      authUserId: input.authUserId,
      createdBy: input.createdBy,
      token: generateInvitationToken(),
      expiresAt,
    },
  });
}

export async function getStaffInvitationByToken(tx: Tx, token: string) {
  return tx.staffInvitation.findUnique({ where: { token } });
}

export async function markStaffInvitationAccepted(tx: Tx, id: string) {
  return tx.staffInvitation.update({
    where: { id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
}
```

Every function takes `tx: Tx` as first param — matches the rest of `src/lib/db/queries/`.

### 4. Rewrite `inviteStaffAction` (≈15 min)

Open `src/app/(admin)/users/actions.ts`. The current shape uses `supabase.auth.admin.inviteUserByEmail` + `updateUserById` + `createProfile`. Replace with the applicant pattern:

```ts
// 1. Create Supabase auth user silently — email_confirm: true means no
//    Supabase OTP email is sent. Use a random password they'll never need;
//    they'll set their own on the registration page.
const supabase = createSupabaseAdminClient();
const tempPassword = randomBytes(24).toString("base64url");

const { data: created, error: supabaseError } = await supabase.auth.admin.createUser({
  email,
  password: tempPassword,
  email_confirm: true,
  app_metadata: { role },
});
if (supabaseError || !created.user) {
  return { success: false, error: supabaseError?.message ?? "Auth create failed" };
}
const authUserId = created.user.id;

// 2. Profile + StaffInvitation + audit log, all inside one withAdminContext.
const appUrl = getAppUrl();
const result = await withAdminContext(async (tx) => {
  const profile = await createProfile(tx, {
    id: authUserId,
    email,
    role: role as Role,
    firstName,
    lastName,
  });
  if (!profile.success) return profile;

  const inv = await createStaffInvitation(tx, {
    email,
    role: role as Role,
    firstName,
    lastName,
    authUserId,
    createdBy: admin.id,
  });

  await createAuditLog(tx, {
    userId: admin.id,
    action: "INVITE_STAFF",
    entityType: "StaffInvitation",
    entityId: inv.id,
    context: `Invited ${email} as ${role}`,
    metadata: { email, role },
  });

  return { success: true as const, token: inv.token };
});

if (!result.success) {
  // Roll back the auth user so we don't leave an orphan.
  await supabase.auth.admin.deleteUser(authUserId);
  return { success: false, error: result.error ?? "Failed to create invitation" };
}

// 3. Send branded Resend email.
await sendEmail(email, "INVITE_STAFF", {
  first_name: firstName ?? email.split("@")[0],
  role,
  registration_link: `${appUrl}/register/staff?token=${result.token}`,
});

revalidatePath("/users");
return { success: true };
```

Important: **always roll back the auth user if any of the DB work fails** — orphan auth users (like the one we cleaned up manually during debugging) are why we need this guard.

### 5. Build the `/register/staff` flow (≈30 min)

#### `src/app/(auth)/register/staff/page.tsx`

Server Component. Accepts `?token=...`. Validates the token server-side (calls `validateStaffInvitationAction`). If valid, renders `<StaffRegisterForm token={token} email={inv.email} firstName={inv.firstName} role={inv.role} />`. If invalid/expired, renders an "Invitation expired" message with a CTA back to `/login`.

Use the same Server Component shell pattern as `src/app/(auth)/register/page.tsx`.

#### `src/app/(auth)/register/staff/staff-register-form.tsx`

Client component. Form with: email (read-only), first/last name (pre-filled, editable), password (with confirmation). On submit:
1. Call `validatePasswordStrength(password)` from `src/lib/auth/password-policy.ts` (already exists — does 12-char + HIBP check). Show errors inline.
2. Call `acceptStaffInvitationAction({ token, firstName, lastName, password })`.
3. On success, the action returns; trigger `supabase.auth.signInWithPassword({ email, password })` client-side, then `router.push("/admin")`.

#### `src/app/(auth)/register/staff/actions.ts`

Two server actions:

```ts
export async function validateStaffInvitationAction(token: string)
// Returns { valid: true, email, firstName, lastName, role } or { valid: false, reason }
// Wrap with withAdminContext to read staff_invitations.
// Check: status === PENDING, expiresAt > now.

export async function acceptStaffInvitationAction(input: {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
})
// 1. Re-validate token (withAdminContext).
// 2. validatePasswordStrength(password) — fail-open on HIBP network error.
// 3. supabase.auth.admin.updateUserById(authUserId, { password }).
// 4. withAdminContext: update Profile firstName/lastName, markStaffInvitationAccepted, createAuditLog action="ACCEPT_STAFF_INVITATION".
// 5. Return { success: true } (client does the sign-in after).
```

### 6. Remove the old code path (≈5 min)

- Delete the `inviteUserByEmail` call and the now-dead `updateUserById` call in `users/actions.ts`. The file should no longer import the helper.
- Grep for `inviteUserByEmail` across `src/` — should be zero hits at end.

### 7. Test on staging (≈15 min)

- Push the branch, wait for staging deploy.
- Manually nuke any test users via the MCP:
  ```sql
  DELETE FROM public.profiles WHERE email LIKE 'jwf-testing%';
  DELETE FROM public.staff_invitations WHERE email LIKE 'jwf-testing%';
  DELETE FROM auth.users WHERE email LIKE 'jwf-testing%';
  ```
- As admin, invite `jwf-testing+assessor2@meridiantech.group` with role ASSESSOR.
- Confirm: branded Resend email arrives (not Supabase's). Subject matches your `INVITE_STAFF` template.
- Click the link → should land on `/register/staff?token=...` with email pre-filled.
- Set a password → should sign in and redirect to `/admin`.
- Verify in DB: `staff_invitations.status = 'ACCEPTED'`, `acceptedAt` set, `Profile.firstName/lastName` populated.
- Confirm the Staff Users list shows the new user.
- Confirm an audit log row exists for `INVITE_STAFF` and `ACCEPT_STAFF_INVITATION`.

### 8. Open a PR

Title: `feat(staff): invitation flow via Resend + /register/staff`

Squash commits. Reference this doc in the PR description.

---

## Things to NOT do

- **Don't try to reuse the applicant `/register` page.** The data shapes are different (staff don't have applicantName/childName/round/school), and the registration form would become a conditional mess. Two pages is cleaner.
- **Don't skip the auth-user rollback.** Orphaned auth users (auth.users row, no Profile) are a known pain point — we cleaned one up manually during the debugging session. The rollback prevents recurrence.
- **Don't add a separate RLS context for staff_invitations beyond what's already documented.** The table follows the same pattern as `invitations`: admins read/write under `withAdminContext`, no end-user access.
- **Don't change the existing applicant `Invitation` model** unless you went with Option 2 above (and even then, keep the changes additive).
- **Don't forget `npx tsc --noEmit` after every step.** This codebase has zero tsc errors and a CI gate that enforces it.

---

## Known gotchas you'll hit

1. **`EmailTemplateType` enum in Prisma schema.** Look at the current enum values — `INVITATION`, `OUTCOME_QUALIFIES`, `OUTCOME_DNQ`, etc. You need to add `INVITE_STAFF` here AND in the seed file. The Prisma migration handles the enum addition.
2. **Seed file deletes templates on every run.** `prisma/seed.ts` does `prisma.emailTemplate.deleteMany({})` first. If you've manually edited templates on staging, they'll be overwritten — that's expected.
3. **Vercel Preview must have `RESEND_FROM_EMAIL` set** (it already is, but confirm). The `sendEmail` helper will throw if the from address isn't on a verified Resend domain.
4. **The middleware does not exempt `/register/staff`** explicitly — but it does match `AUTH_ROUTES = /^\/(?:\(auth\)\/)?(?:login|register|reset-password|auth\/callback)/`. The `register` prefix should cover `/register/staff`. Confirm by reading `src/middleware.ts` line 30 — if you renamed routes, update the regex.
5. **`createProfile`'s `"use server"` directive was removed earlier** because it now takes a `Tx`. Don't add it back — it would break the function signature.
6. **The Supabase Site URL + Redirect URLs allowlist still needs to permit `/register/staff?token=*`.** Since the redirect_to we passed in the email is NOT to Supabase (it's to our own `/register/staff` link rendered in HTML), the allowlist doesn't apply to this flow. But if you ever add a Supabase-native fallback, you'd need to update it.

---

## When you pick this up

1. `git checkout feature/staff-invite-resend-flow` — you should be on commit `fbe02b1` (the parent `security-hardening` HEAD as of 2026-05-13 17:00 UTC).
2. Read this whole doc once.
3. Start with **Schema decision** → step 1.
4. After step 4 (rewrite the action) you can already exercise half the flow: invite produces a token + Resend email, even though `/register/staff` doesn't exist yet — click the email link, confirm the URL is correct, then build the page.

Estimated total: **1.5–2 hours**.
