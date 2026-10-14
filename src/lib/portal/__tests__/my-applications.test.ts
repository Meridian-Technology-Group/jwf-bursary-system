import { describe, it, expect } from "vitest";
import type { ScheduleHomeRow } from "@/lib/bursary-accounts/schedule-home";
import {
  applicationBlockActions,
  buildApplicationBlocks,
  canSubmitFromSections,
  formatLastLogin,
  openTarget,
  parseOpenTarget,
  FIRST_RECORDED_LOGIN,
  type BlockAccountInput,
  type BlockApplicationInput,
  type BlockInvitationInput,
  type DraftCompletion,
} from "../my-applications";
import {
  applicationCompletion,
  applicationCompletionFromGaps,
} from "../application-completion";

const TODAY = new Date("2026-10-14T12:00:00Z");

function row(
  academicYear: string,
  state: ScheduleHomeRow["state"],
  openingDate: Date | null
): ScheduleHomeRow {
  return {
    scheduleYear: 1,
    academicYear,
    schoolYear: null,
    openingDate,
    submissionDeadline: null,
    awardCommunicationDate: null,
    state,
    stateLabel: state.toUpperCase(),
    applicationId: null,
  };
}

function account(over: Partial<BlockAccountInput> = {}): BlockAccountInput {
  return {
    id: "acc-1",
    childName: "Alex Doe",
    school: "TRINITY",
    entries: [{ academicYear: "2026-27", status: "COMPLETE" }],
    rows: [row("2026-27", "submitted", null)],
    ...over,
  };
}

function app(over: Partial<BlockApplicationInput> = {}): BlockApplicationInput {
  return {
    id: "app-1",
    childName: "Alex Doe",
    school: "TRINITY",
    bursaryAccountId: null,
    roundId: "round-2026",
    roundStartYear: 2026,
    formStatus: "IN_PROGRESS",
    submittedAt: null,
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...over,
  };
}

function invite(over: Partial<BlockInvitationInput> = {}): BlockInvitationInput {
  return {
    id: "inv-1",
    childName: "Alex Doe",
    school: "TRINITY",
    bursaryAccountId: null,
    roundId: "round-2026",
    needsDetails: false,
    ...over,
  };
}

function build(params: {
  accounts?: BlockAccountInput[];
  applications?: BlockApplicationInput[];
  invitations?: BlockInvitationInput[];
  completions?: Map<string, DraftCompletion>;
}) {
  return buildApplicationBlocks({
    accounts: params.accounts ?? [],
    applications: params.applications ?? [],
    invitations: params.invitations ?? [],
    completions: params.completions ?? new Map(),
    today: TODAY,
  });
}

