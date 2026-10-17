/**
 * Epic 23 T7 — a rejected form comes BACK with its answers and documents
 * (Charlotte, 16 Oct 2026, decision 4; D-16, D-17).
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn(async () => undefined) }));

import {
  canReturnForCorrection,
  defaultReturnSubmitBy,
  isReturnedForCorrection,
  parseReturnSubmitBy,
  returnApplicationForCorrection,
  type LatestRejection,
} from "../return-for-correction";
import { isSubmissionDeadlinePassed } from "@/lib/rounds/submission-deadline";
import { scheduleRowsForParent } from "@/lib/portal/parent-schedule";
import {
  emailTemplates,
  RESTART_REQUIRED_PREVIOUS_SEED,
  RESTART_REQUIRED_RETURN_SEED,
} from "../../../../prisma/seed-data/email-templates";

const NOW = new Date("2026-10-16T12:00:00Z");

describe("which forms can be returned", () => {
  it("only submitted forms before a final outcome", () => {
    for (const p of ["SUBMITTED", "NOT_STARTED", "PAUSED"] as const) expect(canReturnForCorrection(p)).toBe(true);
    for (const p of ["PRE_SUBMISSION", "COMPLETED", "QUALIFIES", "DOES_NOT_QUALIFY", "CLOSED"] as const) {
      expect(canReturnForCorrection(p)).toBe(false);
    }
  });
});

describe("the new submit-by date", () => {
  it("must be a real date after today (London), stored as the end of that day", () => {
    const r = parseReturnSubmitBy("2026-10-30", NOW);
    expect(r.ok && r.submitBy.toISOString()).toBe("2026-10-30T23:59:59.999Z");
    const bst = parseReturnSubmitBy("2027-05-22", NOW);
    expect(bst.ok && bst.submitBy.toISOString()).toBe("2027-05-22T22:59:59.999Z");
    expect(parseReturnSubmitBy("2026-10-16", NOW).ok).toBe(false); // today
    expect(parseReturnSubmitBy("2026-10-01", NOW).ok).toBe(false);
    expect(parseReturnSubmitBy("2026-02-31", NOW).ok).toBe(false);
    expect(parseReturnSubmitBy("", NOW).ok).toBe(false);
    expect(parseReturnSubmitBy("30/10/2026", NOW).ok).toBe(false);
  });
  it("is pre-filled with the later of the current deadline and today + 7", () => {
    expect(defaultReturnSubmitBy(new Date("2026-09-17T22:59:59Z"), NOW)).toBe("2026-10-23");
    expect(defaultReturnSubmitBy(new Date("2027-05-22T22:59:59Z"), NOW)).toBe("2027-05-22");
    expect(defaultReturnSubmitBy(null, NOW)).toBe("2026-10-23");
  });
});

const rejection = (over: Partial<LatestRejection> = {}): LatestRejection => ({
  rejectedAt: new Date("2026-10-16T09:00:00Z"),
  replacementApplicationId: "app-1",
  newSubmitBy: new Date("2026-10-30T23:59:59Z"),
  message: "  The P60 is for the wrong year.  ",
  ...over,
});

describe("rejected and back with the family (the list's Rejected badge)", () => {
  const app = { id: "app-1", formStatus: "IN_PROGRESS" as const, submittedAt: null };
  it("holds while the returned form has not been resubmitted", () => {
    expect(isReturnedForCorrection(app, rejection())).toBe(true);
  });
  it("goes once it is submitted again, or when the rejection was of another application", () => {
    expect(isReturnedForCorrection({ ...app, formStatus: "SUBMITTED", submittedAt: new Date("2026-10-20") }, rejection())).toBe(false);
    expect(isReturnedForCorrection(app, rejection({ replacementApplicationId: "other" }))).toBe(false);
    expect(isReturnedForCorrection(app, null)).toBe(false);
    // An old Reject-and-restart replacement draft submitted earlier and since re-opened elsewhere:
    expect(isReturnedForCorrection({ ...app, submittedAt: new Date("2026-10-17") }, rejection())).toBe(false);
  });
});

function fakeTx(scheduleRow: { id: string; status: string; applicationId: string | null } | null) {
  const calls: { op: string; args: unknown }[] = [];
  const rec = (op: string) => vi.fn(async (args: unknown) => {
    calls.push({ op, args });
    if (op === "rejection.create") return { id: "rej-1" };
    if (op === "schedule.findFirst") return scheduleRow;
    if (op === "assessment.findUnique") return { id: "as-1", status: "IN_PROGRESS" };
    return {};
  });
  const tx = {
    applicationRejection: { create: rec("rejection.create") },
    bursaryScheduleEntry: { findFirst: rec("schedule.findFirst"), update: rec("schedule.update") },
    application: { update: rec("application.update"), delete: rec("application.delete") },
    assessment: { findUnique: rec("assessment.findUnique"), update: rec("assessment.update") },
    document: { deleteMany: rec("document.deleteMany") },
    applicationSection: { deleteMany: rec("section.deleteMany"), updateMany: rec("section.updateMany") },
  };
  return { tx, calls };
}

const input = {
  application: {
    id: "app-1",
    reference: "TS-TEST01",
    roundId: "round-1",
    academicYear: "2027/28",
    leadApplicantId: "lead-1",
    bursaryAccountId: "acc-1",
    childName: "Pupil Surname",
    submittedAt: new Date("2027-05-01T10:00:00Z"),
    formStatus: "SUBMITTED" as const,
  },
  phase: "NOT_STARTED" as const,
  newSubmitBy: new Date("2027-06-05T22:59:59Z"),
  message: "Blurry bank statement",
  staffId: "staff-1",
};

describe("returnApplicationForCorrection (D-16)", () => {
  it("returns the SAME application: form back, date cleared, new Submit by, review reset, nothing deleted", async () => {
    const { tx, calls } = fakeTx({ id: "sch-1", status: "RECEIVED", applicationId: "app-1" });
    const r = await returnApplicationForCorrection(tx as never, input);
    expect(r).toEqual({ rejectionId: "rej-1", assessmentReset: true });

    const created = calls.find((c) => c.op === "rejection.create")!.args as { data: Record<string, unknown> };
    expect(created.data).toMatchObject({
      replacementApplicationId: "app-1",
      submittedAt: input.application.submittedAt,
      message: "Blurry bank statement",
      newSubmitBy: input.newSubmitBy,
      fromPhase: "NOT_STARTED",
    });
    expect(calls.find((c) => c.op === "schedule.update")!.args).toEqual({
      where: { id: "sch-1" },
      data: { status: "SCHEDULED", receivedOn: null, applicationId: "app-1" },
    });
    expect(calls.find((c) => c.op === "application.update")!.args).toEqual({
      where: { id: "app-1" },
      data: { formStatus: "IN_PROGRESS", submittedAt: null, submissionDeadlineAt: input.newSubmitBy },
    });
    expect(calls.find((c) => c.op === "assessment.update")!.args).toMatchObject({
      data: { status: "NOT_STARTED", outcome: null, completedAt: null, pausedUntil: null },
    });
    for (const op of ["application.delete", "document.deleteMany", "section.deleteMany", "section.updateMany"]) {
      expect(calls.some((c) => c.op === op)).toBe(false);
    }
  });

  it("refuses a decided form or one not submitted", async () => {
    const { tx } = fakeTx(null);
    await expect(returnApplicationForCorrection(tx as never, { ...input, phase: "COMPLETED" })).rejects.toThrow();
    await expect(
      returnApplicationForCorrection(tx as never, { ...input, application: { ...input.application, formStatus: "IN_PROGRESS" } }),
    ).rejects.toThrow();
  });
});

describe("the deadline gate after a return", () => {
  const round = {
    closeDate: new Date("2028-04-14T00:00:00Z"),
    defaultSubmissionDeadlineNew: null,
    defaultSubmissionDeadlineRolling: new Date("2027-05-22T00:00:00Z"),
    windows: [],
  };
  const after = new Date("2027-05-28T12:00:00Z"); // past the original 22 May
  it("past the ORIGINAL deadline but before the NEW one, the form can be edited and resubmitted", () => {
    expect(isSubmissionDeadlinePassed({ submissionDeadlineAt: null, applicationType: "ROLLING_OVER" }, round, after)).toBe(true);
    expect(
      isSubmissionDeadlinePassed({ submissionDeadlineAt: input.newSubmitBy, applicationType: "ROLLING_OVER" }, round, after),
    ).toBe(false);
  });
});

describe("the parent's schedule after a return (Epic 22 P5)", () => {
  const entry = {
    scheduleYear: 2,
    academicYear: "2027-28",
    status: "SCHEDULED" as const,
    availableOn: new Date("2027-04-15T00:00:00Z"),
    requiredBy: new Date("2027-05-22T00:00:00Z"),
    receivedOn: null,
    applicationId: "app-1",
  };
  const base = {
    id: "app-1",
    childName: "Pupil Surname",
    bursaryAccountId: "acc-1",
    academicYear: "2027/28",
    migrationSource: null,
    applicationType: "ROLLING_OVER",
    submissionDeadlineAt: input.newSubmitBy,
    updatedAt: new Date("2027-05-20"),
  };
  const account = (app: Record<string, unknown>) => ({
    id: "acc-1",
    childName: "Pupil Surname",
    school: "TRINITY" as const,
    entryYearGroup: "Y8",
    entries: [entry],
    applications: [{ ...base, ...app } as never],
    rejections: [{ academicYear: "2027/28", submittedAt: input.application.submittedAt, rejectedAt: new Date("2027-05-10T09:00:00Z") }],
    completions: new Map([["app-1", 80]]),
  });
  it("while being corrected: Submitted → Rejected → In progress, against the new date", () => {
    const rows = scheduleRowsForParent(account({ formStatus: "IN_PROGRESS", submittedAt: null }), new Date("2027-05-15T12:00:00Z"));
    expect(rows.map((r) => r.status)).toEqual(["Submitted", "Rejected", "In progress"]);
    expect(rows[2].completion).toBe("80%");
    expect(rows[2].hasOwnDeadline).toBe(true);
  });
  it("once resubmitted: Submitted → Rejected → Submitted with the new date", () => {
    const again = new Date("2027-05-30T10:00:00Z");
    const rows = scheduleRowsForParent(account({ formStatus: "SUBMITTED", submittedAt: again }), new Date("2027-06-01T12:00:00Z"));
    expect(rows.map((r) => r.status)).toEqual(["Submitted", "Rejected", "Submitted"]);
    expect(rows[2].submissionDate).toEqual(again);
    expect(rows[0].submissionDate).toEqual(input.application.submittedAt);
  });
});

describe("the email (D-17)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../../../prisma/migrations/20261016170000_return_for_correction/migration.sql"),
    "utf8",
  );
  const seed = emailTemplates.find((t) => t.type === "APPLICATION_RESTART_REQUIRED")!;
  it("the migration only replaces the previous seed text (or our 16 Aug edit)", () => {
    expect(sql).toContain(`AND subject = $subject$${RESTART_REQUIRED_PREVIOUS_SEED.subject}$subject$`);
    expect(sql).toContain(`replace(body, E'\\r', '') = $seed$${RESTART_REQUIRED_PREVIOUS_SEED.body}$seed$`);
    expect(sql).toContain("OR replace(body, E'\\r', '') = $aug$");
  });
  it("wrote the 16 Oct returned-for-correction wording", () => {
    expect(sql).toContain(`SET subject = $subject$${RESTART_REQUIRED_RETURN_SEED.subject}$subject$`);
    expect(sql).toContain(`body = $body$${RESTART_REQUIRED_RETURN_SEED.body}$body$`);
  });
  it("the write-once trigger lets a date be cleared but never rewritten", () => {
    expect(sql).toMatch(/OLD\.submitted_at IS NOT NULL\s+AND NEW\.submitted_at IS NOT NULL\s+AND NEW\.submitted_at IS DISTINCT FROM OLD\.submitted_at/);
  });
});

describe("the Application Rejection template (17 Oct 2026)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../../../prisma/migrations/20261017120000_application_rejection_template/migration.sql"),
    "utf8",
  );
  const seed = emailTemplates.find((t) => t.type === "APPLICATION_RESTART_REQUIRED")!;
  it("replaces only the 16 Oct text, never an edit made in Settings", () => {
    expect(sql).toContain(`AND subject = $old$${RESTART_REQUIRED_RETURN_SEED.subject}$old$`);
    expect(sql).toContain(`replace(body, E'\\r', '') = $seed$${RESTART_REQUIRED_RETURN_SEED.body}$seed$`);
  });
  it("writes the seed module's wording: hers, with the numbered lines to fill in", () => {
    expect(sql).toContain(`SET subject = $subject$${seed.subject}$subject$`);
    expect(sql).toContain(`body = $body$${seed.body}$body$`);
    expect(seed.subject).toBe("JWF - We have had to reject your application ** PLEASE READ **");
    expect(seed.body).toContain("we have had to reject your bursary application");
    expect(seed.body).toContain("especially:\n1-\n2-");
    expect(seed.body).not.toContain("still there");
    // Her 17 Oct answers: title + surname, and the actual Submit-by date.
    expect(seed.body.startsWith("Dear {{greeting}}")).toBe(true);
    expect(seed.body).toContain("by {{deadline}}.");
    expect(seed.mergeFields).toContain("greeting");
  });
});
