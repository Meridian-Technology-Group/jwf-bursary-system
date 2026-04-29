# JWF Bursary System — Buyer Presentation Narrative

> Slide-by-slide narrative for the buyer meeting (29 April 2026). Bullets are conversational notes, not finished slide copy. Tweak as needed before laying out in slides.

---

## Slide 1 — Title

**John Whitgift Foundation Bursary Assessment Platform**
A purpose-built replacement for Symplectic Grant Tracker

- Presented by: Meridian Technology Group (Brian Wagner)
- Path to production: end of June 2026
- Date: 29 April 2026

---

## Slide 2 — Where we are today

The system is substantially built. Today's conversation is about hardening, deployment, contracts, and migration — not feature delivery.

- **Phase 1 — Foundations** ✅ Schema, authentication, layout shells
- **Phase 2 — Core platform** ✅ Applicant portal (10-section wizard), assessment engine (four-stage calculation), recommendations, sibling linking
- **Phase 3 — Operational features** ✅ XLSX/CSV exports, dashboards, reports, audit trail, GDPR controls, PDF generation
- **Phase 4 — Production hardening & go-live** 🔄 In flight

Headline: 36 routes, all "Must Have" PRD requirements implemented, calculation engine ready for parity validation against historical cases.

---

## Slide 3 — Path to production: end of June 2026

A 9-week runway with four major gates.

| # | Gate | Target | What it proves |
|---|------|--------|----------------|
| **G1** | **Initial Release (Beta on Staging)** | w/c 11 May 2026 | Feature-complete on a production-like environment. Internal regression run. Realistic sample data loaded. |
| **G2** | **User Acceptance Testing** | 18 May → 12 June 2026 | Foundation assessor runs end-to-end real-world scenarios: new application, re-assessment, sibling linking, internal bursary request, recommendation export, GDPR deletion. **Calculation engine validated against ≥10 historical cases** (parity with the existing spreadsheet). |
| **G3** | **Pre-Production Hardening** | 15 → 22 June 2026 | GDPR review sign-off, mobile/accessibility check (WCAG 2.1 AA), performance & load test, security review, email at volume. |
| **G4** | **Production Go-Live** | w/c 22 June 2026 | Cut to live domain. Assessor onboarded. **2-week hypercare** with daily check-ins. |

Migration from Grant Tracker runs as a parallel workstream — see slide 9.

---

## Slide 4 — Commercial terms (headline)

| Item | Amount | Notes |
|------|--------|-------|
| **Initial build** | **£5,000** | One-off. 100% payable on contract signature (the system is already built). |
| **Annual license** | **£7,000 / year** | Rolling 1-year term. Year 1 invoiced on production go-live (end June 2026); annually thereafter on the go-live anniversary. Covers infrastructure + maintenance. |
| **Migration from Grant Tracker** | Quoted separately | Discovery-led custom work. See slide 9. |

**Payment cadence:** Build on contract signature · Year 1 licence on go-live · Net 30 day terms on each invoice.

The annual license is built bottom-up from real costs, not a round number — see next slide.

---

## Slide 5 — License fee: how it breaks down

Transparent build-up so the fee is grounded in actual costs.

### Infrastructure (production-tier, included)

| Service | Purpose | Annual cost |
|---------|---------|-------------|
| Vercel Pro | Production-grade Next.js hosting, edge network, zero-downtime deploys | ~£200 |
| Supabase Pro | Managed Postgres + Auth + encrypted Storage, daily backups, PITR | ~£240 |
| Resend (transactional email) | Invitations, notifications, reminders | ~£190 |
| Sentry / error monitoring | Real-time error alerting and crash reporting | ~£250 |
| Domain & SSL | jwf-bursary.org (or chosen domain) | ~£20 |
| Headroom for traffic spikes / overage | Buffer | ~£100 |
| **Sub-total** | | **~£1,000** |

### Ongoing maintenance & changes
- **£500 / month → £6,000 / year** for light-touch maintenance
- Tracked transparently and reviewed quarterly

### Total: £7,000 / year

> Why this is fair: infrastructure is at-cost (no margin); the £6,000 maintenance is the only "fee" component. The Foundation can verify Vercel and Supabase pricing publicly.

---

## Slide 6 — What "maintenance" covers

The £6,000/year maintenance pot covers light-touch ongoing work.

**Included (no separate charge):**
- Bug fixes and regressions
- Security patches and dependency updates
- Reference table tweaks the assessor can't self-serve
- Minor enhancements (an extra report column, a new email template variable, a layout tweak)
- Ad-hoc questions and onboarding new staff
- Annual GDPR review and audit support

**Quoted separately:**
- New major features (Phase 2 candidates: automatic change-flagging, benchmark trend dashboard, scheduled reports)
- Changes to the four-stage calculation model
- Integrations with external systems (school MIS, finance systems, etc.)

