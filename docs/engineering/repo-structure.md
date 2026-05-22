# Repository Structure

> **STATUS: STUB** — MSA Schedule 1 §4 / clause 13.1(c) deliverable. To be
> completed before go-live (B15).

## Purpose
A one-page orientation to the codebase so a new engineer can find their way.

## To complete
- [ ] Top-level layout (`src/`, `prisma/`, `docs/`, config files).
- [ ] `src/app/` route groups: `(auth)`, `(portal)`, `(admin)` — and the
      API routes under `src/app/api/`.
- [ ] `src/lib/` (assessment engine, db/queries, auth, email, storage,
      rate-limit) and `src/components/` (admin, portal, ui).
- [ ] The assessment engine (`src/lib/assessment/*`) and its test suite.
- [ ] Build/test/seed scripts (`package.json`) and the Node/Prisma toolchain.

See also: [`tdd/03-architectural-overview.md`](tdd/03-architectural-overview.md).
