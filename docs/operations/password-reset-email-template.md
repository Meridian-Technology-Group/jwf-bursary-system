# Password reset email template (Supabase Auth)

**This is a required deploy step, not optional configuration.** The code in
`src/app/(auth)/reset-password/update/` reads a `token_hash` from the query
string. Until the Supabase template below is applied, reset links land on
"This link has expired" — the code change and the template change must go
live together, per environment.

Applies to both projects:

| Environment | Supabase project | Applied |
|---|---|---|
| staging / preview | `supabase-nonprod` | ☐ |
| production | `supabase-prod` | ☐ |

## Why the template has to change

Recovery tokens are single-use. The old flow sent recipients through
Supabase's `/auth/v1/verify` hop, which spends the token on the **first GET
of the link** and redirects to `/auth/callback?code=…`.

Corporate mail security fetches every URL in an inbound email on arrival.
Microsoft Defender Safe Links does this for all Exchange Online tenants —
including John Whitgift Foundation. So the scanner spent the token seconds
after delivery, and the recipient's first real click always failed.

Observed on staging, 2026-08-23 (Supabase auth audit + Vercel logs):

| Time | Event | User agent |
|---|---|---|
| 19:51:16 | `user_recovery_requested` for test3 | Edge/151 — the recipient |
| 19:51:31 | `login` for test3, token spent | **Chrome/142 — the scanner** |
| 19:51:32 | `GET /auth/callback` → 307 | the scanner |
| 19:53:58 | `GET /auth/callback` → 307 → `/login?error=session_exchange_failed` | the recipient's real click |

Fifteen seconds from send to burn; two minutes twenty-seven before the
recipient clicked.

The fix is to link straight to the app with `{{ .TokenHash }}` and verify it
in the browser only when the form is submitted. A scanner GETs a plain
password form, runs no JS and submits nothing, so the token survives.

## The template

Supabase Dashboard → Authentication → Emails → **Reset Password**.

Subject:

```
Reset your password
```

Body:

```html
<h2>Reset your password</h2>
<p>We received a request to reset your password. Follow the link below to choose a new one.</p>
<p>
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
</p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

`{{ .RedirectTo }}` resolves to the `redirectTo` passed by
`src/app/(auth)/reset-password/page.tsx`, which is
`<origin>/reset-password/update`. Deriving it from the browser's origin is
what lets staging, production and preview deploys each resolve to their own
host from one template.

### Redirect allowlist

Authentication → URL Configuration → Redirect URLs must permit
`/reset-password/update` on every host that serves the app, or Supabase
silently falls back to Site URL and `{{ .RedirectTo }}` resolves wrong:

```
https://<staging-host>/reset-password/update
https://<production-host>/reset-password/update
https://*.vercel.app/reset-password/update
```

Check the existing entries first — a sufficiently broad wildcard may already
cover these.

## Verifying after the change

Per environment, in this order:

1. Request a reset for a test account from `/reset-password`.
2. Confirm the email's link points at `/reset-password/update?token_hash=…&type=recovery`
   (not `/auth/v1/verify`, not `/auth/callback`).
3. **Wait two minutes before clicking.** This is the whole point: it gives
   any link scanner time to fetch the URL first. Clicking immediately tests
   nothing.
4. Set a new password. It should be accepted on the first attempt.
5. Sign in with the new password.
6. Check `auth_audit_logs` for that window: there should be exactly one
   `login` for the account, with the recipient's user agent. A second
   `login` from a different user agent means something is still spending
   the token early.

Regression checks worth running in the same pass, both previously broken:

- Open the reset link in a browser **signed in as a different user**. The
  form must change the account the link was issued for, not the signed-in
  one. (The old page trusted any live session.)
- Visit `/reset-password/update` directly with no token. It must show
  "This link has expired", never a usable form.

## Related

- `src/app/(auth)/reset-password/update/update-password-form.tsx` — verify-on-submit
- `src/app/(auth)/register/token-registration.tsx` — the invitation flow, scanner-safe for the same reason
- `docs/guides/walkthroughs/applicants/03-reset-forgotten-password.md`
