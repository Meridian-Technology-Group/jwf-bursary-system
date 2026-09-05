---
title: "DRAFT — email to Charlotte: lifecycle diagram + Q11/Q14/Q15/Q16, and Q8"
status: DRAFT — NOT SENT
opened: 2026-08-26
opened_by: Brian Wagner
related:
  - ../diagrams/epic-18-post-assessment-lifecycle.md
  - ../backlog/uat-aug-2026/epic-18-post-assessment-lifecycle.md
---

# Draft — not sent

⚠️ **This has not been sent.** It needs Brian's review and send. Sending is
outward-facing and was not authorised in the build instruction.

**Timing that shapes it:** she is unavailable **Fri 28 Aug → Wed 2 Sep**, so
Thu 27 Aug is the only window before a nine-day gap. If a call happens, the
diagram is the thing to share screen on and this becomes the follow-up record.

**Attach:** [`epic-18-post-assessment-lifecycle.md`](../diagrams/epic-18-post-assessment-lifecycle.md)
(renders as a diagram on GitHub), or export §1 as an image if she would rather
not open a repo link.

---

**Subject:** The five post-assessment states — a diagram to correct, and one calculation question

Hi Charlotte,

Thank you again for finishing the two live assessments and for confirming the
calculations. That closes a long thread on our side.

I have drawn up your five post-assessment states as a single picture so you can
correct it in one pass rather than us guessing our way through the build. It is
attached. The states themselves are exactly as you set them out — this is only
about what happens *on the way between* them.

Drawing it raised four things I could not answer from your notes, plus one older
question I do not want to lose.

**1. Does the outcome email stop, or move?**

At the moment the system emails the family the instant an outcome is recorded.
You have told us that is not your process — so the question is what replaces it.
If it simply stops, then nobody is ever told, which I do not think is what you
want either. My suggestion would be a **manual "notify the family" action** you
trigger when the admissions position is actually settled, rather than anything
automatic. That fits the winter admission process better than a trigger tied to
the assessment. Happy to be told otherwise.

**2. The bursary reference prompt at "New award"**

You asked for a prompt asking the assessor to amend the bursary account
reference at this point. Two things I should flag: the reference you edit is the
**application** reference (a bursary account has no separate reference of its
own), and it can already be edited at any time by an admin — the pencil next to
the reference on the application page. So this is about adding the *prompt*, not
the ability.

Which leaves three small choices: should the prompt **block** the award until
you have confirmed the reference, or just nudge? Should it suggest a value, or
show the current one? And should an **assessor** be able to change it, or should
the prompt tell them to ask an admin — today it is admin-only.

**3. Is "closed & archived" reopenable?**

Your earlier sketch had closed being reopenable back to *stored*. The
illustration does not say, and now that "closed" has split into *archived* and
*purged* it matters which one that applied to. I have assumed **archived is
reopenable and purged is not** — please correct me if that is wrong.

**4. Is "new award" reversible?**

This one is mine, not yours — it fell out of drawing the picture. You said a new
award "can't be amended again", which I have taken literally. But every other
final state has a way out and this one has none, so if an award is locked in
error there is currently no route back. That may be exactly right. I would just
rather it were a decision than an accident of the diagram.

**5. And the older one: the savings test (my Q8)**

This is not about the two assessments you have just done — both of them produce a
negative savings figure, so nothing is added back either way and your numbers are
unaffected. But for a family with savings **above** the cushion, the model needs
to know whether the deduction is the raw £19,000 or the annualised £6,000, and
those give different awards. It is the last open question that can change a
number, so I would rather settle it before a family hits it than after.

No rush on any of this before you go — but if you have ten minutes tomorrow the
diagram is the fastest way through it, and questions 1 and 2 are the ones holding
up the next piece of build.

Best wishes,
Brian

---

## Notes for Brian, not for sending

- **Q10b (purge vs the 7-year retention guard and append-only `audit_logs`) is
  deliberately NOT in this email.** It needs its own thread and a written
  position — see §4 of the diagram doc. Raising it alongside four smaller
  questions risks a quick answer to something that cannot be undone. It only
  gates WP-B6, which is last anyway.
- **Q7** (dropping the "with mortgage" rows makes 6 property categories
  unreachable) is also held out — it is a separate, self-contained question and
  this email is already carrying five.
- **Q5** (her Assessment Admin layout email, promised 23 Aug) is still owed *by
  her*; no need to chase it in the same message as five of our own questions.
- If she answers Q11 with option (2) — the email stops entirely — flag that
  `OUTCOME_AWARDED`, `OUTCOME_QUALIFIES_NOT_AWARDED` and `OUTCOME_DNQ` become
  dead templates and should be retired rather than left to confuse the next
  reader, the same "half-retired is worse than either state" problem as F1.
