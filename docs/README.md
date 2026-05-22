# JWF Bursary System — Documentation

This is the documentation root for the John Whitgift Foundation Bursary
Assessment System. Docs are organised by **audience and lifecycle** —
*what* we're building, *how* it's built, how to *run* it, how to *use* it,
and whether it's *ready*.

**Active vs archived.** The directories below the line are **current** — the
living documents the team maintains and relies on. Everything that has been
**acted upon and completed** — the build plan once implemented, answered open
questions, build specs once shipped, legacy-system discovery notes, and
point-in-time assessments — is moved into [`archive/`](archive/) so the active
set stays small and trustworthy. Git history preserves the full record.

## Map

| Directory | Audience | What's inside |
|---|---|---|
| [`product/`](product/) | Foundation, product | Requirements (`prd/`) and the assessment model spreadsheet — *what* the system must do. |
| [`engineering/`](engineering/) | Developers | Technical design (`tdd/`) and the data-model / API / repo-structure / open-source-manifest references — *how* it's built. |
| [`operations/`](operations/) | Ops / on-call | Deployment, environment config, backup/restore, incident response, and hypercare runbooks — how to *run* it in production. |
| [`guides/`](guides/) | End users | The [applicant](guides/applicant-guide.md) and [admin/assessor](guides/admin-assessor-guide.md) user guides, plus the step-by-step [`walkthroughs/`](guides/walkthroughs/) for every workflow. |
| [`quality/`](quality/) | Assurance, Foundation | The contractual acceptance [parity test](quality/parity-test/) (Schedule 1 §3). Completed point-in-time assessments are in [`archive/quality/`](archive/quality/). |
| [`contract/`](contract/) | Foundation, delivery | The Master Services Agreement and the Feature Verification Checklist (the sign-off spine). |
| [`backlog/`](backlog/) | Developers | Lightweight tracker of open issues and follow-ups. |
| [`assets/`](assets/) | — | Shared images, sample documents, and the markdown export stylesheet. |
| [`archive/`](archive/) | — | Completed and historical material — see [`archive/README.md`](archive/README.md). |

## Start here

- **New to the project?** Read [`product/prd/_index.md`](product/prd/_index.md)
  (what) then [`engineering/tdd/_index.md`](engineering/tdd/_index.md) (how).
- **Using the system?** The [Applicant Guide](guides/applicant-guide.md) and the
  [Admin & Assessor Guide](guides/admin-assessor-guide.md) cover it end to end.
- **Signing off?** The [Feature Verification Checklist](contract/feature-verification-checklist.md)
  is the document the Foundation uses to accept the system. The point-in-time
  readiness, security, and walkthrough-verification records are in
  [`archive/quality/`](archive/quality/).
- **Picking up a task?** Check [`backlog/`](backlog/README.md).

## Status note — handover deliverables

The MSA Schedule 1 §4 documentation deliverables are **complete**: the two
[`guides/*-guide.md`](guides/) user guides; the [`operations/`](operations/)
runbooks (deployment, environment variables, backup/restore, incident response,
hypercare); and the engineering references
([data-model](engineering/data-model.md), [API reference](engineering/api-reference.md),
[repo structure](engineering/repo-structure.md),
[open-source manifest](engineering/open-source-manifest.md)).

The remaining acceptance item is the [parity test](quality/parity-test/), which
awaits the Foundation's ten historical cases (Schedule 1 §3).
