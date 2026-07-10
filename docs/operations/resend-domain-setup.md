# Resend Domain Verification & DNS Setup Guide

Backlog item 5 (`docs/backlog/post-demo-change-list.md`). This is a
step-by-step guide for verifying the Foundation's own sending domain in
Resend and publishing the DNS records that go with it, so bursary emails
send from `@<foundation domain>` instead of a shared/default address. It is
written for **a non-developer** — the Foundation's admin (Charlotte) or her
IT provider / domain registrar support desk — and assumes no prior Resend or
DNS experience.

## Purpose

Verify the Foundation's sending domain in Resend and add the SPF, DKIM and
DMARC DNS records Resend requires, so the system's outbound bursary emails
(invitations, submission confirmations, reminders, outcome notices) are sent
from the Foundation's own domain with good deliverability — arriving in
inboxes rather than spam.

---

## 1. Goal and prerequisites

**Goal:** replace the current default/shared sending address with an address
on a domain the Foundation owns (for example `bursary@send.jwf.org.uk` — see
the placeholder note in §3). Domain verification and DNS records are a
one-time setup per domain; once verified, the system sends from it
indefinitely.

**Prerequisites — before starting, confirm you have:**

- **Access to the Resend dashboard** for the JWF account
  (`https://resend.com/domains`). This system uses a **single, shared Resend
  account and API key across both the live (Production) and testing
  (Preview) environments** — see the JWF-specific notes in §7 — so this setup
  is done **once**, not once per environment.
- **The ability to add/edit DNS records** for the domain the emails will send
  from. This means either:
  - direct access to the DNS management panel at whichever registrar or DNS
    host manages that domain, or
  - a working relationship with whoever does (the Foundation's IT provider,
    web host, or the person who manages the `jwf.org.uk` domain today).
- **No developer needed for this part.** Setting up the domain and DNS
  records in this guide requires no code changes. The one follow-up step
  that *does* touch the deployed system (pointing the app at the new
  address) is a separate, small change described in §6 — flagged there as
  requiring the developer/deployer's sign-off.

---

## 2. Add the domain in Resend

1. Sign in to the Resend dashboard and go to **Domains**
   (`https://resend.com/domains`).
2. Click **Add Domain**.
3. Enter the domain (or subdomain — see §3) to send from.
4. Choose a **region**. Resend sends region options such as *North Virginia*,
   *Ireland*, *São Paulo* and *Tokyo*; it will suggest the region closest to
   where you're signing in from. **Choose the region closest to the
   Foundation's users (the UK) — normally the European option (Ireland).**
   The region affects sending infrastructure only, not deliverability or
   cost; it does not need to match where Supabase or Vercel host the app.
5. Click through to create the domain. Resend then generates the DNS records
   described in §4 and shows them on the domain's detail page (a **Records**
   tab), each with its host/name, type, and value ready to copy.

> 📷 *Screenshot: Resend → Domains → Add Domain dialog, showing the domain
> name field and the region dropdown.*

### A note on the sending subdomain

Resend recommends sending from a **subdomain** of the Foundation's domain
(for example `send.jwf.org.uk` or `mail.jwf.org.uk`) rather than the bare
root domain (`jwf.org.uk`). This keeps the sending reputation for bursary
emails separate from any other mail the Foundation sends from its main
domain (staff email, etc.), and makes the DNS records self-contained under
one subdomain rather than mixed in with existing root-domain records.

> **Open question for Charlotte:** which subdomain to use is a Foundation
> decision, not a technical constraint. Anything in the form
> `<something>.jwf.org.uk` works — `send.jwf.org.uk` is used as the
> illustrative placeholder throughout this guide. Confirm the exact value
> before starting DNS changes, since every record below is scoped to
> whichever subdomain is chosen.

---

## 3. Understand the DNS records Resend asks for

**Everything in this section is illustrative.** The exact host names and
values are generated per-domain by Resend and appear on the domain's
**Records** tab after you complete §2 — copy them from there, not from this
guide. Do not paste the example values below into a real DNS provider.

| Record | Type | What it's for, in plain language |
|---|---|---|
| **SPF** | TXT (plus an MX record) | A published list of "which mail servers are allowed to send email claiming to be from this domain." Receiving mail servers check this before accepting a message. Resend generates this on the sending subdomain itself (e.g. `send.jwf.org.uk`). |
| **DKIM** | TXT (sometimes shown as a CNAME) | A cryptographic signature added to every outgoing email so the receiving server can confirm the message wasn't altered in transit and genuinely came from Resend on the Foundation's behalf. |
| **DMARC** | TXT, on the `_dmarc` host | Tells receiving mail servers what to do if a message *fails* the SPF/DKIM checks above (e.g. quarantine it, reject it, or do nothing) and, optionally, where to email a summary report. This record is not generated per-domain by Resend in the same way as SPF/DKIM — it's a standard record you add once, at `_dmarc.<sending domain>`. |

For DMARC, Resend's guidance is to start permissively while confirming
everything works, then tighten:

- Start with a value like `v=DMARC1; p=none; rua=mailto:<an address the
  Foundation monitors>;` — `p=none` means "don't block anything yet, just
  report."
- Once bursary emails have been sending cleanly for a while (confirmed via
  the reports and via checking message headers), tighten `p=none` to
  `p=quarantine` (send suspicious mail to spam) and eventually `p=reject`
  (block it outright). This is optional hardening, not a go-live blocker.

