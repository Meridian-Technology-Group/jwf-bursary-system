# CR-002: Grant Tracker Migration (2026-27 live bursaries)

**Change Request and Statement of Work under clauses 2.2 and 9.5 of the Master Services Agreement**

> **DRAFT v1, for the Customer's approval.** Drafting notes are shown in
> blockquotes like this and must be removed before execution. No work will be
> undertaken until the Customer has approved this quote in writing (MSA
> clause 9.5(c)).

---

## 1. Reference and parties

| **CR reference**        | CR-002                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Migration of the live 2026-27 bursary accounts from Symplectic Grant Tracker                                                             |
| **Supplier**            | Result Driven Development LLC, trading as Meridian Technology Group                                                                      |
| **Customer**            | The John Whitgift Foundation                                                                                                             |
| **Governing agreement** | Master Services Agreement dated 1 May 2026 (the **"MSA"**)                                                                               |
| **Mechanism**           | MSA clause 2.2 (migration to be the subject of a separate written statement of work) and clause 9.5; on approval this document becomes that statement of work |
| **Classification**      | Migration work, **excluded** from the Annual Licence Fee under MSA clause 9.3, and therefore quoted separately                           |

Capitalised terms not defined here have the meanings given to them in the MSA.

---

## 2. Background and rationale

The Customer's live bursary records are held in Symplectic Grant Tracker
("**GT**"), which is being retired. The Customer has confirmed that **all access
to GT, including read-only access, ends on Friday 2 October 2026**.

The Supplier holds a complete copy of the GT database taken on 10 September 2026,
together with the associated document archive, so the migration work itself is
not dependent on GT remaining available. What the 2 October date does limit is
the Customer's own ability to check individual records against GT's screens; the
plan below front-loads every question of that kind.

The Customer has settled the approach in correspondence of 16 and 19 September
2026. In summary, and in the Customer's own terms:

- assessments are **recalculated by the current model** from the GT fields the
  Customer has identified as trustworthy. Nothing is copied from GT's calculated
  results, which the Customer regards as unreliable (GT's fee figures in
  particular are stale);
- the Customer's own schedule of 2026-27 awards, scholarships, school fees and
  payable fees is the authority for what each family pays. **No award changes as
  a result of the migration**;
- the Customer receives a side-by-side report for every account, old against new,
  before anything reaches the Production Environment;
- parents receive a login but **no email is sent** by the migration. The Customer
  will tell parents at the end of March 2027, ahead of the re-assessment window.

Migration is expressly outside the scope of the MSA (clause 2.2) and outside the
Annual Licence Fee (clause 9.3). It is therefore quoted here.

---

## 3. Solution overview

The migration is delivered as a **repeatable, reversible, staged process**, not
as a single bulk insert:

1. **System changes first.** The Platform gains the three things the Customer's
   data needs and does not yet have: an Old Palace partnering school, the JWF-PB
   bursary type at Whitgift, and a "migrated account" mode in which an account has
   no applicant form but behaves normally in every other respect.
2. **A migration toolkit.** Purpose-built tooling extracts the GT records, maps
   them to the Platform's fields, runs the Platform's own calculation engine over
   them, loads them, and verifies the result. Every record it creates is recorded
   in a ledger, which is what makes a clean reversal possible.
3. **Two full rehearsals** on the staging environment. The first includes a
   complete rollback and reload, to prove the reversal works before the Customer
   is asked to review anything.
4. **Customer review and sign-off**, from the reconciliation report described in
   §4.1(g), against the staging environment.
5. **Production load**, in stages, each verified, at a time agreed with the
   Customer.

> **Drafting note, why recalculation rather than copying.** The Supplier's
> original proposal (15 September) was to copy GT's award figures across as a
> fixed historical record. The Customer rejected that in favour of recalculation,
> on the grounds that GT's derived figures, fees and VAT treatment are wrong and
> that the current model is materially more transparent. The Supplier agrees.
> The practical consequence is that the migrated assessments will show
> differences between the recalculated recommendation and the award actually in
> force; those differences are recorded as gaps with reason codes, exactly as
> they would be for an assessment carried out in the Platform today.

---

## 4. Scope of work

### 4.1 In scope — core migration

- **(a) Old Palace partnering school.** A third school value carried correctly
  through the whole Platform: assessment, fees, awards, reporting, exports and
  filters. Per-account school fees (Old Palace fees differ pupil by pupil and,
  as the Foundation sponsors these places, carry **no VAT**), and a bursary
  commitment that ends at **Year 11** rather than Year 13.
