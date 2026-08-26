---
title: "DRAFT — release notes email to Charlotte, 26 August"
status: DRAFT — NOT SENT
opened: 2026-08-26
opened_by: Brian Wagner
related:
  - ./2026-08-26-charlotte-feedback.md
  - ../backlog/uat-aug-2026/epic-19-progress.md
  - ./2026-08-26-lifecycle-questions-draft.md
---

# Draft — not sent

⚠️ **Two things to check before sending:**

1. **This reads as though the changes are live.** They are on the test system
   only. **Promote `staging` → `main` first**, or change "You should see these
   next time you sign in" to "These will be live shortly".
2. **This supersedes [`2026-08-26-lifecycle-questions-draft.md`](2026-08-26-lifecycle-questions-draft.md)** —
   the questions from that draft are folded in here, so send one or the other,
   not both. This version is the better one: it leads with what she gets rather
   than with what we need.

**Timing:** she is away **Fri 28 Aug → Wed 2 Sep**. Thursday 27 Aug is the only
window for nine days.

**New thread** — do not reply into an existing one.

---

**Subject:** Release notes — 26 August

Hi Charlotte,

Thank you for the detailed feedback while you were working through the first two
live assessments. Almost all of it is now built. Here's what's changed and why,
followed by a few questions.

You should see these next time you sign in.

---

## 1. The document window is much bigger

You wrote:

> *"I would need somehow the search window to collapse as I check the document
> content so that the window that lets me see the document expands so that I can
> check the full document more easily. Right now, it is a narrow window and makes
> the whole exercise more acrobatic."*

and then, importantly:

> *"Please keep the search panel in view, it works very well. Simply collapse
> what can be collapsed so that the window to appreciate the document expands a
> little bit more than what it is now."*

So the search box stays exactly where it is, and the **list** of documents
underneath it is what gets out of the way. It now starts closed, and reopens the
moment you type in the search box.

On a standard laptop screen the document itself went from about 240 pixels tall
to about 430 — roughly **80% more of the document visible at once**. On a larger
screen it's about 510. Even with the list deliberately open it's taller than
before.

## 2. Parent details are in your order

You gave us the order you wanted:

> Title → First name → Last name → Mobile → Email → Address line 1; Address line
> 2 → City → Postcode → Country

That's now the order on both the Applicant Data tab and the Application Form tab,
for **both** parents — you confirmed the same order should apply to Parent 2.

## 3. Assets & Liabilities is grouped by subject

You wrote:

> *"Can we have all the property related answers on the APPLICATION FORM reported
> within the same section and for each property according to the same logical
> display to mirror the order on the form? (currently the data looks all piled up
> in an un-orderly way, irrespective of whether it is car-related,
> transport-related, accommodation-related, savings-related or debt-related, so
> it is confusing)"*

It now appears under five headings, in your order:

**Property · Car & public transport · Council tax · Financial assets · Debt**

with each group's own uploaded documents listed directly underneath it, rather
than all of them together at the bottom of the page. Where a family owns more
than one property, each property is its own labelled block in the same order as
the form.

Two things you corrected, both applied:

- **Renting vs owning.** You wrote: *"if the applicant selects renting, he should
  have no mortgage field, instead the monthly rent field."* A renting household
  now shows the rent fields and no mortgage fields, and an owning household the
  reverse. If the question hasn't been answered, we show everything, so nothing
  is ever hidden by accident.
- **Not per-parent.** You wrote: *"No this is not parent specific (only the income
  section is), the property assets and financial assets are household-related as
  a whole."* We have not split it by parent.

While doing this we also found that mortgage statements for **second and third
properties** were being listed in a catch-all group at the very bottom of the
page instead of with the property they belong to. That's fixed too.

## 4. Invitations now have a BCC box

You'd looked for this on the individual invitation and found it only on the bulk
email screen. It's now on both routes — the quick invitation form and inviting
someone from the contact register.

It comes **pre-filled with the bursary inbox** so the copy happens by default,
and you can clear it for any individual invitation where you'd rather not copy
anyone. It disappears if you choose "Don't email — I'll send the link myself",
since there's no email to copy in that case.

## 5. The tax year for next year's applications

You wrote:

> *"Yes I need all forms right now to show the tax year 2025-26 and for the
> comments re self-employed and reporting one year in arrears to refer to 2024-25
> then."*

The first half of that was done earlier this week. This release does the second
half, which matters from **10 November**, when applications open for the
following school year.

The problem it fixes: an application filled in during that winter window was
being asked for a tax year that hadn't finished yet, which a parent obviously
can't provide evidence for. It now asks for the last completed one. Nothing
changes for anything you're working on today — I've checked this against the live
applications and none of them is affected.

## And a couple of things behind the scenes

