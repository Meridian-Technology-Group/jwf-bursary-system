# Backlog

Lightweight tracker for issues, improvements, and follow-ups noticed in
passing while doing other work. The goal is to capture context **at the
moment the smell is observed**, not later when half the rationale has
faded.

## Conventions

- **One file per item.** Filename in `kebab-case`, ending in `.md`.
- Use the [`_template.md`](_template.md) as the starting point.
- Keep each file short — a paragraph of context plus a proposed approach is
  usually enough. Anything longer probably belongs in `docs/planning/`.
- Status values: `open`, `in-progress`, `done`, `won't-do`. Drop the file
  into `done/` or delete it once shipped — git history preserves it.
- Severity values: `low`, `medium`, `high`, `critical`. Use sparingly —
  reserve `high`/`critical` for things that affect users today.
- Reference related PRs, planning docs, or code paths inline with relative
  links so the entry stays useful as the codebase moves.

## Adding an item

```
cp docs/backlog/_template.md docs/backlog/<slug>.md
$EDITOR docs/backlog/<slug>.md
```

Commit the new file with a `docs:` commit on whatever branch you're on. If
it's directly relevant to the work you're shipping, the same PR is fine;
otherwise a small `chore/` PR is the cleanest path.