- **(b) The JWF-PB bursary type** at Whitgift, for the scenario in which a full
  award is made for the day element of the fee with no financial assessment, the
  assessment being carried out by an external charity. The Customer's award types
  are therefore: Trinity — JWF, TBF; Whitgift — JWF, JWF-WSP, WFA, JWF-PB.
- **(c) Migrated-account mode.** Migrated accounts hold no applicant form. The
  application tab is disabled for them and the Admin Console explains why;
  documents, assessment, award, schedule and reporting all behave normally; the
  parent's portal shows the schedule without offering a form to open.
- **(d) Contact register, logins and accounts.** For each of the **273** accounts
  on the Customer's schedule: a contact-register entry; a parent login created
  silently; an active bursary account; and the remaining assessment years
  calculated from the pupil's 2026-27 school year and shown on the parent's home
  page. **No email of any kind is sent to any parent.**
- **(e) Recalculated assessments.** For each account, the trusted GT figures are
  mapped into the Platform and the current assessment model is run over them.
  The Customer's confirmed award and payable fees are recorded as the decided
  figures, the recalculated recommendation alongside them, and the difference
  recorded as a gap with the Customer's chosen reason code.
- **(f) Sibling fields.** Where GT records a sibling at a Foundation school, the
  sibling's first name is carried into the award tab's sibling fields for the
  assessor to complete. Consistent with the Customer's instruction of 20
  September, **no automated sibling linking or fee absorption is built**: each
  bursary recipient's account stands alone, and a family with three bursary
  children submits three applications, as now.
- **(g) Reconciliation report.** A per-account report, old against new: GT's
  figures beside the recalculated ones, the award and payable fees, the gap and
  its direction, and which of the three award views the outcome sits closest to.
  This is the document on which the Customer signs off.
- **(h) Exceptions and questions pack.** A single working document covering every
  account that cannot be migrated mechanically, delivered in time for the
  Customer to check them in GT before 2 October.
- **(i) Two rehearsals on staging**, the first including a full rollback and
  reload; production load in verified stages; and a post-load verification report.
- **(j) Reversibility.** A ledger-driven rollback capability covering everything
  the migration creates, and the checks that decide when it should be used.
- **(k) Tests and documentation.** Automated tests for the new school, fund and
  migrated mode, consistent with the Platform's existing suite; a written runbook;
  and an update to the Admin & Assessor Guide.

### 4.2 In scope — documents (priced separately in §6)

- **(l)** For every migrated account, the documents from the latest application or
  annual review, together with GT's generated PDF of that application or review,
  loaded against the account and visible in the Admin Console.
- **(m)** File-by-file reconciliation against the GT archive, and a report of
  anything missing or unreadable.
- **(n)** An index of the remaining (earlier-year) archive so that any historical
  document can be located by account reference, with the archive handed over in
  the location the Customer's IT function nominates.

### 4.2A In scope — terms of use and retention rules

- **(o) Portal terms of use.** Review of the Platform's applicant-facing terms
  and privacy wording against what the Platform now does, including the arrival
  of migrated families who did not submit an application through the Portal, and
  a revised draft for the Customer's approval and publication.
- **(p) Retention rules.** Validation of the Platform's configured retention
  periods and purge behaviour against the Customer's retention policy, a written
  statement of what is deleted when and on what trigger, and configuration of the
  agreed periods. This closes the retention-period sign-off left open at Go-Live.

> **Drafting note.** Annual GDPR review and audit support is already included in
> the Annual Licence Fee (MSA clause 9.2) and is not charged here. What is
> charged is the discrete drafting and configuration work above, which the
> Customer asked for on 20 September.

### 4.3 Out of scope

The following are explicitly **not** included and would be quoted separately if
required:

- **Prior-year data of any kind.** Priced as options in §6.2.
- **Closed accounts.** Only the Customer's 273 live 2026-27 accounts are in scope.
- GT's calculated figures, progress reports, application forms as data, email
  correspondence held in GT, and GT's finance and report sections. The Customer
  has confirmed that none of these come across.
- Second-parent records. Only the lead applicant is migrated, as the Customer
  has directed.