> Again: **copy the exact host and value strings for SPF, DKIM and DMARC
> from the Foundation's own Resend dashboard.** They are unique to this
> domain/account and will not match any example shown here or elsewhere
> online.

---

## 4. Add the records at the DNS provider

Each record Resend shows has two parts you'll be asked to enter at the DNS
provider:

- **Host / Name** — where in the domain the record lives (e.g.
  `send.jwf.org.uk` or `_dmarc.send.jwf.org.uk`).
- **Value / Target** (sometimes called "Points to" or "Data") — the string
  Resend generated.

Practical notes that trip people up:

- **Some registrars want the host without the root domain suffix.** If your
  provider already scopes records to `jwf.org.uk`, you may need to enter
  just `send` (or `_dmarc.send`) rather than the full
  `send.jwf.org.uk`/`_dmarc.send.jwf.org.uk` string Resend displays. Other
  providers want the full string. If unsure, add the record as shown by
  Resend first; if the provider's UI silently appends the domain a second
  time (visible after saving), shorten it and re-save.
- **Don't proxy or "orange-cloud" any CNAME-style record** if the DNS
  provider offers a proxy/CDN toggle (this is a Cloudflare-specific
  behaviour) — a proxied record won't resolve the way a mail server expects
  and verification will fail or hang.
- **Propagation is not instant.** DNS changes typically become visible
  within minutes to a few hours, but can take up to 24–48 hours to reach
  every resolver worldwide. Resend allows up to **72 hours** before it marks
  an unverified domain as failed.
- Add all three record types (SPF, DKIM, DMARC) in the same session where
  possible, to avoid multiple rounds of waiting on propagation.

---

## 5. Verify, and what pending/failed looks like

Resend checks the DNS records automatically; there is nothing to click to
"trigger" verification beyond having added the records.

- **Verified** — the domain's status on the Domains list shows green /
  "Verified." The domain (and its subdomain) is ready to send from.
- **Pending / not started** — records added recently, or not yet detected.
  Wait for propagation (§4) and re-check later; no action needed unless it's
  been several hours.
- **Partially verified / partially failed** — Resend can verify sending and
  receiving capabilities independently; if only one side is confirmed you'll
  see a partial state. You can re-run verification for just the failed part
  once its record is fixed, without resetting the whole domain.
- **Failed** — none of the required records were detected within the ~72
  hour window. Common causes, in order of likelihood:
  - **Records haven't propagated yet** — wait longer, then re-check (don't
    keep re-adding records; that just resets the clock).
  - **Duplicate or conflicting SPF record** — a domain can only have **one**
    SPF TXT record. If the subdomain already has an SPF record from another
    service, the two must be merged into one record rather than left as two
    separate TXT entries; two SPF records both silently fail.
  - **Wrong host entered** — see the root-domain-suffix note in §4; the
    record was saved but under the wrong name, so Resend's check on the
    exact host it expects finds nothing.
  - **CNAME proxied/greyed out** — see the Cloudflare-style proxy note in
    §4.
  - **Typo in the copied value** — re-copy directly from the Resend Records
    tab rather than retyping.

> 📷 *Screenshot: Resend → Domains list showing a domain in the Verified
> state, alongside one in Pending.*

---

## 6. Follow-up: point the system at the verified address

Domain verification in Resend, on its own, does not change what the bursary
system sends from — that's a separate, small configuration step:

- The "from" address is controlled by the `RESEND_FROM_EMAIL` environment
  variable. Once the domain above shows **Verified**, set this variable to
  an address on the newly verified (sub)domain, e.g.
  `bursary@send.jwf.org.uk`.
- See [`environment-variables.md`](environment-variables.md) for exactly
  where this variable is set, in which Vercel scope, and what it defaults to
  today — this guide doesn't duplicate that detail.
- **Changing an environment variable is a user-approved deployment step**
  (per the repository's `CLAUDE.md` workflow rules and
  `environment-variables.md`): Claude/engineering will tell the Foundation
  what needs to change but will not set or redeploy it without explicit
  sign-off, since it affects the live system.

---

## 7. JWF-specific notes

- **One shared Resend account and API key** is used across both the
  Production (live) and Preview (staging/testing) environments — see
  [`environment-variables.md`](environment-variables.md). There is no
  separate "staging" Resend account. Practically, this means:
  - Domain verification in this guide is done **once, for the shared
    account** — it does not need to be repeated per environment.
  - Once `RESEND_FROM_EMAIL` is updated (§6), decide with the
    developer/deployer whether the new address is used in both scopes or
    only in Production, consistent with how that variable is already scoped
    per `environment-variables.md`.
- **`RESEND_WEBHOOK_SECRET` is Production-scope only** — there is a single
  webhook endpoint, pointed at the live production URL, used to receive
  delivery/bounce events from Resend. Staging does not receive these events
  by design. This is unaffected by adding a new sending domain; it's noted
  here only so it isn't mistaken for something this setup needs to touch.

---

## Open questions for Charlotte

- **Exact sending subdomain** — e.g. `send.jwf.org.uk` vs `mail.jwf.org.uk`
  vs another value (§2).
- **Which DNS provider/registrar manages `jwf.org.uk` today**, and who has
  access to add records there (§1, §4).