Two smaller fixes from our own testing rather than your feedback: the upload
button on the income grid now works properly with screen-reader software, and
documents an assessor uploads on a family's behalf are now included in the
duplicate-file check (previously only the parent's own uploads were).

---

# Not in this release

**The zero-instead-of-blank change.** You wrote:

> *"When I enter a 0 in a field, the form switched back to a blank field. Could I
> have a 0 saved in when entered? It is just that the form will show that a nil
> value was entered to show that it was worked on and reported as nil, rather
> than the current display which may look like it was left unanswered as the
> default blank field."*

You're right, and the reason it isn't in this release is worth explaining. Two of
the fields on that page — the rent add-back and the council tax override — use a
blank box to mean "no override applied". If we simply made every blank box show a
zero, those two would change from "no override" to "override to zero", which
would change an award. So it needs a small redesign of those two fields rather
than a one-line change. It's the next thing on the list.

**Previewing an invitation before it sends.** You wrote:

> *"When I click on send the invitation: would it be possible to have a preview of
> the email about to be sent, with an editable functionality? So that when I
> click on 'send invitation', it is exactly as required in that particular case?"*

Still coming. There's a wrinkle we want to get right first: if you can edit an
email before sending it, the Sent Emails log needs to record what you actually
sent rather than the original template, or it would misreport what the parent
received. That's a deliberate bit of design work rather than a quick change.

**The five post-assessment states** (stored as complete / new award / waiting
list / closed & archived / closed & purged) and removing the three award buttons.
I've drawn up your model as a single diagram so we can agree it in one pass
rather than build a guess — that's most of the questions below.

---

# Questions

## 1. The savings calculation — the one that matters most

This is the only open question that changes a number, so I'd rather settle it
before a family runs into it.

When the model works out the savings test, it deducts a different figure from the
one you described to me. Both of the assessments you've just completed come out
the same either way, because both produce a negative result — so **your two
assessments are unaffected**. But for a family with more savings than those two
had, the two approaches give different awards.

Could we go through it for five minutes? I have both calculations written out
side by side.

## 2. When the award buttons go, does the family still get an email?

At the moment an email goes to the family the instant an outcome is recorded, and
you've told me:

> *"No we don't send emails from the assessment completion. Then this creates an
> account. It does not work like that. Those buttons don't work as they are."*

So I need to know what replaces it. If the automatic email simply stops, nobody
is ever told — which I don't think is what you want either.

**My suggestion:** a "notify the family" action you press when the admissions
position is actually settled, rather than anything automatic. That seems to fit
the winter admission process better than a trigger tied to finishing the
assessment. Happy to be told otherwise.

## 3. The bursary reference prompt

You wrote that at the new-award stage:

> *"there should be a prompt asking the assessor to amend the bursary account
> reference then"*

Two things I should flag: the reference you'd be editing is the **application**
reference (a bursary account doesn't have a separate one of its own), and it can
already be edited at any time — it's the small pencil next to the reference on the
application page. So this is about adding the **prompt**, not the ability.

Which leaves three small choices:

- Should the prompt **stop** you until you've confirmed the reference, or just
  remind you?
- Should it suggest a value, or show the current one?
- You wrote "prompt asking the **assessor**" — but editing is currently
  restricted to admins. Should assessors be able to change it, or should the
  prompt tell them to ask an admin?

## 4. Can a closed assessment be reopened?

Your earlier sketch had "closed" being reopenable back to *stored*. Your
illustration doesn't say, and now that closed has split into **archived** and
**purged** it matters which one that applied to.

I've assumed **archived can be reopened and purged cannot** — please correct me
if that's wrong.

## 5. Can a locked award be undone?

This one's mine rather than yours — it came out of drawing the diagram. You wrote
that a new award is:

> *"locked, finalised, can't be amended again"*

I've taken that literally. But every other final state has a way out and this one
doesn't, so if an award were locked in error there's currently no route back. That
may be exactly right — I'd just rather it were a decision than an accident of the
diagram.

---

One thing from your side when you have a moment: the Assessment Admin layout
you were going to send through. Two of your requests — the applicant progress
view and the forward view — are waiting on it, and I don't want to design ahead
of it and get it wrong.

No rush on any of this before you're away. If you have twenty minutes tomorrow,
the diagram plus question 1 would be the most useful use of it.

Best wishes,
Brian

---

## Notes for Brian, not for sending

- **The purge / data-destruction question is deliberately NOT in this email.**
  It needs its own thread and a written answer — it's the one transition that
  cannot be undone, and it shouldn't get a quick reply buried under four smaller
  questions. It only gates the last piece of work anyway. The three concrete
  obstacles (the 7-year retention rule, the audit trail being permanent by
  design, and the outstanding DPO sign-off) are written up in
  `docs/diagrams/epic-18-post-assessment-lifecycle.md` §4.
- **Also held out:** the property-category question (Q7) and the debt-ratio-of-zero
  question (Q9) — both self-contained, and this email is already carrying five.
- **Attach or link** `docs/diagrams/epic-18-post-assessment-lifecycle.md` for the
  diagram, or export its first section as an image if she'd rather not open a
  repo link.
- **Two things in this release have not had a browser pass yet** — the BCC box on
  the two invitation forms, and the November tax-year wording. Both are unit
  tested and the tax-year change is proven inert today, but if you want to be
  strict, walk the BCC box on the staging alias before promoting.
- **CH-32's BCC pre-fill is production-only** by design, so it will look blank on
  staging unless `RESEND_INVITE_BCC_EMAIL` is set there. Same pattern as the
  reply-to address. Worth setting on staging at the same time as CH-48's
  `RESEND_REPLY_TO_EMAIL`, which is still outstanding.
