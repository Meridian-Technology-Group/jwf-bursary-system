import { describe, it, expect } from "vitest";
import { RoundStatus, School } from "@prisma/client";
import {
  deriveTimeProgress,
  deriveStageStrip,
  deriveExportReadiness,
  computeOutcomesDelta,
  type StageStripCounts,
  type StageActivity,
  type StageState,
  type StageKey,
} from "../round-cockpit-eval";
import type {
  WatchlistResult,
  WatchlistRule,
  WatchlistRuleId,
} from "../round-watchlist-eval";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-15T12:00:00.000Z");

function days(n: number): Date {
  return new Date(NOW.getTime() + n * DAY);
}

// ─── Watchlist fixtures (only the bits the cockpit reads) ──────────────────────

function makeRule(id: WatchlistRuleId, count = 1): WatchlistRule {
  return {
    id,
    severity: "blocker",
    count,
    label: `${id} x${count}`,
    drillHref: `/queue?rule=${id}`,
    applicationIds: [],
  };
}

function watchlist(rules: WatchlistRule[] = []): WatchlistResult {
  return { rules, allClear: rules.length === 0 };
}

function makeCounts(
  overrides: Partial<StageStripCounts> = {},
): StageStripCounts {
  return {
    preSubmission: overrides.preSubmission ?? 0,
    submitted: overrides.submitted ?? 0,
    inProgress: overrides.inProgress ?? 0,
    complete: overrides.complete ?? 0,
    total: overrides.total ?? 0,
  };
}

function makeActivity(overrides: Partial<StageActivity> = {}): StageActivity {
  return {
    hasInvitations: overrides.hasInvitations ?? false,
    hasAssessments: overrides.hasAssessments ?? false,
    hasRecommendations: overrides.hasRecommendations ?? false,
    hasExports: overrides.hasExports ?? false,
  };
}

function stateOf(nodes: ReturnType<typeof deriveStageStrip>, key: StageKey): StageState {
  const node = nodes.find((n) => n.key === key);
  if (!node) throw new Error(`missing stage node ${key}`);
  return node.state;
}

// ════════════════════════════════════════════════════════════════════════════
// deriveTimeProgress
// ════════════════════════════════════════════════════════════════════════════

