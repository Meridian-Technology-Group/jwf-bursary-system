# Archive

Completed and historical documentation. Everything here has been **acted upon**
— a plan that's been implemented, questions that have been answered, specs that
have shipped, a legacy system we've replaced, or a point-in-time assessment
that's served its purpose. It's kept for traceability and audit, not for daily
use. The **active** documentation lives at the top level of [`docs/`](../).

> **These are point-in-time snapshots.** Content is preserved as it was when
> archived; relative links *inside* these documents may reference the
> pre-archive layout and may not resolve. Treat them as frozen records — for
> the current picture, use the active docs (`prd/`, `tdd/`, `guides/`,
> `operations/`, `backlog/`).

## Contents

| Folder | What it holds | Why it's archived |
|---|---|---|
| [`proposal/`](proposal/) | Pre-sale proposal, talking points, pitch deck | Sales phase complete |
| [`discovery/`](discovery/) | The legacy **Symplectic Grant Tracker** admin console (`admin-console.md`) — the as-is baseline | Replaced by the delivered system |
| [`planning/`](planning/) | The `implementation-plan.md` (build plan), `open-questions.md` (requirements clarifications), and engineering `notes/` | Implemented / answered |
| [`specs/`](specs/) | Build-time field specs: `applicant-form.md`, `invitation-flow.md` | Implemented (the applicant-form spec carries a stale-vs-implementation note; full re-verification tracked in [`backlog/`](../backlog/applicant-form-spec-stale-vs-implementation.md)) |
| [`quality/`](quality/) | Point-in-time assessments: security audit, walkthrough verification, production-readiness reports | Snapshots; superseded by later runs and the live system |
| [`backlog/`](backlog/) | Shipped backlog items (e.g. `b8-mfa-for-admin-and-assessor.md`) | Delivered to production |

The active acceptance artifact — the [parity test](../quality/parity-test/) —
stays under `quality/` because it is still pending. The Feature Verification
Checklist and MSA stay under [`contract/`](../contract/).
