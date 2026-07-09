# Item 12: Round-level default submission-by date

> Source: `docs/backlog/post-demo-change-list.md` — item 12. Status: Not started.

Each Round should carry a default submission-by (deadline) date that every application in the round inherits, while staff can still override the deadline on an individual application. The "effective deadline" shown and filtered elsewhere (items 1 and 7) is the per-application override when set, otherwise the round default.

## Story 12.1 — Set a round-level default deadline
**As an** ADMIN, **I want** to set a default submission-by date on a round, **so that** every application in that round gets a sensible deadline without me editing each one.

**Acceptance criteria**
- [ ] Given I am editing a round's settings, When I open it, Then I see an optional "Default submission-by date" field.
- [ ] Given I enter a date and save, Then the round stores it as its default deadline and an audit entry records who changed it and when.
- [ ] Given I leave the field empty, Then the round has no default deadline (applications simply have no inherited deadline) and this is a valid, non-blocking state.
- [ ] Given I clear a previously-set default, Then saving removes the round default (see 12.3 for the effect on applications).
- [ ] The field is ADMIN-editable only; ASSESSOR/VIEWER see it read-only.

**Notes / dependencies**
- Requires a nullable default-deadline field on the `Round` model — ship the schema migration in the same PR (CLAUDE.md migration discipline; additive/nullable, author SQL via `migrate diff --script`).
- **Decided — date-only** value (no time-of-day).

## Story 12.2 — Applications inherit the round default; per-application override
**As an** ASSESSOR or ADMIN, **I want** an application to show its round's default deadline unless I set an override, **so that** I only touch the deadline on the exceptions.

**Acceptance criteria**
- [ ] Given an application whose round has a default deadline and no per-application deadline set, When I view the application, Then its effective deadline equals the round default and is labelled as inherited.
- [ ] Given I set a per-application submission-by date, Then that override becomes the effective deadline and takes precedence over the round default.
- [ ] Given a per-application override is set, When I clear it, Then the application falls back to the round default (or to "no deadline" if the round has none).
- [ ] Given the round has no default and the application has no override, Then the effective deadline is empty/none (not an error).
- [ ] The UI distinguishes an inherited value from an explicit override (e.g. "(from round default)" vs an explicitly-set date).

**Notes / dependencies**
- Effective deadline = per-application override if set, else round default. This is the single derivation consumed by items 1 (deadline column) and 7 (submission-by date filter).
- **Decided — two states only: inherit or override.** A per-application deadline is a simple nullable date: unset ⇒ inherit the round default; set ⇒ override. There is **no** "explicitly none" opt-out (no tri-state).

## Story 12.3 — Changing the round default propagates predictably
**As an** ADMIN, **I want** predictable behaviour when I change or clear a round's default deadline, **so that** applications update as expected and overrides are respected.

**Acceptance criteria**
- [ ] Given applications that have NOT set a per-application override, When I change the round default, Then their effective deadline reflects the new round default immediately (inheritance is live/derived, not copied at creation).
- [ ] Given applications that HAVE set a per-application override, When I change the round default, Then their override is unchanged and continues to take precedence.
- [ ] Given I clear the round default, Then applications without an override show no deadline, while applications with an override keep it.
- [ ] Changing the round default writes a single audit entry on the round; it does not write per-application audit entries.

**Notes / dependencies**
- **Intended behaviour:** the round default is inherited by reference (derived at read time), not snapshotted onto each application at creation. This makes "change the round default" affect all non-overridden applications at once — the behaviour the client asked for.
- **Decided — no opt-out.** The per-application deadline is a simple nullable date (inherit or override, per 12.2). There is no "explicitly none" state, so no tri-state is needed.