describe("deriveTimeProgress", () => {
  it("open round mid-way: day index, days-to-close and rates", () => {
    // 30-day window, now is day 15 (14 days elapsed since open + 1).
    const tp = deriveTimeProgress(
      {
        openDate: days(-14),
        closeDate: days(16),
        status: RoundStatus.OPEN,
      },
      /* decided */ 20,
      /* total */ 100,
      /* decisionsToDate */ 30,
      NOW,
    );
    expect(tp.totalDays).toBe(30);
    // 14 whole days elapsed since open (ceil(14d/day) = 14).
    expect(tp.dayN).toBe(14);
    expect(tp.daysToClose).toBe(16);
    expect(tp.undecided).toBe(80);
    // 80 undecided / 16 days = 5.0
    expect(tp.decisionsPerDayRequired).toBe(5);
    // 30 decisions / day 14 ≈ 2.14 → 2.1
    expect(tp.decisionsPerDayActual).toBe(2.1);
  });

  it("rounds rates to one decimal place", () => {
    const tp = deriveTimeProgress(
      { openDate: days(-9), closeDate: days(7), status: RoundStatus.OPEN },
      /* decided */ 0,
      /* total */ 10,
      /* decisionsToDate */ 7,
      NOW,
    );
    // 10 undecided / 7 days ≈ 1.43 → 1.4
    expect(tp.decisionsPerDayRequired).toBe(1.4);
    // open was 9 days ago → ceil(9d/day) = 9
    expect(tp.dayN).toBe(9);
    // 7 / 9 ≈ 0.78 → 0.8
    expect(tp.decisionsPerDayActual).toBe(0.8);
  });

  it("closed round: daysToClose and required are 0, actual still computed", () => {
    const tp = deriveTimeProgress(
      { openDate: days(-40), closeDate: days(-10), status: RoundStatus.CLOSED },
      /* decided */ 95,
      /* total */ 100,
      /* decisionsToDate */ 95,
      NOW,
    );
    expect(tp.daysToClose).toBe(0);
    expect(tp.decisionsPerDayRequired).toBe(0);
    expect(tp.undecided).toBe(5);
    // dayN clamps to totalDays (30); actual = 95/30 ≈ 3.2
    expect(tp.totalDays).toBe(30);
    expect(tp.dayN).toBe(30);
    expect(tp.decisionsPerDayActual).toBe(3.2);
  });

  it("past close but still OPEN: daysToClose 0, required 0", () => {
    const tp = deriveTimeProgress(
      { openDate: days(-40), closeDate: days(-1), status: RoundStatus.OPEN },
      /* decided */ 10,
      /* total */ 50,
      /* decisionsToDate */ 10,
      NOW,
    );
    expect(tp.daysToClose).toBe(0);
    expect(tp.decisionsPerDayRequired).toBe(0);
    expect(tp.undecided).toBe(40);
  });

  it("zero-day / same-day window guards against divide-by-zero", () => {
    const tp = deriveTimeProgress(
      { openDate: NOW, closeDate: NOW, status: RoundStatus.OPEN },
      /* decided */ 0,
      /* total */ 5,
      /* decisionsToDate */ 0,
      NOW,
    );
    expect(tp.totalDays).toBe(1); // clamped up from 0
    expect(tp.dayN).toBe(1); // clamped up
    expect(tp.daysToClose).toBe(0); // now >= close
    expect(tp.decisionsPerDayRequired).toBe(0); // no days left
    expect(Number.isFinite(tp.decisionsPerDayActual)).toBe(true);
    expect(tp.decisionsPerDayActual).toBe(0);
  });

  it("before open clamps dayN to 1, never negative", () => {
    const tp = deriveTimeProgress(
      { openDate: days(2), closeDate: days(12), status: RoundStatus.OPEN },
      /* decided */ 0,
      /* total */ 10,
      /* decisionsToDate */ 0,
      NOW,
    );
    expect(tp.dayN).toBe(1);
    expect(tp.daysToClose).toBeGreaterThan(0);
    expect(tp.undecided).toBe(10);
  });

  it("decided exceeding total never yields negative undecided", () => {
    const tp = deriveTimeProgress(
      { openDate: days(-5), closeDate: days(5), status: RoundStatus.OPEN },
      /* decided */ 12,
      /* total */ 10,
      /* decisionsToDate */ 12,
      NOW,
    );
    expect(tp.undecided).toBe(0);
    expect(tp.decisionsPerDayRequired).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// deriveStageStrip
// ════════════════════════════════════════════════════════════════════════════

describe("deriveStageStrip", () => {
  it("returns the 7 nodes in canonical order", () => {
    const nodes = deriveStageStrip(
      RoundStatus.DRAFT,
      makeCounts(),
      watchlist(),
      makeActivity(),
    );
    expect(nodes.map((n) => n.key)).toEqual([
      "setup",
      "invitations",
      "submissions",
      "assessment",
      "decision",
      "export",
      "closed",
    ]);
  });

  it("fresh DRAFT round: setup live, everything else not_yet", () => {
    const nodes = deriveStageStrip(
      RoundStatus.DRAFT,
      makeCounts(),
      watchlist(),
      makeActivity(),
    );
    expect(stateOf(nodes, "setup")).toBe("live");
    expect(stateOf(nodes, "invitations")).toBe("not_yet");
    expect(stateOf(nodes, "submissions")).toBe("not_yet");
    expect(stateOf(nodes, "assessment")).toBe("not_yet");
    expect(stateOf(nodes, "decision")).toBe("not_yet");
    expect(stateOf(nodes, "export")).toBe("not_yet");
    expect(stateOf(nodes, "closed")).toBe("not_yet");
  });

  it("DRAFT with invitations sent: invitations live", () => {
    const nodes = deriveStageStrip(
      RoundStatus.DRAFT,
      makeCounts(),
      watchlist(),
      makeActivity({ hasInvitations: true }),
    );
    expect(stateOf(nodes, "invitations")).toBe("live");
  });

  it("OPEN round mid-flight: setup+invitations complete, submissions live, assessment live", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ submitted: 5, inProgress: 10, complete: 3, total: 20 }),
      watchlist(),
      makeActivity({ hasInvitations: true, hasAssessments: true }),
    );
    expect(stateOf(nodes, "setup")).toBe("complete");
    expect(stateOf(nodes, "invitations")).toBe("complete");
    expect(stateOf(nodes, "submissions")).toBe("live");
    expect(stateOf(nodes, "assessment")).toBe("live");
    expect(stateOf(nodes, "decision")).toBe("live"); // complete>0 but not all
    expect(stateOf(nodes, "closed")).toBe("not_yet");
  });

  it("all-clear CLOSED round: every progressed stage complete", () => {
    const nodes = deriveStageStrip(
      RoundStatus.CLOSED,
      makeCounts({ complete: 20, total: 20 }),
      watchlist(),
      makeActivity({
        hasInvitations: true,
        hasAssessments: true,
        hasRecommendations: true,
        hasExports: true,
      }),
    );
    expect(stateOf(nodes, "setup")).toBe("complete");
    expect(stateOf(nodes, "invitations")).toBe("complete");
    expect(stateOf(nodes, "submissions")).toBe("complete");
    expect(stateOf(nodes, "assessment")).toBe("complete");
    expect(stateOf(nodes, "decision")).toBe("complete");
    expect(stateOf(nodes, "export")).toBe("complete");
    expect(stateOf(nodes, "closed")).toBe("complete");
  });

  it("decision is not_yet when nothing decided yet", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ submitted: 8, inProgress: 4, complete: 0, total: 12 }),
      watchlist(),
      makeActivity({ hasInvitations: true, hasAssessments: true }),
    );
    expect(stateOf(nodes, "decision")).toBe("not_yet");
  });

  it("export is live when exports exist but round still OPEN", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ complete: 5, total: 20 }),
      watchlist(),
      makeActivity({ hasInvitations: true, hasAssessments: true, hasExports: true }),
    );
    expect(stateOf(nodes, "export")).toBe("live");
  });

  // ── Blocked overlay: each rule lights its stage ──────────────────────────────

  it("INVITES_PENDING blocks the invitations stage", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ total: 10 }),
      watchlist([makeRule("INVITES_PENDING")]),
      makeActivity({ hasInvitations: true }),
    );
    expect(stateOf(nodes, "invitations")).toBe("blocked");
  });

  it("REASSESS_INVITE_EXPIRING blocks the invitations stage", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ total: 10 }),
      watchlist([makeRule("REASSESS_INVITE_EXPIRING")]),
      makeActivity({ hasInvitations: true }),
    );
    expect(stateOf(nodes, "invitations")).toBe("blocked");
  });

  it("SUBMITTED_MISSING_DOCS blocks the assessment stage", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ submitted: 3, total: 10 }),
      watchlist([makeRule("SUBMITTED_MISSING_DOCS")]),
      makeActivity({ hasInvitations: true, hasAssessments: true }),
    );
    expect(stateOf(nodes, "assessment")).toBe("blocked");
  });

  it("ASSESSMENT_PAUSED blocks the assessment stage", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ inProgress: 2, total: 10 }),
      watchlist([makeRule("ASSESSMENT_PAUSED")]),
      makeActivity({ hasInvitations: true, hasAssessments: true }),
    );
    expect(stateOf(nodes, "assessment")).toBe("blocked");
  });

  it("ASSESSMENT_STALLED blocks the assessment stage", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ inProgress: 2, total: 10 }),
      watchlist([makeRule("ASSESSMENT_STALLED")]),
      makeActivity({ hasInvitations: true, hasAssessments: true }),
    );
    expect(stateOf(nodes, "assessment")).toBe("blocked");
  });

  it("RECOMMENDATION_AWAITING_OUTCOME blocks the decision stage", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ complete: 4, total: 10 }),
      watchlist([makeRule("RECOMMENDATION_AWAITING_OUTCOME")]),
      makeActivity({ hasInvitations: true, hasAssessments: true }),
    );
    expect(stateOf(nodes, "decision")).toBe("blocked");
  });

  it("CLOSE_APPROACHING_UNDECIDED blocks the decision stage", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ complete: 4, total: 10 }),
      watchlist([makeRule("CLOSE_APPROACHING_UNDECIDED")]),
      makeActivity({ hasInvitations: true, hasAssessments: true }),
    );
    expect(stateOf(nodes, "decision")).toBe("blocked");
  });

  it("READY_NOT_EXPORTED blocks the export stage", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ complete: 8, total: 10 }),
      watchlist([makeRule("READY_NOT_EXPORTED")]),
      makeActivity({ hasInvitations: true, hasAssessments: true, hasExports: true }),
    );
    expect(stateOf(nodes, "export")).toBe("blocked");
  });

  it("blocked overlay wins over a complete base state", () => {
    // Submissions would be complete (CLOSED) but a doc-gap blocker on assessment
    // must light assessment, not submissions.
    const nodes = deriveStageStrip(
      RoundStatus.CLOSED,
      makeCounts({ complete: 18, total: 20 }),
      watchlist([makeRule("ASSESSMENT_STALLED")]),
      makeActivity({
        hasInvitations: true,
        hasAssessments: true,
        hasRecommendations: true,
      }),
    );
    expect(stateOf(nodes, "submissions")).toBe("complete");
    expect(stateOf(nodes, "assessment")).toBe("blocked");
    expect(stateOf(nodes, "closed")).toBe("complete");
  });

  it("closed node never blocks (no rule maps to it)", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ total: 10 }),
      watchlist([
        makeRule("INVITES_PENDING"),
        makeRule("ASSESSMENT_STALLED"),
        makeRule("READY_NOT_EXPORTED"),
      ]),
      makeActivity({ hasInvitations: true }),
    );
    expect(stateOf(nodes, "closed")).not.toBe("blocked");
  });

  it("a rule with count 0 does not block its stage", () => {
    const nodes = deriveStageStrip(
      RoundStatus.OPEN,
      makeCounts({ total: 10 }),
      watchlist([makeRule("INVITES_PENDING", 0)]),
      makeActivity({ hasInvitations: true }),
    );
    expect(stateOf(nodes, "invitations")).not.toBe("blocked");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// deriveExportReadiness
// ════════════════════════════════════════════════════════════════════════════

describe("deriveExportReadiness", () => {
  it("export after the latest decision counts as all-exported", () => {
    const [row] = deriveExportReadiness([
      {
        school: School.TRINITY,
        decided: 5,
        latestDecisionAt: days(-2),
        lastExportedAt: days(-1),
      },
    ]);
    expect(row.allExported).toBe(true);
    expect(row.decided).toBe(5);
  });

  it("export before the latest decision does NOT cover it", () => {
    const [row] = deriveExportReadiness([
      {
        school: School.WHITGIFT,
        decided: 5,
        latestDecisionAt: days(-1),
        lastExportedAt: days(-2),
      },
    ]);
    expect(row.allExported).toBe(false);
  });

  it("no export at all is not all-exported", () => {
    const [row] = deriveExportReadiness([
      {
        school: School.TRINITY,
        decided: 3,
        latestDecisionAt: days(-1),
        lastExportedAt: null,
      },
    ]);
    expect(row.allExported).toBe(false);
    expect(row.lastExportedAt).toBeNull();
  });

  it("zero decided is never all-exported even with an export present", () => {
    const [row] = deriveExportReadiness([
      {
        school: School.TRINITY,
        decided: 0,
        latestDecisionAt: null,
        lastExportedAt: days(-1),
      },
    ]);
    expect(row.allExported).toBe(false);
  });

  it("passes through every school row", () => {
    const rows = deriveExportReadiness([
      {
        school: School.TRINITY,
        decided: 2,
        latestDecisionAt: days(-3),
        lastExportedAt: days(-1),
      },
      {
        school: School.WHITGIFT,
        decided: 4,
        latestDecisionAt: days(-1),
        lastExportedAt: null,
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.school)).toEqual([School.TRINITY, School.WHITGIFT]);
    expect(rows[0].allExported).toBe(true);
    expect(rows[1].allExported).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// computeOutcomesDelta
// ════════════════════════════════════════════════════════════════════════════

describe("computeOutcomesDelta", () => {
  it("up: current rate higher than prior → positive delta, direction up", () => {
    // current 7/(7+3)=70%, prior 58/(58+42)=58% → +12pp.
    const delta = computeOutcomesDelta(
      { qualifies: 7, doesNotQualify: 3 },
      { qualifies: 58, doesNotQualify: 42 },
      "2025/26",
    );
    expect(delta).not.toBeNull();
    expect(delta!.currentRatePct).toBe(70);
    expect(delta!.priorRatePct).toBe(58);
    expect(delta!.deltaPoints).toBe(12);
    expect(delta!.direction).toBe("up");
    expect(delta!.priorLabel).toBe("2025/26");
  });

  it("down: current rate lower than prior → negative delta, direction down", () => {
    // current 40%, prior 60% → −20pp.
    const delta = computeOutcomesDelta(
      { qualifies: 4, doesNotQualify: 6 },
      { qualifies: 6, doesNotQualify: 4 },
      "2024/25",
    );
    expect(delta!.deltaPoints).toBe(-20);
    expect(delta!.direction).toBe("down");
  });

  it("neutral: identical rates → zero delta, direction neutral", () => {
    const delta = computeOutcomesDelta(
      { qualifies: 5, doesNotQualify: 5 },
      { qualifies: 30, doesNotQualify: 30 },
      "2023/24",
    );
    expect(delta!.deltaPoints).toBe(0);
    expect(delta!.direction).toBe("neutral");
  });

  it("null when there is no prior round", () => {
    expect(
      computeOutcomesDelta({ qualifies: 5, doesNotQualify: 5 }, null, null),
    ).toBeNull();
    // prior present but no label is also treated as no prior.
    expect(
      computeOutcomesDelta(
        { qualifies: 5, doesNotQualify: 5 },
        { qualifies: 1, doesNotQualify: 1 },
        null,
      ),
    ).toBeNull();
  });

  it("null when the prior round has zero decisions", () => {
    expect(
      computeOutcomesDelta(
        { qualifies: 5, doesNotQualify: 5 },
        { qualifies: 0, doesNotQualify: 0 },
        "2025/26",
      ),
    ).toBeNull();
  });

  it("null when the current round has zero decisions", () => {
    expect(
      computeOutcomesDelta(
        { qualifies: 0, doesNotQualify: 0 },
        { qualifies: 5, doesNotQualify: 5 },
        "2025/26",
      ),
    ).toBeNull();
  });
});