Unused time does not roll over — but quarterly reviews ensure the Foundation gets value across the year.

---

## Slide 7 — Support model: reliable communication

A traceable channel with team coverage — not a single point of failure.

- **Freshdesk** as the support ticketing system
  - Dedicated support email auto-creates a ticket
  - Self-service portal for the assessor to raise, track, and view ticket history
  - Full audit trail of every issue, SLA timer, and resolution
- **Team coverage, not just one person**
  - Day-to-day support handled by Brian Wagner (primary contact)
  - Backed by Meridian's outsourced engineering team — scaled up on demand (cover for leave, surge during the application round, parallel work on enhancements)
  - The Foundation always has a route to a responder, regardless of individual availability
- **Severity-based response SLAs:**

| Severity | Example | Response | Resolution / workaround |
|----------|---------|----------|-------------------------|
| **Critical** | System down during a round, can't process applications | 4 working hours | 1 working day |
| **High** | Major feature broken, no easy workaround | 1 working day | 3 working days |
| **Medium** | Minor bug, cosmetic issue, workaround exists | 2 working days | Next maintenance cycle |
| **Low** | Question, suggestion, enhancement request | 5 working days | Reviewed quarterly |

- **Working hours:** Mon–Fri, 09:00–17:30 UK time
- **Quarterly review** to walk through the maintenance backlog and prioritise enhancements

---

## Slide 8 — Security: built in, not bolted on

The system was designed with GDPR and the sensitivity of family financial data front-and-centre.

- **Encryption everywhere** — TLS in transit; AES-256 at rest (database and document storage)
- **MFA mandatory** for all admin / assessor accounts
- **Role-based access control** — applicants see only their own application; assessors see only what they need
- **Data minimisation** — applicant names hidden by default in queues and reports; reveals are audit-logged for GDPR accountability
- **Document access via pre-signed, time-limited URLs** — no public file paths
- **Immutable audit trail** of every create / update / delete operation
- **UK / EU data residency** — GDPR-compliant
- **GDPR controls built in** — 7-year retention, right-to-deletion workflow, no school access to the system
- **Backups** — daily automated + point-in-time recovery (30-day window)
- **Application security** — OWASP Top 10 hardening, CSP headers, rate-limited authentication, virus scanning of uploads
- **Independent GDPR review at G3** before go-live

---

## Slide 9 — Migration from Grant Tracker

Symplectic Grant Tracker is a known unknown. We treat migration as a discovery-led custom workstream — separate from the £5,000 initial build.

### What needs to come across
- Active bursary accounts (preserving reference numbers: **WS-xxx**, **TS-xxx**)
- Historical assessment records — needed to maintain payable-fees **benchmarks**
- Uploaded documents (subject to retention policy)
- Sibling linkages
- Year-on-year recommendation history

### Why it's custom work
- Grant Tracker's REST API (v7.0) is **limited and lacks public documentation**
- Document export capability is **unverified**
- Data is shaped around grant-management, not bursary assessment — **transformation is needed**
- Hard deadline: **Grant Tracker is sunset 31 December 2026**

### Proposed approach
1. **Discovery sprint** (1–2 weeks, fixed price): obtain Grant Tracker access, audit export capability (API vs. UI vs. CSV), document the data shape end-to-end
2. **Fixed-price quote** for the full extract → transform → load, based on discovery findings
3. **Cutover**: aligned with go-live or shortly after. **100% of active accounts migrated; 20% spot-checked for accuracy.**

> Until discovery is done, a fixed migration quote would be guesswork. The discovery sprint is small and de-risks the whole exercise.

---

## Slide 10 — Next steps

1. **Confirm acceptance of commercial terms** (£5,000 build + £7,000/year license)
2. **Schedule UAT kick-off** — proposed w/c 18 May 2026
3. **Initiate Grant Tracker migration discovery** (parallel workstream — needs Foundation contact at Digital Science)
4. **Confirm support tooling preference** (ticketing portal)
5. **Sign go-live date** — end June 2026

---

## Appendix — Assumptions baked into this draft

Flag any of these to challenge:

- Initial build of £5,000 covers everything delivered to date plus Phase 4 deployment to production. **No further scope is implied.** Payable 100% on contract signature; go-live is a delivery milestone, not a payment milestone.
- License fee is **flat for year 1**. CPI uplift in subsequent years is **not** included (open question — see chat).
- Infrastructure costs are based on **current (April 2026) Vercel Pro and Supabase Pro pricing**. Material price changes on those vendors would be passed through transparently in the next renewal.
- Resend Pro is included in the build-up for safety; the free tier (3,000 emails/month) likely covers ~200 applicants per round and could remove ~£190/year if preferred.
- "Light-touch maintenance" assumes a steady-state operation. The annual application round itself does not require additional support beyond what's covered.
- Hypercare (first 2 weeks post go-live) is included in the build fee, not the license.