- Automated sibling linking, sibling fee absorption, or any joint application
  across siblings (Customer's instruction of 20 September; see §4.1(f)).
- Legal advice. The work in §4.2A is drafting and configuration by the Supplier;
  the Customer remains responsible for taking its own legal or DPO advice on the
  wording it publishes.
- Any change to the assessment model itself.
- Any integration with the Customer's billing system.
- Communication with parents about their new logins (a Platform capability the
  Customer already holds, to be used at the Customer's chosen time in March 2027).
- Retrieval or long-term hosting of the ~34 GB pre-2026 document archive beyond
  the index and hand-over in §4.2(n).

### 4.4 Not charged

The following arose while planning this work. They are **defects in, or minor
enhancements to, the Platform as accepted** and are therefore covered by the
Annual Licence Fee under MSA clause 9.2. They are listed here for completeness
and will be fixed at no charge:

- The two additional year-on-year reason codes requested on 19 September, and
  the renumbering that follows (a reference-table change).
- A defect in the rolling re-assessment invitation batch which would fail for any
  account holder who already has a login. This affects existing accounts as well
  as migrated ones and would otherwise surface in the April 2027 window.
- Defects in the dashboard and round-watchlist counts, which do not recognise
  the locked award states introduced in the post-assessment lifecycle work.

---

## 5. Acceptance criteria

The migration is accepted when, on the staging environment and then in
production:

- [ ] All 273 accounts (less any the Customer has asked to hold back) exist as active bursary accounts with the correct school, award fund, pupil and lead applicant.
- [ ] Each account's remaining assessment years are correct, ending at Year 13 (Year 11 for Old Palace), and appear on the parent's home page.
- [ ] Every migrated account's **award and payable fees match the Customer's schedule exactly**.
- [ ] Each account carries a recalculated assessment, its recommendation, a gap where one exists, and the Customer's gap reason code.
- [ ] The reconciliation report shows each account's Grant Tracker written synopsis, so the gap reason can be judged in the context of that assessment.
- [ ] Old Palace accounts use their own per-pupil fee and carry no VAT.
- [ ] Pastoral boarder accounts show the award with no financial assessment.
- [ ] The application tab is disabled on migrated accounts and the reason is shown; nothing else about the account is impaired.
- [ ] **No email has been sent to any parent**, evidenced by the Platform's own email log.
- [ ] The reconciliation report reconciles to the Customer's schedule in total and per account.
- [ ] Documents (§4.2): each account shows its latest-cycle documents and GT PDF, and the file-by-file reconciliation is clean.
- [ ] A rehearsal rollback has been demonstrated on staging, returning the environment to its prior state.
- [ ] A migrated account can be taken through a normal re-assessment, demonstrated on staging against a 2027-28 round.

---

## 6. Charges

### 6.1 Core migration and documents

| Item | Basis | Amount |
|---|---|---|
| CR-002 (a)–(k), core migration | **Fixed price** | **£1,500** |
| CR-002 (l)–(n), documents | **Fixed price** | **£350** |
| CR-002 (o)–(p), terms of use and retention rules (§4.2A) | **Fixed price** | **£250** |
| Priority delivery to the Customer's 2 October deadline (§6.3) | **Fixed price** | **£350** |
| **Total** | | **£2,450 (two thousand four hundred and fifty pounds sterling)** |

### 6.2 Options: earlier years

The Customer has asked to decide about earlier years **after** the current year is
live. These options are priced now so that the decision can be taken on known
figures. Each is a separate instruction; none is committed by approving this CR.

| Option | Description | Amount |
|---|---|---|
| 1 | 2025-26 headline figures added to each active account's year-on-year history | £200 |
| 4 | The same, for the previous three years | £375 |
| 2 | Full reconstruction of the 2025-26 assessments, including accounts closed since, with its own reconciliation and sign-off | £1,200 |
| 3 | No earlier years | £0 |

### 6.3 Priority delivery

The Customer's Grant Tracker access ends on 2 October 2026 and the re-assessment
window opens in April 2027. Meeting the first of those dates requires the
Supplier to work to the Customer's timetable rather than its own maintenance
cycle, including weekends, and to deliver the exceptions pack within two Business
Days of approval. The £350 priority-delivery charge covers that compression. It
is charged once and is not repeated for the options in §6.2.

> **Drafting note.** The Customer raised this unprompted on 20 September, noting
> that the alternative would be extending the Grant Tracker licence by
> approximately three months. The charge is set well below that cost.

> **Drafting note, pricing basis.** Consistent with CR-001, this CR is priced as a
> share of total system scope and value, reflecting AI-assisted delivery rather
> than team-based effort, with a change-request uplift. The uplift reflects that
> this work (a) carries none of the shared overhead of the bundled build,
> (b) touches every core entity in the Platform and introduces a third school
> across the whole system, (c) writes the personal and financial records of 273
> families into the Production Environment, where errors are expensive to
> reverse, and (d) requires two full rehearsals and two rounds of Customer
> review. Priced by time against the indicative rate card in MSA Schedule 2 §4,
> the same scope would be materially higher; the fixed prices above are offered
> in preference. The terms-of-use and retention item and the priority-delivery
> charge were both added at the Customer's request on 20 September; option 2 in
> §6.2 was increased from an initial £800 on the Customer's own observation that
> it represents a second full cycle of the process.

- Fees are **fixed prices** for the scope set out in §4.1, §4.2 and §4.2A.
- Fees are stated **net of VAT**, on the basis described in MSA clause 11.5 (the
  Supplier is not registered for UK VAT as at the Effective Date; reverse charge
  applies where relevant).
- **Invoicing:** the core migration and the priority-delivery charge on the
  Customer's acceptance of the production load; documents on acceptance of §4.2;
  terms of use and retention rules on the Customer's approval of the revised
  wording and configuration. Each payable within **thirty (30) days** of the date
  of invoice, consistent with MSA clause 11.
- No change to the Annual Licence Fee arises from this CR. Migrated accounts are
  supported thereafter as part of the Platform under clause 9.2.

---

## 7. Timeline

Delivery is driven by two dates: the end of GT access on **2 October 2026**, and
the re-assessment window opening on **12 April 2027**. The migration must be
complete and proven well before the latter.

| Stage | Indicative timing |
|---|---|
| Exceptions and questions pack to the Customer | Within **2 Business Days** of approval |
| Customer's rulings on exceptions (needs GT) | **By 1 October 2026** |
| System changes delivered to staging | Within **5 Business Days** of approval |
| First rehearsal complete on staging | Within **8 Business Days** of approval |
| Reconciliation report to the Customer | Within **10 Business Days** of approval |
| Second rehearsal and Customer sign-off | On the Customer's review |
| Production load | At a time agreed with the Customer, following sign-off |
| Documents | Following the production load |

> **Drafting note.** Business Days run from written approval. The pack in line 1
> can be issued immediately on approval; its value depends on the Customer having
> time to use GT before 2 October, so approval this week materially reduces the
> number of accounts that must be held back.

---

## 8. Assumptions and dependencies

- The Customer's schedule of 273 accounts (received 19 September 2026) and the
  mapping of trusted GT fields (same date) are the agreed inputs. A materially
  revised list, or a new data source, would be re-quoted.
- The Supplier's GT database copy of 10 September 2026 and the associated
  document archive are the source of record for GT data. The Customer will
  confirm whether anything material changed in GT after that date.
- The Customer provides rulings on the exceptions pack, and on the reconciliation
  report, in reasonable time. Accounts left unresolved at the point of the
  production load are **held back** and migrated later at no additional charge,
  provided they are within the 273.
- The Customer accepts that migrated family data must be present on the staging
  environment for the rehearsal and review stages, and is removed after
  production sign-off.
- The Customer provides the password to the GT document archive (required for
  §4.2 only) and nominates a location for the earlier-year archive.
- For §4.2A, the Customer confirms its retention policy periods and approves the
  revised terms wording for publication.
- Delivery follows the standard branch → staging → production workflow. Nothing
  reaches production until the Customer has reviewed the reconciliation report
  and signed off.
- No change to infrastructure or vendors is anticipated. Document storage for the
  latest cycle (approximately 6.4 GB) sits within existing provision; the
  earlier-year archive is **not** hosted in the Platform.

---

## 9. Open decisions for the Customer

**D-CR2-1, Earlier years.** Which of the four options in §6.2 the Customer wishes
to take. **Not required now**; the Customer has said this will be decided once the
current year is live.

**D-CR2-2, JWF-PB accounts.** The two pastoral boarder accounts name the
Foundation's fees team, not a parent, as the contact. The Supplier proposes that
these accounts carry **no parent login**, and appear in the Admin Console and the
statistics only. To be confirmed.

**D-CR2-3, The earlier-year document archive.** Where the archive is to be held,
and how the Customer wishes to reach it (referred to the Customer's IT function
on 19 September). Affects §4.2(n) only.

---

## 10. Signatures

On approval, this document constitutes the statement of work required by MSA
clauses 2.2 and 9.5(d) and is governed by the terms of the MSA.

| | Supplier | Customer |
|---|---|---|
| **Name** | | |
| **Title** | | |
| **Signature** | | |
| **Date** | | |
