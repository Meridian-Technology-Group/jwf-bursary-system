/**
 * Epic 23 T6 — Export Section 1 (assessment workload): her columns, the
 * submission-status mapping (D-13), invitation-only rows, deadline resolution
 * (incl. a per-invitation Submit by), and her filters (% completion strictly
 * less than; whole-day date ranges).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/portal/draft-completion", () => ({ draftCompletion: vi.fn() }));

import { WORKLOAD_COLUMNS } from "../sections/workload-columns";
import {
  filterWorkloadRows,
  invitationApplicationType,
  latestOpenInvitations,
  mapWorkloadApplication,
  mapWorkloadInvitation,
  workloadClosing,
  parseWorkloadFilters,
  type WorkloadApplicationSource,
  type WorkloadInvitationSource,
  type WorkloadRound,
} from "../sections/workload";

const HER_HEADERS = [
  "Bursary Status",
  "To be submitted by",
  "Application Submission Date",
  "Submission Status",
  "% Completion",
  "Application Type",
  "Bursary reference",
  "Lead Applicant First name and Surname",
  "Lead applicant's email address",
  "Lead applicant's mobile number",
  "Bursary recipient's name ('Child')",
  "Bursary recipient's school",
  "Bursary recipient's school year",
  "Round",
  "Assessment status",
  "Bursary account",
  "Assessment Completion Date",
  "Closing date",
  "Close reason",
];

const round: WorkloadRound = {
  academicYear: "2027/28",
  closeDate: new Date("2028-04-14T00:00:00Z"),
  defaultSubmissionDeadlineNew: new Date("2027-01-31T00:00:00Z"),
  defaultSubmissionDeadlineRolling: new Date("2027-05-22T00:00:00Z"),
  windows: [],
};

function app(over: Partial<WorkloadApplicationSource> = {}): WorkloadApplicationSource {
  return {
    id: "app-1",
    reference: "TS-TEST01-SURNAME, Pupil",
    childName: "Pupil Surname",
    childFirstName: "Pupil",
    childLastName: "Surname",
    school: "TRINITY",
    entryYearGroup: "Y9",
    applicationType: "ROLLING_OVER",
    isReassessment: true,
    formStatus: "IN_PROGRESS",
    submittedAt: null,
    submissionDeadlineAt: null,
    leadApplicantId: "lead-1",
    leadApplicant: { firstName: "Pat", lastName: "Parent", email: "pat@example.test", phone: null },
    contact: { phone: "07700 900000" },
    bursaryAccount: { status: "ACTIVE" },
    assessment: null,
    ...over,
  };
}

function inv(over: Partial<WorkloadInvitationSource> = {}): WorkloadInvitationSource {
  return {
    id: "inv-1",
    email: "new@example.test",
    firstName: "New",
    lastName: "Family",
    childName: "Kid Family",
    childFirstName: "Kid",
    childLastName: "Family",
    school: "WHITGIFT",
    entryYearGroup: "Y7",
    situation: "NEW",
    submissionDeadlineAt: null,
    createdAt: new Date("2026-11-10T09:00:00Z"),
    contact: null,
    bursaryAccount: null,
    ...over,
  };
}

describe("Section 1 registry", () => {
  it("is her column list, in her order", () => {
    expect(WORKLOAD_COLUMNS.map((c) => c.header)).toEqual(HER_HEADERS);
  });
  it("keys are unique", () => {
    const keys = WORKLOAD_COLUMNS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("workloadClosing (Charlotte, 22 Oct 2026)", () => {
  const at = (iso: string) => new Date(iso);
  it("the staff close wins, with its reason", () => {
    expect(
      workloadClosing(
        app({
          closedAt: at("2026-10-22T13:44:58Z"),
          closeReason: { label: "Applicant missed deadline(s) & gave up" },
          assessment: { status: "CLOSED_ARCHIVED", completedAt: null, archivedAt: at("2026-10-22T13:14:52Z"), archiveCloseReason: { label: "Archived" } },
        }),
      ),
    ).toEqual({ closedAt: at("2026-10-22T13:44:58Z"), closeReason: "Applicant missed deadline(s) & gave up" });
  });
  it("then the bursary account's close", () => {
    expect(
      workloadClosing(app({ bursaryAccount: { status: "CLOSED", closedAt: at("2026-10-01T00:00:00Z"), closeReason: { label: "End of cycle" } } })),
    ).toEqual({ closedAt: at("2026-10-01T00:00:00Z"), closeReason: "End of cycle" });
  });
  it("then an archived assessment", () => {
    expect(
      workloadClosing(
        app({ bursaryAccount: null, assessment: { status: "CLOSED_ARCHIVED", completedAt: null, archivedAt: at("2026-10-02T00:00:00Z"), archiveCloseReason: { label: "Archived" } } }),
      ),
    ).toEqual({ closedAt: at("2026-10-02T00:00:00Z"), closeReason: "Archived" });
  });
  it("an erasure on request reads EOR, dated the erasure", () => {
    expect(
      workloadClosing(app({ bursaryAccount: null, retentionStage: "ANONYMISED", retentionStageAt: at("2026-10-22T13:30:48Z") })),
    ).toEqual({ closedAt: at("2026-10-22T13:30:48Z"), closeReason: "EOR – Erased on request" });
  });
  it("an open case has neither", () => {
    expect(workloadClosing(app())).toEqual({ closedAt: null, closeReason: "" });
    expect(mapWorkloadInvitation(inv(), round).record).toMatchObject({ closedAt: null, closeReason: "" });
  });
});

describe("mapWorkloadApplication", () => {
  it("a draft: Started, the parent's %, the round's rolling default as the deadline", () => {
    const r = mapWorkloadApplication(app(), round, 62.5);
    expect(r.status).toBe("Started");
    expect(r.record).toMatchObject({
      bursaryStatus: "Active",
      submissionStatus: "Started",
      completion: 62.5,
      applicationType: "Rolling-Over Application",
      leadName: "Pat Parent",
      leadEmail: "pat@example.test",
      leadMobile: "07700 900000", // contact phone when the profile has none
      childName: "Pupil Surname",
      childSchool: "Trinity",
      childSchoolYear: 9,
      round: "2027/28",
      assessmentStatus: "",
      bursaryAccount: "Active",
    });
    expect((r.record.toBeSubmittedBy as Date).toISOString().slice(0, 10)).toBe("2027-05-22");
  });

  it("D-13: CREATED / NOT_STARTED → Not yet started; FILLED_IN → Started; SUBMITTED → Submitted at 100%", () => {
    expect(mapWorkloadApplication(app({ formStatus: "CREATED" }), round, 0).status).toBe("Not yet started");
    expect(mapWorkloadApplication(app({ formStatus: "NOT_STARTED" }), round, 0).status).toBe("Not yet started");
    expect(mapWorkloadApplication(app({ formStatus: "FILLED_IN" }), round, 100).status).toBe("Started");
    const sub = mapWorkloadApplication(
      app({ formStatus: "SUBMITTED", submittedAt: new Date("2027-05-01T10:00:00Z"), assessment: { status: "PAUSED", completedAt: null } }),
      round,
      12,
    );
    expect(sub.record.submissionStatus).toBe("Submitted");
    expect(sub.record.completion).toBe(100);
    expect(sub.record.assessmentStatus).toBe("Paused");
  });

  it("a per-application Submit by (from the invitation) wins over the round default", () => {
    const own = new Date("2026-11-16T23:59:59Z");
    const r = mapWorkloadApplication(app({ applicationType: "NEW", submissionDeadlineAt: own }), round, 0);
    expect(r.dueBy).toEqual(own);
  });

  it("the profile phone wins; no account reads 'No account yet'", () => {
    const r = mapWorkloadApplication(
      app({ leadApplicant: { firstName: "Pat", lastName: null, email: "p@x", phone: " 0123 " }, bursaryAccount: null }),
      round,
      0,
    );
    expect(r.record.leadMobile).toBe("0123");
    expect(r.record.bursaryStatus).toBe("");
    expect(r.record.bursaryAccount).toBe("No account yet");
    expect(r.account).toBe("NONE");
  });
});

describe("invitation-only rows (D-13)", () => {
  it("Not yet started, 0%, the invitation's own Submit by when set", () => {
    const own = new Date("2026-11-16T23:59:59Z");
    const r = mapWorkloadInvitation(inv({ submissionDeadlineAt: own }), round);
    expect(r.record).toMatchObject({
      submissionStatus: "Not yet started",
      completion: 0,
      applicationType: "New Application",
      reference: "",
      leadName: "New Family",
      childName: "Kid Family",
      childSchool: "Whitgift",
      childSchoolYear: 7,
      bursaryAccount: "No account yet",
    });
    expect(r.dueBy).toEqual(own);
  });
  it("without one, the round default for its type", () => {
    const r = mapWorkloadInvitation(inv(), round);
    expect((r.dueBy as Date).toISOString().slice(0, 10)).toBe("2027-01-31");
    const ro = mapWorkloadInvitation(inv({ situation: "ROLLING_OVER", bursaryAccount: { status: "ACTIVE" } }), round);
    expect((ro.dueBy as Date).toISOString().slice(0, 10)).toBe("2027-05-22");
    expect(ro.record.bursaryStatus).toBe("Active");
  });
  it("situation → application type", () => {
    expect(invitationApplicationType("ROLLING_OVER")).toBe("ROLLING_OVER");
    expect(invitationApplicationType("INTERNAL")).toBe("NEW");
    expect(invitationApplicationType(null)).toBe("NEW");
  });
  it("keeps the latest re-send per child and drops children who already applied", () => {
    const a = inv({ id: "a", createdAt: new Date("2026-11-01") });
    const b = inv({ id: "b", createdAt: new Date("2026-11-05") });
    const other = inv({ id: "c", childName: "Other Child" });
    const applied = inv({ id: "d", email: "pat@example.test", childName: "Pupil Surname" });
    const kept = latestOpenInvitations([a, b, other, applied], [app()]);
    expect(kept.map((i) => i.id).sort()).toEqual(["b", "c"]);
  });
});

describe("her filters", () => {
  const rows = [
    mapWorkloadApplication(app({ id: "draft" }), round, 40),
    mapWorkloadApplication(app({ id: "half", applicationType: "NEW" }), round, 50),
    mapWorkloadApplication(app({ id: "sub", formStatus: "SUBMITTED", submittedAt: new Date("2027-05-10T12:00:00Z") }), round, 0),
    mapWorkloadInvitation(inv(), round),
  ];
  const parse = (q: string) => {
    const p = parseWorkloadFilters(new URLSearchParams(q));
    if (!p.ok) throw new Error(p.error);
    return p.filters;
  };
  const statuses = (q: string) => filterWorkloadRows(rows, parse(q)).map((r) => `${r.status}:${r.completion}`);

  it("no filters = every row", () => {
    expect(filterWorkloadRows(rows, parse(""))).toHaveLength(4);
  });
  it("% completion is strictly less than x", () => {
    expect(statuses("completionBelow=50")).toEqual(["Started:40", "Not yet started:0"]);
    expect(statuses("completionBelow=100")).toEqual(["Started:40", "Started:50", "Not yet started:0"]);
  });
  it("submission status, account and application type", () => {
    expect(statuses("submissionStatus=SUBMITTED")).toEqual(["Submitted:100"]);
    expect(statuses("submissionStatus=NOT_YET_STARTED")).toEqual(["Not yet started:0"]);
    expect(filterWorkloadRows(rows, parse("account=NONE"))).toHaveLength(1);
    expect(filterWorkloadRows(rows, parse("applicationType=NEW"))).toHaveLength(2);
  });
  it("date ranges are whole days, and a row with no date fails a date filter", () => {
    expect(statuses("submittedFrom=2027-05-10&submittedTo=2027-05-10")).toEqual(["Submitted:100"]);
    expect(filterWorkloadRows(rows, parse("dueFrom=2027-05-22&dueTo=2027-05-22"))).toHaveLength(2);
  });
  it("rejects bad input", () => {
    expect(parseWorkloadFilters(new URLSearchParams("completionBelow=120")).ok).toBe(false);
    expect(parseWorkloadFilters(new URLSearchParams("submissionStatus=DONE")).ok).toBe(false);
    expect(parseWorkloadFilters(new URLSearchParams("dueFrom=2027-06-01&dueTo=2027-05-01")).ok).toBe(false);
  });
});
