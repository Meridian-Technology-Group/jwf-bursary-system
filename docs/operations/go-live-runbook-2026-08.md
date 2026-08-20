# Go-live runbook — first real applicants (August 2026)

Epic 15 G3 (CI-09). Charlotte has three internal bursary requests and wants
invitations out **Fri 21 Aug 2026** with a parent submission deadline of
**Thu 27 Aug 2026**. Per D15-1 they run on the **staging environment**
(staging alias + `supabase-nonprod`).

## 0. Verified state (browser pass, staging alias, 2026-08-20 late evening)

Run against the deployed staging alias after PRs #321/#322/#323 merged
(`db-push` green, deploy live):

| Check | Result |
|---|---|
| Password reset — Charlotte's CI-01 repro | ✅ request → email → link → **set-new-password page** → sign-in with the new password (screenshot `e15-g3-01-staging-reset-loop-fixed.png`) |
| Quick invite with the new mandatory child identity (first name, surname, DOB — no title) | ✅ refuses incomplete; sends with complete data |
| Invitation email | ✅ received from staging, registration link points at the staging alias, expiry +30 days |
| Registration via the emailed link | ✅ account created, application created with the split child identity (DB-verified) |
| Portal | ✅ home shows the 2026/27 round + deadline banner; wizard opens with the child's name prefilled |
| Fixtures | all throwaways deleted after the pass |

## 1. What Brian does BEFORE Charlotte starts (once, ~10 min)

1. **Reply-to (CI-03)** — staging sends currently carry **no reply-to**
   (the `fees@` fallback is production-only, #318). If parent replies must
   reach the Bursary Office from day one, set in Vercel → jwf-bursary-system
   → Settings → Environment Variables, **Preview** scope:
   `RESEND_REPLY_TO_EMAIL = fees@johnwhitgiftfoundation.org`, then redeploy
   staging (any push does it, or Vercel → Redeploy).
2. **The deadline the email states (⚠️ the one real gotcha).** The
   invitation email for the 2026/27 round currently says *"the deadline for
   submitting your completed application is 30/11/2026"* (verified live).
   Charlotte wants these three families working to **27 Aug**. To make the
   email say 27/08/2026: Admin → All Rounds → 2026/27 → **Round scenarios**
   card → set the NEW-application scenario's *Submit by* to 2026-08-27
   (or set the round's NEW default deadline). Decide with Charlotte whether
   she wants the system deadline moved or would rather state the 27 Aug
   expectation in her own covering email — moving the round-level date
   affects EVERY invitation on that round, not just these three.
3. **Green-light Charlotte** (D15-2 satisfied — G1+G2 verified on staging).

## 2. What Charlotte does per family (~3 min each)

Recommended path — **contact register** (keeps a curated record):

1. Admin → Contacts → **New contact**: parent surname + email (+ first
   name/phone), child **first name, surname, date of birth** (all
   required), school, **situation** (Internal for these three), entry year
   + entry year group, address if known.
2. Row → **Invite** → pick round **2026/27** → confirm. The parent gets the
   INTERNAL-variant invitation with a personal registration link (30-day
   expiry).
3. The parent registers via the link, sets a password, and lands in the
   application with school/year locked.

Quick alternative: Admin → Send Invitations → *Quick invite a family*
(same fields, no stored contact).

If a parent forgets their password: **Sign in → Forgot password?** — the
loop is fixed and verified.

## 3. Hygiene while real families share nonprod (until prod cutover)

- Nonprod now holds REAL family data. Engineering sessions treat every
  non-`*@meridiantech.group`-plus-tag, non-`*.test` account as protected:
  never open, modify, or delete; throwaway fixtures only, always cleaned up.
- `seed:demo` stays forbidden against nonprod (destructive), as always.
- The three families' **post-assessment transfer to production** is a
  separate, planned exercise (out of Epic 15 scope) — do not improvise it.

## 4. Known limitations to hold in mind (already in the Epic 15 board)

- Missing-docs window: parents can only respond once ALL requested slots
  are filled (`Send to assessor` gates on completeness) — request only the
  slots actually needed.
- The assessment workspace items (CH batch + Part 6) land through the week
  — Charlotte can assess offline if the 27 Aug window closes first (her
  stated fallback).
- Sent emails are not yet visible in-app (X1 ships this week); the
  invitation history table on Send Invitations shows invitation sends.
