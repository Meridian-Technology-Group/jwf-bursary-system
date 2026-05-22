# JWF Bursary System — Documentation

This is the documentation root for the John Whitgift Foundation Bursary
Assessment System. Docs are organised by **audience and lifecycle** —
*what* we're building, *how* it's built, how to *run* it, how to *use* it,
and whether it's *ready*.

## Map

| Directory | Audience | What's inside |
|---|---|---|
| [`discovery/`](discovery/) | Delivery, product | As-is documentation of the **legacy systems this project replaces** (e.g. the old Symplectic Grant Tracker console) — captured during discovery for context, *not* a spec of what we built. |
| [`product/`](product/) | Foundation, product | Requirements (`prd/`), field-level specs (`specs/`), open questions, and the assessment model spreadsheet — *what* the system must do. |
| [`engineering/`](engineering/) | Developers | Technical design (`tdd/`), the implementation plan, engineering notes, and the data-model / API / repo-structure references — *how* it's built. |
| [`operations/`](operations/) | Ops / on-call | Deployment, environment config, backup/restore, incident response, and hypercare runbooks — how to *run* it in production. |
| [`guides/`](guides/) | End users | Applicant and admin/assessor user guides, plus the step-by-step [`walkthroughs/`](guides/walkthroughs/) for every workflow. |
| [`quality/`](quality/) | Assurance, Foundation | Point-in-time assessments: production readiness, security audit, walkthrough verification, and the contractual parity test. |
| [`contract/`](contract/) | Foundation, delivery | The Master Services Agreement and the Feature Verification Checklist (the sign-off spine). |
| [`backlog/`](backlog/) | Developers | Lightweight tracker of open issues and follow-ups. |
| [`archive/`](archive/) | — | Historical pre-sale material (proposal, talking points, pitch deck). |
| [`assets/`](assets/) | — | Shared images, sample documents, and the markdown export stylesheet. |

## Start here

- **New to the project?** Read [`product/prd/_index.md`](product/prd/_index.md)
  (what) then [`engineering/tdd/_index.md`](engineering/tdd/_index.md) (how).
- **Shipping to production?** See the current
  [production readiness assessment](quality/production-readiness/2026-05-22.md)
  and the [walkthrough verification](quality/walkthrough-verification.md).
- **Signing off?** The [Feature Verification Checklist](contract/feature-verification-checklist.md)
  is the document the Foundation uses to accept the system.
- **Picking up a task?** Check [`backlog/`](backlog/README.md).

## Status note — handover deliverables

The `operations/` and `guides/*-guide.md` files, and the
`engineering/{data-model,api-reference,repo-structure,open-source-manifest}.md`
references, are currently **stubs**. They are MSA Schedule 1 §4 deliverables
required before go-live (tracked as B15 in the production-readiness assessment).
Each stub carries an outline and a `STATUS: STUB` marker.