describe("buildApplicationBlocks (Epic 22 P1)", () => {
  it("gives two children two blocks: one draft, one not started", () => {
    const blocks = build({
      applications: [app()],
      invitations: [
        invite({ id: "inv-a", childName: "Alex Doe" }),
        invite({ id: "inv-b", childName: "Sam Doe" }),
      ],
      completions: new Map([["app-1", { percent: 60.5, canSubmit: false }]]),
    });
    expect(blocks.map((b) => [b.childName, b.state.kind])).toEqual([
      ["Alex Doe", "draft"],
      ["Sam Doe", "start"],
    ]);
    expect(blocks[0].state).toMatchObject({ percent: 60.5, canSubmit: false });
    expect(blocks[1].state).toMatchObject({ invitationId: "inv-b" });
  });

  it("matches a child's application and invitation by name, ignoring case and spaces", () => {
    const blocks = build({
      applications: [app({ childName: "alex  doe" })],
      invitations: [invite({ childName: "Alex Doe" })],
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].state.kind).toBe("draft");
  });

  it("shows a submitted application with its date", () => {
    const submittedAt = new Date("2026-10-10T09:00:00Z");
    const [block] = build({
      applications: [app({ formStatus: "SUBMITTED", submittedAt })],
    });
    expect(block.state).toEqual({
      kind: "submitted",
      applicationId: "app-1",
      submittedAt,
    });
  });

  it("migrated family (no application, year 1 COMPLETE): next year's opening date", () => {
    const opens = new Date("2027-04-15T00:00:00Z");
    const [block] = build({
      accounts: [
        account({
          entries: [
            { academicYear: "2026-27", status: "COMPLETE" },
            { academicYear: "2027-28", status: "SCHEDULED" },
          ],
          rows: [row("2026-27", "submitted", null), row("2027-28", "locked", opens)],
        }),
      ],
    });
    expect(block.state).toEqual({
      kind: "next-year",
      academicYear: "2027-28",
      opensOn: opens,
    });
  });

  it("migrated Year 13 account with no later year: the bursary runs to the end of 2026-27", () => {
    const [block] = build({ accounts: [account()] });
    expect(block.state).toEqual({ kind: "ended", lastAcademicYear: "2026-27" });
  });

  it("an open year with no invitation yet waits for the invitation", () => {
    const [block] = build({
      accounts: [
        account({
          rows: [
            row("2026-27", "submitted", null),
            row("2027-28", "start", new Date("2026-10-01T00:00:00Z")),
          ],
        }),
      ],
    });
    expect(block.state).toEqual({
      kind: "awaiting-invitation",
      academicYear: "2027-28",
    });
  });

  it("a re-assessment invitation on the account offers Start", () => {
    const [block] = build({
      accounts: [account()],
      invitations: [
        invite({ bursaryAccountId: "acc-1", roundId: "round-2027", childName: null }),
      ],
    });
    expect(block.state).toEqual({
      kind: "start",
      invitationId: "inv-1",
      needsDetails: false,
    });
  });

  it("a used invitation (an application exists in its round) no longer offers Start", () => {
    const [block] = build({
      applications: [app({ formStatus: "SUBMITTED", submittedAt: TODAY })],
      invitations: [invite()],
    });
    expect(block.state.kind).toBe("submitted");
  });

  it("a submitted rolling-over year stays 'submitted' until the office completes it", () => {
    const base = {
      accounts: [
        account({
          entries: [
            { academicYear: "2026-27", status: "COMPLETE" as const },
            { academicYear: "2027-28", status: "RECEIVED" as const },
          ],
          rows: [
            row("2026-27", "submitted", null),
            row("2027-28", "submitted", null),
            row("2028-29", "locked", new Date("2028-04-15T00:00:00Z")),
          ],
        }),
      ],
      applications: [
        app({
          bursaryAccountId: "acc-1",
          roundStartYear: 2027,
          roundId: "round-2027",
          formStatus: "SUBMITTED",
          submittedAt: TODAY,
        }),
      ],
    };
    expect(build(base)[0].state.kind).toBe("submitted");

    base.accounts[0] = {
      ...base.accounts[0],
      entries: [
        { academicYear: "2026-27", status: "COMPLETE" },
        { academicYear: "2027-28", status: "COMPLETE" },
      ],
    };
    expect(build(base)[0].state).toMatchObject({
      kind: "next-year",
      academicYear: "2028-29",
    });
  });

  it("a draft restarted after a rejection is a 0% draft", () => {
    const [block] = build({
      applications: [app({ formStatus: "CREATED" })],
      completions: new Map([["app-1", { percent: 0, canSubmit: false }]]),
    });
    expect(block.state).toMatchObject({ kind: "draft", percent: 0 });
  });

  it("the newest round wins when a child has applications in two years", () => {
    const [block] = build({
      accounts: [account()],
      applications: [
        app({ id: "old", bursaryAccountId: "acc-1", formStatus: "SUBMITTED" }),
        app({
          id: "new",
          bursaryAccountId: "acc-1",
          roundStartYear: 2027,
          roundId: "round-2027",
          updatedAt: new Date("2026-09-01T00:00:00Z"),
        }),
      ],
    });
    expect(block.state).toMatchObject({ kind: "draft", applicationId: "new" });
  });

  it("a bare first-year invitation already used from the chooser is not a second child", () => {
    const blocks = build({
      applications: [app({ childName: "Typed Name" })],
      invitations: [invite({ childName: null, needsDetails: true })],
    });
    expect(blocks).toHaveLength(1);
  });
});

describe("applicationBlockActions — her four options", () => {
  it("start: only Start is enabled, posting the invitation", () => {
    const actions = applicationBlockActions({
      kind: "start",
      invitationId: "inv-1",
      needsDetails: false,
    });
    expect(actions.map((a) => [a.key, a.enabled])).toEqual([
      ["start", true],
      ["continue", false],
      ["review", false],
      ["submit", false],
    ]);
    expect(actions[0]).toMatchObject({ invitationId: "inv-1", href: null });
  });

  it("start without the details the form needs goes to the home page's chooser", () => {
    const [start] = applicationBlockActions({
      kind: "start",
      invitationId: "inv-1",
      needsDetails: true,
    });
    expect(start).toMatchObject({ href: "/#start-application", invitationId: null });
  });

  it("draft with gaps: continue + review deep-link, submit disabled with the reason", () => {
    const actions = applicationBlockActions({
      kind: "draft",
      applicationId: "app-1",
      percent: 40,
      canSubmit: false,
    });
    expect(actions.map((a) => [a.key, a.enabled, a.href])).toEqual([
      ["start", false, null],
      ["continue", true, "/apply/open/app-1?to=continue"],
      ["review", true, "/apply/open/app-1?to=review"],
      ["submit", false, null],
    ]);
    expect(actions[3].hint).toMatch(/Complete the sections/);
  });

  it("draft ready to submit: submit goes to the end of the form", () => {
    const actions = applicationBlockActions({
      kind: "draft",
      applicationId: "app-1",
      percent: 100,
      canSubmit: true,
    });
    expect(actions[3]).toMatchObject({
      enabled: true,
      href: "/apply/open/app-1?to=submit",
    });
  });

  it("submitted and between-round blocks have no options", () => {
    expect(
      applicationBlockActions({
        kind: "submitted",
        applicationId: "a",
        submittedAt: null,
      })
    ).toEqual([]);
    expect(
      applicationBlockActions({ kind: "ended", lastAcademicYear: null })
    ).toEqual([]);
  });
});

