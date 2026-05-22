---
title: Applicant-side re-assessment flow unreachable (PR #47 built the card; dashboard regression hides it for returning holders)
status: closed
severity: high
area: reassessment, invitations, portal
opened: 2026-05-22
opened_by: walkthrough-verification
related:
  - docs/walkthroughs/applicants/26-accept-reassessment-invitation.md
  - docs/walkthroughs/applicants/27-complete-reassessment.md
  - docs/walkthroughs/applicants/28-what-changes-year-on-year.md
  - src/app/(auth)/register/actions.ts (acceptApplicantInvitationAction)
  - src/lib/db/queries/reassessment.ts (prepopulateReassessment — not called on this path)
  - src/app/(admin)/invitations/actions.ts (batch path that DOES call prepopulateReassessment)
---

## Context

Tested with a seeded PENDING re-assessment invitation for applicant2
(`bursary_account_id` set, current round 2026/27) plus a completed
year-1 record. Walked applicant/26 and 27.

The underlying accept **does** create the right row: navigating to the
token URL and submitting creates `WS-202627-0004` —
`status=PRE_SUBMISSION, is_reassessment=true, bursary_account_id=<BA-R>`.
But everything around it diverges from the guides:

1. **Login-before-link is a dead-end.** Logging in directly (no token in
   the URL) auto-accepts the invitation (`status → ACCEPTED`,
   `accepted_at` set) **without creating the application**. The dashboard
   then shows generic first-year onboarding; clicking "Start my
   application" correctly refuses ("This invitation is for a
   re-assessment. Please follow the re-assessment link…") — but the
   re-assessment link now returns "Invitation invalid — already used."
   The applicant cannot start their re-assessment by any route.

2. **Wrong accept UX.** The token URL renders the first-year "Create your
   account / choose a password (at least 12 characters)" form, not the
   "sign in → welcome back to the new round → confirm school + child"
   experience the guide describes. applicant2 already has an account.

3. **No section prepopulation.** After accept, `WS-202627-0004` has
   **zero** `application_sections`. The guide promises child/parent/
   dependent details "pre-filled from last year." `prepopulateReassessment`
   is only wired into the batch-invite path, not
   `acceptApplicantInvitationAction`.

4. **FAMILY_ID not hidden / no shorter form.** The portal shows the full
   11-section nav including **Family Identification**; the guide says
   Section 2 is skipped for re-assessments. The applicant-facing
   experience is identical to a first-year application — the only
   difference is the DB `is_reassessment` flag.

5. **(Minor) HIBP check CSP-blocked.** The register page's pwned-password
   check calls `api.pwnedpasswords.com`, blocked by `connect-src 'self'
   https://*.supabase.co`. It fails open ("HIBP check failed, allowing
   password"), so it's low severity, but it errors on every registration.

## Why it matters

applicant/26, 27, and 28 are all unverifiable as written — the documented
re-assessment experience is essentially unbuilt beyond the `is_reassessment`
flag. Item (1) is the worst: a returning bursary holder who logs in before
clicking the email link permanently burns their invitation with no
recovery path in the UI.

The **assessor** side (benchmark + year-on-year comparison, guides 26/27)
reads the prior-year assessment via the bursary account and is independent
of these gaps — verified separately by submitting `WS-202627-0004`.

## Proposed approach

- Do not auto-accept (consume) a re-assessment invitation on plain login;
  either create the application at that point or leave the invite PENDING
  so the link still works.
- Branch the accept UI on "user already exists" → sign-in + a
  re-assessment confirmation card, instead of the create-account form.
- Call `prepopulateReassessment` from `acceptApplicantInvitationAction`
  (or wherever the re-assessment app is first created) and hide FAMILY_ID
  in the portal nav when `application.isReassessment`.
- Add `api.pwnedpasswords.com` to `connect-src` (or proxy the check
  server-side) — see the other CSP backlog entries.

## Re-walk after PR #47 (2026-05-22) — partially fixed, STILL OPEN

PR #47 ("feat: build applicant-side re-assessment flow") landed the missing
pieces — but a regression makes the whole flow **unreachable**, so 26/27/28
remain ❌.

**What PR #47 fixed:**
- The token URL (`/register?token=…`) for an already-registered holder now
  renders a **"Welcome back" sign-in screen** ("Sign in with the same email
  and password you used last year to begin"), pre-fills the email, names the
  child + round — not the first-year create-account form. (Item 2 ✅.)
- `ReassessmentCard` (`src/app/(portal)/reassessment-card.tsx`) +
  `beginReassessmentAction` exist and are wired to consume the still-PENDING
  invite and create the prepopulated app. The accept no longer auto-consumes
  on plain login (the dashboard now leaves a re-assessment invite PENDING for
  the card to consume).

**The blocking regression (root cause):** the `ReassessmentCard` only renders
in the `!application` branch of the portal dashboard
(`src/app/(portal)/page.tsx:220`). But PR #39 changed
`getCurrentApplicationForUser` (`src/lib/db/queries/applications.ts:280`) to
return the applicant's most-recent application of **any** status. A returning
holder's only app is last year's **COMPLETED** WS-202526-0001 (CLOSED round
2025/26), so the dashboard takes the `application` branch and renders the old
year-1 status card ("2025/26 Assessment Round — view your application status
below", COMPLETED badge, "View Status" quick action). The `invitation` branch
— and therefore the **"Begin re-assessment" button — is never reached**.

Re-walk observation (applicant2, invite e3 reset to PENDING, no current-round
app): logged in → dashboard shows the year-1 COMPLETED status card, NOT the
re-assessment "welcome back" card. No CTA to begin. The "Sign in to begin"
button on the token screen lands on this same dead-end dashboard.

**Fix needed:** scope the dashboard's "current application" lookup to the
current/open round (or to PRE_SUBMISSION / the invite's round), so a returning
holder with only a prior-year COMPLETED app falls through to the
`ReassessmentCard`. Until then, items 3 (prefill) and 4 (hide FAMILY_ID) can't
be verified in the UI because no re-assessment app can be created via the
front end.

## Re-walk after PR #47 + #48 (2026-05-22) — FIXED & CLOSED

PR #48 fixed the blocking regression: the dashboard's "current application"
lookup is now scoped to the current/open round, so a returning holder whose
only app is last year's COMPLETED record falls through to the
`ReassessmentCard`. With this in place the full flow was re-walked end-to-end
on a local prod build of merged `staging` (includes PR #47 + #48) and all three
guides now pass:

- **applicant/26 ✅** — logged in as applicant2 with invite e3 PENDING and no
  current-round app; dashboard `/` now shows the **"Welcome back — your bursary
  for Shane Murazik is up for re-assessment for 2026/27"** card (school Whitgift
  School, child Shane Murazik), not the prior-year status card or onboarding.
  Clicking **Begin re-assessment** created a new app (`is_reassessment=true`,
  `bursary_account_id=BA-202526-0001`, `status=PRE_SUBMISSION`) and flipped
  invite e3 → **ACCEPTED** (`accepted_at` set).
- **applicant/27 ✅** — the new app's `application_sections` show
  CHILD_DETAILS / PARENT_DETAILS / DEPENDENT_CHILDREN / DEPENDENT_ELDERLY copied
  with `is_complete=true` (with data), PARENTS_INCOME / ASSETS_LIABILITIES
  present-but-incomplete (blank), and **no FAMILY_ID row**. The portal nav
  **hides "Family Identification"** and the count reads **"0 of 10 sections
  complete"** (reduced from 11). Details of Child is pre-populated with last
  year's data (Shane Murazik, DOB 10/05/2014, Whitgift School, start 05/09/2025);
  Parents' Income is blank.
- **applicant/28 ✅** — the documented year-on-year differences all hold:
  FAMILY_ID skipped, personal sections prefilled, financial sections blank.

Closed by PR #47 (built the card + token UX + prepopulation) and PR #48
(scoped the dashboard's current-application lookup to the current round).

## Out of scope

The year-1 record, bursary account, and invitation here are test-only
seeds (UUIDs prefixed `f1000000-…`).
