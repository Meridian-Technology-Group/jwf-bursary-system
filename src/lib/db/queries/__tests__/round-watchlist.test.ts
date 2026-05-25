import { describe, it, expect } from "vitest";
import {
  ApplicationStatus,
  AssessmentStatus,
  InvitationStatus,
  RoundStatus,
  School,
} from "@prisma/client";
import {
  evaluateWatchlist,
  WATCHLIST_THRESHOLDS,
  type WatchlistInput,
  type WatchlistInputApplication,
  type WatchlistInputInvitation,
  type WatchlistRuleId,
} from "../round-watchlist-eval";

// Fixed "now" for deterministic boundary tests.
const NOW = new Date("2026-06-01T12:00:00.000Z");
const T = WATCHLIST_THRESHOLDS;

// Offsets relative to NOW.
function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}
function ahead(ms: number): Date {
  return new Date(NOW.getTime() + ms);
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function makeApp(
  overrides: Partial<WatchlistInputApplication> = {},
): WatchlistInputApplication {
  return {
    id: overrides.id ?? "app-1",
    school: overrides.school ?? School.TRINITY,
    status: overrides.status ?? ApplicationStatus.SUBMITTED,
    assessmentId: overrides.assessmentId ?? null,
    assessmentStatus: overrides.assessmentStatus ?? null,
    recommendationCreatedAt: overrides.recommendationCreatedAt ?? null,
    hasMissingDocs: overrides.hasMissingDocs ?? false,
    latestPauseAt: overrides.latestPauseAt ?? null,
    latestAnyAuditAt: overrides.latestAnyAuditAt ?? null,
  };
}

function makeInvite(
  overrides: Partial<WatchlistInputInvitation> = {},
): WatchlistInputInvitation {
  return {
    id: overrides.id ?? "inv-1",
    status: overrides.status ?? InvitationStatus.PENDING,
    bursaryAccountId: overrides.bursaryAccountId ?? null,
    createdAt: overrides.createdAt ?? ago(T.invitePending + 1),
    expiresAt: overrides.expiresAt ?? ahead(10 * 24 * 60 * 60 * 1000),
    acceptedAt: overrides.acceptedAt ?? null,
  };
}

function makeInput(overrides: Partial<WatchlistInput> = {}): WatchlistInput {
  return {
    round: {
      id: "round-1",
      status: RoundStatus.OPEN,
      closeDate: ahead(30 * 24 * 60 * 60 * 1000), // far away
      total: 0,
      qualifies: 0,
      doesNotQualify: 0,
      ...overrides.round,
    },
    invitations: overrides.invitations ?? [],
    applications: overrides.applications ?? [],
    exports: overrides.exports ?? [],
  };
}

function ruleById(
  result: ReturnType<typeof evaluateWatchlist>,
  id: WatchlistRuleId,
) {
  return result.rules.find((r) => r.id === id);
}

// ─── Rule 1 — invites pending >14d ───────────────────────────────────────────

describe("rule 1 — invites pending >14d", () => {
  it("does NOT fire just under 14 days", () => {
    const input = makeInput({
      invitations: [makeInvite({ createdAt: ago(T.invitePending - 1000) })],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "INVITES_PENDING")).toBeUndefined();
  });

  it("fires just over 14 days", () => {
    const input = makeInput({
      invitations: [makeInvite({ createdAt: ago(T.invitePending + 1000) })],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "INVITES_PENDING")?.count).toBe(1);
  });

  it("ignores accepted, expired, or already-expired invites", () => {
    const input = makeInput({
      invitations: [
        makeInvite({ id: "a", acceptedAt: ago(1000) }),
        makeInvite({ id: "b", status: InvitationStatus.EXPIRED }),
        makeInvite({ id: "c", expiresAt: ago(1000) }), // expiresAt in the past
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "INVITES_PENDING")).toBeUndefined();
  });
});

// ─── Rule 2 — reassessment invite expiring <48h ──────────────────────────────

describe("rule 2 — reassessment invite expiring <48h", () => {
  it("fires for a reassessment invite expiring just under 48h", () => {
    const input = makeInput({
      invitations: [
        makeInvite({
          bursaryAccountId: "acct-1",
          createdAt: ago(1000), // recent, so rule 1 doesn't fire
          expiresAt: ahead(T.reassessExpiring - 1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "REASSESS_INVITE_EXPIRING")?.count).toBe(1);
  });

  it("does NOT fire just over 48h to expiry", () => {
    const input = makeInput({
      invitations: [
        makeInvite({
          bursaryAccountId: "acct-1",
          createdAt: ago(1000),
          expiresAt: ahead(T.reassessExpiring + 1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "REASSESS_INVITE_EXPIRING")).toBeUndefined();
  });

  it("does NOT fire for a non-reassessment invite (no bursaryAccountId)", () => {
    const input = makeInput({
      invitations: [
        makeInvite({
          bursaryAccountId: null,
          createdAt: ago(1000),
          expiresAt: ahead(T.reassessExpiring - 1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "REASSESS_INVITE_EXPIRING")).toBeUndefined();
  });
});

// ─── Rule 3 — submitted, missing required docs ───────────────────────────────

describe("rule 3 — submitted, missing required docs", () => {
  it("fires for a SUBMITTED app with missing docs", () => {
    const input = makeInput({
      applications: [
        makeApp({
          status: ApplicationStatus.SUBMITTED,
          hasMissingDocs: true,
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "SUBMITTED_MISSING_DOCS")?.count).toBe(1);
  });

  it("does NOT fire for a SUBMITTED app with complete docs", () => {
    const input = makeInput({
      applications: [
        makeApp({ status: ApplicationStatus.SUBMITTED, hasMissingDocs: false }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "SUBMITTED_MISSING_DOCS")).toBeUndefined();
  });

  it("does NOT fire for a non-SUBMITTED app even with missing docs", () => {
    const input = makeInput({
      applications: [
        makeApp({ status: ApplicationStatus.NOT_STARTED, hasMissingDocs: true }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "SUBMITTED_MISSING_DOCS")).toBeUndefined();
  });
});

// ─── Rule 4 — assessment paused >7d ──────────────────────────────────────────

describe("rule 4 — assessment paused >7d", () => {
  it("does NOT fire just under 7 days", () => {
    const input = makeInput({
      applications: [
        makeApp({
          status: ApplicationStatus.PAUSED,
          assessmentId: "ass-1",
          assessmentStatus: AssessmentStatus.PAUSED,
          latestPauseAt: ago(T.paused - 1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "ASSESSMENT_PAUSED")).toBeUndefined();
  });

  it("fires just over 7 days", () => {
    const input = makeInput({
      applications: [
        makeApp({
          status: ApplicationStatus.PAUSED,
          assessmentId: "ass-1",
          assessmentStatus: AssessmentStatus.PAUSED,
          latestPauseAt: ago(T.paused + 1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "ASSESSMENT_PAUSED")?.count).toBe(1);
  });

  it("does NOT fire when not paused, even with an old pause event", () => {
    const input = makeInput({
      applications: [
        makeApp({
          status: ApplicationStatus.NOT_STARTED,
          assessmentId: "ass-1",
          assessmentStatus: AssessmentStatus.NOT_STARTED,
          latestPauseAt: ago(T.paused + 1000),
          // give it recent activity so rule 5 doesn't fire instead
          latestAnyAuditAt: ago(1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "ASSESSMENT_PAUSED")).toBeUndefined();
  });
});

// ─── Rule 5 — assessment stalled ─────────────────────────────────────────────

describe("rule 5 — assessment stalled", () => {
  it("does NOT fire just under 5 days of inactivity", () => {
    const input = makeInput({
      applications: [
        makeApp({
          status: ApplicationStatus.NOT_STARTED,
          assessmentId: "ass-1",
          assessmentStatus: AssessmentStatus.NOT_STARTED,
          latestAnyAuditAt: ago(T.stalled - 1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "ASSESSMENT_STALLED")).toBeUndefined();
  });

  it("fires just over 5 days of inactivity", () => {
    const input = makeInput({
      applications: [
        makeApp({
          status: ApplicationStatus.NOT_STARTED,
          assessmentId: "ass-1",
          assessmentStatus: AssessmentStatus.NOT_STARTED,
          latestAnyAuditAt: ago(T.stalled + 1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "ASSESSMENT_STALLED")?.count).toBe(1);
  });

  it("fires when an assessment exists but has zero audit activity", () => {
    const input = makeInput({
      applications: [
        makeApp({
          status: ApplicationStatus.NOT_STARTED,
          assessmentId: "ass-1",
          assessmentStatus: AssessmentStatus.NOT_STARTED,
          latestAnyAuditAt: null,
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "ASSESSMENT_STALLED")?.count).toBe(1);
  });

  it("does NOT fire when there is no assessment", () => {
    const input = makeInput({
      applications: [
        makeApp({
          status: ApplicationStatus.SUBMITTED,
          assessmentId: null,
          latestAnyAuditAt: null,
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "ASSESSMENT_STALLED")).toBeUndefined();
  });

  it("does NOT fire when the assessment is COMPLETED", () => {
    const input = makeInput({
      applications: [
        makeApp({
          status: ApplicationStatus.COMPLETED,
          assessmentId: "ass-1",
          assessmentStatus: AssessmentStatus.COMPLETED,
          latestAnyAuditAt: ago(T.stalled + 1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "ASSESSMENT_STALLED")).toBeUndefined();
  });
});

// ─── Rule 6 — recommendation awaiting outcome >3d ────────────────────────────

describe("rule 6 — recommendation awaiting outcome >3d", () => {
  it("does NOT fire just under 3 days", () => {
    const input = makeInput({
      applications: [
        makeApp({
          status: ApplicationStatus.COMPLETED,
          assessmentId: "ass-1",
          assessmentStatus: AssessmentStatus.COMPLETED,
          recommendationCreatedAt: ago(T.awaitingOutcome - 1000),
          latestAnyAuditAt: ago(1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "RECOMMENDATION_AWAITING_OUTCOME")).toBeUndefined();
  });

  it("fires just over 3 days without an outcome", () => {
    const input = makeInput({
      applications: [
        makeApp({
          status: ApplicationStatus.COMPLETED,
          assessmentId: "ass-1",
          assessmentStatus: AssessmentStatus.COMPLETED,
          recommendationCreatedAt: ago(T.awaitingOutcome + 1000),
          latestAnyAuditAt: ago(1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "RECOMMENDATION_AWAITING_OUTCOME")?.count).toBe(1);
  });

  it("does NOT fire once an outcome is decided (QUALIFIES)", () => {
    const input = makeInput({
      round: {
        id: "round-1",
        status: RoundStatus.OPEN,
        closeDate: ahead(30 * 24 * 60 * 60 * 1000),
        total: 1,
        qualifies: 1,
        doesNotQualify: 0,
      },
      applications: [
        makeApp({
          status: ApplicationStatus.QUALIFIES,
          assessmentId: "ass-1",
          assessmentStatus: AssessmentStatus.COMPLETED,
          recommendationCreatedAt: ago(T.awaitingOutcome + 1000),
        }),
      ],
      // export covers it so rule 7 doesn't fire
      exports: [{ school: "ALL", createdAt: ago(500) }],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "RECOMMENDATION_AWAITING_OUTCOME")).toBeUndefined();
  });
});

// ─── Rule 7 — ready but not exported ─────────────────────────────────────────

describe("rule 7 — ready but not exported", () => {
  function decidedApp(
    school: School,
    decisionAt: Date,
  ): WatchlistInputApplication {
    return makeApp({
      id: `app-${school}`,
      school,
      status: ApplicationStatus.QUALIFIES,
      assessmentId: `ass-${school}`,
      assessmentStatus: AssessmentStatus.COMPLETED,
      recommendationCreatedAt: decisionAt,
    });
  }

  it("flags a school with a decision and no export at all", () => {
    const input = makeInput({
      applications: [decidedApp(School.TRINITY, ago(2000))],
      exports: [],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "READY_NOT_EXPORTED")?.count).toBe(1);
  });

  it("does NOT flag when an export covers the latest decision", () => {
    const input = makeInput({
      applications: [decidedApp(School.TRINITY, ago(2000))],
      exports: [{ school: "TRINITY", createdAt: ago(1000) }], // after decision
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "READY_NOT_EXPORTED")).toBeUndefined();
  });

  it("re-flags when a decision is newer than the last export", () => {
    const input = makeInput({
      applications: [decidedApp(School.TRINITY, ago(1000))],
      exports: [{ school: "TRINITY", createdAt: ago(2000) }], // before decision
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "READY_NOT_EXPORTED")?.count).toBe(1);
  });

  it("an ALL export covers any school", () => {
    const input = makeInput({
      applications: [
        decidedApp(School.TRINITY, ago(2000)),
        decidedApp(School.WHITGIFT, ago(2000)),
      ],
      exports: [{ school: "ALL", createdAt: ago(1000) }],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "READY_NOT_EXPORTED")).toBeUndefined();
  });

  it("flags only the school whose decision post-dates its export", () => {
    const input = makeInput({
      applications: [
        decidedApp(School.TRINITY, ago(1000)), // newer than its export → flag
        decidedApp(School.WHITGIFT, ago(3000)), // covered
      ],
      exports: [
        { school: "TRINITY", createdAt: ago(2000) },
        { school: "WHITGIFT", createdAt: ago(2000) },
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "READY_NOT_EXPORTED")?.count).toBe(1);
  });
});

// ─── Rule 8 — close approaching with undecided ───────────────────────────────

describe("rule 8 — close approaching with undecided", () => {
  function closeInput(
    closeDate: Date,
    total: number,
    qualifies: number,
    doesNotQualify: number,
  ): WatchlistInput {
    // Undecided apps so the rule has something to claim.
    const undecided = total - qualifies - doesNotQualify;
    const apps: WatchlistInputApplication[] = [];
    for (let i = 0; i < undecided; i++) {
      apps.push(
        makeApp({ id: `u-${i}`, status: ApplicationStatus.SUBMITTED }),
      );
    }
    return makeInput({
      round: {
        id: "round-1",
        status: RoundStatus.OPEN,
        closeDate,
        total,
        qualifies,
        doesNotQualify,
      },
      applications: apps,
    });
  }

  it("does NOT fire with exactly 10 undecided (floor is > 10)", () => {
    const input = closeInput(ahead(T.closeApproaching - DAY()), 10, 0, 0);
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "CLOSE_APPROACHING_UNDECIDED")).toBeUndefined();
  });

  it("fires with 11 undecided and close within 7 days", () => {
    const input = closeInput(ahead(T.closeApproaching - DAY()), 11, 0, 0);
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "CLOSE_APPROACHING_UNDECIDED")?.count).toBe(11);
  });

  it("does NOT fire when close date is beyond 7 days", () => {
    const input = closeInput(ahead(T.closeApproaching + DAY()), 11, 0, 0);
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "CLOSE_APPROACHING_UNDECIDED")).toBeUndefined();
  });

  it("does NOT fire when the round is already CLOSED", () => {
    const input = closeInput(ahead(T.closeApproaching - DAY()), 11, 0, 0);
    input.round.status = RoundStatus.CLOSED;
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "CLOSE_APPROACHING_UNDECIDED")).toBeUndefined();
  });
});

function DAY() {
  return 24 * 60 * 60 * 1000;
}

// ─── Precedence / dedupe ─────────────────────────────────────────────────────

describe("precedence / dedupe across per-application rules", () => {
  it("a single app trips only the most-severe rule (missing-docs blocker wins over stalled)", () => {
    // An app that is SUBMITTED + missing docs (rule 3, blocker) AND would also
    // be stalled (rule 5, warning) if it had an assessment. Give it an
    // assessment with no recent activity so rule 5 would otherwise fire.
    const input = makeInput({
      applications: [
        makeApp({
          id: "x",
          status: ApplicationStatus.SUBMITTED,
          hasMissingDocs: true,
          assessmentId: "ass-x",
          assessmentStatus: AssessmentStatus.NOT_STARTED,
          latestAnyAuditAt: ago(T.stalled + 1000),
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "SUBMITTED_MISSING_DOCS")?.count).toBe(1);
    // Rule 5 must NOT also claim the same app.
    expect(ruleById(res, "ASSESSMENT_STALLED")).toBeUndefined();
  });

  it("awaiting-outcome (blocker) wins over close+undecided (blocker) by rule order", () => {
    // One app, both rule 6 and rule 8 would claim it. Rule 6 comes first.
    const input = makeInput({
      round: {
        id: "round-1",
        status: RoundStatus.OPEN,
        closeDate: ahead(T.closeApproaching - DAY()),
        total: 11,
        qualifies: 0,
        doesNotQualify: 0,
      },
      applications: [
        // The awaiting-outcome app.
        makeApp({
          id: "rec-app",
          status: ApplicationStatus.COMPLETED,
          assessmentId: "ass-rec",
          assessmentStatus: AssessmentStatus.COMPLETED,
          recommendationCreatedAt: ago(T.awaitingOutcome + 1000),
          latestAnyAuditAt: ago(1000),
        }),
        // 10 more plain undecided apps to push undecided count to 11.
        ...Array.from({ length: 10 }, (_, i) =>
          makeApp({ id: `u-${i}`, status: ApplicationStatus.SUBMITTED }),
        ),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "RECOMMENDATION_AWAITING_OUTCOME")?.count).toBe(1);
    // Rule 8 still fires but no longer counts the rec-app (10 remain, not 11).
    expect(ruleById(res, "CLOSE_APPROACHING_UNDECIDED")?.count).toBe(10);
    const rule8 = ruleById(res, "CLOSE_APPROACHING_UNDECIDED");
    expect(rule8?.applicationIds).not.toContain("rec-app");
  });

  it("invitation-scoped rules do NOT dedupe against application rules", () => {
    const input = makeInput({
      invitations: [makeInvite({ id: "inv-aged" })],
      applications: [
        makeApp({
          id: "app-docs",
          status: ApplicationStatus.SUBMITTED,
          hasMissingDocs: true,
        }),
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(ruleById(res, "INVITES_PENDING")?.count).toBe(1);
    expect(ruleById(res, "SUBMITTED_MISSING_DOCS")?.count).toBe(1);
  });

  it("render order puts blockers before warnings", () => {
    const input = makeInput({
      invitations: [makeInvite({ id: "inv-aged" })], // warning
      applications: [
        makeApp({
          id: "app-docs",
          status: ApplicationStatus.SUBMITTED,
          hasMissingDocs: true,
        }), // blocker
      ],
    });
    const res = evaluateWatchlist(input, NOW);
    expect(res.rules[0].severity).toBe("blocker");
    expect(res.rules[res.rules.length - 1].severity).toBe("warning");
  });
});

// ─── All clear ───────────────────────────────────────────────────────────────

describe("all clear", () => {
  it("returns allClear with no rules when nothing trips", () => {
    const input = makeInput({
      round: {
        id: "round-1",
        status: RoundStatus.OPEN,
        closeDate: ahead(30 * 24 * 60 * 60 * 1000),
        total: 2,
        qualifies: 1,
        doesNotQualify: 1,
      },
      invitations: [
        makeInvite({ createdAt: ago(1000) }), // recent, no trip
      ],
      applications: [
        makeApp({
          id: "ok-1",
          status: ApplicationStatus.QUALIFIES,
          assessmentId: "ass-1",
          assessmentStatus: AssessmentStatus.COMPLETED,
          recommendationCreatedAt: ago(2000),
        }),
        makeApp({
          id: "ok-2",
          status: ApplicationStatus.DOES_NOT_QUALIFY,
          assessmentId: "ass-2",
          assessmentStatus: AssessmentStatus.COMPLETED,
          recommendationCreatedAt: ago(2000),
        }),
      ],
      exports: [{ school: "ALL", createdAt: ago(500) }], // covers all decisions
    });
    const res = evaluateWatchlist(input, NOW);
    expect(res.allClear).toBe(true);
    expect(res.rules).toHaveLength(0);
  });
});