describe("openTarget (/apply/open/[id]?to=…)", () => {
  const sections = [
    { slug: "child-details", status: "complete" as const },
    { slug: "parent-details", status: "needs_attention" as const },
    { slug: "review", status: "needs_attention" as const, isSynthetic: true },
    { slug: "declaration", status: "not_started" as const },
  ];

  it("whitelists the target", () => {
    expect(parseOpenTarget("continue")).toBe("continue");
    expect(parseOpenTarget("https://evil.example")).toBeNull();
    expect(parseOpenTarget(null)).toBeNull();
  });

  it("continue → the first section without a green tick", () => {
    expect(openTarget("continue", "IN_PROGRESS", sections)).toBe(
      "/apply/parent-details"
    );
  });

  it("review → the validation section; submit → the Declaration", () => {
    expect(openTarget("review", "IN_PROGRESS", sections)).toBe("/apply/review");
    expect(openTarget("submit", "IN_PROGRESS", sections)).toBe(
      "/apply/declaration"
    );
  });

  it("no target → the start of the form; submitted → status, whatever was asked", () => {
    expect(openTarget(null, "CREATED", sections)).toBe("/apply/child-details");
    expect(openTarget("continue", "SUBMITTED", sections)).toBe("/status");
  });
});

describe("canSubmitFromSections", () => {
  it("needs every section but the Declaration ticked", () => {
    const ticked = [
      { slug: "child-details", status: "complete" as const },
      { slug: "review", status: "complete" as const, isSynthetic: true },
      { slug: "declaration", status: "not_started" as const },
    ];
    expect(canSubmitFromSections(ticked)).toBe(true);
    expect(
      canSubmitFromSections([
        ...ticked,
        { slug: "parents-income", status: "needs_attention" as const },
      ])
    ).toBe(false);
  });
});

describe("formatLastLogin (D-5)", () => {
  it("prints London time in her format", () => {
    // 21:26 UTC on 11 Oct is 22:26 BST.
    expect(formatLastLogin(new Date("2026-10-11T21:26:00Z"))).toBe(
      "11 October 2026, 22:26"
    );
  });

  it("says so when there is no earlier recorded sign-in", () => {
    expect(formatLastLogin(null)).toBe(FIRST_RECORDED_LOGIN);
  });
});

describe("applicationCompletion (D-4)", () => {
  it("sums items across sections, leaving out the synthetic Review", () => {
    expect(
      applicationCompletion([
        { progressSatisfied: 3, progressTotal: 4 },
        { progressSatisfied: 1, progressTotal: 4 },
        { progressSatisfied: 0, progressTotal: 1, isSynthetic: true },
      ])
    ).toBe(50);
  });

  it("is 0 with nothing to count and never above 100", () => {
    expect(applicationCompletion([])).toBe(0);
    expect(
      applicationCompletion([{ progressSatisfied: 5, progressTotal: 4 }])
    ).toBe(100);
  });

  it("rounds to one decimal place, like the rail", () => {
    expect(
      applicationCompletion([{ progressSatisfied: 1, progressTotal: 3 }])
    ).toBe(33.3);
  });

  it("leaves Family Identification out of a rolling-over application", () => {
    const gaps = [
      {
        sectionType: "CHILD_DETAILS" as const,
        isStarted: true,
        isDbComplete: true,
        gaps: [],
        isFullyValid: true,
        progress: { satisfied: 1, total: 1 },
      },
      {
        sectionType: "FAMILY_ID" as const,
        isStarted: false,
        isDbComplete: false,
        gaps: [],
        isFullyValid: false,
        progress: { satisfied: 0, total: 3 },
      },
    ];
    const rolling = applicationCompletionFromGaps(gaps, true);
    const fresh = applicationCompletionFromGaps(gaps, false);
    expect(rolling).toBeGreaterThan(fresh);
  });
});
