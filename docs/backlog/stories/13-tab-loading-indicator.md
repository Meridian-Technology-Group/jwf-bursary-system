# Item 13: Loading indicator for slow tab transitions

> Source: `docs/backlog/post-demo-change-list.md` — item 13. Status: Not started.

Switching between tabs on the application detail page (Applicant Data, Assessment, Recommendation, etc.) can be slow, and today nothing signals that a load is in progress, so a slow tab reads as frozen or broken. A prior fix resolved the *stuck* Assessment tab bug but added no visible loading feedback.

## Story 13.1 — Pending state on tab navigation
**As a** staff user (ADMIN, ASSESSOR, or VIEWER) viewing an application, **I want** a visible pending indicator the moment I click a tab, **so that** a slow tab load looks like it is working rather than frozen or unresponsive.

**Acceptance criteria**
- [ ] Given I am on any application detail tab, when I click a different tab, then a pending/loading indicator (e.g. spinner or progress cue) appears immediately while the new tab's content is being fetched.
- [ ] Given the tab content finishes loading, when the new content is ready, then the pending indicator disappears and the selected tab's content is shown.
- [ ] Given a tab transition is in progress, when I look at the tab bar, then the tab I clicked is clearly marked as the active/target tab (so I know which one I am waiting for).
- [ ] Given a fast tab load, when the content resolves quickly, then the indicator does not produce a jarring flash (brief loads should feel instant, not flicker).
- [ ] Given the pending state, when I am mid-transition, then clicking away / navigating elsewhere is not blocked and does not leave a stuck spinner behind.
- [ ] Applies consistently across all application detail tabs and for all three staff roles.

**Notes / dependencies**
- Behaviour-level only: the exact mechanism (React transition pending state on the tab link vs. a route-segment loading fallback) is an implementation choice.
- Prior work fixed the *stuck* Assessment tab; this story is about the missing feedback, not that bug.

## Story 13.2 — Skeleton placeholder while a tab's content loads
**As a** staff user viewing an application, **I want** a skeleton placeholder shaped like the incoming tab's layout during a slow load, **so that** I can see the page is building and roughly what to expect instead of staring at a blank or stale area.

**Acceptance criteria**
- [ ] Given I switch to a tab whose content takes noticeable time to load, when the load is in progress, then a skeleton placeholder resembling that tab's layout is shown in the content area.
- [ ] Given the content resolves, when it is ready, then the skeleton is replaced by the real content without layout jump.
- [ ] Given a slow load, when the skeleton is visible, then the surrounding page chrome (tab bar, application header) remains visible and interactive so context is not lost.
- [ ] Given a tab fails to load, when an error occurs, then the user sees an error state rather than a skeleton that never resolves.

**Notes / dependencies**
- Optional / lower priority relative to 13.1 — the spinner-on-transition alone satisfies the core "doesn't look frozen" need; the skeleton is a polish upgrade.
- Skeletons can be minimal (generic content blocks) rather than pixel-perfect per-tab shapes if that is cheaper to maintain.
